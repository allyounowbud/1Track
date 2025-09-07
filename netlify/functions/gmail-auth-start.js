// ESM is supported by Netlify Functions out of the box
import { google } from "googleapis";

export async function handler(event) {
  try {
    const {
      GOOGLE_CLIENT_ID,
      GOOGLE_CLIENT_SECRET,
      GOOGLE_REDIRECT_URI,
    } = process.env;

    // Fail loudly if env isn’t set so you’ll see a 500 with a clear message (instead of 502)
    const missing = [];
    if (!GOOGLE_CLIENT_ID) missing.push("GOOGLE_CLIENT_ID");
    if (!GOOGLE_CLIENT_SECRET) missing.push("GOOGLE_CLIENT_SECRET");
    if (!GOOGLE_REDIRECT_URI) missing.push("GOOGLE_REDIRECT_URI");
    if (missing.length) {
      console.error("Missing env:", missing.join(", "));
      return {
        statusCode: 500,
        body: `Server misconfigured: missing ${missing.join(", ")}`,
      };
    }

    const oauth2 = new google.auth.OAuth2(
      GOOGLE_CLIENT_ID,
      GOOGLE_CLIENT_SECRET,
      GOOGLE_REDIRECT_URI
    );

    const scope = [
      "https://www.googleapis.com/auth/gmail.readonly",
      "https://www.googleapis.com/auth/userinfo.email",
      "https://www.googleapis.com/auth/userinfo.profile",
      "openid",
    ];

    const url = oauth2.generateAuthUrl({
      access_type: "offline",      // get refresh_token
      prompt: "consent",           // always ask so we get refresh_token first time
      scope,
    });

    // If you call ?redirect=1 we 302 straight to Google, otherwise return JSON {url}
    const wantsRedirect = event.queryStringParameters?.redirect === "1";
    if (wantsRedirect) {
      return {
        statusCode: 302,
        headers: { Location: url },
        body: "",
      };
    }
    return {
      statusCode: 200,
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ url }),
    };
  } catch (err) {
    console.error("gmail-auth-start error:", err);
    return {
      statusCode: 500,
      body: `Internal error: ${err?.message || String(err)}`,
    };
  }
}