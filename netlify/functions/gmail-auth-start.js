// netlify/functions/gmail-auth-start.js
import { google } from "googleapis";

export const handler = async (event) => {
  try {
    const url = new URL(event.rawUrl);
    const uid = url.searchParams.get("uid");          // required: Supabase user id
    const redirectTo = url.searchParams.get("redirect") || `${url.origin}/emails`;

    if (!uid) {
      return { statusCode: 400, body: "Missing uid" };
    }

    const {
      GOOGLE_CLIENT_ID,
      GOOGLE_CLIENT_SECRET,
      GOOGLE_REDIRECT_URI
    } = process.env;

    const oauth2Client = new google.auth.OAuth2(
      GOOGLE_CLIENT_ID,
      GOOGLE_CLIENT_SECRET,
      GOOGLE_REDIRECT_URI
    );

    const state = Buffer.from(JSON.stringify({ uid, redirectTo })).toString("base64");

    const scopes = [
      "https://www.googleapis.com/auth/gmail.readonly",
      "openid",
      "email"
    ];

    const authUrl = oauth2Client.generateAuthUrl({
      access_type: "offline",
      prompt: "consent", // ensures refresh_token on first consent
      scope: scopes,
      state
    });

    return {
      statusCode: 302,
      headers: { Location: authUrl }
    };
  } catch (e) {
    return { statusCode: 500, body: String(e.message || e) };
  }
};
