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

const json = (status, body) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json" },
  });

export default async () => {
  try {
    if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY)
      return json(500, { error: "Missing Supabase env" });
    if (!GOOGLE_CLIENT_ID || !GOOGLE_CLIENT_SECRET || !GOOGLE_REDIRECT_URI)
      return json(500, { error: "Missing Google OAuth env" });

    const admin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
      auth: { persistSession: false },
    });

    // Get most recent connected Gmail account
    const { data: rows, error: acctErr } = await admin
      .from("email_accounts")
      .select("*")
      .eq("provider", "gmail")
      .order("updated_at", { ascending: false })
      .limit(1);
    if (acctErr) {
      console.error("email_accounts select error:", acctErr);
      return json(500, { error: "Supabase select failed (email_accounts)" });
    }
    const acct = rows?.[0];
    if (!acct) return json(400, { error: "No connected Gmail account found" });

    const refresh_token = acct.refresh_token;
    let access_token = acct.access_token;

    // expires_at may be timestamp or bigint; normalize to ms
    let expiresAtMs = 0;
    if (acct.expires_at != null) {
      if (typeof acct.expires_at === "number") {
        // seconds or ms
        expiresAtMs =
          acct.expires_at > 10_000_000_000
            ? acct.expires_at
            : acct.expires_at * 1000;
      } else {
        // timestamp string
        const parsed = Date.parse(acct.expires_at);
        expiresAtMs = Number.isFinite(parsed) ? parsed : 0;
      }
    }

    if (!refresh_token)
      return json(400, { error: "Missing refresh_token; please reconnect Gmail" });

    const oauth2 = new google.auth.OAuth2(
      GOOGLE_CLIENT_ID,
      GOOGLE_CLIENT_SECRET,
      GOOGLE_REDIRECT_URI
    );

    // Refresh if missing/expired/near expiry
    const needsRefresh =
      !access_token || !expiresAtMs || expiresAtMs - Date.now() < 60_000;

    if (needsRefresh) {
      try {
        const { credentials } = await oauth2.refreshToken(refresh_token);
        access_token = credentials.access_token || access_token;

        // Write ISO timestamp to match your schema
        const newExpiryIso = credentials.expiry_date
          ? new Date(credentials.expiry_date).toISOString()
          : new Date(Date.now() + 3_500_000).toISOString();

        const { error: updErr } = await admin
          .from("email_accounts")
          .update({
            access_token,
            expires_at: newExpiryIso,
            updated_at: new Date().toISOString(),
          })
          .eq("id", acct.id);
        if (updErr) console.error("email_accounts update error:", updErr);

        expiresAtMs = Date.parse(newExpiryIso) || 0;
      } catch (e) {
        console.error("refreshToken error:", e?.response?.data || e);
        return json(401, { error: "Failed to refresh Gmail token; reconnect Gmail" });
      }
    }

    oauth2.setCredentials({ access_token, refresh_token });
    const gmail = google.gmail({ version: "v1", auth: oauth2 });

    // List & fetch a small batch (tune later)
    const { data: list } = await gmail.users.messages.list({
      userId: "me",
      q: "newer_than:30d (order OR shipped OR shipment OR tracking)",
      maxResults: 20,
    });

    const ids = list?.messages?.map((m) => m.id) || [];
    let fetched = 0;

    for (const id of ids) {
      try {
        const { data: msg } = await gmail.users.messages.get({
          userId: "me",
          id,
          format: "full",
        });
        fetched++;

        await admin.from("email_raw").upsert({
          id: msg.id,
          account_id: acct.id,
          snippet: msg.snippet || null,
          internal_date: msg.internalDate
            ? new Date(Number(msg.internalDate)).toISOString()
            : new Date().toISOString(),
          raw: msg,
        });
      } catch (e) {
        console.error("message get error:", id, e?.response?.data || e);
      }
    }

    return json(200, {
      ok: true,
      account: acct.email_address,
      scanned: ids.length,
      fetched,
    });
  } catch (err) {
    console.error("gmail-sync top-level error:", err);
    return json(500, { error: "Internal error in gmail-sync (see function logs)" });
  }
};
