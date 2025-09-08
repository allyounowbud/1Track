// netlify/functions/gmail-sync.js
// Full sync + preview for order/shipment/delivery via Gmail

import { google } from "googleapis";
import cheerio from "cheerio";
import { createClient } from "@supabase/supabase-js";

/* ----------------------------- Supabase init ----------------------------- */
const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_SERVICE_ROLE_KEY =
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_ANON_KEY; // SRK preferred
const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
  auth: { persistSession: false },
});

/* ---------------------------- Gmail OAuth init --------------------------- */
const OAUTH_CLIENT_ID = process.env.GMAIL_OAUTH_CLIENT_ID;
const OAUTH_CLIENT_SECRET = process.env.GMAIL_OAUTH_CLIENT_SECRET;
const OAUTH_REDIRECT_URI =
  process.env.GMAIL_OAUTH_REDIRECT_URI || "http://localhost"; // not used here but required by client
const oauth2 = new google.auth.OAuth2(
  OAUTH_CLIENT_ID,
  OAUTH_CLIENT_SECRET,
  OAUTH_REDIRECT_URI
);

/* ------------------------------ Retailer map ----------------------------- */
const RETAILERS = [
  {
    name: "Target",
    senderMatch: (from) =>
      /@target\.com$/i.test(from) || /order\.target\.com$/i.test(from),
    orderSubject: /(thanks for your order|order\s*#\s*\d+)/i,
    shipSubject: /(on the way|has shipped|shipping confirmation)/i,
    deliverSubject: /(delivered|was delivered|delivered successfully)/i,
    cancelSubject: /(canceled|cancelled|order.*cancel)/i,
    parseOrder: parseTargetOrder,
    parseShipping: parseTargetShipping,
    parseDelivered: parseGenericDelivered,
  },
  {
    name: "Amazon",
    senderMatch: (from) =>
      /@amazon\.(com|ca|co\.uk|de|fr|it|es|co\.jp)$/i.test(from) ||
      /order-update@amazon/i.test(from),
    orderSubject: /(order\s*confirmation|order\s*placed)/i,
    shipSubject: /(shipped|shipment confirmation|on (?:its|the) way)/i,
    deliverSubject: /(delivered|has been delivered)/i,
    cancelSubject: /(canceled|cancelled)/i,
    parseOrder: parseAmazonOrderBasic,
    parseShipping: parseGenericShipping,
    parseDelivered: parseGenericDelivered,
  },
];

/* -------------------------- Helpers (Gmail utils) ------------------------ */
async function getAccount() {
  const { data, error } = await supabase
    .from("email_accounts")
    .select("id, email_address, access_token, refresh_token, token_expiry, updated_at")
    .order("updated_at", { ascending: false })
    .limit(1);

  if (error) throw error;
  if (!data || !data.length) throw new Error("No connected Gmail account in email_accounts");
  return data[0];
}

async function getGmailClient() {
  const acct = await getAccount();
  oauth2.setCredentials({
    access_token: acct.access_token,
    refresh_token: acct.refresh_token,
    scope: acct.token_scope || "https://www.googleapis.com/auth/gmail.readonly",
    expiry_date: acct.token_expiry
      ? new Date(acct.token_expiry).getTime()
      : undefined,
  });

  // Ensure fresh token; if refreshed, persist
  oauth2.on("tokens", async (tokens) => {
    const patch = {};
    if (tokens.access_token) patch.access_token = tokens.access_token;
    if (tokens.expiry_date)
      patch.token_expiry = new Date(tokens.expiry_date).toISOString();
    if (Object.keys(patch).length) {
      await supabase.from("email_accounts").update(patch).eq("id", acct.id);
    }
  });

  try {
    // a harmless call to ensure credentials are OK
    await oauth2.getAccessToken();
  } catch (e) {
    // last-ditch attempt to refresh
    if (acct.refresh_token) {
      const { credentials } = await oauth2.refreshAccessToken();
      oauth2.setCredentials(credentials);
    } else {
      throw new Error("Gmail token expired and no refresh token available");
    }
  }

  return google.gmail({ version: "v1", auth: oauth2 });
}

// List message IDs from last ~90 days for subjects/senders we care about
async function listCandidateMessageIds(gmail) {
  const qParts = [
    // time window; broaden on first run
    "newer_than:90d",
    // we read from Inbox (Promotions are also in inbox for many)
    "in:inbox",
    // general phrases
    '(subject:"order" OR subject:"thanks for your order" OR subject:"order placed" OR subject:"shipped" OR subject:"delivered" OR subject:"shipment")',
  ];
  const q = qParts.join(" ");

  const ids = [];
  let pageToken = undefined;
  // cap to ~300–400 per sync
  for (let i = 0; i < 8; i++) {
    const res = await gmail.users.messages.list({
      userId: "me",
      q,
      maxResults: 50,
      pageToken,
    });
    (res.data.messages || []).forEach((m) => ids.push(m.id));
    pageToken = res.data.nextPageToken;
    if (!pageToken) break;
  }
  return Array.from(new Set(ids));
}

async function getMessageFull(gmail, id) {
  const res = await gmail.users.messages.get({
    userId: "me",
    id,
    format: "full",
  });
  return res.data;
}

function headersToObj(headers = []) {
  const o = {};
  headers.forEach((h) => (o[h.name.toLowerCase()] = h.value || ""));
  return o;
}

function decodeB64url(str) {
  if (!str) return "";
  const buff = Buffer.from(
    str.replace(/-/g, "+").replace(/_/g, "/"),
    "base64"
  );
  return buff.toString("utf8");
}

function extractBodyParts(payload) {
  // Recursively walk parts to find text/html and text/plain
  let html = null;
  let text = null;

  function walk(p) {
    if (!p) return;
    if (p.mimeType === "text/html" && p.body?.data)
      html = decodeB64url(p.body.data);
    if (p.mimeType === "text/plain" && p.body?.data)
      text = decodeB64url(p.body.data);
    (p.parts || []).forEach(walk);
  }
  walk(payload);

  if (!html && payload?.body?.data && /html/i.test(payload.mimeType || "")) {
    html = decodeB64url(payload.body.data);
  }
  if (!text && payload?.body?.data && /plain/i.test(payload.mimeType || "")) {
    text = decodeB64url(payload.body.data);
  }
  return { html, text };
}

/* ------------------------------ Classifier ------------------------------- */
function classifyRetailer(from) {
  const f = (from || "").toLowerCase();
  return RETAILERS.find((r) => r.senderMatch(f)) || null;
}

function classifyType(retailer, subject) {
  const s = (subject || "").toLowerCase();
  if (retailer.orderSubject && retailer.orderSubject.test(s)) return "order";
  if (retailer.shipSubject && retailer.shipSubject.test(s)) return "shipping";
  if (retailer.deliverSubject && retailer.deliverSubject.test(s))
    return "delivered";
  if (retailer.cancelSubject && retailer.cancelSubject.test(s))
    return "canceled";
  // fallback heuristics:
  if (
    /\b(order|confirmation|thanks for your order|we got your order)\b/i.test(s)
  )
    return "order";
  if (/\b(shipped|on the way|label created|tracking)\b/i.test(s))
    return "shipping";
  if (/\b(delivered|has been delivered)\b/i.test(s)) return "delivered";
  if (/\b(cancel|cancelled)\b/i.test(s)) return "canceled";
  return null;
}

/* ------------------------------- Parsers --------------------------------- */
// Helpers
function parseMoney(str = "") {
  const m = String(str)
    .replace(/[,]/g, "")
    .match(/\$?\s*([0-9]+(?:\.[0-9]{2})?)/);
  return m ? Math.round(parseFloat(m[1]) * 100) : null;
}
function pickCarrierByTracking(tn = "", html = "", text = "") {
  const s = (html || "") + " " + (text || "");
  if (/1Z[0-9A-Z]{10,}/i.test(tn) || /UPS/i.test(s)) return "UPS";
  if (/\b(92|94|95)\d{20,}\b/.test(tn) || /USPS/i.test(s)) return "USPS";
  if (/\b(\d{12,14})\b/.test(tn) || /FedEx/i.test(s)) return "FedEx";
  if (/amazon/i.test(s)) return "Amazon";
  return "";
}

/* ---- Target: order confirmation ---- */
function parseTargetOrder(html, text) {
  const $ = cheerio.load(html || "");
  const out = {};

  // order id
  out.order_id =
    ($("body").text().match(/Order\s*#\s*([0-9\-]+)/i) || [])[1] ||
    (text && (text.match(/Order\s*#\s*([0-9\-]+)/i) || [])[1]) ||
    null;

  // total ("Order total $48.28")
  const totalNode = $('*:contains("Order total")')
    .filter((_, el) => /Order total/i.test($(el).text()))
    .first();
  const totalText = (totalNode.next().text() || totalNode.text() || "").trim();
  const totalCents = parseMoney(totalText);
  if (totalCents != null) out.total_cents = totalCents;

  // quantity (Qty: 2)
  const qty =
    (($("body").text().match(/Qty:\s*([0-9]+)/i) || [])[1]) ||
    (($('*:contains("Qty")').first().text().match(/Qty[:\s]+([0-9]+)/i) || [])[1]);
  if (qty) out.quantity = parseInt(qty, 10);

  // item name (alt text or near qty)
  let item = "";
  $('img[alt]').each((_, el) => {
    const alt = ($(el).attr("alt") || "").trim();
    if (/thanks/i.test(alt) || /target/i.test(alt) || /logo/i.test(alt)) return;
    if (alt.length > 12 && alt.length < 160) item = item || alt;
  });
  if (!item) {
    const qtyBlock = $('*:contains("Qty:")').first().parent();
    const candidate = qtyBlock.prev().text().trim();
    if (candidate.length > 8) item = candidate;
  }
  if (!item) {
    const near = totalNode
      .closest("table,div")
      .text()
      .split("\n")
      .map((s) => s.trim())
      .filter(Boolean);
    item = near.sort((a, b) => b.length - a.length)[0] || null;
  }
  if (item) out.item_name = item;

  // unit price (e.g., $21.99 / ea)
  const each =
    ($("body").text().match(/\$[0-9]+(?:\.[0-9]{2})?\s*\/\s*ea/i) || [])[0] ||
    null;
  if (each) out.unit_price_cents = parseMoney(each);

  // image url – first non-logo product image
  let img = null;
  $("img").each((_, el) => {
    const src = $(el).attr("src") || "";
    const alt = ($(el).attr("alt") || "").toLowerCase();
    const bad = /(logo|target|icon)/i.test(src) || /(logo|target)/i.test(alt);
    if (!bad && /^https?:\/\//i.test(src)) img = img || src;
  });
  if (img) out.image_url = img;

  return out;
}

/* ---- Target: shipping ---- */
function parseTargetShipping(html, text) {
  const content = (html || "") + " " + (text || "");
  const tracking =
    (content.match(/\b(1Z[0-9A-Z]{10,})\b/i) || [])[1] ||
    (content.match(/\b([A-Z0-9]{10,25})\b/g) || []).find((x) => x.length >= 12) ||
    null;
  const carrier = pickCarrierByTracking(tracking, html, text);
  return {
    tracking_number: tracking || null,
    carrier,
    status: "in_transit",
  };
}

/* ---- Amazon order (basic) ---- */
function parseAmazonOrderBasic(html, text) {
  const $ = cheerio.load(html || "");
  const out = {};
  out.order_id =
    (($("body").text().match(/Order\s*#\s*([0-9\-]+)/i) || [])[1]) ||
    (text && (text.match(/Order\s*#\s*([0-9\-]+)/i) || [])[1]) ||
    null;

  // Item (try alt text)
  let item = "";
  $('img[alt]').each((_, el) => {
    const alt = ($(el).attr("alt") || "").trim();
    if (/amazon/i.test(alt) || /logo/i.test(alt)) return;
    if (alt.length > 12 && alt.length < 160) item = item || alt;
  });
  if (item) out.item_name = item;

  // Totals
  const totalText =
    ($("body").text().match(/Total:\s*\$[0-9,.]+/i) || [])[0] || "";
  const totalCents = parseMoney(totalText);
  if (totalCents != null) out.total_cents = totalCents;

  // Qty
  const qty = (($("body").text().match(/Qty:\s*([0-9]+)/i) || [])[1]) || null;
  if (qty) out.quantity = parseInt(qty, 10);

  // Image
  let img = null;
  $("img").each((_, el) => {
    const src = $(el).attr("src") || "";
    if (/logo|prime/i.test(src)) return;
    if (/^https?:\/\//i.test(src)) img = img || src;
  });
  if (img) out.image_url = img;

  return out;
}

/* ---- Generic shipping ---- */
function parseGenericShipping(html, text) {
  const content = (html || "") + " " + (text || "");
  const tracking =
    (content.match(/\b(1Z[0-9A-Z]{10,})\b/i) || [])[1] ||
    (content.match(/\b([A-Z0-9]{10,25})\b/g) || []).find((x) => x.length >= 12) ||
    null;
  const carrier = pickCarrierByTracking(tracking, html, text);
  return {
    tracking_number: tracking || null,
    carrier,
    status: "in_transit",
  };
}

/* ---- Generic delivered ---- */
function parseGenericDelivered(_html, _text) {
  return { status: "delivered" };
}

/* --------------------------- DB upsert helpers --------------------------- */
async function orderExists(retailer, order_id) {
  if (!order_id) return false;
  const { data, error } = await supabase
    .from("email_orders")
    .select("id")
    .eq("retailer", retailer)
    .eq("order_id", order_id)
    .maybeSingle();
  if (error && error.code !== "PGRST116") throw error;
  return !!data;
}

async function upsertOrder(row) {
  // row: retailer, order_id, order_date, item_name, quantity, unit_price_cents, total_cents, image_url, shipped_at, delivered_at, status, source_message_id
  const { data, error } = await supabase
    .from("email_orders")
    .upsert(row, { onConflict: "retailer,order_id" })
    .select("id")
    .maybeSingle();
  if (error) throw error;
  return data?.id || null;
}

async function upsertShipment(row) {
  // row: retailer, order_id, tracking_number, carrier, status, shipped_at, delivered_at
  if (!row.tracking_number) return null; // nothing to write
  const { data, error } = await supabase
    .from("email_shipments")
    .upsert(row, { onConflict: "retailer,order_id,tracking_number" })
    .select("id")
    .maybeSingle();
  if (error) throw error;
  return data?.id || null;
}

function ymd(dateStr) {
  if (!dateStr) return null;
  const d = new Date(dateStr);
  if (isNaN(d)) return null;
  return d.toISOString().slice(0, 10);
}

/* ------------------------------- Core logic ------------------------------ */
async function runSync(event) {
  const mode = (event.queryStringParameters?.mode || "").toLowerCase();

  const gmail = await getGmailClient();
  const ids = await listCandidateMessageIds(gmail);

  const proposed = []; // for preview
  let imported = 0;
  let updated = 0;
  let skipped_existing = 0;

  for (const id of ids) {
    const msg = await getMessageFull(gmail, id);
    const h = headersToObj(msg.payload?.headers || []);
    const subject = h["subject"] || "";
    const from = h["from"] || "";
    const dateHeader = h["date"] || "";
    const messageDate = dateHeader
      ? new Date(dateHeader)
      : new Date(msg.internalDate ? Number(msg.internalDate) : Date.now());
    const { html, text } = extractBodyParts(msg.payload || {});
    const retailer = classifyRetailer(from);
    if (!retailer) continue;

    const type = classifyType(retailer, subject);
    if (!type) continue;

    if (mode === "preview" && type !== "order") {
      // preview only considers new orders
      continue;
    }

    // Parse payload
    let parsed = {};
    if (type === "order" && retailer.parseOrder)
      parsed = retailer.parseOrder(html, text);
    else if (type === "shipping" && retailer.parseShipping)
      parsed = retailer.parseShipping(html, text);
    else if (type === "delivered" && retailer.parseDelivered)
      parsed = retailer.parseDelivered(html, text);
    else if (type === "canceled") parsed = { status: "canceled" };

    const order_id =
      parsed.order_id ||
      // fallback: sometimes included in subject
      ((subject.match(/#\s*([0-9\-]+)/) || [])[1]) ||
      null;

    if (mode === "preview") {
      // only show orders that aren't in email_orders yet
      const exists = await orderExists(retailer.name, order_id);
      if (!exists) {
        proposed.push({
          retailer: retailer.name,
          order_id: order_id || "—",
          order_date: ymd(messageDate),
          item_name: parsed.item_name || null,
          quantity: parsed.quantity || null,
          unit_price_cents: parsed.unit_price_cents || null,
          total_cents: parsed.total_cents || null,
          image_url: parsed.image_url || null,
        });
      }
      continue;
    }

    // --- Normal sync (create/update) ---
    if (type === "order") {
      const exists = await orderExists(retailer.name, order_id);
      const row = {
        retailer: retailer.name,
        order_id: order_id || `unknown-${msg.id}`,
        order_date: ymd(messageDate),
        item_name: parsed.item_name || null,
        quantity: parsed.quantity || null,
        unit_price_cents: parsed.unit_price_cents || null,
        total_cents: parsed.total_cents || null,
        image_url: parsed.image_url || null,
        shipped_at: null,
        delivered_at: null,
        status: "ordered",
        source_message_id: msg.id,
      };
      await upsertOrder(row);
      if (exists) skipped_existing++;
      else imported++;
    }

    if (type === "shipping") {
      // attach shipment to existing order if we can find order_id from subject/body; otherwise we still save the shipment row
      const ship = {
        retailer: retailer.name,
        order_id: order_id || "Unknown",
        tracking_number: parsed.tracking_number || null,
        carrier: parsed.carrier || "",
        status: parsed.status || "in_transit",
        shipped_at: ymd(messageDate),
        delivered_at: null,
      };
      await upsertShipment(ship);

      // If we have an order row, update it
      if (order_id) {
        await upsertOrder({
          retailer: retailer.name,
          order_id,
          shipped_at: messageDate.toISOString(),
          status: "in_transit",
        });
      }
      updated++;
    }

    if (type === "delivered") {
      if (order_id) {
        await upsertOrder({
          retailer: retailer.name,
          order_id,
          delivered_at: messageDate.toISOString(),
          status: "delivered",
        });
      }
      updated++;
    }

    if (type === "canceled") {
      if (order_id) {
        await upsertOrder({
          retailer: retailer.name,
          order_id,
          status: "canceled",
        });
      }
      updated++;
    }
  }

  if (mode === "preview") {
    // Only return proposals
    return json({ proposed });
  }
  if (mode === "commit") {
    // Friendly response to the Emails.jsx confirmInsert flow
    return json({ imported, updated, skipped_existing });
  }
  return json({ imported, updated, skipped_existing });
}

/* ------------------------------- Utilities ------------------------------- */
function json(body, status = 200) {
  return {
    statusCode: status,
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  };
}

/* ------------------------------- Single handler -------------------------- */
export async function handler(event) {
  console.log("gmail-sync start", {
    mode: event.queryStringParameters?.mode,
    method: event.httpMethod,
  });

  // Quick health check: /.netlify/functions/gmail-sync?health=1
  if (event.queryStringParameters?.health === "1") {
    const envOk = {
      SUPABASE_URL: !!process.env.SUPABASE_URL,
      SUPABASE_SERVICE_ROLE_KEY: !!process.env.SUPABASE_SERVICE_ROLE_KEY,
      GMAIL_OAUTH_CLIENT_ID: !!process.env.GMAIL_OAUTH_CLIENT_ID,
      GMAIL_OAUTH_CLIENT_SECRET: !!process.env.GMAIL_OAUTH_CLIENT_SECRET,
    };
    return json({ ok: true, envOk });
  }

  try {
    return await runSync(event);
  } catch (err) {
    console.error("gmail-sync error:", err);
    return json({ error: String(err?.message || err) }, 500);
  }
}
