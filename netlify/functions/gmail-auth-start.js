// Redirect the user to Google's OAuth consent screen.
// We include the Supabase user_id inside "state" so we know whose
// account to upsert after the callback.

exports.handler = async (event) => {
  try {
    const { GOOGLE_CLIENT_ID, GOOGLE_REDIRECT_URI } = process.env;
    if (!GOOGLE_CLIENT_ID || !GOOGLE_REDIRECT_URI) {
      return { statusCode: 500, body: "Missing GOOGLE_CLIENT_ID/GOOGLE_REDIRECT_URI" };
    }

    const uid = event.queryStringParameters?.uid || ""; // <- passed from client
    const state = Buffer.from(
      JSON.stringify({ uid, nonce: cryptoSafeUUID() })
    ).toString("base64url");

    const scopes = [
      "https://www.googleapis.com/auth/gmail.readonly",
      "https://www.googleapis.com/auth/userinfo.email",
      "https://www.googleapis.com/auth/userinfo.profile",
      "openid",
    ].join(" ");

    const params = new URLSearchParams({
      access_type: "offline",
      prompt: "consent",
      response_type: "code",
      client_id: GOOGLE_CLIENT_ID,
      redirect_uri: GOOGLE_REDIRECT_URI,
      scope: scopes,
      state,
    });

    return {
      statusCode: 302,
      headers: { Location: `https://accounts.google.com/o/oauth2/v2/auth?${params}` },
    };
  } catch (e) {
    return { statusCode: 500, body: String(e.message || e) };
  }
};

/** RFC4122-ish UUID for state nonce (no crypto import needed in Node 18+) */
function cryptoSafeUUID() {
  const rnd = () => Math.random().toString(16).slice(2, 10);
  return `${rnd()}-${rnd()}-${rnd()}-${rnd()}`;
}
