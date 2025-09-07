// Netlify function: starts Google OAuth by returning a consent URL
export const handler = async () => {
  const {
    GOOGLE_CLIENT_ID,
    GOOGLE_REDIRECT_URI, // e.g. https://YOUR_SITE.netlify.app/.netlify/functions/gmail-oauth-callback
  } = process.env;

  if (!GOOGLE_CLIENT_ID || !GOOGLE_REDIRECT_URI) {
    return { statusCode: 500, body: JSON.stringify({ error: "Missing Google env vars" }) };
  }

  // CSRF state
  const state = crypto.randomUUID();
  const params = new URLSearchParams({
    client_id: GOOGLE_CLIENT_ID,
    redirect_uri: GOOGLE_REDIRECT_URI,
    response_type: "code",
    access_type: "offline",
    prompt: "consent",
    scope: [
      "https://www.googleapis.com/auth/gmail.readonly",
      "https://www.googleapis.com/auth/userinfo.email",
      "https://www.googleapis.com/auth/userinfo.profile",
      "openid",
    ].join(" "),
    state,
  });

  // set a short-lived, httpOnly cookie with the state
  const cookie = [
    `gmail_oauth_state=${state}`,
    "Path=/",
    "HttpOnly",
    "SameSite=Lax",
    "Max-Age=600",
    "Secure",
  ].join("; ");

  return {
    statusCode: 200,
    headers: { "Set-Cookie": cookie, "Content-Type": "application/json" },
    body: JSON.stringify({ url: `https://accounts.google.com/o/oauth2/v2/auth?${params}` }),
  };
};
