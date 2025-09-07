// netlify/functions/gmail-oauth-callback.js
import { google } from "googleapis";
import { createClient } from "@supabase/supabase-js";

export const handler = async (event) => {
  try {
    const url = new URL(event.rawUrl);
    const code = url.searchParams.get("code");
    const stateB64 = url.searchParams.get("state");
    if (!code || !stateB64) return { statusCode: 400, body: "Missing code/state" };

    const state = JSON.parse(Buffer.from(stateB64, "base64").toString("utf8"));
    const { uid, redirectTo } = state || {};
    if (!uid) return { statusCode: 400, body: "Missing uid" };

    const {
      GOOGLE_CLIENT_ID,
      GOOGLE_CLIENT_SECRET,
      GOOGLE_REDIRECT_URI,
      SUPABASE_URL,
      SUPABASE_SERVICE_ROLE_KEY
    } = process.env;

    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
      auth: { persistSession: false }
    });

    const oauth2Client = new google.auth.OAuth2(
      GOOGLE_CLIENT_ID,
      GOOGLE_CLIENT_SECRET,
      GOOGLE_REDIRECT_URI
    );

    const { tokens } = await oauth2Client.getToken(code);
    oauth2Client.setCredentials(tokens);

    // Get user email from profile
    const oauth2 = google.oauth2({ version: "v2", auth: oauth2Client });
    const me = await oauth2.userinfo.get();
    const email = me?.data?.email || null;

    // Persist (upsert) the account
    const now = new Date().toISOString();
    const refresh_token = tokens.refresh_token; // critical
    const access_token = tokens.access_token || null;
    const token_expires_at = tokens.expiry_date ? new Date(tokens.expiry_date).toISOString() : null;

    if (!refresh_token) {
      // If user had previously consented, Google may not return refresh_token again.
      // Keep existing refresh_token if present.
      // Nothing else to do — redirect back gracefully.
    }

    await supabase
      .from("email_accounts")
      .upsert(
        {
          user_id: uid,
          provider: "gmail",
          email_address: email,
          refresh_token: refresh_token || undefined, // don't overwrite with null
          access_token,
          token_expires_at,
          updated_at: now
        },
        { onConflict: "user_id" }
      );

    return {
      statusCode: 302,
      headers: { Location: redirectTo || "/emails" }
    };
  } catch (e) {
    return { statusCode: 500, body: String(e.message || e) };
  }
};
