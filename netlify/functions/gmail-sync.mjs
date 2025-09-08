import { google } from "googleapis";
import cheerio from "cheerio";
import { createClient } from "@supabase/supabase-js";

/* ----------------------------- Supabase init ----------------------------- */
const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_SERVICE_ROLE_KEY =
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_ANON_KEY;
const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
  auth: { persistSession: false },
});

/* ---------------------------- Gmail OAuth init --------------------------- */
const OAUTH_CLIENT_ID = process.env.GMAIL_OAUTH_CLIENT_ID;
const OAUTH_CLIENT_SECRET = process.env.GMAIL_OAUTH_CLIENT_SECRET;
const OAUTH_REDIRECT_URI =
  process.env.GMAIL_OAUTH_REDIRECT_URI || "http://localhost";
const oauth2 = new google.auth.OAuth2(
  OAUTH_CLIENT_ID,
  OAUTH_CLIENT_SECRET,
  OAUTH_REDIRECT_URI
);

/* ============================ Helpers / Utils ============================ */
function parseMoney(str = "") {
  const m = String(str).replace(/[,]/g, "").match(/\$?\s*([0-9]+(?:\.[0-9]{2})?)/);
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
function cleanText($, node) {
  return $(node).text().replace(/\s+/g, " ").trim();
}
function firstNonLogoImg($) {
  let img = null;
  $("img").each((_, el) => {
    const src = ($(el).attr("src") || "").trim();
    const alt = ($(el).attr("alt") || "").toLowerCase();
    if (!/^https?:\/\//i.test(src)) return;
    if (/logo|sprite|prime|rating|nav|icon|badge/i.test(src)) return;
    if (/amazon|logo|prime/i.test(alt)) return;
    img = img || src;
  });
  return img;
}

/* =============================== PARSERS ================================= */
/* ---- Target ---- */
function parseTargetOrder(html, text) {
  const $ = cheerio.load(html || "");
  const out = {};
  out.order_id =
    ($("body").text().match(/Order\s*#\s*([0-9\-]+)/i) || [])[1] ||
    (text && (text.match(/Order\s*#\s*([0-9\-]+)/i) || [])[1]) ||
    null;

  const totalNode = $('*:contains("Order total")')
    .filter((_, el) => /Order total/i.test($(el).text()))
    .first();
  const totalText = (totalNode.next().text() || totalNode.text() || "").trim();
  const totalCents = parseMoney(totalText);
  if (totalCents != null) out.total_cents = totalCents;

  const qty =
    (($("body").text().match(/Qty:\s*([0-9]+)/i) || [])[1]) ||
    (($('*:contains("Qty")').first().text().match(/Qty[:\s]+([0-9]+)/i) || [])[1]);
  if (qty) out.quantity = parseInt(qty, 10);

  let item = "";
  $('img[alt]').each((_, el) => {
    const alt = ($(el).attr("alt") || "").trim();
    if (/thanks|target|logo/i.test(alt)) return;
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

  const each =
    ($("body").text().match(/\$[0-9]+(?:\.[0-9]{2})?\s*\/\s*ea/i) || [])[0] || null;
  if (each) out.unit_price_cents = parseMoney(each);

  const img = firstNonLogoImg($);
  if (img) out.image_url = img;

  return out;
}
function parseTargetShipping(html, text) {
  const content = (html || "") + " " + (text || "");
  const tracking =
    (content.match(/\b(1Z[0-9A-Z]{10,})\b/i) || [])[1] ||
    (content.match(/\b([A-Z0-9]{10,25})\b/g) || []).find((x) => x.length >= 12) ||
    null;
  const carrier = pickCarrierByTracking(tracking, html, text);
  return { tracking_number: tracking || null, carrier, status: "in_transit" };
}

/* ---- Amazon (robust for Ordered/Shipped/Delivered) ---- */
function extractAmazonOrderId(subject = "", bodyText = "") {
  return (
    (subject.match(/\b\d{3}-\d{7}-\d{7}\b/) || [])[0] ||
    (bodyText.match(/\b\d{3}-\d{7}-\d{7}\b/) || [])[0] ||
    // fallback "Order # 111-2222222-3333333"
    (bodyText.match(/Order\s*#\s*(\d{3}-\d{7}-\d{7})/) || [])[1] ||
    null
  );
}

function extractAmazonItemBlock($) {
  // Try the first product card that has "Quantity" nearby
  const blocks = [];
  $("*").each((_, el) => {
    const t = cleanText($, el);
    if (/Quantity:\s*\d+/i.test(t)) {
      const blockText = cleanText($, $(el).parent());
      blocks.push({ el, text: blockText, root: $(el).parent() });
    }
  });
  return blocks[0] || null;
}

function parseAmazonOrderEnhanced(html, text, subject = "") {
  const $ = cheerio.load(html || "");
  const bodyText = $("body").text().replace(/\s+/g, " ").trim();
  const out = {};

  // order id
  out.order_id = extractAmazonOrderId(subject, bodyText) || extractAmazonOrderId("", text || "");

  // product image
  out.image_url = firstNonLogoImg($) || null;

  // Try to use the "item block"
  const blk = extractAmazonItemBlock($);
  if (blk) {
    // item name – longest link text inside the block
    let title = "";
    blk.root.find("a,span,div").each((_, n) => {
      const t = cleanText($, n);
      if (!t) return;
      if (/Quantity:|Order #|Track package|Your Orders|Delivered|Shipped/i.test(t)) return;
      if (t.length >= 8 && t.length <= 180 && t.length > (title?.length || 0)) title = t;
    });
    out.item_name = out.item_name || title || null;

    // quantity
    const q = (blk.text.match(/Quantity:\s*(\d+)/i) || [])[1];
    if (q) out.quantity = parseInt(q, 10);

    // unit price (just before "Quantity" usually)
    const unitLine =
      (blk.text.match(/\$[0-9][0-9,]*(?:\.[0-9]{2})?\s*(?:ea|each)?/i) || [])[0] || null;
    if (unitLine) out.unit_price_cents = parseMoney(unitLine);
  }

  // fallback item name candidates
  if (!out.item_name) {
    // 1) first non-logo image alt
    const imgAlt = $("img[alt]")
      .map((_, n) => ($(n).attr("alt") || "").trim())
      .get()
      .find((a) => a && !/amazon|logo|prime/i.test(a) && a.length > 8);
    if (imgAlt) out.item_name = imgAlt;
  }
  if (!out.item_name) {
    // 2) Subject quoted title
    const q = (subject.match(/:\s*"?([^"]+?)"?\s*$/) || [])[1];
    if (q && q.length > 8) out.item_name = q;
  }

  // totals
  const totalText =
    (bodyText.match(/Total:\s*\$[0-9,.]+/i) || [])[0] ||
    (bodyText.match(/Order total:\s*\$[0-9,.]+/i) || [])[0] ||
    (text && (text.match(/Total:\s*\$[0-9,.]+/i) || [])[0]) ||
    "";
  const totalCents = parseMoney(totalText);
  if (totalCents != null) out.total_cents = totalCents;

  // qty fallback from whole page
  if (!out.quantity) {
    const q = (bodyText.match(/Quantity:\s*(\d+)/i) || [])[1];
    if (q) out.quantity = parseInt(q, 10);
  }

  return out;
}

function parseAmazonShipping(html, text, subject = "") {
  const $ = cheerio.load(html || "");
  const bodyText = $("body").text().replace(/\s+/g, " ").trim();

  // Amazon shipping emails often omit carrier tracking; grab any plausible token
  const tn =
    (bodyText.match(/\b1Z[0-9A-Z]{10,}\b/i) || [])[0] ||
    (bodyText.match(/\b(92|94|95)\d{20,}\b/) || [])[0] ||
    // Amazon internal tracking (long mixed token after "Tracking number")
    (bodyText.match(/Tracking number\s*([A-Z0-9\-]{12,})/i) || [])[1] ||
    null;

  const carrier = pickCarrierByTracking(tn || "", html, text) || "Amazon";

  // Extract order id too (sometimes needed to tie)
  const order_id = extractAmazonOrderId(subject, bodyText) || null;

  return {
    tracking_number: tn || null,
    carrier,
    status: "in_transit",
    order_id, // used by caller if missing
  };
}

function parseAmazonDelivered(html, text, subject = "") {
  const $ = cheerio.load(html || "");
  const bodyText = $("body").text().replace(/\s+/g, " ").trim();

  // Same tracking heuristics
  const tn =
    (bodyText.match(/\b1Z[0-9A-Z]{10,}\b/i) || [])[0] ||
    (bodyText.match(/\b(92|94|95)\d{20,}\b/) || [])[0] ||
    (bodyText.match(/Tracking number\s*([A-Z0-9\-]{12,})/i) || [])[1] ||
    null;

  const carrier = pickCarrierByTracking(tn || "", html, text) || "Amazon";
  const order_id = extractAmazonOrderId(subject, bodyText) || null;

  return { status: "delivered", tracking_number: tn || null, carrier, order_id };
}

/* =============================== RETAILERS =============================== */
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
    parseDelivered: () => ({ status: "delivered" }),
  },
  {
    name: "Amazon",
    senderMatch: (from) =>
      /@amazon\.(com|ca|co\.uk|de|fr|it|es|co\.jp)$/i.test(from) ||
      /order-update@amazon/i.test(from) ||
      /shipment-tracking@amazon/i.test(from) ||
      /ship-confirm@amazon/i.test(from),
    // These match your screenshots exactly:
    orderSubject: /^(ordered:|your amazon\.com order)/i,
    shipSubject: /^(shipped:|your package was shipped)/i,
    deliverSubject: /^(delivered:|your package was delivered)/i,
    cancelSubject: /(canceled|cancelled)/i,
    parseOrder: (html, text, subject) => parseAmazonOrderEnhanced(html, text, subject),
    parseShipping: (html, text, subject) => parseAmazonShipping(html, text, subject),
    parseDelivered: (html, text, subject) => parseAmazonDelivered(html, text, subject),
  },
];

/* ========================== Gmail & payload utils ======================== */
async function getAccount() {
  const { data, error } = await supabase
    .from("email_accounts")
    .select("id, user_id, email_address, access_token, refresh_token, updated_at")
    .order("updated_at", { ascending: false })
    .limit(1);
  if (error) throw error;
  if (!data?.length) throw new Error("No connected Gmail account in email_accounts");
  return data[0];
}

async function getGmailClientWithAccount(acct) {
  oauth2.setCredentials({
    access_token: acct.access_token,
    refresh_token: acct.refresh_token,
    scope: "https://www.googleapis.com/auth/gmail.readonly",
  });

  oauth2.on("tokens", async (tokens) => {
    if (tokens.access_token) {
      await supabase.from("email_accounts").update({ access_token: tokens.access_token }).eq("id", acct.id);
    }
  });

  try {
    await oauth2.getAccessToken();
  } catch (e) {
    if (acct.refresh_token) {
      const { credentials } = await oauth2.refreshAccessToken();
      oauth2.setCredentials(credentials);
      if (credentials?.access_token) {
        await supabase.from("email_accounts").update({ access_token: credentials.access_token }).eq("id", acct.id);
      }
    } else {
      throw new Error("Gmail token expired and no refresh token available");
    }
  }

  return google.gmail({ version: "v1", auth: oauth2 });
}

async function listCandidateMessageIds(gmail, maxTotal = 60) {
  const q = [
    "newer_than:120d",
    "in:inbox",
    // broad but focused
    '(subject:"ordered:" OR subject:"shipped:" OR subject:"delivered:" OR subject:"order" OR subject:"shipped" OR subject:"delivered" OR subject:"shipment" OR subject:"canceled" OR subject:"cancelled")',
  ].join(" ");

  const ids = [];
  let pageToken;
  while (ids.length < maxTotal) {
    const res = await gmail.users.messages.list({
      userId: "me",
      q,
      maxResults: Math.min(50, maxTotal - ids.length),
      pageToken,
    });
    (res.data.messages || []).forEach((m) => ids.push(m.id));
    pageToken = res.data.nextPageToken;
    if (!pageToken) break;
  }
  return Array.from(new Set(ids));
}

async function getMessageFull(gmail, id) {
  const res = await gmail.users.messages.get({ userId: "me", id, format: "full" });
  return res.data;
}
function headersToObj(headers = []) {
  const o = {};
  headers.forEach((h) => (o[h.name.toLowerCase()] = h.value || ""));
  return o;
}
function decodeB64url(str) {
  if (!str) return "";
  const buff = Buffer.from(str.replace(/-/g, "+").replace(/_/g, "/"), "base64");
  return buff.toString("utf8");
}
function extractBodyParts(payload) {
  let html = null;
  let text = null;
  function walk(p) {
    if (!p) return;
    if (p.mimeType === "text/html" && p.body?.data) html = decodeB64url(p.body.data);
    if (p.mimeType === "text/plain" && p.body?.data) text = decodeB64url(p.body.data);
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

/* =========================== Classify + DB utils ========================= */
function classifyType(retailer, subject) {
  const s = (subject || "").toLowerCase();
  // Amazon’s “Ordered: … / Shipped: … / Delivered: …” are handled explicitly in RETAILERS regexes,
  // but we keep fallbacks here too:
  if (retailer.cancelSubject?.test(s)) return "canceled";
  if (retailer.deliverSubject?.test(s)) return "delivered";
  if (retailer.shipSubject?.test(s)) return "shipping";
  if (retailer.orderSubject?.test(s)) return "order";
  if (/\b(cancel|cancelled)\b/i.test(s)) return "canceled";
  if (/\b(delivered|has been delivered)\b/i.test(s)) return "delivered";
  if (/\b(shipped|on the way|label created|tracking)\b/i.test(s)) return "shipping";
  if (/\b(order|confirmation|thanks for your order|we got your order)\b/i.test(s)) return "order";
  return null;
}
function classifyRetailer(from) {
  const f = (from || "").toLowerCase();
  return RETAILERS.find((r) => r.senderMatch(f)) || null;
}

async function orderExists(retailer, order_id, user_id) {
  if (!order_id) return false;
  const { data, error } = await supabase
    .from("email_orders")
    .select("id")
    .eq("user_id", user_id)
    .eq("retailer", retailer)
    .eq("order_id", order_id)
    .maybeSingle();
  if (error && error.code !== "PGRST116") throw error;
  return !!data;
}
async function upsertOrder(row, user_id_for_fallback) {
  const { data: existing, error: selErr } = await supabase
    .from("email_orders")
    .select("id")
    .eq("user_id", row.user_id ?? user_id_for_fallback)
    .eq("retailer", row.retailer)
    .eq("order_id", row.order_id)
    .maybeSingle();
  if (selErr && selErr.code !== "PGRST116") throw selErr;

  if (existing?.id) {
    const { error: updErr } = await supabase.from("email_orders").update(row).eq("id", existing.id);
    if (updErr) throw updErr;
    return existing.id;
  } else {
    const insertRow = { user_id: user_id_for_fallback, ...row };
    const { data: ins, error: insErr } = await supabase
      .from("email_orders")
      .insert(insertRow)
      .select("id")
      .maybeSingle();
    if (insErr) throw insErr;
    return ins?.id ?? null;
  }
}
async function upsertShipment(row, user_id_for_fallback) {
  if (!row.tracking_number) return null;
  const { data: existing, error: selErr } = await supabase
    .from("email_shipments")
    .select("id")
    .eq("user_id", row.user_id ?? user_id_for_fallback)
    .eq("retailer", row.retailer)
    .eq("order_id", row.order_id)
    .eq("tracking_number", row.tracking_number)
    .maybeSingle();
  if (selErr && selErr.code !== "PGRST116") throw selErr;

  if (existing?.id) {
    const { error: updErr } = await supabase
      .from("email_shipments")
      .update(row)
      .eq("id", existing.id);
    if (updErr) throw updErr;
    return existing.id;
  } else {
    const insertRow = { user_id: user_id_for_fallback, ...row };
    const { data: ins, error: insErr } = await supabase
      .from("email_shipments")
      .insert(insertRow)
      .select("id")
      .maybeSingle();
    if (insErr) throw insErr;
    return ins?.id ?? null;
  }
}
function ymd(dateStr) {
  if (!dateStr) return null;
  const d = new Date(dateStr);
  if (isNaN(d)) return null;
  return d.toISOString().slice(0, 10);
}

/* ================================= SYNC ================================== */
async function runSync(event) {
  const started = Date.now();
  const TIME_BUDGET_MS = Number(process.env.FUNCTION_TIMEOUT_MS) || 22000;
  const SOFT_DEADLINE = started + TIME_BUDGET_MS - 3000;

  const mode = (event.queryStringParameters?.mode || "").toLowerCase();
  const max = Math.max(
    20,
    Math.min(500, Number(event.queryStringParameters?.max || 0) || 60)
  );

  const acct = await getAccount();
  const gmail = await getGmailClientWithAccount(acct);
  const user_id = acct.user_id;

  const ids = await listCandidateMessageIds(gmail, max);

  const proposed = [];
  let imported = 0;
  let updated = 0;
  let skipped_existing = 0;

  const BATCH = 25;
  for (let i = 0; i < ids.length; i += BATCH) {
    if (Date.now() > SOFT_DEADLINE) break;
    const slice = ids.slice(i, i + BATCH);

    for (const id of slice) {
      if (Date.now() > SOFT_DEADLINE) break;
      try {
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

        if (mode === "preview" && type !== "order") continue;

        // Parse
        let parsed = {};
        if (type === "order" && retailer.parseOrder) parsed = retailer.parseOrder(html, text, subject);
        else if (type === "shipping" && retailer.parseShipping) parsed = retailer.parseShipping(html, text, subject);
        else if (type === "delivered" && retailer.parseDelivered) parsed = retailer.parseDelivered(html, text, subject);
        else if (type === "canceled") parsed = { status: "canceled" };

        let order_id =
          parsed.order_id ||
          ((subject.match(/\b\d{3}-\d{7}-\d{7}\b/) || [])[0]) ||
          ((subject.match(/#\s*([0-9\-]+)/) || [])[1]) ||
          null;

        if (mode === "preview") {
          const exists = await orderExists(retailer.name, order_id, user_id);
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

        if (type === "order") {
          const exists = await orderExists(retailer.name, order_id, user_id);
          const row = {
            user_id,
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
          await upsertOrder(row, user_id);
          if (exists) skipped_existing++; else imported++;
        }

        if (type === "shipping") {
          // parsed may include order_id from body for Amazon
          if (!order_id && parsed.order_id) order_id = parsed.order_id;

          const ship = {
            user_id,
            retailer: retailer.name,
            order_id: order_id || "Unknown",
            tracking_number: parsed.tracking_number || null,
            carrier: parsed.carrier || "",
            status: parsed.status || "in_transit",
            shipped_at: ymd(messageDate),
            delivered_at: null,
          };
          await upsertShipment(ship, user_id);

          if (order_id) {
            await upsertOrder(
              { retailer: retailer.name, order_id, shipped_at: messageDate.toISOString(), status: "in_transit" },
              user_id
            );
          }
          updated++;
        }

        if (type === "delivered") {
          if (!order_id && parsed.order_id) order_id = parsed.order_id;

          if (order_id) {
            await upsertOrder(
              { retailer: retailer.name, order_id, delivered_at: messageDate.toISOString(), status: "delivered" },
              user_id
            );
          }
          // also store final tracking if present
          if (parsed.tracking_number) {
            await upsertShipment(
              {
                user_id,
                retailer: retailer.name,
                order_id: order_id || "Unknown",
                tracking_number: parsed.tracking_number,
                carrier: parsed.carrier || "",
                status: "delivered",
                shipped_at: null,
                delivered_at: ymd(messageDate),
              },
              user_id
            );
          }
          updated++;
        }

        if (type === "canceled") {
          if (order_id) {
            await upsertOrder(
              { retailer: retailer.name, order_id, order_date: ymd(messageDate), status: "canceled" },
              user_id
            );
          }
          updated++;
        }
      } catch (e) {
        console.error("message sync error:", e?.message || e);
      }
    }
  }

  if (mode === "preview") return json({ proposed }, 200, started);
  if (mode === "commit") return json({ imported, updated, skipped_existing }, 200, started);
  return json({ imported, updated, skipped_existing }, 200, started);
}

/* ================================ Utilities ============================== */
function json(body, status = 200, startedTs) {
  const headers = { "content-type": "application/json" };
  if (startedTs) headers["x-duration-ms"] = String(Date.now() - startedTs);
  return { statusCode: status, headers, body: JSON.stringify(body) };
}

/* ================================= Handler =============================== */
export async function handler(event) {
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
