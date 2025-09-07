// netlify/functions/gmail-sync.js
import { google } from "googleapis";
import { createClient } from "@supabase/supabase-js";

const supabase = createClient(process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

// Utility: auth for the current user (reads the stored Gmail tokens tied to Supabase auth.user())
async function getUserAndGmail(oauthTokensRow) {
  // You likely already store tokens in a table like email_accounts
  // Expected row fields: access_token, refresh_token, expiry_date, email_address, user_id
  const oAuth2Client = new google.auth.OAuth2(
    process.env.GOOGLE_CLIENT_ID,
    process.env.GOOGLE_CLIENT_SECRET,
    process.env.GMAIL_REDIRECT_URI
  );
  oAuth2Client.setCredentials({
    access_token: oauthTokensRow.access_token,
    refresh_token: oauthTokensRow.refresh_token,
    expiry_date: oauthTokensRow.expiry_date,
  });
  return { userId: oauthTokensRow.user_id, acctEmail: oauthTokensRow.email_address, gmail: google.gmail({ version: "v1", auth: oAuth2Client }) };
}

// ---- Classification & parsing core ---------------------------------------

const CANCELED_WORDS = /\b(cancel(?:led|ed|ation)|order\s+cancel)/i;
const SHIPPED_WORDS  = /\b(shipped|shipping\s+update|your\s+order\s+has\s+shipped|on\s+the\s+way)\b/i;
const OUT_FOR_DELIVERY_WORDS = /\bout\s+for\s+delivery\b/i;
const DELIVERED_WORDS = /\b(delivered|delivery\s+complete|arrived)\b/i;
const ORDER_CONFIRM_WORDS = /\b(order\s+confirmation|thanks\s+for\s+your\s+order|we\s+received\s+your\s+order)\b/i;

// extract first tracking (fallback generic carriers)
const TRACKING_RE = /\b(1Z[0-9A-Z]{16}|9\d{15,22}|\d{12,22})\b/g; // UPS 1Z..., USPS 20-22 digits, FedEx 12-22
const UPS_HINT = /\bUPS\b/i;
const USPS_HINT = /\bUSPS|Postal Service\b/i;
const FEDEX_HINT = /\bFedEx\b/i;

// Retailer-specific hooks (fill out as you go)
const retailerParsers = [
  // Example: Target
  {
    name: "Target",
    match: ({from, subject}) => /@target\.com$/.test(from) || /\bTarget\b/.test(subject),
    parse: ({html, text, subject}) => {
      const orderId = (text.match(/Order\s+#\s*([A-Z0-9-]+)/i) || [])[1] || (subject.match(/Order\s+#\s*([A-Z0-9-]+)/i) || [])[1];
      const total = (text.match(/\$([\d,]+\.\d{2})\s*(total|order total)/i) || [])[1];
      return { retailer: "Target", order_id: orderId, total_cents: total ? Math.round(parseFloat(total.replace(/,/g, ""))*100) : undefined };
    }
  },
  // Example: Amazon
  {
    name: "Amazon",
    match: ({from, subject}) => /@amazon\.com$/.test(from) || /\bAmazon\b/.test(subject),
    parse: ({text, subject}) => {
      const orderId = (text.match(/Order\s+#\s*([0-9\-]+)/i) || [])[1] || (subject.match(/#\s*([0-9\-]+)/) || [])[1];
      return { retailer: "Amazon", order_id: orderId };
    }
  }
];

function classify({ from, subject, text, html }) {
  const s = subject || "";
  const t = text || "";
  if (CANCELED_WORDS.test(s) || CANCELED_WORDS.test(t)) return "canceled";
  if (DELIVERED_WORDS.test(s) || DELIVERED_WORDS.test(t)) return "delivered";
  if (OUT_FOR_DELIVERY_WORDS.test(s) || OUT_FOR_DELIVERY_WORDS.test(t)) return "out_for_delivery";
  if (SHIPPED_WORDS.test(s) || SHIPPED_WORDS.test(t)) return "shipping";
  if (ORDER_CONFIRM_WORDS.test(s) || ORDER_CONFIRM_WORDS.test(t)) return "order";
  return "other";
}

function detectRetailer(payload) {
  const from = payload.from || "";
  const subject = payload.subject || "";
  for (const r of retailerParsers) {
    if (r.match({from, subject})) return r;
  }
  return null;
}

function parseMessage(payload) {
  const { subject, text, html } = payload;
  const cls = classify(payload);
  const hook = detectRetailer(payload);

  let retailer, order_id, total_cents;
  if (hook) {
    const out = hook.parse({ subject, text, html }) || {};
    retailer = out.retailer || hook.name;
    order_id = out.order_id || undefined;
    total_cents = out.total_cents;
  }

  // generic order id fallback
  if (!order_id) {
    const m = (text || subject || "").match(/\b(Order|PO)\s*#?\s*([A-Z0-9\-]{4,})/i);
    if (m) order_id = m[2];
  }

  // tracking & carrier heuristic
  const trackings = new Set();
  const combined = `${text || ""}\n${html || ""}`;
  const tr = combined.match(TRACKING_RE) || [];
  tr.slice(0, 5).forEach(x => trackings.add(x));
  let carrier = UPS_HINT.test(combined) ? "UPS" : (USPS_HINT.test(combined) ? "USPS" : (FEDEX_HINT.test(combined) ? "FedEx" : null));

  return {
    classification: cls,
    retailer,
    order_id,
    total_cents,
    trackings: Array.from(trackings),
    carrier
  };
}

// --- Gmail helpers ---------------------------------------------------------
function header(h, name) {
  const row = (h || []).find(x => x.name?.toLowerCase() === name.toLowerCase());
  return row?.value || null;
}

function decodeBody(part) {
  if (!part || !part.body?.data) return "";
  const b64 = part.body.data.replace(/-/g, "+").replace(/_/g, "/");
  try { return Buffer.from(b64, "base64").toString("utf8"); } catch { return ""; }
}

function flattenParts(parts, acc = { text: "", html: "" }) {
  if (!parts) return acc;
  for (const p of parts) {
    if (p.mimeType === "text/plain") acc.text += "\n" + decodeBody(p);
    if (p.mimeType === "text/html") acc.html += "\n" + decodeBody(p);
    if (p.parts) flattenParts(p.parts, acc);
  }
  return acc;
}

// --- Upsert helpers --------------------------------------------------------
async function upsertOrder(userId, retailer, order_id, fields) {
  if (!retailer || !order_id) return null;
  const { data, error } = await supabase
    .from("email_orders")
    .upsert([{ user_id: userId, retailer, order_id, ...fields }], { onConflict: "user_id,retailer,order_id" })
    .select("id, status, shipped_at, delivered_at, canceled_at")
    .single();
  if (error) throw error;
  return data;
}

async function upsertShipment(userId, retailer, order_id, tracking_number, fields) {
  if (!tracking_number) return null;
  const row = { user_id: userId, retailer: retailer || "—", order_id: order_id || null, tracking_number, ...fields };
  const { data, error } = await supabase
    .from("email_shipments")
    .upsert([row], { onConflict: "user_id,tracking_number" })
    .select("id, order_id, status, shipped_at, delivered_at")
    .single();
  if (error) throw error;
  return data;
}

function mergeStatus(cur, incoming) {
  const rank = v => ({ canceled: 5, delivered: 4, out_for_delivery: 3, in_transit: 2, ordered: 1 })[v] || 0;
  return rank(incoming) > rank(cur || "") ? incoming : cur;
}

// --- Preview collector -----------------------------------------------------
function makeProposedOrder(parse, messageTs) {
  // minimal Order Book payload
  return {
    retailer: parse.retailer || "Unknown",
    order_id: parse.order_id || "Unknown",
    order_date: new Date(messageTs).toISOString(),
    total_cents: parse.total_cents || 0
  };
}

// --- handler ---------------------------------------------------------------
export const handler = async (event, context) => {
  try {
    const mode = (event.queryStringParameters?.mode || "sync").toLowerCase(); // "sync" | "preview" | "commit"
    const { data: acctRow, error: acctErr } = await supabase
      .from("email_accounts")
      .select("*")
      .order("updated_at", { ascending: false })
      .limit(1)
      .single();
    if (acctErr || !acctRow) return resp(400, { error: "No connected Gmail account." });

    const { userId, acctEmail, gmail } = await getUserAndGmail(acctRow);

    // Search query: restrict to likely commerce emails; tailor as needed
    const query = [
      'category:updates OR category:promotions OR in:inbox',
      '(order OR shipped OR delivery OR delivered OR tracking OR cancel)',
      '-from:noreply@github.com'
    ].join(' ');

    // Fetch message ids first
    const list = await gmail.users.messages.list({
      userId: "me",
      q: query,
      maxResults: 200
    });
    const ids = (list.data.messages || []).map(m => m.id);

    // Pull existing to short-circuit
    const { data: seen } = await supabase
      .from("email_messages")
      .select("gmail_message_id")
      .in("gmail_message_id", ids);
    const seenSet = new Set((seen || []).map(x => x.gmail_message_id));

    let imported = 0, updated = 0, skipped = 0;
    const proposedNewOrders = [];

    for (const id of ids) {
      if (seenSet.has(id)) { skipped++; continue; }

      const full = await gmail.users.messages.get({ userId: "me", id, format: "full" });
      const msg = full.data;
      const h = msg.payload?.headers || [];
      const from = header(h, "From") || "";
      const subject = header(h, "Subject") || "";
      const { text, html } = flattenParts(msg.payload?.parts);
      const snippet = msg.snippet || "";
      const internalTs = new Date(Number(msg.internalDate || Date.now())).toISOString();
      const threadId = msg.threadId;

      // Parse & classify
      const parsed = parseMessage({ from, subject, text, html });
      const classification = parsed.classification;

      // Write message row (idempotent unique constraint)
      await supabase.from("email_messages").insert([{
        user_id: userId,
        gmail_message_id: id,
        gmail_thread_id: threadId,
        internal_ts: internalTs,
        from_addr: from,
        subject,
        snippet,
        body_text: text,
        body_html: html,
        classification,
        retailer: parsed.retailer || null,
        order_id: parsed.order_id || null,
        tracking_number: parsed.trackings?.[0] || null,
        carrier: parsed.carrier || null,
        parsed_json: parsed
      }]);

      // Build mutations in preview/commit modes only for order emails
      if ((mode === "preview" || mode === "commit") && classification === "order" && parsed.retailer && parsed.order_id) {
        proposedNewOrders.push(makeProposedOrder(parsed, internalTs));
      }

      // On sync/commit, actually upsert the normalized entities
      if (mode !== "preview") {
        // 1) ORDER
        if (parsed.retailer && parsed.order_id) {
          const base = { order_date: internalTs, total_cents: parsed.total_cents || undefined };
          const targetStatus =
            classification === "canceled" ? "canceled" :
            classification === "delivered" ? "delivered" :
            classification === "out_for_delivery" ? "out_for_delivery" :
            classification === "shipping" ? "in_transit" :
            "ordered";

          const stamps = {
            canceled_at: targetStatus === "canceled" ? internalTs : undefined,
            delivered_at: targetStatus === "delivered" ? internalTs : undefined,
            shipped_at:   targetStatus === "in_transit" || targetStatus === "out_for_delivery" ? internalTs : undefined
          };

          const cur = await upsertOrder(userId, parsed.retailer, parsed.order_id, { ...base, ...stamps });
          const finalStatus = mergeStatus(cur?.status, targetStatus);
          if (finalStatus && finalStatus !== cur?.status) {
            await supabase.from("email_orders")
              .update({ status: finalStatus, ...stamps })
              .eq("user_id", userId).eq("retailer", parsed.retailer).eq("order_id", parsed.order_id);
            updated++;
          } else {
            imported++;
          }
        }

        // 2) SHIPMENTS
        for (const tn of parsed.trackings || []) {
          await upsertShipment(userId, parsed.retailer, parsed.order_id, tn, {
            carrier: parsed.carrier || null,
            status:
              classification === "delivered" ? "delivered" :
              classification === "out_for_delivery" ? "out_for_delivery" :
              classification === "shipping" ? "in_transit" :
              "label_created",
            shipped_at: (classification === "shipping" || classification === "out_for_delivery") ? internalTs : null,
            delivered_at: (classification === "delivered") ? internalTs : null
          });
        }
      }
    }

    if (mode === "preview") {
      // return deduped only-new orders relative to email_orders
      const uniq = new Map();
      for (const p of proposedNewOrders) {
        const key = `${p.retailer}::${p.order_id}`;
        if (!uniq.has(key)) uniq.set(key, p);
      }
      const pending = Array.from(uniq.values());
      // remove those that already exist
      const existing = await supabase.from("email_orders")
        .select("retailer, order_id")
        .in("retailer", pending.map(x => x.retailer))
        .eq("user_id", (await supabase.auth.getUser()).data?.user?.id || ""); // when using service key, you may pass userId directly
      const existSet = new Set((existing.data || []).map(x => `${x.retailer}::${x.order_id}`));
      const onlyNew = pending.filter(x => !existSet.has(`${x.retailer}::${x.order_id}`));
      return resp(200, { mode, proposed: onlyNew });
    }

    if (mode === "commit") {
      // In your app, “commit” might also create rows in your separate Order Book table.
      // Here, we simply ensure email_orders exists (upsert already done above during commit run).
    }

    return resp(200, { imported, updated, skipped_existing: skipped });

  } catch (e) {
    console.error(e);
    return resp(500, { error: e.message || String(e) });
  }
};

function resp(code, body) {
  return { statusCode: code, headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) };
}
