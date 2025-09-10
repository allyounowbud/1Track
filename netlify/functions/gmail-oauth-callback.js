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

    // ---- handle Gmail account connection (support multiple Gmail accounts)
    // Check if this specific email is already connected
    const { data: existingEmail, error: checkError } = await supabase
      .from("email_accounts")
      .select("id, email_address")
      .eq("email_address", email)
      .single();
    
    if (checkError && checkError.code !== "PGRST116") {
      throw checkError;
    }
    
    const accountData = {
      user_id: uid,
      provider: `gmail_${email.replace(/[^a-zA-Z0-9]/g, '_')}`, // Make provider unique per email
      email_address: email,
      access_token,
      refresh_token: refresh_token || null,
      token_scope: scope || null,
      expires_at,
      updated_at: new Date().toISOString(),
    };
    
    let error;
    if (existingEmail) {
      // This email is already connected - update tokens
      const { error: updateError } = await supabase
        .from("email_accounts")
        .update(accountData)
        .eq("id", existingEmail.id);
      error = updateError;
    } else {
      // This is a new email - try to insert it
      // We'll use upsert with the correct constraint to allow multiple Gmail accounts
      const { error: upsertError } = await supabase
        .from("email_accounts")
        .upsert(
          accountData,
          // Use email_address as the unique constraint to allow multiple Gmail accounts per user
          { onConflict: "email_address" }
        );
      error = upsertError;
      
      // If the email_address constraint doesn't exist, try a different approach
      if (error && error.message.includes("no unique or exclusion constraint")) {
        // Try inserting without upsert - this might work if there's no email constraint
        const { error: insertError } = await supabase
          .from("email_accounts")
          .insert(accountData);
        error = insertError;
        
        // If we still get a constraint error, the user_id,provider constraint is blocking us
        if (error && error.message.includes("duplicate key value violates unique constraint")) {
          // The database constraint prevents multiple Gmail accounts per user
          // We'll need to update the existing account instead
          const { data: existingUserGmail, error: findError } = await supabase
            .from("email_accounts")
            .select("id")
            .eq("user_id", uid)
            .eq("provider", "gmail")
            .single();
          
          if (findError) throw findError;
          
          const { error: updateError } = await supabase
            .from("email_accounts")
            .update(accountData)
            .eq("id", existingUserGmail.id);
          error = updateError;
        }
      }
    }
    if (error) throw error;

    // Back to app
    return { statusCode: 302, headers: { Location: "/emails?connected=1" } };
  } catch (e) {
    return { statusCode: 500, body: JSON.stringify({ error: String(e.message || e) }) };
  }
};
