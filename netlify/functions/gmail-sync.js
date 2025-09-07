// netlify/functions/gmail-sync.js
// Complete: auto-scheduled, order lifecycle updates, preview/commit flow,
// stricter shipment creation, item/qty/price parsing, tracking URLs.

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
const ok = (body) => ({ statusCode: 200, headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
const err = (code, body) => ({ statusCode: code, headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });

/* ---------------------- Classification & parsing --------------------- */
const CANCELED_WORDS = /\b(cancel(?:led|ed|ation)|order\s+cancel)/i;
const SHIPPED_WORDS  = /\b(shipped|shipping\s+update|your\s+order\s+has\s+shipped|on\s+the\s+way)\b/i;
const OUT_FOR_DELIVERY_WORDS = /\bout\s+for\s+delivery\b/i;
const DELIVERED_WORDS = /\b(delivered|delivery\s+complete|arrived)\b/i;
const ORDER_CONFIRM_WORDS = /\b(order\s+confirmation|thanks\s+for\s+your\s+order|we\s+received\s+your\s+order)\b/i;

const TRACKING_RE = /\b(1Z[0-9A-Z]{16}|9\d{15,22}|\d{12,22})\b/g; // UPS + USPS + common FedEx-ish
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

/* ---------------------- Retailer hooks (extensible) ------------------ */
const retailerParsers = [
  {
    name: "Target",
    match: ({ from, subject }) => /@target\.com/i.test(from || "") || /\bTarget\b/i.test(subject || ""),
    parse: ({ subject, text }) => {
      const orderId = (text?.match(/Order\s+#\s*([A-Z0-9-]+)/i) || [])[1]
        || (subject?.match(/Order\s+#\s*([A-Z0-9-]+)/i) || [])[1];
      const item = (text?.match(/Item\s*:\s*(.+)/i) || [])[1];
      const qty = Number((text?.match(/\bQty(?:\.|:)?\s*(\d{1,3})\b/i) || [])[1] || 1);
      const price = (text?.match(/\$([\d,]+\.\d{2})\s*(each|price)/i) || [])[1] || (text?.match(/Total\s*\$([\d,]+\.\d{2})/i) || [])[1];
      return {
        retailer: "Target",
        order_id: orderId,
        item_name: item,
        quantity: Number.isFinite(qty) ? qty : 1,
        unit_price_cents: price ? Math.round(parseFloat(String(price).replace(/,/g, "")) * 100) : undefined
      };
    }
  },
  {
    name: "Amazon",
    match: ({ from, subject }) => /@amazon\.com/i.test(from || "") || /\bAmazon\b/i.test(subject || ""),
    parse: ({ subject, text, html }) => {
      const orderId = (text?.match(/Order\s+#\s*([0-9\-]+)/i) || [])[1]
        || (subject?.match(/#\s*([0-9\-]+)/) || [])[1];
      const item = (text?.match(/(?:Item|Items ordered)\s*:\s*(.+)/i) || [])[1];
      const qty = Number((text?.match(/\bQty(?:\.|:)?\s*(\d{1,3})\b/i) || [])[1] || 1);
      const price = (text?.match(/\$([\d,]+\.\d{2})\s*(each|price)/i) || [])[1];
      return {
        retailer: "Amazon",
        order_id: orderId,
        item_name: item,
        quantity: Number.isFinite(qty) ? qty : 1,
        unit_price_cents: price ? Math.round(parseFloat(String(price).replace(/,/g, "")) * 100) : undefined
      };
    }
  },
  // Add more retailers as needed...
];

/* ----------------------- Generic parse fallbacks ---------------------- */
function detectRetailer(payload) {
  for (const r of retailerParsers) if (r.match(payload)) return r;
  return null;
}

function parseMessage(payload) {
  const { subject, text, html } = payload;
  const cls = classify(payload);
  const hook = detectRetailer(payload);

  let retailer, order_id, item_name, quantity, unit_price_cents, total_cents;

  if (hook) {
    const out = hook.parse({ subject, text, html }) || {};
    retailer = out.retailer || hook.name;
    order_id = out.order_id || order_id;
    item_name = out.item_name || item_name;
    quantity = out.quantity || quantity;
    unit_price_cents = out.unit_price_cents ?? unit_price_cents;
  }

  // Generic order id fallback
  if (!order_id) {
    const m = (text || subject || "").match(/\b(Order|PO)\s*#?\s*([A-Z0-9\-]{4,})/i);
    if (m) order_id = m[2];
  }

  // Generic item/qty/price fallbacks
  if (!item_name) {
    const m = (text || "").match(/(?:Item|Product|Description)\s*:\s*(.+)/i);
    if (m) item_name = m[1].trim().slice(0, 140);
  }
  if (!quantity) {
    const qm = (text || "").match(/\bQty(?:\.|:)?\s*(\d{1,3})\b/i);
    quantity = qm ? Number(qm[1]) : 1;
  }
  if (!unit_price_cents) {
    const pm = (text || "").match(/\$([\d,]+\.\d{2})\s*(?:each|price)?/i);
    if (pm) unit_price_cents = Math.round(parseFloat(pm[1].replace(/,/g, "")) * 100);
  }
  if (unit_price_cents && quantity) {
    total_cents = unit_price_cents * quantity;
  } else {
    const tm = (text || "").match(/(?:Total|Order Total)\s*\$([\d,]+\.\d{2})/i);
    if (tm) total_cents = Math.round(parseFloat(tm[1].replace(/,/g, "")) * 100);
  }

  // Tracking & carrier heuristics
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
    item_name,
    quantity,
    unit_price_cents,
    total_cents,
    trackings: Array.from(trackings),
    carrier
  };
}

/* ---------------------- Gmail payload utilities ---------------------- */
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

/* ------------------------ Tracking URL builder ----------------------- */
function trackingUrl(carrier, tn) {
  if (!tn) return null;
  const c = (carrier || "").toLowerCase();
  if (c === "ups")   return `https://www.ups.com/track?tracknum=${encodeURIComponent(tn)}`;
  if (c === "usps")  return `https://tools.usps.com/go/TrackConfirmAction?tLabels=${encodeURIComponent(tn)}`;
  if (c === "fedex") return `https://www.fedex.com/fedextrack/?tracknumbers=${encodeURIComponent(tn)}`;
  // Fallback guess
  if (/^1Z/i.test(tn)) return `https://www.ups.com/track?tracknum=${encodeURIComponent(tn)}`;
  return `https://www.google.com/search?q=${encodeURIComponent(tn + " tracking")}`;
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
    item_name: parse.item_name || null,
    quantity: parse.quantity || 1,
    unit_price_cents: parse.unit_price_cents || null,
    total_cents: parse.total_cents || null
  };
}

/* -------------------- Tighten shipment creation ---------------------- */
function isLikelyTracking(tn, carrierHint) {
  if (!tn) return false;
  const s = String(tn).trim();
  if (/^1Z[0-9A-Z]{16}$/i.test(s)) return true; // UPS strict
  if (/^\d{20,22}$/.test(s)) return carrierHint === "USPS" || !carrierHint; // USPS common
  if (/^\d{12}$/.test(s) || /^\d{14}$/.test(s) || /^\d{15}$/.test(s) || /^\d{22}$/.test(s)) return carrierHint === "FedEx";
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

    // Get most recent/active account
    const { data: acctRow, error: acctErr } = await supabase
      .from("email_accounts")
      .select("*")
      .order("updated_at", { ascending: false })
      .limit(1)
      .single();
    if (acctErr || !acctRow) return err(400, { error: "No connected Gmail account." });

    const userId = acctRow.user_id;
    const gmail = google.gmail({ version: "v1", auth: makeOAuth2Client(acctRow) });

    // Inclusive commerce-focused query
    const query = [
      'category:updates OR category:promotions OR in:inbox',
      '(order OR shipped OR delivery OR delivered OR tracking OR cancel)',
      '-from:noreply@github.com'
    ].join(' ');

    // 1) Candidate message IDs
    const list = await gmail.users.messages.list({ userId: "me", q: query, maxResults: 200 });
    const ids = (list.data.messages || []).map(m => m.id);

    // 2) Skip already-ingested messages
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

      // Parse + classify
      const parsed = parseMessage({ from, subject, text, html });
      const classification = parsed.classification;

      // 3) Persist raw message for audit/idempotency
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
        parsed_json: parsed,
        // store a first tracking URL (optional)
        tracking_url: parsed.trackings?.[0] ? trackingUrl(parsed.carrier, parsed.trackings[0]) : null
      }]);

      // 4) PREVIEW: collect only true order confirmations that aren't in orders yet
      if ((mode === "preview" || mode === "commit") && classification === "order" && parsed.retailer && parsed.order_id) {
        proposedNewOrders.push(makeProposedOrder(parsed, internalTs));
      }

      // 5) SYNC/COMMIT: mutate normalized entities
      if (mode !== "preview") {
        // Orders are ONLY created on 'order' classification
        if (classification === "order" && parsed.retailer && parsed.order_id) {
          const base = {
            order_date: internalTs,
            item_name: parsed.item_name || null,
            quantity: parsed.quantity || 1,
            unit_price_cents: parsed.unit_price_cents ?? null,
            total_cents: parsed.total_cents ?? null
          };
          const cur = await upsertOrder(userId, parsed.retailer, parsed.order_id, { ...base, status: "ordered" });
          if (!cur) imported++; // defensive
        }

        // Status updates for shipping/out_for_delivery/delivered/canceled
        if (parsed.retailer && parsed.order_id) {
          const targetStatus =
            classification === "canceled" ? "canceled" :
            classification === "delivered" ? "delivered" :
            classification === "out_for_delivery" ? "out_for_delivery" :
            classification === "shipping" ? "in_transit" :
            null;

          if (targetStatus) {
            const stamps = {
              canceled_at: targetStatus === "canceled" ? internalTs : undefined,
              delivered_at: targetStatus === "delivered" ? internalTs : undefined,
              shipped_at: (targetStatus === "in_transit" || targetStatus === "out_for_delivery") ? internalTs : undefined
            };
            const cur = await upsertOrder(userId, parsed.retailer, parsed.order_id, { ...stamps });
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
        }

        // Shipments: only for shipping-type messages and with likely tracking
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
      // Dedupe & filter out ones already in email_orders
      const uniq = new Map();
      for (const p of proposedNewOrders) {
        const key = `${p.retailer}::${p.order_id}`;
        if (!uniq.has(key)) uniq.set(key, p);
      }
      const pending = Array.from(uniq.values());
      if (!pending.length) return ok({ mode, proposed: [] });

      const retailers = Array.from(new Set(pending.map(x => x.retailer)));
      const { data: existing, error: exErr } = await supabase
        .from("email_orders")
        .select("retailer, order_id")
        .eq("user_id", (await supabase.from("email_accounts").select("user_id").eq("id", acctRow.id).single()).data.user_id) // same userId
        .in("retailer", retailers);
      if (exErr) return err(500, { error: exErr.message });

      const existSet = new Set((existing || []).map(x => `${x.retailer}::${x.order_id}`));
      const onlyNew = pending.filter(x => !existSet.has(`${x.retailer}::${x.order_id}`));
      return ok({ mode, proposed: onlyNew });
    }

    return ok({ imported, updated, skipped_existing: skipped });
  } catch (e) {
    console.error(e);
    return err(500, { error: e.message || String(e) });
  }
};

/* ------------------------ Netlify Scheduled Run ---------------------- */
export const config = {
  schedule: "*/10 * * * *", // every 10 minutes
};
