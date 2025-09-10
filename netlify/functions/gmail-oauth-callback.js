// Exchange the code for tokens, fetch the user's email, and upsert an
// account row keyed by (user_id, provider, email_address).

const { createClient } = require("@supabase/supabase-js");

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY, // SERVICE ROLE (server-only)
  { auth: { persistSession: false } }
);

exports.handler = async (event) => {
  try {
    const url = new URL(event.rawUrl);
    const code = url.searchParams.get("code");
    const stateRaw = url.searchParams.get("state");
    if (!code || !stateRaw) {
      return { statusCode: 400, body: JSON.stringify({ error: "Missing code/state" }) };
    }

    let uid = "";
    try {
      const parsed = JSON.parse(Buffer.from(stateRaw, "base64url").toString("utf8"));
      uid = parsed?.uid || "";
    } catch (_e) {}
    if (!uid) return { statusCode: 400, body: JSON.stringify({ error: "Missing uid in state" }) };

    // ---- exchange code for tokens
    const tokenRes = await fetch("https://oauth2.googleapis.com/token", {
      method: "POST",
      headers: { "content-type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        code,
        grant_type: "authorization_code",
        redirect_uri: process.env.GOOGLE_REDIRECT_URI,
        client_id: process.env.GOOGLE_CLIENT_ID,
        client_secret: process.env.GOOGLE_CLIENT_SECRET,
      }),
    });
    const tokenJson = await tokenRes.json();
    if (!tokenRes.ok) throw new Error(tokenJson.error || "Token exchange failed");

    const { access_token, refresh_token, expires_in, scope } = tokenJson;
    const expires_at = new Date(Date.now() + (expires_in || 0) * 1000).toISOString();

    // ---- get profile email
    const profRes = await fetch("https://www.googleapis.com/oauth2/v2/userinfo", {
      headers: { Authorization: `Bearer ${access_token}` },
    });
    const profile = await profRes.json();
    if (!profRes.ok) throw new Error("Profile fetch failed");
    const email = profile.email;

    // ---- handle Gmail account connection
    // Check if user already has a Gmail account
    const { data: existingGmail, error: checkError } = await supabase
      .from("email_accounts")
      .select("id, email_address")
      .eq("user_id", uid)
      .eq("provider", "gmail")
      .single();
    
    if (checkError && checkError.code !== "PGRST116") {
      throw checkError;
    }
    
    const accountData = {
      user_id: uid,
      provider: "gmail",
      email_address: email,
      access_token,
      refresh_token: refresh_token || null,
      token_scope: scope || null,
      expires_at,
      updated_at: new Date().toISOString(),
    };
    
    let error;
    if (existingGmail) {
      // User already has a Gmail account - update it with new email/tokens
      const { error: updateError } = await supabase
        .from("email_accounts")
        .update(accountData)
        .eq("id", existingGmail.id);
      error = updateError;
    } else {
      // User doesn't have a Gmail account - insert new one
      const { error: insertError } = await supabase
        .from("email_accounts")
        .insert(accountData);
      error = insertError;
    }
    if (error) throw error;

    // Back to app
    return { statusCode: 302, headers: { Location: "/emails?connected=1" } };
  } catch (e) {
    return { statusCode: 500, body: JSON.stringify({ error: String(e.message || e) }) };
  }
};
