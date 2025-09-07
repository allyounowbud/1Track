// netlify/functions/gmail-sync.js
import { google } from "googleapis";
import { createClient } from "@supabase/supabase-js";

const {
  SUPABASE_URL,
  SUPABASE_SERVICE_ROLE_KEY,
  GOOGLE_CLIENT_ID,
  GOOGLE_CLIENT_SECRET,
  GOOGLE_REDIRECT_URI,
} = process.env;

const j = (status, body) =>
  new Response(JSON.stringify(body, null, 2), {
    status,
    headers: { "content-type": "application/json" },
  });

export default async (req) => {
  const url = new URL(req.url);
  const debug = url.searchParams.get("debug") === "1";
  let stage = "start";

  try {
    // ---- sanity: envs
    stage = "check-env";
    if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY)
      return j(500, { stage, error: "Missing Supabase env" });
    if (!GOOGLE_CLIENT_ID || !GOOGLE_CLIENT_SECRET || !GOOGLE_REDIRECT_URI)
      return j(500, { stage, error: "Missing Google OAuth env" });

    // ---- supabase admin
    stage = "supabase-admin";
    const admin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
      auth: { persistSession: false },
    });

    // ensure raw table exists (idempotent)
    stage = "ensure-email-raw";
    await admin.rpc("noop").catch(() => {}); // harmless poke to wake pool
    await admin
      .from("email_raw")
      .select("id")
      .limit(1)
      .then(async (res) => {
        if (res.error && /relation .* does not exist/i.test(res.error.message || "")) {
          await admin.from("email_raw").upsert([]); // will still fail if table absent
        }
      })
      .catch(() => {}); // ignore; just best-effort

    // ---- get an account
    stage = "select-account";
    const { data: rows, error: selErr } = await admin
      .from("email_accounts")
      .select("*")
      .eq("provider", "gmail")
      .order("updated_at", { ascending: false })
      .limit(1);

    if (selErr) return j(500, { stage, error: selErr.message || selErr });
    const acct = rows?.[0];
    if (!acct) return j(400, { stage, error: "No connected Gmail account found" });

    const refresh_token = acct.refresh_token;
    let access_token = acct.access_token;
    if (!refresh_token) return j(400, { stage, error: "Missing refresh_token; reconnect Gmail" });

    // normalize expires_at (timestamp or number seconds/ms) to ms
    stage = "normalize-expiry";
    let expiresAtMs = 0;
    if (acct.expires_at != null) {
      if (typeof acct.expires_at === "number") {
        expiresAtMs =
          acct.expires_at > 10_000_000_000
            ? acct.expires_at
            : acct.expires_at * 1000;
      } else {
        const parsed = Date.parse(acct.expires_at);
        expiresAtMs = Number.isFinite(parsed) ? parsed : 0;
      }
    }

    // ---- OAuth2 client
    stage = "oauth-client";
    const oauth2 = new google.auth.OAuth2(
      GOOGLE_CLIENT_ID,
      GOOGLE_CLIENT_SECRET,
      GOOGLE_REDIRECT_URI
    );

    // refresh if missing/expired/near-expiry
    stage = "maybe-refresh";
    const needsRefresh =
      !access_token || !expiresAtMs || expiresAtMs - Date.now() < 60_000;

    if (needsRefresh) {
      try {
        const { credentials } = await oauth2.refreshToken(refresh_token);
        access_token = credentials.access_token || access_token;
        const newExpiryIso = credentials.expiry_date
          ? new Date(credentials.expiry_date).toISOString()
          : new Date(Date.now() + 3_500_000).toISOString();

        const { error: updErr } = await admin
          .from("email_accounts")
          .update({
            access_token,
            expires_at: newExpiryIso, // <-- timestamp to match your schema
            updated_at: new Date().toISOString(),
          })
          .eq("id", acct.id);
        if (updErr) return j(500, { stage: "update-token", error: updErr.message || updErr });

        expiresAtMs = Date.parse(newExpiryIso) || 0;
      } catch (e) {
        return j(401, {
          stage: "refresh-token",
          error: e?.response?.data || e?.message || e,
          hint: "Ensure Gmail API is enabled in your Google Cloud project and the refresh token is valid.",
        });
      }
    }

    // ---- Gmail API client
    stage = "gmail-client";
    oauth2.setCredentials({ access_token, refresh_token });
    const gmail = google.gmail({ version: "v1", auth: oauth2 });

    // Minimal probe if debug (helps isolate Google-side issues)
    if (debug) {
      stage = "gmail-labels";
      const labels = await gmail.users.labels.list({ userId: "me" }).catch((e) => ({
        error: e?.response?.data || e?.message || e,
      }));
      if (labels?.error) return j(500, { stage, error: labels.error });
    }

    // ---- List a batch of likely-relevant messages
    stage = "list-messages";
    const { data: list } = await gmail.users.messages.list({
      userId: "me",
      q: "newer_than:30d (order OR shipped OR shipment OR tracking)",
      maxResults: 20,
    });

    const ids = list?.messages?.map((m) => m.id) || [];
    let fetched = 0;

    // ---- Upsert raw emails
    stage = "fetch-loop";
    for (const id of ids) {
      try {
        const { data: msg } = await gmail.users.messages.get({
          userId: "me",
          id,
          format: "full",
        });
        fetched++;

        const payload = {
          id: msg.id,
          account_id: acct.id,
          snippet: msg.snippet || null,
          internal_date: msg.internalDate
            ? new Date(Number(msg.internalDate)).toISOString()
            : new Date().toISOString(),
          raw: msg,
        };

        const { error: upErr } = await admin.from("email_raw").upsert(payload);
        if (upErr) return j(500, { stage: "upsert-email_raw", error: upErr.message || upErr });
      } catch (e) {
        // Continue other messages but capture in debug
        if (debug) console.error("message get error", id, e?.response?.data || e);
      }
    }

    return j(200, {
      ok: true,
      account: acct.email_address,
      scanned: ids.length,
      fetched,
      debug: debug ? { expiresAtMs, stage: "done" } : undefined,
    });
  } catch (err) {
    console.error("gmail-sync fatal:", stage, err);
    return j(500, { stage, error: err?.message || err });
  }
};
