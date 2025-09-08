// netlify/functions/gmail-sync.js
// CommonJS build (works on Netlify) – robust Amazon/Target parsers.

const { google } = require("googleapis");
const cheerio = require("cheerio");
const { createClient } = require("@supabase/supabase-js");

/* ----------------------------- Supabase init ----------------------------- */
const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_SERVICE_ROLE_KEY =
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_ANON_KEY;
if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
  console.warn("Missing SUPABASE env. Health check can still run.");
}
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

/* ------------------------------ Retailer map ----------------------------- */
/** Classification + retailer-specific parse hooks */
const RETAILERS = [
  /* ----------------------------- TARGET ----------------------------- */
  {
    name: "Target",
    senderMatch: (from) =>
      /(^|<)\s*.*@target\.com\s*(>|$)/i.test(from) ||
      /(^|<)\s*order.*@target\.com\s*(>|$)/i.test(from),
    orderSubject: /(thanks for your order|order\s*#)/i,
    shipSubject: /(on the way|has shipped|shipping confirmation|your order has shipped)/i,
    deliverSubject: /(delivered|was delivered|delivered successfully)/i,
    cancelSubject: /(canceled|cancelled|order.*cancel)/i,
    parseOrder: parseTargetOrder,
    parseShipping: parseTargetShipping,
    parseDelivered: () => ({ status: "delivered" }),
  },

  /* ----------------------------- AMAZON ----------------------------- */
  {
    name: "Amazon",
    senderMatch: (from) =>
      /(^|<)\s*.*@amazon\.(com|ca|co\.uk|de|fr|it|es|co\.jp)\s*(>|$)/i.test(from),
    // These match the exact subjects on your screenshots
    orderSubject: /^(ordered:|your order|thanks for your order)/i,
    shipSubject: /^(shipped:|your package was shipped|has shipped)/i,
    deliverSubject: /^(delivered:|your package was delivered)/i,
    cancelSubject: /(order.*(canceled|cancelled))/i,
    parseOrder: parseAmazonOrder,
    parseShipping: parseAmazonShipping,
    parseDelivered: parseAmazonDelivered,
  },
];

/* --------------------------- Small helpers --------------------------- */
const json = (body, status = 200) => ({
  statusCode: status,
  headers: { "content-type": "application/json" },
  body: JSON.stringify(body),
});

const ymd = (dateStr) => {
  if (!dateStr) return null;
  const d = new Date(dateStr);
  return isNaN(d) ? null : d.toISOString().slice(0, 10);
};

const headersToObj = (headers = []) => {
  const o = {};
  headers.forEach((h) => (o[(h.name || "").toLowerCase()] = h.value || ""));
  return o;
};

const decodeB64url = (str) =>
  !str
    ? ""
    : Buffer.from(str.replace(/-/g, "+").replace(/_/g, "/"), "base64").toString(
        "utf8"
      );

function extractBodyParts(payload) {
  let html = null;
  let text = null;
  const walk = (p) => {
    if (!p) return;
    if (p.mimeType === "text/html" && p.body?.data) html = decodeB64url(p.body.data);
    if (p.mimeType === "text/plain" && p.body?.data) text = decodeB64url(p.body.data);
    (p.parts || []).forEach(walk);
  };
  walk(payload);
  if (!html && /html/i.test(payload?.mimeType || "") && payload?.body?.data)
    html = decodeB64url(payload.body.data);
  if (!text && /plain/i.test(payload?.mimeType || "") && payload?.body?.data)
    text = decodeB64url(payload.body.data);
  return { html, text };
}

function parseMoney(str = "") {
  const m = String(str).replace(/,/g, "").match(/\$?\s*([0-9]+(?:\.[0-9]{2})?)/);
  return m ? Math.round(parseFloat(m[1]) * 100) : null;
}

function classifyRetailer(from) {
  const f = (from || "").toLowerCase();
  return RETAILERS.find((r) => r.senderMatch(f)) || null;
}
function classifyType(retailer, subject) {
  const s = (subject || "").toLowerCase();
  if (retailer.orderSubject?.test(s)) return "order";
  if (retailer.shipSubject?.test(s)) return "shipping";
  if (retailer.deliverSubject?.test(s)) return "delivered";
  if (retailer.cancelSubject?.test(s)) return "canceled";
  return null;
}

/* -------------------------- Gmail client helpers ------------------------- */
async function getAccount() {
  const { data, error } = await supabase
    .from("email_accounts")
    .select("id, user_id, email_address, access_token, refresh_token")
    .order("updated_at", { ascending: false })
    .limit(1);
  if (error) throw error;
  if (!data?.length) throw new Error("No connected Gmail account");
  return data[0];
}

async function getGmailClient() {
  const acct = await getAccount();
  oauth2.setCredentials({
    access_token: acct.access_token,
    refresh_token: acct.refresh_token,
    scope: "https://www.googleapis.com/auth/gmail.readonly",
  });
  try {
    await oauth2.getAccessToken();
  } catch (e) {
    if (acct.refresh_token) {
      const { credentials } = await oauth2.refreshAccessToken();
      oauth2.setCredentials(credentials);
    } else {
      throw new Error("Gmail token expired and no refresh token available");
    }
  }
  return { gmail: google.gmail({ version: "v1", auth: oauth2 }), acctUserId: acct.user_id };
}

async function listCandidateMessageIds(gmail) {
  // Amazon & Target, last 90 days, in:inbox, only the 3 life-cycle subjects
  const queries = [
    '(from:amazon.com OR from:"@amazon.") (subject:ordered OR subject:shipped OR subject:delivered) newer_than:90d in:inbox',
    '(from:target.com) (subject:order OR subject:shipped OR subject:delivered OR subject:cancel) newer_than:90d in:inbox',
  ];
  const ids = new Set();
  for (const q of queries) {
    let pageToken;
    for (let i = 0; i < 6; i++) {
      const res = await gmail.users.messages.list({
        userId: "me",
        q,
        maxResults: 50,
        pageToken,
      });
      (res.data.messages || []).forEach((m) => ids.add(m.id));
      pageToken = res.data.nextPageToken;
      if (!pageToken) break;
    }
  }
  return Array.from(ids);
}

async function getMessageFull(gmail, id) {
  const res = await gmail.users.messages.get({
    userId: "me",
    id,
    format: "full",
  });
  return res.data;
}

/* ------------------------------ TARGET parsers --------------------------- */
function parseTargetOrder(html, text) {
  const $ = cheerio.load(html || "");
  const out = {};
  out.order_id =
    ($("body").text().match(/Order\s*#\s*([0-9\-]+)/i) || [])[1] ||
    (text && (text.match(/Order\s*#\s*([0-9\-]+)/i) || [])[1]) ||
    null;

  // Total
  const totalNode = $('*:contains("Order total")')
    .filter((_, el) => /Order total/i.test($(el).text()))
    .first();
  const totalText = (totalNode.next().text() || totalNode.text() || "").trim();
  const totalCents = parseMoney(totalText);
  if (totalCents != null) out.total_cents = totalCents;

  // Quantity
  const qty =
    (($("body").text().match(/Qty:\s*([0-9]+)/i) || [])[1]) ||
    (($('*:contains("Qty")').first().text().match(/Qty[:\s]+([0-9]+)/i) || [])[1]);
  if (qty) out.quantity = parseInt(qty, 10);

  // Item name
  let item = "";
  $('img[alt]').each((_, el) => {
    const alt = ($(el).attr("alt") || "").trim();
    if (/logo|target|thanks/i.test(alt)) return;
    if (alt.length > 12 && alt.length < 180) item = item || alt;
  });
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

  // Unit price
  const each =
    (($("body").text().match(/\$[0-9]+(?:\.[0-9]{2})?\s*\/\s*ea/i) || [])[0]) ||
    null;
  if (each) out.unit_price_cents = parseMoney(each);

  // Image
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

function parseTargetShipping(html, text) {
  const content = (html || "") + " " + (text || "");
  const tracking =
    (content.match(/\b(1Z[0-9A-Z]{10,})\b/i) || [])[1] ||
    (content.match(/\b([A-Z0-9]{10,25})\b/g) || []).find((x) => x.length >= 12) ||
    null;
  const carrier =
    /UPS/i.test(content) ? "UPS" : /USPS/i.test(content) ? "USPS" : /FedEx/i.test(content) ? "FedEx" : "";
  return { tracking_number: tracking || null, carrier, status: "in_transit" };
}

/* ------------------------------ AMAZON parsers --------------------------- */
/** Amazon ORDERED (see your screenshots) */
function parseAmazonOrder(html, text) {
  const $ = cheerio.load(html || "");
  const out = {};

  // Order ID always shows as "Order # 114-xxxx-xxxxx"
  out.order_id =
    ($("body").text().match(/Order\s*#\s*([0-9\-]+)/i) || [])[1] ||
    (text && (text.match(/Order\s*#\s*([0-9\-]+)/i) || [])[1]) ||
    null;

  // Product block heuristic: find the block with “Quantity:”
  const qtyEl = $('*:contains("Quantity:")').filter((_, el) =>
    /Quantity:/i.test($(el).text())
  ).first();

  // Item name is usually an <a> just above the quantity block
  let item = "";
  if (qtyEl.length) {
    const titleAnchor = qtyEl
      .closest("tr,td,div,table")
      .find("a")
      .filter((_, a) => {
        const t = ($(a).text() || "").trim();
        return t.length > 8 && !/Your Orders|Your Account|Buy Again/i.test(t);
      })
      .first();
    item = (titleAnchor.text() || "").trim();
  }
  if (!item) {
    // Fallback: pick the longest meaningful anchor text on the page
    const candidates = [];
    $("a").each((_, a) => {
      const t = ($(a).text() || "").trim();
      if (t.length > 8 && t.length < 160 && !/Your Orders|Your Account|Buy Again/i.test(t)) {
        candidates.push(t);
      }
    });
    item = candidates.sort((a, b) => b.length - a.length)[0] || "";
  }
  if (item) out.item_name = item;

  // Quantity:
  const qty =
    (($("body").text().match(/Quantity:\s*([0-9]+)/i) || [])[1]) || null;
  if (qty) out.quantity = parseInt(qty, 10);

  // Unit price: the small price near the product; if not, just skip
  const afterQty = qtyEl.length ? qtyEl.closest("tr,td,div,table").text() : $("body").text();
  const unitPriceCents = parseMoney(
    (afterQty.match(/\$[0-9]+\.[0-9]{2}\s*(?=\/?ea)?/i) || [])[0] || ""
  );
  if (unitPriceCents != null) out.unit_price_cents = unitPriceCents;

  // Order total
  const totalLine =
    ($("body").text().match(/Total\s*\$[0-9,.]+/i) || [])[0] || "";
  const totalCents = parseMoney(totalLine);
  if (totalCents != null) out.total_cents = totalCents;

  // Image – first product-looking image (not logo)
  let img = null;
  $("img").each((_, el) => {
    const src = $(el).attr("src") || "";
    const alt = ($(el).attr("alt") || "").toLowerCase();
    const looksLogo = /logo|amazon|icon|smile|sprite/i.test(src) || /amazon|logo|icon/i.test(alt);
    if (!looksLogo && /^https?:/i.test(src)) img = img || src;
  });
  if (img) out.image_url = img;

  return out;
}

/** Amazon SHIPPED – capture “Track package” link as tracking_number and mark carrier Amazon */
function parseAmazonShipping(html, text) {
  const $ = cheerio.load(html || "");
  let trackUrl = null;

  // Anchor literally says "Track package" in your screenshots
  const a = $('a:contains("Track package")').first();
  if (a.length) {
    const href = a.attr("href");
    if (href && /^https?:/i.test(href)) trackUrl = href;
  }

  // Fallback: any link ending in /progress-tracker/ or gp/your-account/order-details
  if (!trackUrl) {
    $("a").each((_, el) => {
      const href = ($(el).attr("href") || "").trim();
      if (/https?:\/\/.*amazon\.[^/]+\/.*(progress|track|trackpackage)/i.test(href))
        trackUrl = trackUrl || href;
    });
  }

  return {
    tracking_number: trackUrl || null, // we store the URL; UI will open it (see note below)
    carrier: "Amazon",
    status: "in_transit",
  };
}

/** Amazon DELIVERED – just mark delivered  */
function parseAmazonDelivered() {
  return { status: "delivered" };
}

/* --------------------------- DB upsert helpers --------------------------- */
async function upsertOrder(row) {
  // expects retailer, user_id, order_id...
  const { data, error } = await supabase
    .from("email_orders")
    .upsert(row, { onConflict: "retailer,order_id,user_id" })
    .select("id")
    .maybeSingle();
  if (error) throw error;
  return data?.id || null;
}

async function upsertShipment(row) {
  if (!row.tracking_number && !row.status) return null;
  const { data, error } = await supabase
    .from("email_shipments")
    .upsert(row, { onConflict: "retailer,order_id,tracking_number,user_id" })
    .select("id")
    .maybeSingle();
  if (error) throw error;
  return data?.id || null;
}

async function orderExists(user_id, retailer, order_id) {
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

/* -------------------------------- Handler -------------------------------- */
module.exports.handler = async (event) => {
  // Health check
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
    const mode = (event.queryStringParameters?.mode || "").toLowerCase();

    const { gmail, acctUserId } = await getGmailClient();
    const ids = await listCandidateMessageIds(gmail);

    const proposed = [];
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

      if (!retailer) continue; // “Undefined” not saved — only Amazon/Target for now
      const type = classifyType(retailer, subject);
      if (!type) continue;

      // Parse by type
      let parsed = {};
      if (type === "order") parsed = retailer.parseOrder(html, text) || {};
      else if (type === "shipping") parsed = retailer.parseShipping(html, text) || {};
      else if (type === "delivered") parsed = retailer.parseDelivered(html, text) || {};
      else if (type === "canceled") parsed = { status: "canceled" };

      const order_id =
        parsed.order_id ||
        ((subject.match(/Order\s*#\s*([0-9\-]+)/i) || [])[1]) ||
        null;

      if (mode === "preview") {
        if (!(await orderExists(acctUserId, retailer.name, order_id))) {
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

      /* -------------------------- normal sync -------------------------- */
      if (type === "order") {
        const exists = await orderExists(acctUserId, retailer.name, order_id);
        await upsertOrder({
          user_id: acctUserId,
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
        });
        if (exists) skipped_existing++;
        else imported++;
      }

      if (type === "shipping") {
        await upsertShipment({
          user_id: acctUserId,
          retailer: retailer.name,
          order_id: order_id || "Unknown",
          tracking_number: parsed.tracking_number || null, // for Amazon: this is the “Track package” URL
          carrier: parsed.carrier || "",
          status: parsed.status || "in_transit",
          shipped_at: ymd(messageDate),
          delivered_at: null,
        });

        if (order_id) {
          await upsertOrder({
            user_id: acctUserId,
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
            user_id: acctUserId,
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
            user_id: acctUserId,
            retailer: retailer.name,
            order_id,
            status: "canceled",
          });
        }
        updated++;
      }
    }

    if (mode === "preview") return json({ proposed });
    return json({ imported, updated, skipped_existing });
  } catch (err) {
    console.error("gmail-sync error:", err);
    return json({ error: String(err?.message || err) }, 500);
  }
};
