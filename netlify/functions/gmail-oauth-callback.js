// Netlify function: handles Google redirect, exchanges code, stores tokens in Supabase
import { createClient } from "@supabase/supabase-js";

function parseCookies(header = "") {
  return Object.fromEntries(
    header.split(/;\s*/).map((p) => {
      const i = p.indexOf("=");
      return i === -1 ? [p, ""] : [p.slice(0, i), decodeURIComponent(p.slice(i + 1))];
    })
  );
}

export const handler = async (event) => {
  try {
    const qs = new URLSearchParams(event.rawQuery || "");
    const code = qs.get("code");
    const state = qs.get("state");

    const cookies = parseCookies(event.headers.cookie || "");
    const expected = cookies["gmail_oauth_state"];

    if (!code || !state || !expected || state !== expected) {
      return {
        statusCode: 400,
        body: "Missing code/state",
        headers: {
          // clear the cookie if present
          "Set-Cookie": "gmail_oauth_state=; Path=/; Max-Age=0; HttpOnly; SameSite=Lax; Secure",
        },
      };
    }

    const {
      GOOGLE_CLIENT_ID,
      GOOGLE_CLIENT_SECRET,
      GOOGLE_REDIRECT_URI,
      SUPABASE_URL,
      SUPABASE_SERVICE_ROLE_KEY,
    } = process.env;

    if (!GOOGLE_CLIENT_ID || !GOOGLE_CLIENT_SECRET || !GOOGLE_REDIRECT_URI) {
      throw new Error("Missing Google env vars");
    }
    if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
      throw new Error("Missing Supabase env vars");
    }

    // exchange code for tokens
    const tokenRes = await fetch("https://oauth2.googleapis.com/token", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        code,
        client_id: GOOGLE_CLIENT_ID,
        client_secret: GOOGLE_CLIENT_SECRET,
        redirect_uri: GOOGLE_REDIRECT_URI,
        grant_type: "authorization_code",
      }),
    });

    const tokenJson = await tokenRes.json();
    if (!tokenRes.ok) {
      throw new Error(tokenJson.error_description || tokenJson.error || "Token exchange failed");
    }

    const { access_token, refresh_token, expires_in, id_token } = tokenJson;
    const expires_at = new Date(Date.now() + (expires_in || 3600) * 1000).toISOString();

    // fetch user info (email)
    const uiRes = await fetch("https://www.googleapis.com/oauth2/v2/userinfo", {
      headers: { Authorization: `Bearer ${access_token}` },
    });
    const userInfo = await uiRes.json();
    const email = userInfo?.email || null;

    // store in Supabase (service role)
    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
    const { error } = await supabase.from("email_accounts").upsert(
      {
        provider: "gmail",
        email_address: email,
        access_token,
        refresh_token: refresh_token || null,
        expires_at,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "provider" }
    );
    if (error) throw error;

    // clear the state cookie
    const clearCookie = "gmail_oauth_state=; Path=/; Max-Age=0; HttpOnly; SameSite=Lax; Secure";

    // bounce back to the UI with a success flag
    return {
      statusCode: 302,
      headers: {
        Location: "/emails?connected=1",
        "Set-Cookie": clearCookie,
      },
    };
  } catch (e) {
    return {
      statusCode: 302,
      headers: {
        Location: `/emails?error=${encodeURIComponent(e.message || String(e))}`,
        "Set-Cookie": "gmail_oauth_state=; Path=/; Max-Age=0; HttpOnly; SameSite=Lax; Secure",
      },
    };
  }
};
