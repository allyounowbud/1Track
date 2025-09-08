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

// Function to fetch full product name from Amazon product page
async function fetchAmazonProductName(productUrl) {
  try {
    // Ensure we have a full URL
    let fullUrl = productUrl;
    if (productUrl.startsWith('/')) {
      fullUrl = 'https://www.amazon.com' + productUrl;
    }
    
    console.log("Fetching product page:", fullUrl);
    
    const response = await fetch(fullUrl, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36'
      }
    });
    
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }
    
    const html = await response.text();
    const $ = cheerio.load(html);
    
    // Look for the product title in various selectors Amazon uses
    const titleSelectors = [
      '#productTitle',
      'h1.a-size-large',
      'h1[data-automation-id="product-title"]',
      '.product-title',
      'h1'
    ];
    
    for (const selector of titleSelectors) {
      const title = $(selector).first().text().trim();
      if (title && title.length > 10) {
        console.log("Found product title:", title);
        return title;
      }
    }
    
    console.log("No product title found on page");
    return null;
    
  } catch (error) {
    console.log("Error fetching product page:", error.message);
    return null;
  }
}

async function amazonCommon($, html, text) {
  const out = {};
  const bodyText = $("body").text();
  
  console.log("=== AMAZON PARSING DEBUG ===");
  console.log("Body text length:", bodyText.length);
  console.log("First 500 chars:", bodyText.substring(0, 500));
  console.log("All order number matches:", bodyText.match(/#\s*([0-9\-]+)/g));
  console.log("All Amazon format matches:", bodyText.match(/([0-9]{3}-[0-9]{7}-[0-9]{7})/g));
  
  // Order ID extraction - try multiple patterns in order of specificity
  const orderIdPatterns = [
    /([0-9]{3}-[0-9]{7}-[0-9]{7})/i, // Amazon format: 114-6370970-6938659 (most specific)
    /Order\s*#\s*([0-9\-]+)/i,
    /Order\s*Number[:\s]*([0-9\-]+)/i,
    /#\s*([0-9\-]+)/,
  ];
  
  for (const pattern of orderIdPatterns) {
    const match = bodyText.match(pattern);
    if (match && match[1]) {
      out.order_id = match[1];
      console.log("Found order ID:", out.order_id, "using pattern:", pattern);
      break;
    }
  }
  
  // Item name extraction - look for product names in quotes or specific patterns
  let item = "";
  
  // Look for quoted product names (common in Amazon emails)
  const quotedMatch = bodyText.match(/"([^"]{10,100})"/);
  if (quotedMatch && quotedMatch[1]) {
    item = quotedMatch[1];
    console.log("Found quoted item:", item);
  }
  
  // Look for product names after "Ordered:", "Shipped:", "Delivered:"
  if (!item) {
    const statusMatch = bodyText.match(/(?:Ordered|Shipped|Delivered):\s*"([^"]+)"/i);
    if (statusMatch && statusMatch[1]) {
      item = statusMatch[1];
      console.log("Found status item:", item);
    }
  }
  
  // Look for product links and try to get full name from product page
  if (!item) {
    const prodLink = $("a[href*='gp/product'], a[href*='dp/']").first().text().trim();
    if (prodLink && prodLink.length > 5) {
      item = prodLink;
      console.log("Found product link text:", item);
    }
  }
  
  // Try to get full product name from Amazon product page
  if (item && item.includes('...')) {
    console.log("Item name is truncated, attempting to fetch full name from product page...");
    try {
      const productLink = $("a[href*='gp/product'], a[href*='dp/']").first().attr('href');
      if (productLink) {
        console.log("Found product URL:", productLink);
        const fullName = await fetchAmazonProductName(productLink);
        if (fullName) {
          item = fullName;
          console.log("Got full product name from page:", item);
        }
      }
    } catch (error) {
      console.log("Failed to fetch full product name:", error.message);
    }
  }
  
  if (item) out.item_name = item;

  // Quantity extraction
  const qtyMatch = bodyText.match(/Quantity[:\s]*([0-9]+)/i);
  if (qtyMatch) {
    out.quantity = parseInt(qtyMatch[1], 10);
    console.log("Found quantity:", out.quantity);
  }

  // Price extraction - look for dollar amounts with better filtering
  const priceMatches = bodyText.match(/\$([0-9,]+\.?[0-9]*)/g);
  console.log("All price matches found:", priceMatches);
  if (priceMatches) {
    const prices = priceMatches
      .map(m => parseFloat(m.replace(/[$,]/g, '')))
      .filter(p => p > 0 && p < 10000) // reasonable price range
      .filter(p => p !== 494) // filter out order numbers that look like prices
      .filter(p => p < 5000); // filter out unreasonably high prices like $8999
    
    console.log("Filtered prices:", prices);
    
    // Look for "Total" or "Order Total" specifically first
    const totalMatch = bodyText.match(/(?:Total|Order\s*Total)[:\s]*\$([0-9,]+\.?[0-9]*)/i);
    if (totalMatch) {
      const totalPrice = parseFloat(totalMatch[1].replace(/[$,]/g, ''));
      if (totalPrice > 0 && totalPrice < 5000) {
        out.total_cents = Math.round(totalPrice * 100);
        console.log("Found explicit total:", totalPrice, "cents:", out.total_cents);
      }
    }
    
    // If no explicit total found, use the highest reasonable price
    if (!out.total_cents && prices.length > 0) {
      const sortedPrices = prices.sort((a, b) => b - a);
      out.total_cents = Math.round(sortedPrices[0] * 100);
      console.log("Using highest price as total:", sortedPrices[0], "cents:", out.total_cents);
    }
  }

  // Image extraction - look for product images
  let img = null;
  $("img").each((_, el) => {
    const src = $(el).attr("src") || "";
    const alt = ($(el).attr("alt") || "").toLowerCase();
    const width = $(el).attr("width") || "";
    const height = $(el).attr("height") || "";
    
    if (!/^https?:\/\//.test(src)) return;
    if (/logo|amazon|prime|sprite|tracker|icon|button/i.test(src) || 
        /logo|amazon|prime|icon|button/.test(alt)) return;
    
    // Look for product images (usually have dimensions or are in images.amazon.com)
    if (src.includes('images.amazon.com') || 
        src.includes('m.media-amazon.com') ||
        (width && height && parseInt(width) > 50 && parseInt(height) > 50)) {
      img = src;
      console.log("Found product image:", img);
      return false; // break
    }
  });
  if (img) out.image_url = img;

  console.log("Final parsed data:", out);
  console.log("=== END AMAZON PARSING DEBUG ===");
  
  return out;
}

async function parseAmazonOrder(html, text) {
  const $ = cheerio.load(html || "");
  return await amazonCommon($, html, text);
}
async function parseAmazonShipping(html, text) {
  const $ = cheerio.load(html || "");

  // single "Track package" URL (prefer the first one)
  const trackHref =
    $("a:contains('Track package'),a:contains('Track Package')")
      .first()
      .attr("href") || null;

  const base = await amazonCommon($, html, text);
  return {
    ...base,
    tracking_number: trackHref || null, // we store the URL for Amazon carrier
    carrier: "Amazon",
    status: "in_transit",
  };
}
async function parseAmazonDelivered(html, text) {
  const $ = cheerio.load(html || "");
  const base = await amazonCommon($, html, text);
  return { ...base, status: "delivered" };
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
    
    // Step 1: Process order confirmations first
    console.log("Step 1: Processing order confirmations...");
    for (const id of ids) {
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

        // Only process emails from the last 30 days to avoid old emails
        const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
        if (messageDate < thirtyDaysAgo) {
          console.log(`Skipping old email from ${messageDate.toISOString()}`);
          continue;
        }

        const retailer = classifyRetailer(from);
        const type = classifyType(retailer, subject);
        
        // Only process order confirmations in this step
        if (type !== "order") continue;
        
        console.log(`Processing order confirmation: ${subject}`);
        
        // Parse order confirmation
        const parsed = retailer.parseOrder ? await retailer.parseOrder(html, text) : {};
        console.log(`Parsed order data:`, JSON.stringify(parsed, null, 2));

        // Extract order ID with better fallbacks
        const order_id = 
          parsed.order_id ||
          ((subject.match(/Order\s*#\s*([0-9\-]+)/i) || [])[1]) ||
          ((subject.match(/#\s*([0-9\-]+)/) || [])[1]) ||
          null;

        if (!order_id) {
          console.log(`No order ID found for: ${subject}`);
          continue;
        }

        // Additional validation - ensure we have meaningful data
        if (!parsed.item_name && !parsed.total_cents) {
          console.log(`Insufficient data for order ${order_id}: no item name or price`);
          continue;
        }

        if (mode === "preview") {
          const exists = await getOrderIdExists(acct.user_id, retailer.name, order_id);
          if (!exists) {
            proposed.push({
              retailer: retailer.name,
              order_id: order_id,
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

        // Create or update order
        const exists = await getOrderIdExists(acct.user_id, retailer.name, order_id);
        const row = {
          user_id: acct.user_id,
          retailer: retailer.name,
          order_id: order_id,
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
        
      } catch (err) {
        console.error(`Error processing order confirmation ${id}:`, err);
        errors++;
      }
    }

    // Step 2: Process shipping updates for existing orders
    console.log("Step 2: Processing shipping updates...");
    for (const id of ids) {
      if (Date.now() - startTime > maxDuration) break;
      
      try {
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

        // Only process emails from the last 30 days
        const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
        if (messageDate < thirtyDaysAgo) continue;

        const retailer = classifyRetailer(from);
        const type = classifyType(retailer, subject);
        
        // Only process shipping updates in this step
        if (type !== "shipping") continue;
        
        console.log(`Processing shipping update: ${subject}`);
        
        // Parse shipping update
        const parsed = retailer.parseShipping ? await retailer.parseShipping(html, text) : {};
        
        // Extract order ID
        const order_id = 
          parsed.order_id ||
          ((subject.match(/Order\s*#\s*([0-9\-]+)/i) || [])[1]) ||
          ((subject.match(/#\s*([0-9\-]+)/) || [])[1]) ||
          null;

        if (!order_id) continue;

        // Only process if corresponding order exists
        const orderExists = await getOrderIdExists(acct.user_id, retailer.name, order_id);
        if (!orderExists) {
          console.log(`No existing order found for shipping update: ${order_id}`);
          continue;
        }

        // Create shipment record
        const ship = {
          user_id: acct.user_id,
          retailer: retailer.name,
          order_id: order_id,
          tracking_number: parsed.tracking_number || null,
          carrier: parsed.carrier || "",
          status: "in_transit",
          shipped_at: ymd(messageDate),
          delivered_at: null,
        };
        await upsertShipment(ship);
        
        // Update order status to in_transit
        await upsertOrder({
          user_id: acct.user_id,
          retailer: retailer.name,
          order_id,
          shipped_at: messageDate.toISOString(),
          status: "in_transit",
        });
        
        updated++;
        
      } catch (err) {
        console.error(`Error processing shipping update ${id}:`, err);
        errors++;
      }
    }

    // Step 3: Process delivery updates for existing in-transit orders
    console.log("Step 3: Processing delivery updates...");
    for (const id of ids) {
      if (Date.now() - startTime > maxDuration) break;
      
      try {
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

        // Only process emails from the last 30 days
        const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
        if (messageDate < thirtyDaysAgo) continue;

        const retailer = classifyRetailer(from);
        const type = classifyType(retailer, subject);
        
        // Only process delivery updates in this step
        if (type !== "delivered") continue;
        
        console.log(`Processing delivery update: ${subject}`);
        
        // Extract order ID
        const order_id = 
          ((subject.match(/Order\s*#\s*([0-9\-]+)/i) || [])[1]) ||
          ((subject.match(/#\s*([0-9\-]+)/) || [])[1]) ||
          null;

        if (!order_id) continue;

        // Only process if corresponding order exists and is in transit
        const { data: existingOrder } = await supabase
          .from("email_orders")
          .select("status")
          .eq("user_id", acct.user_id)
          .eq("retailer", retailer.name)
          .eq("order_id", order_id)
          .maybeSingle();
          
        if (!existingOrder || existingOrder.status !== "in_transit") {
          console.log(`No in-transit order found for delivery update: ${order_id}`);
          continue;
        }

        // Update order to delivered
        await upsertOrder({
          user_id: acct.user_id,
          retailer: retailer.name,
          order_id,
          delivered_at: messageDate.toISOString(),
          status: "delivered",
        });
        
        updated++;
        
      } catch (err) {
        console.error(`Error processing delivery update ${id}:`, err);
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