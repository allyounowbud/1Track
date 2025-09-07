// netlify/functions/gmail-sync.js
import { google } from "googleapis";
import { createClient } from "@supabase/supabase-js";

const json = (status, body) => ({
  statusCode: status,
  headers: { "content-type": "application/json" },
  body: JSON.stringify(body),
});

export const handler = async (event) => {
  try {
    // ---------- (A) Auth: get Supabase user from the bearer token ----------
    const auth = event.headers.authorization || event.headers.Authorization || "";
    const token = auth.startsWith("Bearer ") ? auth.slice(7) : null;
    if (!token) return json(401, { error: "Missing Authorization bearer token" });

    const SUPABASE_URL = process.env.SUPABASE_URL;
    const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
    if (!SUPABASE_URL || !SERVICE_KEY) {
      console.error("Missing Supabase envs");
      return json(500, { error: "Server not configured (Supabase envs missing)" });
    }

    const supabase = createClient(SUPABASE_URL, SERVICE_KEY);
    const { data: userData, error: userErr } = await supabase.auth.getUser(token);
    if (userErr || !userData?.user) {
      console.error("getUser failed", userErr);
      return json(401, { error: "Invalid session" });
    }
    const userId = userData.user.id;

    // ---------- (B) Load connected Gmail account for this user ----------
    const { data: accounts, error: acctErr } = await supabase
      .from("email_accounts")
      .select("*")
      .eq("user_id", userId)
      .eq("provider", "gmail")
      .order("updated_at", { ascending: false })
      .limit(1);

    if (acctErr) {
      console.error("email_accounts select error", acctErr);
      return json(500, { error: "DB error: email_accounts" });
    }
    const acct = accounts?.[0];
    if (!acct) return json(400, { error: "No Gmail account connected" });

    // ---------- (C) OAuth client + refresh access token if needed ----------
    const oauth2 = new google.auth.OAuth2(
      process.env.GOOGLE_CLIENT_ID,
      process.env.GOOGLE_CLIENT_SECRET,
      process.env.GOOGLE_REDIRECT_URI
    );

    oauth2.setCredentials({
      refresh_token: acct.refresh_token,
      access_token: acct.access_token || undefined,
      expiry_date: acct.expires_at ? new Date(acct.expires_at).getTime() : undefined,
      token_type: acct.token_type || "Bearer",
      scope: acct.scope || undefined,
    });

    let newAccess;
    try {
      const at = await oauth2.getAccessToken(); // { token }
      newAccess = at?.token;
    } catch (e) {
      console.error("getAccessToken failed", e);
      return json(401, { error: "Access token refresh failed (check refresh_token)" });
    }

    if (newAccess && newAccess !== acct.access_token) {
      const { error: updErr } = await supabase
        .from("email_accounts")
        .update({
          access_token: newAccess,
          expires_at: new Date(Date.now() + 55 * 60 * 1000).toISOString(),
        })
        .eq("id", acct.id);
      if (updErr) console.error("email_accounts update error", updErr);
    }

    // ---------- (D) Simple Gmail call to verify pipeline ----------
    const gmail = google.gmail({ version: "v1", auth: oauth2 });
    const list = await gmail.users.messages.list({
      userId: "me",
      maxResults: 25,
      q: "newer_than:30d (order OR shipped OR confirmation)",
    });

    const ids = list.data.messages?.map((m) => m.id) ?? [];
    // TODO: fetch each message, parse, and upsert into email_orders / email_shipments

    return json(200, { imported: ids.length });
  } catch (err) {
    console.error("gmail-sync crash:", err);
    return json(500, { error: err?.message || String(err) });
  }
};
