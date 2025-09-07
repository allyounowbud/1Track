// netlify/functions/gmail-sync.js
// Fully updated: scheduled auto-sync, preview/commit, tightened shipment creation,
// status precedence (includes 'canceled'), and robust parsing/classification.

import { google } from "googleapis";
import { createClient } from "@supabase/supabase-js";

/* ------------------------- Supabase (server) ------------------------- */
const supabase = createClient(
  process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

/* ------------------------- Gmail OAuth client ------------------------ */
function makeOAuth2Client(tokensRow) {
  const oAuth2Client = new google.auth.OAuth2(
    process.env.GOOGLE_CLIENT_ID,
    process.env.GOOGLE_CLIENT_SECRET,
    process.env.GMAIL_REDIRECT_URI
  );
  oAuth2Client.setCredentials({
    access_token: tokensRow.access_token,
    refresh_token: tokensRow.refresh_token,
    expiry_date: tokensRow.expiry_date ? Number(tokensRow.expiry_date) : undefined,
  });
  return oAuth2Client;
}

/* --------------------------- Helpers: HTTP --------------------------- */
function resp(code, body) {
  return {
    statusCode: code,
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  };
}

/* ---------------------- Classification & parsing --------------------- */
const CANCELED_WORDS = /\b(cancel(?:led|ed|ation)|order\s+cancel)/i;
const SHIPPED_WORDS  = /\b(shipped|shipping\s+update|your\s+order\s+has\s+shipped|on\s+the\s+way)\b/i;
const OUT_FOR_DELIVERY_WORDS = /\bout\s+for\s+delivery\b/i;
const DELIVERED_WORDS = /\b(delivered|delivery\s+complete|arrived)\b/i;
const ORDER_CONFIRM_WORDS = /\b(order\s+confirmation|thanks\s+for\s+your\s+order|we\s+received\s+your\s+order)\b/i;

// Generic tracking candidates
const TRACKING_RE = /\b(1Z[0-9A-Z]{16}|9\d{15,22}|\d{12,22})\b/g; // UPS + USPS + general FedEx-ish
const UPS_HINT  = /\bUPS\b/i;
const USPS_HINT = /\bUSPS|Postal Service\b/i;
const FEDEX_HINT = /\bFedEx\b/i;

function classify({ subject, text }) {
  const s = subject || "";
  const t = text || "";
  if (CANCELED_WORDS.test(s) || CANCELED_WORDS.test(t)) return "canceled";
  if (DELIVERED_WORDS.test(s) || DELIVERED_WORDS.test(t)) return "delivered";
  if (OUT_FOR_DELIVERY_WORDS.test(s) || OUT_FOR_DELIVERY_WORDS.test(t)) return "out_for_delivery";
  if (SHIPPED_WORDS.test(s) || SHIPPED_WORDS.test(t)) return "shipping";
  if (ORDER_CONFIRM_WORDS.test(s) || ORDER_CONFIRM_WORDS.test(t)) return "order";
  return "other";
}

const retailerParsers = [
  // Target (example)
  {
    name: "Target",
    match: ({ from, subject }) => /@target\.com/i.test(from || "") || /\bTarget\b/i.test(subject || ""),
    parse: ({ subject, text }) => {
      const orderId = (text?.match(/Order\s+#\s*([A-Z0-9-]+)/i) || [])[1]
        || (subject?.match(/Order\s+#\s*([A-Z0-9-]+)/i) || [])[1];
      const total = (text?.match(/\$([\d,]+\.\d{2})\s*(total|order total)/i) || [])[1];
      return {
        retailer: "Target",
        order_id: orderId,
        total_cents: total ? Math.round(parseFloat(total.replace(/,/g, "")) * 100) : undefined
      };
    }
  },
  // Amazon (example)
  {
    name: "Amazon",
    match: ({ from, subject }) => /@amazon\.com/i.test(from || "") || /\bAmazon\b/i.test(subject || ""),
    parse: ({ subject, text }) => {
      const orderId = (text?.match(/Order\s+#\s*([0-9\-]+)/i) || [])[1]
        || (subject?.match(/#\s*([0-9\-]+)/) || [])[1];
      return { retailer: "Amazon", order_id: orderId };
    }
  },
  // Add more retailers here as you encounter formats...
];

function detectRetailer(payload) {
  for (const r of retailerParsers) {
    if (r.match(payload)) return r;
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

  // Generic order id fallback
  if (!order_id) {
    const m = (text || subject || "").match(/\b(Order|PO)\s*#?\s*([A-Z0-9\-]{4,})/i);
    if (m) order_id = m[2];
  }

  // Tracking + carrier heuristics
  const trackings = new Set();
  const combined = `${text || ""}\n${html || ""}`;
  const tr = combined.match(TRACKING_RE) || [];
  tr.slice(0, 6).forEach(x => trackings.add(x));
  const carrier =
    UPS_HINT.test(combined) ? "UPS" :
    USPS_HINT.test(combined) ? "USPS" :
    FEDEX_HINT.test(combined) ? "FedEx" :
    null;

  return {
    classification: cls,
    retailer,
    order_id,
    total_cents,
    trackings: Array.from(trackings),
    carrier
  };
}

/* ------------------------- Gmail payload utils ----------------------- */
function header(h, name) {
  const row = (h || []).find(x => x.name?.toLowerCase() === name.toLowerCase());
  return row?.value || null;
}
function decodeBody(part) {
  if (!part?.body?.data) return "";
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

/* --------------------------- DB upsert utils ------------------------- */
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

function makeProposedOrder(parse, messageTs) {
  return {
    retailer: parse.retailer || "Unknown",
    order_id: parse.order_id || "Unknown",
    order_date: new Date(messageTs).toISOString(),
    total_cents: parse.total_cents || 0
  };
}

/* -------------------- Tighten shipment creation ---------------------- */
function isLikelyTracking(tn, carrierHint) {
  if (!tn) return false;
  const s = String(tn).trim();
  // UPS strict
  if (/^1Z[0-9A-Z]{16}$/i.test(s)) return true;
  // USPS common: 20–22 digits (allow when USPS or no hint)
  if (/^\d{20,22}$/.test(s)) return carrierHint === "USPS" || !carrierHint;
  // FedEx lengths (require hint to cut false positives)
  if (/^\d{12}$/.test(s) || /^\d{14}$/.test(s) || /^\d{15}$/.test(s) || /^\d{22}$/.test(s)) {
    return carrierHint === "FedEx";
  }
  return false;
}
function shouldMakeShipment(classification) {
  const c = (classification || "").toLowerCase();
  return c === "shipping" || c === "out_for_delivery" || c === "delivered";
}

/* ----------------------------- Handler ------------------------------- */
export const handler = async (event) => {
  try {
    const mode = (event.queryStringParameters?.mode || (event.httpMethod === "POST" ? "sync" : "preview")).toLowerCase();
    // Pull the newest/active email account (supports single-account per user app flow)
    const { data: acctRow, error: acctErr } = await supabase
      .from("email_accounts")
      .select("*")
      .order("updated_at", { ascending: false })
      .limit(1)
      .single();
    if (acctErr || !acctRow) return resp(400, { error: "No connected Gmail account." });

    const userId = acctRow.user_id;
    const oAuth2Client = makeOAuth2Client(acctRow);
    const gmail = google.gmail({ version: "v1", auth: oAuth2Client });

    // Keep query inclusive but commerce-focused
    const query = [
      'category:updates OR category:promotions OR in:inbox',
      '(order OR shipped OR delivery OR delivered OR tracking OR cancel)',
      '-from:noreply@github.com'
    ].join(' ');

    // 1) List candidate messages
    const list = await gmail.users.messages.list({
      userId: "me",
      q: query,
      maxResults: 200
    });
    const ids = (list.data.messages || []).map(m => m.id);

    // 2) Skip already ingested messages
    let seenSet = new Set();
    if (ids.length) {
      const { data: seen } = await supabase
        .from("email_messages")
        .select("gmail_message_id")
        .in("gmail_message_id", ids);
      seenSet = new Set((seen || []).map(x => x.gmail_message_id));
    }

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

      // 3) Persist raw message (idempotency & audit)
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

      // 4) PREVIEW: collect proposed order rows from order confirmations only
      if ((mode === "preview" || mode === "commit") && classification === "order" && parsed.retailer && parsed.order_id) {
        proposedNewOrders.push(makeProposedOrder(parsed, internalTs));
      }

      // 5) SYNC/COMMIT: upsert normalized entities
      if (mode !== "preview") {
        // ORDER upsert + status timestamps
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
            shipped_at: (targetStatus === "in_transit" || targetStatus === "out_for_delivery") ? internalTs : undefined
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

        // SHIPMENT upserts (tightened; only on shipping-type events, and only if likely tracking)
        if (shouldMakeShipment(classification)) {
          for (const tn of parsed.trackings || []) {
            if (!isLikelyTracking(tn, parsed.carrier)) continue;
            await upsertShipment(userId, parsed.retailer, parsed.order_id, tn, {
              carrier: parsed.carrier || null,
              status:
                classification === "delivered" ? "delivered" :
                classification === "out_for_delivery" ? "out_for_delivery" :
                "in_transit",
              shipped_at: (classification === "shipping" || classification === "out_for_delivery") ? internalTs : null,
              delivered_at: (classification === "delivered") ? internalTs : null
            });
          }
        }
      }
    }

    if (mode === "preview") {
      // Deduplicate proposed and drop ones already existing in email_orders
      const uniq = new Map();
      for (const p of proposedNewOrders) {
        const key = `${p.retailer}::${p.order_id}`;
        if (!uniq.has(key)) uniq.set(key, p);
      }
      const pending = Array.from(uniq.values());
      if (!pending.length) return resp(200, { mode, proposed: [] });

      // Fetch existing orders for this user+retailers; filter client-side by order_id pair
      const retailers = Array.from(new Set(pending.map(x => x.retailer)));
      const { data: existing, error: exErr } = await supabase
        .from("email_orders")
        .select("retailer, order_id")
        .eq("user_id", userId)
        .in("retailer", retailers);
      if (exErr) return resp(500, { error: exErr.message });

      const existSet = new Set((existing || []).map(x => `${x.retailer}::${x.order_id}`));
      const onlyNew = pending.filter(x => !existSet.has(`${x.retailer}::${x.order_id}`));
      return resp(200, { mode, proposed: onlyNew });
    }

    // For commit/sync, normal summary:
    return resp(200, { imported, updated, skipped_existing: skipped });

  } catch (e) {
    console.error(e);
    return resp(500, { error: e.message || String(e) });
  }
};

/* ------------------------ Netlify Scheduled Run ---------------------- */
/** Runs every 10 minutes automatically on Netlify, while the HTTP endpoint
 *  remains available for manual sync and for preview/commit flows. */
export const config = {
  schedule: "*/10 * * * *",
};
