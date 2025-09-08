// netlify/functions/gmail-sync.js
// Gmail sync: import order/shipping/delivery mails into email_orders & email_shipments

const { google } = require("googleapis");
const cheerio = require("cheerio");
const { createClient } = require("@supabase/supabase-js");

/* ----------------------------- Supabase init ----------------------------- */
const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_SERVICE_ROLE_KEY =
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_ANON_KEY; // SRK preferred
if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
  console.warn("Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY");
}
const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
  auth: { persistSession: false },
});

/* ---------------------------- Gmail OAuth init --------------------------- */
const OAUTH_CLIENT_ID = process.env.GMAIL_OAUTH_CLIENT_ID || "";
const OAUTH_CLIENT_SECRET = process.env.GMAIL_OAUTH_CLIENT_SECRET || "";
const OAUTH_REDIRECT_URI =
  process.env.GMAIL_OAUTH_REDIRECT_URI || "http://localhost";
const oauth2 = new google.auth.OAuth2(
  OAUTH_CLIENT_ID,
  OAUTH_CLIENT_SECRET,
  OAUTH_REDIRECT_URI
);

/* ------------------------------ Utils ----------------------------------- */
const json = (body, status = 200) => ({
  statusCode: status,
  headers: { "content-type": "application/json" },
  body: JSON.stringify(body),
});
const ymd = (d) => {
  if (!d) return null;
  const dd = new Date(d);
  if (isNaN(dd)) return null;
  return dd.toISOString().slice(0, 10);
};

/* ------------------------------ Retailer map ----------------------------- */
const RETAILERS = [
  // AMAZON (strong HTML parsers)
  {
    name: "Amazon",
    senderMatch: (from) =>
      /(^|<|\s)(auto-confirm|order-update|shipment-tracking)@amazon\.(com|ca|co\.uk|de|fr|it|es|co\.jp)(>|$|\s)/i.test(
        from
      ) || /@amazon\.(com|ca|co\.uk|de|fr|it|es|co\.jp)$/i.test(from),
    orderSubject: /\b(ordered|order(?:ed)?|order confirmation)\b/i,
    shipSubject: /\b(shipped|shipment confirmation|on (?:its|the) way)\b/i,
    deliverSubject: /\b(delivered|has been delivered)\b/i,
    cancelSubject: /\b(cancel(?:led|ed))\b/i,
    parseOrder: parseAmazonOrderStrong,
    parseShipping: parseAmazonShippingStrong,
    parseDelivered: parseAmazonDeliveredStrong,
  },

  // TARGET (basic but reliable)
  {
    name: "Target",
    senderMatch: (from) =>
      /(order|noreply|guest)@target\.com/i.test(from) || /@target\.com$/i.test(from),
    orderSubject: /(thanks for your order|order\s*#\s*\d+)/i,
    shipSubject: /(on the way|has shipped|shipping confirmation)/i,
    deliverSubject: /(delivered|was delivered|delivered successfully)/i,
    cancelSubject: /(canceled|cancelled|order.*cancel)/i,
    parseOrder: parseTargetOrder,
    parseShipping: parseTargetShipping,
    parseDelivered: parseGenericDelivered,
  },
];

/* -------------------------- Cheerio helpers ------------------------------ */
function textAll($, sel) {
  return $(sel).text().replace(/\s+/g, " ").trim();
}
function findFirstLink($, texts = []) {
  const want = texts.map((t) => t.toLowerCase());
  let href = null;
  $("a").each((_i, a) => {
    const t = ($(a).text() || "").toLowerCase().trim();
    if (want.some((w) => t.includes(w))) {
      const h = $(a).attr("href") || "";
      if (/^https?:\/\//i.test(h)) {
        href = h;
        return false;
      }
    }
  });
  return href;
}
function firstProductImage($) {
  let src = null;
  $("img").each((_i, img) => {
    const s = $(img).attr("src") || "";
    const alt = ($(img).attr("alt") || "").toLowerCase();
    if (!s) return;
    if (/logo|amazon|prime|icon|spacer|target/i.test(s) || /logo|amazon|prime|target/i.test(alt)) return;
    if (/^https?:\/\//i.test(s)) {
      src = s;
      return false;
    }
  });
  return src;
}
function pickMoneyCents(str) {
  const m = String(str).replace(/,/g, "").match(/\$([0-9]+(?:\.[0-9]{2})?)/);
  return m ? Math.round(parseFloat(m[1]) * 100) : null;
}
function firstMatch(re, ...txt) {
  const blob = txt.filter(Boolean).join(" ");
  const m = blob.match(re);
  return (m && m[1]) || null;
}

/* ------------------------------ Parsers ---------------------------------- */
// AMAZON — ORDER
function parseAmazonOrderStrong(html, text) {
  const $ = cheerio.load(html || "");
  const body = (text || "") + " " + textAll($, "body");

  const order_id =
    firstMatch(/Order\s*#\s*([0-9\-]+)/i, body) ||
    firstMatch(/#\s*([0-9]{3}-\d{7}-\d{7})/, body);

  let item_name = textAll($, "a[href*='/gp/']");
  if (!item_name || item_name.length < 6) {
    const parts = textAll($, "td,div,p").split("\n").filter(Boolean);
    item_name = parts.sort((a, b) => b.length - a.length)[0] || null;
  }

  const qty =
    parseInt(
      firstMatch(/Quantity[:\s]+([0-9]+)/i, body) ||
      firstMatch(/\bQty[:\s]+([0-9]+)/i, body) ||
      "0",
      10
    ) || null;

  const total_cents =
    pickMoneyCents(firstMatch(/Total[:\s]+(\$[0-9\.,]+)/i, body) || "") ||
    pickMoneyCents(firstMatch(/Order\s*total[:\s]+(\$[0-9\.,]+)/i, body) || "");

  const unit_price_cents =
    pickMoneyCents(firstMatch(/(\$[0-9\.,]+)\s*\/?\s*ea/i, body) || "") || null;

  const image_url = firstProductImage($);
  const track_url = findFirstLink($, ["track package", "track your package"]) || null;

  return {
    order_id,
    item_name,
    quantity: qty,
    total_cents,
    unit_price_cents,
    image_url,
    tracking_url: track_url,
  };
}

// AMAZON — SHIPPED
function parseAmazonShippingStrong(html, text) {
  const $ = cheerio.load(html || "");
  const body = (text || "") + " " + textAll($, "body");

  const order_id =
    firstMatch(/Order\s*#\s*([0-9\-]+)/i, body) ||
    firstMatch(/#\s*([0-9]{3}-\d{7}-\d{7})/, body);

  const track_url =
    findFirstLink($, ["track package", "track your package"]) || null;
  const image_url = firstProductImage($);

  return {
    order_id,
    tracking_number: track_url || null, // store URL as tracking for Amazon
    carrier: "Amazon",
    status: "in_transit",
    image_url,
  };
}

// AMAZON — DELIVERED
function parseAmazonDeliveredStrong(html, text) {
  const $ = cheerio.load(html || "");
  const body = (text || "") + " " + textAll($, "body");
  const order_id =
    firstMatch(/Order\s*#\s*([0-9\-]+)/i, body) ||
    firstMatch(/#\s*([0-9]{3}-\d{7}-\d{7})/, body);
  const track_url =
    findFirstLink($, ["track package", "track your package"]) || null;
  const image_url = firstProductImage($);
  return {
    order_id,
    status: "delivered",
    tracking_number: track_url || null,
    carrier: "Amazon",
    image_url,
  };
}

// TARGET — ORDER (basic but robust)
function parseTargetOrder(html, text) {
  const $ = cheerio.load(html || "");
  const body = (text || "") + " " + textAll($, "body");
  const order_id =
    firstMatch(/Order\s*#\s*([0-9\-]+)/i, body) ||
    firstMatch(/#\s*([0-9\-]+)/i, body);

  const total_cents =
    pickMoneyCents(firstMatch(/Order\s*total[:\s]+(\$[0-9\.,]+)/i, body) || "") ||
    pickMoneyCents(firstMatch(/Total[:\s]+(\$[0-9\.,]+)/i, body) || "");

  const qty =
    parseInt(
      firstMatch(/Qty[:\s]+([0-9]+)/i, body) || firstMatch(/Quantity[:\s]+([0-9]+)/i, body) || "0",
      10
    ) || null;

  let item_name = "";
  $("img[alt]").each((_i, el) => {
    const alt = ($(el).attr("alt") || "").trim();
    if (alt && !/logo|target|icon/i.test(alt) && alt.length > 8) {
      if (!item_name) item_name = alt;
    }
  });
  if (!item_name) {
    const pick = textAll($, "td,div,p")
      .split("\n")
      .map((s) => s.trim())
      .filter(Boolean)
      .sort((a, b) => b.length - a.length)[0];
    item_name = pick || null;
  }

  const image_url = firstProductImage($);
  return { order_id, item_name, quantity: qty, total_cents, image_url };
}

// TARGET — SHIPPING (simple tracking extraction)
function parseTargetShipping(html, text) {
  const content = (html || "") + " " + (text || "");
  const tn =
    (content.match(/\b(1Z[0-9A-Z]{10,})\b/i) || [])[1] ||
    (content.match(/\b([A-Z0-9]{12,25})\b/g) || []).find((x) => x.length >= 12) ||
    null;
  let carrier = "";
  if (/UPS/i.test(content) || /^1Z/i.test(tn || "")) carrier = "UPS";
  else if (/USPS/i.test(content)) carrier = "USPS";
  else if (/FedEx/i.test(content)) carrier = "FedEx";
  return { tracking_number: tn, carrier, status: "in_transit" };
}

// GENERIC delivered
function parseGenericDelivered() {
  return { status: "delivered" };
}

/* -------------------------- Gmail helpers ------------------------------- */
async function getAccount() {
  // Most-recent Gmail account
  const { data, error } = await supabase
    .from("email_accounts")
    .select("id, user_id, email_address, access_token, refresh_token")
    .order("updated_at", { ascending: false })
    .limit(1);
  if (error) throw error;
  if (!data || !data.length)
    throw new Error("No connected Gmail account in email_accounts");
  return data[0];
}

async function getGmailClient() {
  const acct = await getAccount();
  oauth2.setCredentials({
    access_token: acct.access_token,
    refresh_token: acct.refresh_token,
    // (omit expiry columns to avoid schema mismatches)
  });

  // If token refresh happens, persist new access_token
  oauth2.on("tokens", async (tokens) => {
    if (tokens.access_token) {
      await supabase
        .from("email_accounts")
        .update({ access_token: tokens.access_token })
        .eq("id", acct.id);
    }
  });

  // Try to get a token; refresh if needed
  try {
    await oauth2.getAccessToken();
  } catch (_e) {
    if (!acct.refresh_token) throw new Error("Gmail token expired");
    const { credentials } = await oauth2.refreshAccessToken();
    oauth2.setCredentials(credentials);
  }

  return { gmail: google.gmail({ version: "v1", auth: oauth2 }), userId: acct.user_id };
}

async function listCandidateMessageIds(gmail, { limit = 250 } = {}) {
  const q = [
    "newer_than:45d",
    "in:inbox",
    "(" +
      [
        'from:(@amazon.com) subject:(ordered OR shipped OR delivered OR order)',
        'from:(@target.com) subject:(order OR shipped OR delivered)',
      ].join(" OR ") +
    ")",
  ].join(" ");
  const ids = [];
  let pageToken;
  while (ids.length < limit) {
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
  return Array.from(new Set(ids)).slice(0, limit);
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
  if (!html && payload?.body?.data && /html/i.test(payload.mimeType || ""))
    html = decodeB64url(payload.body.data);
  if (!text && payload?.body?.data && /plain/i.test(payload.mimeType || ""))
    text = decodeB64url(payload.body.data);
  return { html, text };
}

/* --------------------------- DB helpers --------------------------------- */
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
async function upsertOrder(row) {
  const { data, error } = await supabase
    .from("email_orders")
    .upsert(row, { onConflict: "user_id,retailer,order_id" })
    .select("id")
    .maybeSingle();
  if (error) throw error;
  return data?.id || null;
}
async function upsertShipment(row) {
  if (!row.tracking_number) return null;
  const { data, error } = await supabase
    .from("email_shipments")
    .upsert(row, { onConflict: "user_id,retailer,order_id,tracking_number" })
    .select("id")
    .maybeSingle();
  if (error) throw error;
  return data?.id || null;
}

/* ------------------------ batching / time budget ------------------------ */
function timeBudget(ms = 23000) {
  const start = Date.now();
  return () => Date.now() - start < ms;
}
async function pMap(items, worker, { concurrency = 6, budgetOk = () => true } = {}) {
  const ret = [];
  let i = 0, active = 0;
  return new Promise((resolve) => {
    const next = () => {
      if (!budgetOk() || i >= items.length) {
        if (active === 0) resolve(ret);
        return;
      }
      active++;
      const idx = i++;
      Promise.resolve(worker(items[idx], idx))
        .then((r) => ret.push(r))
        .catch(() => ret.push(null))
        .finally(() => { active--; next(); });
    };
    for (let k = 0; k < Math.min(concurrency, items.length); k++) next();
  });
}

/* -------------------------------- Handler ------------------------------- */
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
    const limit = Math.max(50, Math.min(400, Number(event.queryStringParameters?.limit || 250)));
    const budgetOk = timeBudget(23000); // stay under Netlify 26s

    const { gmail, userId } = await getGmailClient();
    const ids = await listCandidateMessageIds(gmail, { limit });

    const proposed = [];
    let imported = 0, updated = 0, skipped_existing = 0;

    await pMap(
      ids,
      async (id) => {
        if (!budgetOk()) return null;

        const msg = await getMessageFull(gmail, id);
        const h = headersToObj(msg.payload?.headers || []);
        const subject = h["subject"] || "";
        const from = h["from"] || "";
        const dateHeader = h["date"] || "";
        const msgDate = dateHeader
          ? new Date(dateHeader)
          : new Date(msg.internalDate ? Number(msg.internalDate) : Date.now());
        const { html, text } = extractBodyParts(msg.payload || {});
        const retailer = RETAILERS.find((r) => r.senderMatch((from || "").toLowerCase()));
        if (!retailer) return null;

        const s = (subject || "").toLowerCase();
        let type = null;
        if (retailer.orderSubject?.test(s)) type = "order";
        else if (retailer.shipSubject?.test(s)) type = "shipping";
        else if (retailer.deliverSubject?.test(s)) type = "delivered";
        else if (retailer.cancelSubject?.test(s)) type = "canceled";
        else if (/\border( confirmation|ed)?\b/.test(s)) type = "order";
        else if (/\b(shipped|on the way|label created)\b/.test(s)) type = "shipping";
        else if (/\b(delivered)\b/.test(s)) type = "delivered";
        else if (/\b(cancel|cancelled)\b/.test(s)) type = "canceled";
        if (!type) return null;

        let parsed = {};
        if (type === "order" && retailer.parseOrder) parsed = retailer.parseOrder(html, text);
        else if (type === "shipping" && retailer.parseShipping) parsed = retailer.parseShipping(html, text);
        else if (type === "delivered" && retailer.parseDelivered) parsed = retailer.parseDelivered(html, text);
        else if (type === "canceled") parsed = { status: "canceled" };

        const order_id =
          parsed.order_id ||
          ((subject.match(/#\s*([0-9\-]+)/) || [])[1]) ||
          null;
        const retailerName = retailer.name;

        // PREVIEW
        if (mode === "preview" && type === "order") {
          const exists = await orderExists(userId, retailerName, order_id);
          if (!exists) {
            proposed.push({
              retailer: retailerName,
              order_id: order_id || "—",
              order_date: ymd(msgDate),
              item_name: parsed.item_name || null,
              quantity: parsed.quantity || null,
              unit_price_cents: parsed.unit_price_cents || null,
              total_cents: parsed.total_cents || null,
              image_url: parsed.image_url || null,
            });
          }
          return null;
        }
        if (mode === "preview") return null;

        // UPSERTS
        if (type === "order") {
          const exists = await orderExists(userId, retailerName, order_id);
          await upsertOrder({
            user_id: userId,
            retailer: retailerName,
            order_id: order_id || `unknown-${msg.id}`,
            order_date: ymd(msgDate),
            item_name: parsed.item_name || null,
            quantity: parsed.quantity || null,
            unit_price_cents: parsed.unit_price_cents || null,
            total_cents: parsed.total_cents || null,
            image_url: parsed.image_url || null,
            status: "ordered",
            source_message_id: msg.id,
          });
          if (exists) skipped_existing++; else imported++;
        }

        if (type === "shipping") {
          if (parsed.tracking_number) {
            await upsertShipment({
              user_id: userId,
              retailer: retailerName,
              order_id: order_id || "Unknown",
              tracking_number: parsed.tracking_number,
              carrier: parsed.carrier || "",
              status: parsed.status || "in_transit",
              shipped_at: ymd(msgDate),
              delivered_at: null,
            });
          }
          await upsertOrder({
            user_id: userId,
            retailer: retailerName,
            order_id: order_id || `unknown-${msg.id}`,
            shipped_at: msgDate.toISOString(),
            image_url: parsed.image_url || null,
            status: "in_transit",
          });
          updated++;
        }

        if (type === "delivered") {
          await upsertOrder({
            user_id: userId,
            retailer: retailerName,
            order_id: order_id || `unknown-${msg.id}`,
            delivered_at: msgDate.toISOString(),
            image_url: parsed.image_url || null,
            status: "delivered",
          });
          if (parsed.tracking_number) {
            await upsertShipment({
              user_id: userId,
              retailer: retailerName,
              order_id: order_id || "Unknown",
              tracking_number: parsed.tracking_number,
              carrier: parsed.carrier || "",
              status: "delivered",
              shipped_at: null,
              delivered_at: ymd(msgDate),
            });
          }
          updated++;
        }

        if (type === "canceled" && order_id) {
          await upsertOrder({
            user_id: userId,
            retailer: retailerName,
            order_id,
            status: "canceled",
          });
          updated++;
        }
        return null;
      },
      { concurrency: 6, budgetOk }
    );

    if (mode === "preview") return json({ proposed });
    return json({ imported, updated, skipped_existing });
  } catch (err) {
    console.error("gmail-sync error:", err);
    return json({ error: String(err.message || err) }, 500);
  }
};
