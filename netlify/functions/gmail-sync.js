// netlify/functions/gmail-sync.js
const { google } = require("googleapis");
const { createClient } = require("@supabase/supabase-js");

function json(status, body) {
  return {
    statusCode: status,
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  };
}

exports.handler = async (event) => {
  try {
    // --- 1) AuthN: get user from Supabase using the bearer token sent by the client
    const auth = event.headers.authorization || event.headers.Authorization || "";
    const token = auth.startsWith("Bearer ") ? auth.slice(7) : null;
    if (!token) return json(401, { error: "Missing Authorization bearer token" });

    const supabase = createClient(
      process.env.SUPABASE_URL,
      process.env.SUPABASE_SERVICE_ROLE_KEY
    );

    const { data: userData, error: userErr } = await supabase.auth.getUser(token);
    if (userErr || !userData?.user) return json(401, { error: "Invalid session" });
    const userId = userData.user.id;

    // --- 2) Load the connected Gmail account for this user
    const { data: accounts, error: acctErr } = await supabase
      .from("email_accounts")
      .select("*")
      .eq("user_id", userId)
      .eq("provider", "gmail")
      .order("updated_at", { ascending: false })
      .limit(1);

    if (acctErr) throw acctErr;
    const acct = accounts?.[0];
    if (!acct) return json(400, { error: "No Gmail account connected" });

    // --- 3) Prepare OAuth2 client, refresh token if needed, persist new access token
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

    // Ensure we have a fresh access token
    const at = await oauth2.getAccessToken(); // returns { token }
    if (at?.token && at.token !== acct.access_token) {
      await supabase
        .from("email_accounts")
        .update({
          access_token: at.token,
          // access tokens are ~1h; store conservative expiry
          expires_at: new Date(Date.now() + 55 * 60 * 1000).toISOString(),
        })
        .eq("id", acct.id);
    }

    // --- 4) Call Gmail to prove everything works (list recent messages)
    const gmail = google.gmail({ version: "v1", auth: oauth2 });

    const list = await gmail.users.messages.list({
      userId: "me",
      maxResults: 25,
      // crude search that finds typical commerce emails
      q: "newer_than:30d (order OR shipped OR confirmation)",
    });

    const ids = list.data.messages?.map((m) => m.id) ?? [];

    // (Parsing & inserting into email_orders/email_shipments comes next;
    // for now return a success so you don't see 500.)
    return json(200, { imported: ids.length });
  } catch (err) {
    console.error("gmail-sync error:", err);
    return json(500, { error: err.message || String(err) });
  }
};
