// netlify/functions/gmail-sync.js
// Robust body extraction, broader order detection (Target, Amazon, generic),
// item/qty/price parsing, shipment tightening, and a one-time ?mode=backfill
// to re-process recent email_messages with the improved parser.

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
const ok  = (body) => ({ statusCode: 200, headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
const err = (code, body) => ({ statusCode: code, headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });

/* ---------------------- Classification & parsing --------------------- */
/** Broadened phrases for order confirmation (covers more retailer copy). */
const ORDER_CONFIRM_WORDS = new RegExp([
  'order\\s+confirmation',
  'thanks\\s+for\\s+your\\s+order',
  'we\\s+received\\s+your\\s+order',
  'we\\s+got\\s+your\\s+order',
  'order\\s+received',
  'your\\s+order\\s+number',
  'your\\s+order\\s+is\\s+confirmed',
  'order\\s+placed',
  'receipt\\s+for\\s+your\\s+order',
  'order\\s+details'
].join('|'), 'i');

const CANCELED_WORDS = /\b(cancel(?:led|ed|ation)|order\s+cancel(?:led|ed)?)/i;
const SHIPPED_WORDS  = /\b(shipped|shipping\s+update|your\s+order\s+has\s+shipped|on\s+the\s+way)\b/i;
const OUT_FOR_DELIVERY_WORDS = /\bout\s+for\s+delivery\b/i;
const DELIVERED_WORDS = /\b(delivered|delivery\s+complete|arrived)\b/i;

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

/* ---------------------- Retailer hooks (extensible) ------------------ */
/** Improved Target + Amazon parsing; easy to add more later. */
const retailerParsers = [
  {
    name: "Target",
    match: ({ from, subject }) =>
      /target\.com/i.test(from || "") || /\bTarget\b/i.test(subject || ""),
    parse: ({ subject, text, html }) => {
      const body = (text || "") + "\n" + (html || "");
      // Target order IDs are often 12–14 digits starting with 1
      const orderId = (body.match(/\bOrder\s*#\s*([0-9\-]{6,})/i) || [])[1]
        || (body.match(/\b(1\d{11,13})\b/) || [])[1];
      // Item: look near "Item" / "Item details" or first product-like line
      let item = (body.match(/(?:Item\s*[:\-]\s*)(.+)/i) || [])[1];
      if (!item) {
        const m = body.match(/Item\s+details(?:[^A-Za-z0-9]+)([^\n<]{4,120})/i);
        if (m) item = m[1].trim();
      }
      // Qty
      const qty = Number((body.match(/\bQty(?:\.|:)?\s*(\d{1,3})\b/i) || [])[1] || 1);
      // Price: prefer each price, else order total
      const priceEach = (body.match(/\$([\d,]+\.\d{2})\s*(?:each|ea|price)/i) || [])[1];
      const orderTotal = (body.match(/(?:Order\s+Total|Total)\s*\$([\d,]+\.\d{2})/i) || [])[1];
      return {
        retailer: "Target",
        order_id: orderId,
        item_name: item ? item.replace(/<\/?[^>]+(>|$)/g, "").trim().slice(0, 140) : undefined,
        quantity: Number.isFinite(qty) ? qty : 1,
        unit_price_cents: priceEach ? Math.round(parseFloat(priceEach.replace(/,/g, "")) * 100) : undefined,
        total_cents: orderTotal ? Math.round(parseFloat(orderTotal.replace(/,/g, "")) * 100) : undefined
      };
    }
  },
  {
    name: "Amazon",
    match: ({ from, subject }) =>
      /amazon\./i.test(from || "") || /\bAmazon\b/i.test(subject || ""),
    parse: ({ subject, text, html }) => {
      const body = (text || "") + "\n" + (html || "");
      const orderId = (body.match(/Order\s+#\s*([0-9\-]+)/i) || [])[1]
        || (body.match(/\b\d{3}-\d{7}-\d{7}\b/) || [])[0];
      const item = (body.match(/(?:Item|Items ordered)\s*[:\-]\s*([^\n<]{4,140})/i) || [])[1];
      const qty = Number((body.match(/\bQty(?:\.|:)?\s*(\d{1,3})\b/i) || [])[1] || 1);
      const priceEach = (body.match(/\$([\d,]+\.\d{2})\s*(?:each|ea|price)/i) || [])[1];
      const orderTotal = (body.match(/(?:Order\s+Total|Total Before Tax)\s*\$([\d,]+\.\d{2})/i) || [])[1];
      return {
        retailer: "Amazon",
        order_id: orderId,
        item_name: item ? item.replace(/<\/?[^>]+(>|$)/g, "").trim() : undefined,
        quantity: Number.isFinite(qty) ? qty : 1,
        unit_price_cents: priceEach ? Math.round(parseFloat(priceEach.replace(/,/g, "")) * 100) : undefined,
        total_cents: orderTotal ? Math.round(parseFloat(orderTotal.replace(/,/g, "")) * 100) : undefined
      };
    }
  },
];

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
    total_cents = out.total_cents ?? total_cents;
  }

  // Generic fallbacks
  if (!order_id) {
    const m = (text || subject || "").match(/\b(Order|PO)\s*#?\s*([A-Z0-9\-]{4,})/i);
    if (m) order_id = m[2];
  }
  if (!item_name) {
    const m = (text || "").match(/(?:Item|Product|Description)\s*[:\-]\s*([^\n]{4,140})/i);
    if (m) item_name = m[1].trim();
  }
  if (!quantity) {
    const qm = (text || "").match(/\bQty(?:\.|:)?\s*(\d{1,3})\b/i);
    quantity = qm ? Number(qm[1]) : 1;
  }
  if (!unit_price_cents) {
    const pm = (text || "").match(/\$([\d,]+\.\d{2})\s*(?:each|ea|price)?/i);
    if (pm) unit_price_cents = Math.round(parseFloat(pm[1].replace(/,/g, "")) * 100);
  }
  if (!total_cents && unit_price_cents && quantity) total_cents = unit_price_cents * quantity;

  // Tracking + carrier
  const combined = `${text || ""}\n${html || ""}`;
  const trackings = new Set((combined.match(TRACKING_RE) || []).slice(0, 6));
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
function decode(part) {
  if (!part?.body?.data) return "";
  const b64 = part.body.data.replace(/-/g, "+").replace(/_/g, "/");
  try { return Buffer.from(b64, "base64").toString("utf8"); } catch { return ""; }
}
/** NEW: handle bodies that are on payload.body (no parts) and nested multiparts. */
function extractBody(payload) {
  let text = "", html = "";
  const stack = [payload];
  while (stack.length) {
    const p = stack.pop();
    if (!p) continue;
    if (p.mimeType === "text/plain" && p.body?.data) text += "\n" + decode(p);
    if (p.mimeType === "text/html"  && p.body?.data) html += "\n" + decode(p);
    if (p.parts) p.parts.forEach(x => stack.push(x));
  }
  if (!text && payload?.body?.data) text = decode(payload); // single-part plain
  return { text, html };
}

/* ------------------------ Tracking URL builder ----------------------- */
function trackingUrl(carrier, tn) {
  if (!tn) return null;
  const c = (carrier || "").toLowerCase();
  if (c === "ups")   return `https://www.ups.com/track?tracknum=${encodeURIComponent(tn)}`;
  if (c === "usps")  return `https://tools.usps.com/go/TrackConfirmAction?tLabels=${encodeURIComponent(tn)}`;
  if (c === "fedex") return `https://www.fedex.com/fedextrack/?tracknumbers=${encodeURIComponent(tn)}`;
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
/* Tightened shipment creation */
function isLikelyTracking(tn, carrierHint) {
  if (!tn) return false;
  const s = String(tn).trim();
  if (/^1Z[0-9A-Z]{16}$/i.test(s)) return true;
  if (/^\d{20,22}$/.test(s)) return carrierHint === "USPS" || !carrierHint;
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
    const modeRaw = event.queryStringParameters?.mode;
    const mode = (modeRaw || (event.httpMethod === "POST" ? "sync" : "preview")).toLowerCase();

    // Get most recent/active account
    const { data: acctRow, error: acctErr } = await supabase
      .from("email_accounts")
      .select("*")
      .order("updated_at", { ascending: false })
      .limit(1)
      .single();
    if (acctErr || !acctRow) return err(400, { error: "No connected Gmail account." });

    const userId = acctRow.user_id;

    /* ----------------------- Backfill from email_messages -----------------------
       Use when you've already imported messages but parsing logic has improved.
       Call: /.netlify/functions/gmail-sync?mode=backfill
    --------------------------------------------------------------------------- */
    if (mode === "backfill") {
      // last 14 days of raw messages (adjust as needed)
      const { data: raws, error: re } = await supabase
        .from("email_messages")
        .select("id, gmail_message_id, gmail_thread_id, internal_ts, from_addr, subject, body_text, body_html")
        .eq("user_id", userId)
        .gte("internal_ts", new Date(Date.now() - 14 * 24 * 60 * 60 * 1000).toISOString())
        .order("internal_ts", { ascending: true })
        .limit(1000);
      if (re) return err(500, { error: re.message });

      let imported = 0, updated = 0;
      for (const m of (raws || [])) {
        const parsed = parseMessage({ from: m.from_addr, subject: m.subject, text: m.body_text, html: m.body_html });
        const classification = parsed.classification;

        // Orders: create on "order"
        if (classification === "order" && parsed.retailer && parsed.order_id) {
          await upsertOrder(userId, parsed.retailer, parsed.order_id, {
            order_date: m.internal_ts,
            item_name: parsed.item_name || null,
            quantity: parsed.quantity || 1,
            unit_price_cents: parsed.unit_price_cents ?? null,
            total_cents: parsed.total_cents ?? null,
            status: "ordered"
          });
          imported++;
        }

        // Status updates
        if (parsed.retailer && parsed.order_id) {
          const targetStatus =
            classification === "canceled" ? "canceled" :
            classification === "delivered" ? "delivered" :
            classification === "out_for_delivery" ? "out_for_delivery" :
            classification === "shipping" ? "in_transit" :
            null;

          if (targetStatus) {
            const stamps = {
              canceled_at: targetStatus === "canceled" ? m.internal_ts : undefined,
              delivered_at: targetStatus === "delivered" ? m.internal_ts : undefined,
              shipped_at: (targetStatus === "in_transit" || targetStatus === "out_for_delivery") ? m.internal_ts : undefined
            };
            const cur = await upsertOrder(userId, parsed.retailer, parsed.order_id, { ...stamps });
            const finalStatus = mergeStatus(cur?.status, targetStatus);
            if (finalStatus && finalStatus !== cur?.status) {
              await supabase.from("email_orders")
                .update({ status: finalStatus, ...stamps })
                .eq("user_id", userId).eq("retailer", parsed.retailer).eq("order_id", parsed.order_id);
              updated++;
            }
          }
        }

        // Shipments
        if (shouldMakeShipment(classification)) {
          for (const tn of parsed.trackings || []) {
            if (!isLikelyTracking(tn, parsed.carrier)) continue;
            await upsertShipment(userId, parsed.retailer, parsed.order_id, tn, {
              carrier: parsed.carrier || null,
              status:
                classification === "delivered" ? "delivered" :
                classification === "out_for_delivery" ? "out_for_delivery" :
                "in_transit",
              shipped_at: (classification === "shipping" || classification === "out_for_delivery") ? m.internal_ts : null,
              delivered_at: (classification === "delivered") ? m.internal_ts : null
            });
          }
        }
      }
      return ok({ mode, imported, updated });
    }

    /* ------------------------------- Gmail sync ------------------------------- */
    const oAuth2Client = makeOAuth2Client(acctRow);
    const gmail = google.gmail({ version: "v1", auth: oAuth2Client });

    // Pull recent commerce-related messages (newer_than to avoid very old noise)
    const query = [
      'newer_than:30d',
      'category:updates OR category:promotions OR in:inbox',
      '(order OR receipt OR shipped OR delivery OR delivered OR tracking OR cancel)',
      '-from:noreply@github.com'
    ].join(' ');

    const list = await gmail.users.messages.list({ userId: "me", q: query, maxResults: 200 });
    const ids = (list.data.messages || []).map(m => m.id);

    // Skip already ingested messages
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
      const { text, html } = extractBody(msg.payload || {});
      const snippet = msg.snippet || "";
      const internalTs = new Date(Number(msg.internalDate || Date.now())).toISOString();
      const threadId = msg.threadId;

      const parsed = parseMessage({ from, subject, text, html });
      const classification = parsed.classification;

      // Store raw message (audit/idempotency)
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
        tracking_url: parsed.trackings?.[0] ? trackingUrl(parsed.carrier, parsed.trackings[0]) : null
      }]);

      // Collect preview candidates (only true order confirmations)
      if ((mode === "preview" || mode === "commit") && classification === "order" && parsed.retailer && parsed.order_id) {
        proposedNewOrders.push(makeProposedOrder(parsed, internalTs));
      }

      // Mutate normalized tables (skip for preview)
      if (mode !== "preview") {
        // Create order only on "order"
        if (classification === "order" && parsed.retailer && parsed.order_id) {
          await upsertOrder(userId, parsed.retailer, parsed.order_id, {
            order_date: internalTs,
            item_name: parsed.item_name || null,
            quantity: parsed.quantity || 1,
            unit_price_cents: parsed.unit_price_cents ?? null,
            total_cents: parsed.total_cents ?? null,
            status: "ordered"
          });
          imported++;
        }

        // Status updates
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
            }
          }
        }

        // Shipments with likely tracking
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
      const uniq = new Map();
      for (const p of proposedNewOrders) uniq.set(`${p.retailer}::${p.order_id}`, p);
      const pending = Array.from(uniq.values());
      if (!pending.length) return ok({ mode, proposed: [] });

      const retailers = Array.from(new Set(pending.map(x => x.retailer)));
      const { data: existing, error: exErr } = await supabase
        .from("email_orders")
        .select("retailer, order_id")
        .eq("user_id", userId)
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
