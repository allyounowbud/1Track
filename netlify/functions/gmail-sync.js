// netlify/functions/gmail-sync.js
import { google } from "googleapis";
import { createClient } from "@supabase/supabase-js";

const {
  SUPABASE_URL,
  SUPABASE_SERVICE_ROLE_KEY,
  GOOGLE_CLIENT_ID,
  GOOGLE_CLIENT_SECRET,
  GOOGLE_REDIRECT_URI, // must match what you set in Google console
} = process.env;

// Simple helper so we never return a raw 500 without context
const json = (status, body) => new Response(JSON.stringify(body), {
  status,
  headers: { "content-type": "application/json" },
});

export default async () => {
  try {
    // ---- sanity checks on env ----
    if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
      return json(500, { error: "Missing Supabase env (SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY)" });
    }
    if (!GOOGLE_CLIENT_ID || !GOOGLE_CLIENT_SECRET || !GOOGLE_REDIRECT_URI) {
      return json(500, { error: "Missing Google OAuth env (CLIENT_ID / CLIENT_SECRET / REDIRECT_URI)" });
    }

    const admin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } });

    // ---- fetch the most recent connected Gmail account ----
    const { data: acctRows, error: acctErr } = await admin
      .from("email_accounts")
      .select("*")
      .eq("provider", "gmail")
      .order("updated_at", { ascending: false })
      .limit(1);

    if (acctErr) {
      console.error("SB select email_accounts error:", acctErr);
      return json(500, { error: "Supabase select failed (email_accounts)" });
    }
    const acct = acctRows?.[0];
    if (!acct) return json(400, { error: "No connected Gmail account found" });

    const refresh_token = acct.refresh_token;
    let access_token = acct.access_token;
    let expires_at = acct.expires_at ? Number(acct.expires_at) : 0; // seconds since epoch

    if (!refresh_token) {
      return json(400, { error: "Account is missing refresh_token; re-connect Gmail" });
    }

    // ---- set up OAuth2 client ----
    const oauth2 = new google.auth.OAuth2(GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET, GOOGLE_REDIRECT_URI);

    // Refresh if token missing/expired or within 60s of expiry
    const nowSec = Math.floor(Date.now() / 1000);
    if (!access_token || !expires_at || expires_at - nowSec < 60) {
      try {
        const { credentials } = await oauth2.refreshToken(refresh_token);
        access_token = credentials.access_token;
        const newExpirySec =
          credentials.expiry_date ? Math.floor(credentials.expiry_date / 1000) : nowSec + 3500;

        // Persist refreshed token
        const { error: updErr } = await admin
          .from("email_accounts")
          .update({
            access_token,
            expires_at: newExpirySec,
            updated_at: new Date().toISOString(),
          })
          .eq("id", acct.id);

        if (updErr) console.error("SB update email_accounts error:", updErr);
        expires_at = newExpirySec;
      } catch (e) {
        console.error("Google refreshToken error:", e?.response?.data || e);
        return json(401, { error: "Failed to refresh Gmail token; re-connect Gmail" });
      }
    }

    oauth2.setCredentials({ access_token, refresh_token });
    const gmail = google.gmail({ version: "v1", auth: oauth2 });

    // ---- list recent messages (start small to avoid quota/timeouts) ----
    const { data: list } = await gmail.users.messages.list({
      userId: "me",
      // You can tune this query; this is intentionally broad while safe:
      q: "newer_than:30d (order OR shipped OR shipment OR tracking)",
      maxResults: 20,
    });

    const ids = list?.messages?.map((m) => m.id) || [];
    let fetched = 0;

    // Example parse stub: just fetch payloads; insert raw rows you can parse later
    // Ensure you created a table `email_raw` (id text pk, snippet text, internal_date timestamptz, raw jsonb)
    for (const id of ids) {
      try {
        const { data: msg } = await gmail.users.messages.get({
          userId: "me",
          id,
          format: "full",
        });
        fetched++;

        // Upsert raw (safe no-op if it exists)
        await admin.from("email_raw").upsert({
          id: msg.id,
          snippet: msg.snippet || null,
          internal_date: msg.internalDate
            ? new Date(Number(msg.internalDate)).toISOString()
            : new Date().toISOString(),
          raw: msg, // jsonb
          account_id: acct.id,
        });
      } catch (e) {
        // keep going; log individual failures
        console.error("Gmail fetch message error:", id, e?.response?.data || e);
      }
    }

    // Return counts so the UI never sees a bare 500
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
}
