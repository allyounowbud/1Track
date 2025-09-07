// netlify/functions/gmail-sync.js
import { google } from "googleapis";
import { createClient } from "@supabase/supabase-js";

function guessRetailer(from) {
  if (!from) return null;
  const s = from.toLowerCase();
  if (s.includes("amazon")) return "Amazon";
  if (s.includes("bestbuy")) return "Best Buy";
  if (s.includes("target")) return "Target";
  if (s.includes("walmart")) return "Walmart";
  return null;
}

export const handler = async (event) => {
  try {
    if (event.httpMethod !== "POST") {
      return { statusCode: 405, body: "POST only" };
    }
    const url = new URL(event.rawUrl);
    const uid = url.searchParams.get("uid");
    if (!uid) return { statusCode: 400, body: "Missing uid" };

    const {
      SUPABASE_URL,
      SUPABASE_SERVICE_ROLE_KEY,
      GOOGLE_CLIENT_ID,
      GOOGLE_CLIENT_SECRET,
      GOOGLE_REDIRECT_URI
    } = process.env;

    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
      auth: { persistSession: false }
    });

    // Load Gmail account for this user
    const { data: accts, error: acctErr } = await supabase
      .from("email_accounts")
      .select("*")
      .eq("user_id", uid)
      .limit(1);
    if (acctErr) throw acctErr;
    const acct = accts?.[0];
    if (!acct?.refresh_token) {
      return { statusCode: 400, body: "No Gmail connected" };
    }

    // OAuth
    const oauth2Client = new google.auth.OAuth2(
      GOOGLE_CLIENT_ID,
      GOOGLE_CLIENT_SECRET,
      GOOGLE_REDIRECT_URI
    );
    oauth2Client.setCredentials({ refresh_token: acct.refresh_token });

    const gmail = google.gmail({ version: "v1", auth: oauth2Client });

    // Pull last 30 days of "order / shipped" style mails
    const q = 'newer_than:30d (subject:order OR subject:shipped OR subject:shipment OR "your order")';
    const list = await gmail.users.messages.list({ userId: "me", q, maxResults: 50 });

    let imported = 0;

    for (const m of list.data.messages || []) {
      // Get full message
      const full = await gmail.users.messages.get({ userId: "me", id: m.id, format: "metadata", metadataHeaders: ["From","Subject","Date"] });

      const headers = Object.fromEntries(
        (full.data.payload?.headers || []).map(h => [h.name.toLowerCase(), h.value])
      );
      const from = headers["from"] || "";
      const subject = headers["subject"] || "";
      const dateStr = headers["date"] || null;
      const internal = full.data.internalDate ? new Date(Number(full.data.internalDate)).toISOString() : null;

      // Naive extraction
      const retailer = guessRetailer(from) || null;
      const orderIdMatch = subject.match(/(?:order|#)\s*[:#\s-]*([A-Z0-9-]{5,})/i);
      const order_id = orderIdMatch ? orderIdMatch[1] : null;

      const isShipment = /(shipped|shipment|your package)/i.test(subject);
      const isOrder    = /(order|confirmation)/i.test(subject) && !isShipment;

      if (isOrder) {
        await supabase.from("email_orders").insert({
          user_id: uid,
          retailer,
          order_id,
          order_date: dateStr ? new Date(dateStr).toISOString().slice(0,10) : internal?.slice(0,10) || null,
          total_cents: 0,
          raw_message_id: m.id
        });
        imported++;
      } else if (isShipment) {
        await supabase.from("email_shipments").insert({
          user_id: uid,
          retailer,
          order_id,
          carrier: null,
          tracking_number: null,
          status: "in_transit",
          shipped_at: internal,
          delivered_at: null,
          raw_message_id: m.id
        });
        imported++;
      }
    }

    return {
      statusCode: 200,
      body: JSON.stringify({ imported })
    };
  } catch (e) {
    return { statusCode: 500, body: JSON.stringify({ error: String(e.message || e) }) };
  }
};
