/* netlify/functions/gmail-sync.js
   Gmail → Supabase sync (orders/shipments), with robust Amazon parsing
   CJS module (Netlify functions default). Keep this filename as .js. */

const { google } = require("googleapis");
const cheerio = require("cheerio");
const { createClient } = require("@supabase/supabase-js");

/* ----------------------------- Supabase init ----------------------------- */
const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_SERVICE_ROLE_KEY =
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_ANON_KEY;
if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
  // Return early if misconfigured so you see a clear error in the function logs.
  console.error("Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY");
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

/* ------------------------------ Retailer map ----------------------------- */
const RETAILERS = [
  // AMAZON — ordered/shipped/delivered
  {
    name: "Amazon",
    senderMatch: (from) =>
      /@amazon\.(com|ca|co\.uk|de|fr|it|es|co\.jp)$/i.test(from) ||
      /(auto-confirm|shipment-tracking|order-update)@amazon/i.test(from),
    orderSubject: /\bordered:\s|order(ed)?[:\s]/i,
    shipSubject: /\bshipped:|\bwas shipped\b|\bshipment\b/i,
    deliverSubject: /\bdelivered:|\bwas delivered\b/i,
    cancelSubject: /\bcancel(?:ed|led)\b/i,
    parseOrder: parseAmazonOrder,
    parseShipping: parseAmazonShipping,
    parseDelivered: parseAmazonDelivered,
  },
  // Add Target again when you’re ready to turn it back on
];

/* -------------------------- Small helpers -------------------------- */
function headersToObj(headers = []) {
  const o = {};
  headers.forEach((h) => (o[h.name.toLowerCase()] = h.value || ""));
  return o;
}
function decodeB64url(str) {
  if (!str) return "";
  return Buffer.from(str.replace(/-/g, "+").replace(/_/g, "/"), "base64").toString(
    "utf8"
  );
}
function extractBodyParts(payload) {
  let html = null;
  let text = null;
  (function walk(p) {
    if (!p) return;
    if (p.mimeType === "text/html" && p.body?.data) html = decodeB64url(p.body.data);
    if (p.mimeType === "text/plain" && p.body?.data) text = decodeB64url(p.body.data);
    (p.parts || []).forEach(walk);
  })(payload);
  if (!html && payload?.body?.data && /html/i.test(payload.mimeType || "")) {
    html = decodeB64url(payload.body.data);
  }
  if (!text && payload?.body?.data && /plain/i.test(payload.mimeType || "")) {
    text = decodeB64url(payload.body.data);
  }
  return { html, text };
}
function parseMoneyToCents(s = "") {
  const m = String(s).replace(/[,]/g, "").match(/\$?\s*([0-9]+(?:\.[0-9]{2})?)/);
  return m ? Math.round(parseFloat(m[1]) * 100) : null;
}
function ymd(dateStr) {
  if (!dateStr) return null;
  const d = new Date(dateStr);
  return Number.isNaN(+d) ? null : d.toISOString().slice(0, 10);
}
function unique(arr) {
  return Array.from(new Set(arr.filter(Boolean)));
}

/* ---------------------------- Gmail client ---------------------------- */
async function getAccount() {
  const { data, error } = await supabase
    .from("email_accounts")
    .select(
      "id, user_id, email_address, access_token, refresh_token, token_scope, expires_at"
    )
    .order("updated_at", { ascending: false })
    .limit(1);
  if (error) throw error;
  if (!data || !data.length) throw new Error("No connected Gmail account");
  return data[0];
}
async function getGmailClient() {
  const acct = await getAccount();
  oauth2.setCredentials({
    access_token: acct.access_token,
    refresh_token: acct.refresh_token,
    scope:
      acct.token_scope ||
      "https://www.googleapis.com/auth/gmail.readonly",
    expiry_date: acct.expires_at ? new Date(acct.expires_at).getTime() : undefined,
  });
  oauth2.on("tokens", async (tokens) => {
    const patch = {};
    if (tokens.access_token) patch.access_token = tokens.access_token;
    if (tokens.expiry_date) patch.expires_at = new Date(tokens.expiry_date).toISOString();
    if (Object.keys(patch).length) {
      await supabase.from("email_accounts").update(patch).eq("id", acct.id);
    }
  });
  try {
    await oauth2.getAccessToken();
  } catch {
    if (!acct.refresh_token) throw new Error("Expired Gmail token (no refresh_token)");
    const { credentials } = await oauth2.refreshAccessToken();
    oauth2.setCredentials(credentials);
  }
  return google.gmail({ version: "v1", auth: oauth2 });
}

/* ---------------------------- Gmail listing ---------------------------- */
async function listCandidateMessageIds(gmail) {
  // tighter query to reduce timeouts; we run more often, so 60d is OK
  const q =
    'newer_than:60d in:inbox (from:amazon.com OR subject:order OR subject:shipped OR subject:delivered)';
  const ids = [];
  let pageToken;
  // cap at 200 msgs per invocation
  for (let i = 0; i < 4; i++) {
    const res = await gmail.users.messages.list({
      userId: "me",
      q,
      maxResults: 50,
      pageToken,
    });
    (res.data.messages || []).forEach((m) => ids.push(m.id));
    pageToken = res.data.nextPageToken;
    if (!pageToken || ids.length >= 200) break;
  }
  return unique(ids).slice(0, 200);
}
async function getMessageFull(gmail, id) {
  const res = await gmail.users.messages.get({
    userId: "me",
    id,
    format: "full",
  });
  return res.data;
}

/* ------------------------------ Classifier ------------------------------ */
function classifyRetailer(from) {
  const f = (from || "").toLowerCase();
  return RETAILERS.find((r) => r.senderMatch(f)) || {
    name: "Undefined",
    orderSubject: /order/,
    shipSubject: /shipped|shipment/i,
    deliverSubject: /delivered/i,
    cancelSubject: /cancel/i,
  };
}
function classifyType(retailer, subject) {
  const s = (subject || "").toLowerCase();
  if (retailer.orderSubject?.test(s)) return "order";
  if (retailer.shipSubject?.test(s)) return "shipping";
  if (retailer.deliverSubject?.test(s)) return "delivered";
  if (retailer.cancelSubject?.test(s)) return "canceled";
  if (/thanks for your order|order confirmation/.test(s)) return "order";
  if (/shipped|on (?:its|the) way|track package/.test(s)) return "shipping";
  if (/delivered/.test(s)) return "delivered";
  if (/cancel/.test(s)) return "canceled";
  return null;
}

/* ----------------------------- Amazon parsers ----------------------------- */
// These are tailored to the screenshots you sent (responsive HTML Amazon uses).

function amazonCommon($, html, text) {
  const out = {};
  // order id
  out.order_id =
    ($("body").text().match(/Order\s*#\s*([0-9\-]+)/i) || [])[1] ||
    (text && (text.match(/Order\s*#\s*([0-9\-]+)/i) || [])[1]) ||
    null;

  // item name (first product link under the progress header)
  let item = "";
  const prodLink = $("a[href*='gp/product'], a[href*='dp/']").first().text().trim();
  if (prodLink) item = prodLink;
  if (!item) {
    // fallback: first longish link text
    $("a").each((_, el) => {
      const t = ($(el).text() || "").trim();
      if (!item && t.length > 12 && t.length < 140 && !/your orders|buy again/i.test(t)) {
        item = t;
      }
    });
  }
  if (item) out.item_name = item;

  // quantity
  const qty =
    ($("body").text().match(/Quantity:\s*([0-9]+)/i) || [])[1] ||
    ($("body").text().match(/Qty[:\s]+([0-9]+)/i) || [])[1] ||
    null;
  if (qty) out.quantity = parseInt(qty, 10);

  // total
  const totalMatch =
    ($("body").text().match(/Total\s*\$[0-9,.]+/i) || [])[0] ||
    ($("td,div").filter((_, el) => /Total/i.test($(el).text())).next().text() || "");
  const totalCents = parseMoneyToCents(totalMatch);
  if (totalCents != null) out.total_cents = totalCents;

  // image
  let img = null;
  $("img").each((_, el) => {
    const src = $(el).attr("src") || "";
    const alt = ($(el).attr("alt") || "").toLowerCase();
    if (!/^https?:\/\//.test(src)) return;
    if (/logo|amazon|prime|sprite|tracker/i.test(src) || /logo|amazon|prime/.test(alt)) return;
    if (!img) img = src;
  });
  if (img) out.image_url = img;

  return out;
}

function parseAmazonOrder(html, text) {
  const $ = cheerio.load(html || "");
  return amazonCommon($, html, text);
}
function parseAmazonShipping(html, text) {
  const $ = cheerio.load(html || "");

  // single "Track package" URL (prefer the first one)
  const trackHref =
    $("a:contains('Track package'),a:contains('Track Package')")
      .first()
      .attr("href") || null;

  const base = amazonCommon($, html, text);
  return {
    ...base,
    tracking_number: trackHref || null, // we store the URL for Amazon carrier
    carrier: "Amazon",
    status: "in_transit",
  };
}
function parseAmazonDelivered(html, text) {
  const $ = cheerio.load(html || "");
  return { ...amazonCommon($, html, text), status: "delivered" };
}

/* --------------------------- DB upsert helpers --------------------------- */
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
async function getOrderIdExists(user_id, retailer, order_id) {
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
exports.handler = async (event) => {
  // Health probe
  if (event?.queryStringParameters?.health === "1") {
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
    const gmail = await getGmailClient();
    const acct = await getAccount(); // need user_id for composite keys
    const ids = await listCandidateMessageIds(gmail);

    const proposed = [];
    let imported = 0;
    let updated = 0;
    let skipped_existing = 0;
    let errors = 0;
    let processed = 0;
    const startTime = Date.now();

    // Add timeout protection - Netlify functions have 10s limit
    const maxDuration = 8000; // 8 seconds to leave buffer for response
    
    for (const id of ids) {
      // Check if we're approaching timeout
      if (Date.now() - startTime > maxDuration) {
        console.log(`Timeout approaching, stopping at ${processed}/${ids.length} messages`);
        break;
      }
      
      try {
        processed++;
        const msg = await getMessageFull(gmail, id);
        const h = headersToObj(msg.payload?.headers || []);
        const subject = h["subject"] || "";
        const from = h["from"] || "";
        const dateHeader = h["date"] || "";
        const messageDate =
          dateHeader
            ? new Date(dateHeader)
            : new Date(msg.internalDate ? Number(msg.internalDate) : Date.now());
        const { html, text } = extractBodyParts(msg.payload || {});

        const retailer = classifyRetailer(from);
        const type = classifyType(retailer, subject);
        if (!type) continue;
        
        // Debug logging for Amazon orders
        if (retailer.name === "Amazon" && type === "order") {
          console.log(`Processing Amazon order: ${subject}`);
        }

      // parse
      let parsed = {};
      if (type === "order" && retailer.parseOrder) parsed = retailer.parseOrder(html, text);
      else if (type === "shipping" && retailer.parseShipping)
        parsed = retailer.parseShipping(html, text);
      else if (type === "delivered" && retailer.parseDelivered)
        parsed = retailer.parseDelivered(html, text);
      else if (type === "canceled") parsed = { status: "canceled" };
      
      // Debug logging for parsed data
      if (retailer.name === "Amazon" && type === "order") {
        console.log(`Parsed data:`, JSON.stringify(parsed, null, 2));
      }

      // order id (fallback: subject)
      const order_id =
        parsed.order_id ||
        ((subject.match(/#\s*([0-9\-]+)/) || [])[1]) ||
        null;

      if (mode === "preview") {
        const exists = await getOrderIdExists(acct.user_id, retailer.name, order_id);
        if (!exists && type === "order") {
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

      // Normal sync:
      if (type === "order") {
        const exists = await getOrderIdExists(acct.user_id, retailer.name, order_id);
        const row = {
          user_id: acct.user_id,
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
        const ship = {
          user_id: acct.user_id,
          retailer: retailer.name,
          order_id: order_id || "Unknown",
          tracking_number: parsed.tracking_number || null, // Amazon = URL
          carrier: parsed.carrier || "",
          status: parsed.status || "in_transit",
          shipped_at: ymd(messageDate),
          delivered_at: null,
        };
        await upsertShipment(ship);
        if (order_id) {
          await upsertOrder({
            user_id: acct.user_id,
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
            user_id: acct.user_id,
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
            user_id: acct.user_id,
            retailer: retailer.name,
            order_id,
            status: "canceled",
          });
        }
        updated++;
      }
      } catch (err) {
        console.error(`Error processing message ${id}:`, err);
        errors++;
      }
    }

    const duration = Date.now() - startTime;
    const wasTimeout = processed < ids.length;
    const stats = {
      imported,
      updated,
      skipped_existing,
      errors,
      processed,
      duration_ms: duration,
      total_messages: ids.length,
      incomplete: wasTimeout,
      remaining: wasTimeout ? ids.length - processed : 0
    };

    if (mode === "preview") return json({ proposed, stats });
    return json(stats);
  } catch (err) {
    console.error("gmail-sync error:", err);
    return json({ error: String(err?.message || err) }, 500);
  }
};

function json(body, status = 200) {
  return {
    statusCode: status,
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  };
}