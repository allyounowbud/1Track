import { google } from "googleapis";
import { createClient } from "@supabase/supabase-js";

const { SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET, GOOGLE_REDIRECT_URI } = process.env;

const respond = (status, body) =>
  new Response(JSON.stringify(body, null, 2), { status, headers: { "content-type": "application/json" } });

export default async () => {
  let stage = "start";
  try {
    stage = "env";
    if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) return respond(500, { stage, error: "Missing Supabase env" });
    if (!GOOGLE_CLIENT_ID || !GOOGLE_CLIENT_SECRET || !GOOGLE_REDIRECT_URI) return respond(500, { stage, error: "Missing Google env" });

    stage = "supabase";
    const admin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } });

    stage = "select-account";
    const { data, error } = await admin.from("email_accounts").select("*").eq("provider", "gmail").order("updated_at", { ascending: false }).limit(1);
    if (error) return respond(500, { stage, error: error.message || error });
    const acct = data?.[0];
    if (!acct) return respond(400, { stage, error: "No Gmail account connected" });

    stage = "oauth";
    const oauth2 = new google.auth.OAuth2(GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET, GOOGLE_REDIRECT_URI);
    oauth2.setCredentials({ access_token: acct.access_token, refresh_token: acct.refresh_token });

    stage = "labels";
    const gmail = google.gmail({ version: "v1", auth: oauth2 });
    const labels = await gmail.users.labels.list({ userId: "me" });

    return respond(200, { ok: true, stage: "done", account: acct.email_address, labelCount: labels?.data?.labels?.length ?? 0 });
  } catch (e) {
    return respond(500, { stage, error: e?.response?.data || e?.message || String(e) });
  }
};
