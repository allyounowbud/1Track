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
    orderSubject: /\bordered:\s|order(ed)?[:\s]|thanks for your order|order confirmation/i,
    shipSubject: /\bshipped:|\bwas shipped\b|\bshipment\b/i,
    deliverSubject: /\bdelivered:|\bwas delivered\b/i,
    cancelSubject: /\bcancel(?:ed|led)\b/i,
    parseOrder: parseAmazonOrder,
    parseShipping: parseAmazonShipping,
    parseDelivered: parseAmazonDelivered,
  },
  // TARGET — enhanced HTML parsing
  {
    name: "Target",
    senderMatch: (from) => /@target\.com$/i.test(from) || /@oe\.target\.com$/i.test(from) || /@oe1\.target\.com$/i.test(from),
    orderSubject: /thanks for your order|order confirmation|order placed/i,
    shipSubject: /shipped|on the way|shipment/i,
    deliverSubject: /delivered|arrived/i,
    cancelSubject: /cancel/i,
    parseOrder: parseTargetOrder,
    parseShipping: parseTargetShipping,
    parseDelivered: parseTargetDelivered,
  },
  // MACY'S — enhanced HTML parsing
  {
    name: "Macy's",
    senderMatch: (from) => /@macys\.com$/i.test(from) || /@oes\.macys\.com$/i.test(from) || /@noreply\.macys\.com$/i.test(from),
    orderSubject: /thanks for your order|order confirmation|order placed/i,
    shipSubject: /shipped|on the way|shipment/i,
    deliverSubject: /delivered|arrived/i,
    cancelSubject: /cancel/i,
    parseOrder: parseMacysOrder,
    parseShipping: parseMacysShipping,
    parseDelivered: parseMacysDelivered,
  },
  // NIKE — basic support
  {
    name: "Nike",
    senderMatch: (from) => /@nike\.com$/i.test(from) || /@ship\.notifications\.nike\.com$/i.test(from),
    orderSubject: /order|shipped|delivered/i,
    shipSubject: /shipped|on the way/i,
    deliverSubject: /delivered|arrived/i,
    cancelSubject: /cancel/i,
    parseOrder: parseGenericOrder,
    parseShipping: parseGenericShipping,
    parseDelivered: parseGenericDelivered,
  },
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
async function getAccounts() {
  const { data, error } = await supabase
    .from("email_accounts")
    .select(
      "id, user_id, email_address, access_token, refresh_token, token_scope, expires_at, provider"
    )
    .like("provider", "gmail%")
    .order("updated_at", { ascending: false });
  if (error) throw error;
  if (!data || !data.length) throw new Error("No connected Gmail accounts");
  return data;
}
async function getGmailClient(account) {
  oauth2.setCredentials({
    access_token: account.access_token,
    refresh_token: account.refresh_token,
    scope:
      account.token_scope ||
      "https://www.googleapis.com/auth/gmail.readonly",
    expiry_date: account.expires_at ? new Date(account.expires_at).getTime() : undefined,
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
  const fullFrom = (from || "").toLowerCase();
  console.log("Classifying retailer for full 'from' string:", fullFrom);
  
  // Extract email address from the "from" string
  let emailAddress = fullFrom;
  const emailMatch = /<([^>]+)>/.exec(fullFrom);
  if (emailMatch && emailMatch[1]) {
    emailAddress = emailMatch[1];
  }
  console.log("Extracted email address for classification:", emailAddress);
  
  for (const retailer of RETAILERS) {
    const matches = retailer.senderMatch(emailAddress);
    console.log(`Testing ${retailer.name} with ${emailAddress}: ${matches}`);
    if (matches) {
      console.log(`Matched retailer: ${retailer.name}`);
      return retailer;
    }
  }
  
  console.log("No retailer matched, using Undefined");
  return {
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
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
        'Accept-Language': 'en-US,en;q=0.5',
        'Accept-Encoding': 'gzip, deflate, br',
        'Connection': 'keep-alive',
        'Upgrade-Insecure-Requests': '1'
      }
    });
    
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }
    
    const html = await response.text();
    console.log("Product page HTML length:", html.length);
    const $ = cheerio.load(html);
    
    // Look for the product title in various selectors Amazon uses
    const titleSelectors = [
      '#productTitle',
      'h1.a-size-large',
      'h1[data-automation-id="product-title"]',
      '.product-title',
      'h1.a-size-base-plus',
      'h1 span',
      'h1',
      'h1.a-size-large.a-color-base',
      '.a-size-large.a-color-base',
      'h1.a-size-large.a-color-base.a-text-normal'
    ];
    
    for (const selector of titleSelectors) {
      const title = $(selector).first().text().trim();
      console.log(`Trying selector "${selector}":`, title);
      if (title && title.length > 10 && !title.includes('Amazon.com') && !title.includes('Sign in')) {
        console.log("Found product title:", title);
        return title;
      }
    }
    
    // Fallback: look for any text that looks like a product title
    const allH1s = $('h1').map((i, el) => $(el).text().trim()).get();
    console.log("All H1 elements found:", allH1s);
    
    for (const h1Text of allH1s) {
      if (h1Text && h1Text.length > 10 && 
          !h1Text.includes('Amazon.com') && 
          !h1Text.includes('Sign in') &&
          !h1Text.includes('Your Account')) {
        console.log("Found product title in H1 fallback:", h1Text);
        return h1Text;
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
    console.log("All product links found:", $("a[href*='gp/product'], a[href*='dp/']").map((i, el) => ({
      href: $(el).attr('href'),
      text: $(el).text().trim()
    })).get());
    if (prodLink && prodLink.length > 5) {
      item = prodLink;
      console.log("Found product link text:", item);
    }
  }
  
  // Try to get full product name from Amazon product page
  if (item && item.includes('...')) {
    console.log("Item name is truncated, attempting to fetch full name from product page...");
    console.log("Current truncated item:", item);
    try {
      // First try to find product links in the DOM
      const productLink = $("a[href*='gp/product'], a[href*='dp/']").first().attr('href');
      console.log("All product links found in DOM:", $("a[href*='gp/product'], a[href*='dp/']").map((i, el) => $(el).attr('href')).get());
      
      let finalProductLink = null;
      
      if (productLink) {
        finalProductLink = productLink;
        console.log("Found product URL in DOM:", finalProductLink);
      } else {
        console.log("No product link found in DOM, searching HTML source...");
        // Try to find product links in the HTML source with more patterns
        const htmlSrc = html || "";
        const productLinkPatterns = [
          /https:\/\/[^"'\s]*\/gp\/product\/[A-Z0-9]+/gi,
          /https:\/\/[^"'\s]*\/dp\/[A-Z0-9]+/gi,
          /https:\/\/[^"'\s]*amazon\.com[^"'\s]*\/dp\/[A-Z0-9]+/gi
        ];
        
        for (const pattern of productLinkPatterns) {
          const matches = htmlSrc.match(pattern);
          if (matches && matches.length > 0) {
            console.log(`Found product links with pattern ${pattern}:`, matches);
            finalProductLink = matches[0];
            break;
          }
        }
      }
      
      if (finalProductLink) {
        console.log("Using product URL:", finalProductLink);
        const fullName = await fetchAmazonProductName(finalProductLink);
        if (fullName) {
          item = fullName;
          console.log("Got full product name from page:", item);
        } else {
          console.log("Failed to get full name from product page");
        }
      } else {
        console.log("No product link found anywhere in email");
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
  console.log("Looking for product images...");
  $("img").each((_, el) => {
    const src = $(el).attr("src") || "";
    const alt = ($(el).attr("alt") || "").toLowerCase();
    const width = $(el).attr("width") || "";
    const height = $(el).attr("height") || "";
    
    console.log("Checking image:", src, "alt:", alt, "width:", width, "height:", height);
    
    if (!/^https?:\/\//.test(src)) return;
    
    // Skip obvious non-product images (but allow product images from Amazon)
    if (/logo|prime|sprite|tracker|icon|button|social|facebook|twitter|instagram|steptracker|pixel|transp\.gif|smile/i.test(src) || 
        /logo|prime|icon|button|social|facebook|twitter|instagram|amazon\.com/.test(alt)) {
      console.log("Skipping non-product image:", src);
      return;
    }
    
    // Look for product images - be more permissive
    if (src.includes('images.amazon.com') || 
        src.includes('m.media-amazon.com') ||
        src.includes('amazon.com/images') ||
        src.includes('googleusercontent.com') || // Google proxy images
        (width && height && parseInt(width) > 30 && parseInt(height) > 30) ||
        (src.includes('amazon') && !src.includes('logo'))) {
      img = src;
      console.log("Found product image:", img);
      return false; // break
    }
  });
  
  // Also check for images in the HTML source that might not be in img tags
  if (!img) {
    const htmlSrc = html || "";
    const imageMatches = htmlSrc.match(/https:\/\/[^"'\s]+\.(jpg|jpeg|png|gif|webp)/gi);
    if (imageMatches) {
      console.log("Found images in HTML source:", imageMatches);
      // Prioritize product images over UI elements
      for (const imageUrl of imageMatches) {
        // Skip UI elements
        if (/steptracker|pixel|transp\.gif|smile|logo/i.test(imageUrl)) {
          console.log("Skipping UI image from HTML source:", imageUrl);
          continue;
        }
        // Look for product images
        if (imageUrl.includes('m.media-amazon.com') || 
            imageUrl.includes('images.amazon.com') ||
            imageUrl.includes('googleusercontent.com')) {
          img = imageUrl;
          console.log("Using product image from HTML source:", img);
          break;
        }
      }
    }
  }
  
  if (img) {
    out.image_url = img;
    console.log("Using product image:", img);
  } else {
    console.log("No product image found");
  }

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

/* ----------------------------- Generic parsers ----------------------------- */
// Basic parsers for non-Amazon retailers that extract minimal info

function parseGenericOrder(html, text) {
  const $ = cheerio.load(html || "");
  const bodyText = $("body").text();
  
  console.log("=== GENERIC PARSING DEBUG ===");
  console.log("HTML length:", (html || "").length);
  console.log("Text length:", (text || "").length);
  console.log("Body text length:", bodyText.length);
  console.log("First 500 chars:", bodyText.substring(0, 500));
  
  const out = {};
  
  // Try to extract order ID from various patterns
  const orderIdPatterns = [
    /order\s*#\s*([0-9\-]+)/i,
    /order\s*number\s*([0-9\-]+)/i,
    /#\s*([0-9\-]+)/,
    /([0-9]{10,})/, // long numbers that might be order IDs
  ];
  
  console.log("Trying order ID patterns...");
  for (const pattern of orderIdPatterns) {
    const match = bodyText.match(pattern);
    console.log(`Pattern ${pattern}:`, match);
    if (match && match[1]) {
      out.order_id = match[1];
      console.log("Found generic order ID:", out.order_id, "using pattern:", pattern);
      break;
    }
  }
  
  // Try to extract total price
  const priceMatches = bodyText.match(/\$([0-9,]+\.?[0-9]*)/g);
  if (priceMatches) {
    const prices = priceMatches
      .map(m => parseFloat(m.replace(/[$,]/g, '')))
      .filter(p => p > 0 && p < 10000);
    
    if (prices.length > 0) {
      const sortedPrices = prices.sort((a, b) => b - a);
      out.total_cents = Math.round(sortedPrices[0] * 100);
      console.log("Found generic total:", sortedPrices[0], "cents:", out.total_cents);
    }
  }
  
  // Try to extract item name (look for common patterns)
  const itemPatterns = [
    /"([^"]{10,100})"/, // quoted text
    /item[:\s]+([^\n\r]{10,100})/i,
    /product[:\s]+([^\n\r]{10,100})/i,
  ];
  
  for (const pattern of itemPatterns) {
    const match = bodyText.match(pattern);
    if (match && match[1] && match[1].length > 10) {
      const candidate = match[1].trim();
      
      // Filter out tracking cookies, JS variables, and other junk
      if (!candidate.includes('_dTCookie') &&
          !candidate.includes('_ga') &&
          !candidate.includes('_gid') &&
          !candidate.includes('utm_') &&
          !candidate.includes('javascript:') &&
          !candidate.includes('function') &&
          !/^[0-9]+$/.test(candidate) && // Not just numbers
          !/^[A-Z_]+$/.test(candidate)) { // Not just uppercase with underscores
        out.item_name = candidate;
        console.log("Found generic item name:", out.item_name);
        break;
      }
    }
  }
  
  console.log("Final generic parsed data:", out);
  console.log("=== END GENERIC PARSING DEBUG ===");
  
  return out;
}

function parseGenericShipping(html, text) {
  const base = parseGenericOrder(html, text);
  return {
    ...base,
    status: "in_transit",
    carrier: "Unknown",
  };
}

function parseGenericDelivered(html, text) {
  const base = parseGenericOrder(html, text);
  return {
    ...base,
    status: "delivered",
  };
}

/* ------------------------------ Target-specific parsers ------------------------------ */
function parseTargetOrder(html, text) {
  const $ = cheerio.load(html || "");
  const bodyText = $("body").text();
  
  console.log("=== TARGET PARSING DEBUG ===");
  console.log("HTML length:", (html || "").length);
  console.log("Body text length:", bodyText.length);
  
  const out = {};
  
  // Extract order ID from Target format: "Order #102002814872430"
  const orderIdMatch = bodyText.match(/order\s*#\s*([0-9]+)/i);
  if (orderIdMatch && orderIdMatch[1]) {
    out.order_id = orderIdMatch[1];
    console.log("Found Target order ID:", out.order_id);
  }
  
  // Extract total price - look for "Total $48.28" pattern
  const totalMatch = bodyText.match(/total\s*\$([0-9,]+\.?[0-9]*)/i);
  if (totalMatch && totalMatch[1]) {
    out.total_cents = Math.round(parseFloat(totalMatch[1].replace(/,/g, '')) * 100);
    console.log("Found Target total:", totalMatch[1], "cents:", out.total_cents);
  }
  
  // Extract item name from HTML - look for product names in the email
  const itemNameSelectors = [
    'img[alt*="Pokémon"]', // Look for images with product names in alt text
    'img[alt*="Trading Card"]',
    'img[alt*="Box"]',
    '.product-name',
    '.item-name',
    '[class*="product"]',
    '[class*="item"]'
  ];
  
  let itemName = null;
  for (const selector of itemNameSelectors) {
    const element = $(selector).first();
    if (element.length) {
      const altText = element.attr('alt') || '';
      const textContent = element.text() || '';
      if (altText && altText.length > 10 && !altText.includes('Target') && !altText.includes('logo')) {
        itemName = altText.trim();
        console.log("Found Target item name from alt text:", itemName);
        break;
      }
      if (textContent && textContent.length > 10 && !textContent.includes('Target')) {
        itemName = textContent.trim();
        console.log("Found Target item name from text:", itemName);
        break;
      }
    }
  }
  
  // Fallback: look for product names in the body text
  if (!itemName) {
    const productPatterns = [
      /([A-Za-z][^:]{10,50}):\s*([A-Za-z][^:]{10,50})/g, // "Pokémon Trading Card Game:Mega Latias ex Box"
      /([A-Za-z][^,]{10,50}),\s*([A-Za-z][^,]{10,50})/g,
    ];
    
    for (const pattern of productPatterns) {
      const matches = [...bodyText.matchAll(pattern)];
      for (const match of matches) {
        const candidate = match[0].trim();
        if (candidate.length > 10 && !candidate.includes('Target') && !candidate.includes('Order')) {
          itemName = candidate;
          console.log("Found Target item name from pattern:", itemName);
          break;
        }
      }
      if (itemName) break;
    }
  }
  
  if (itemName) {
    out.item_name = itemName;
  }
  
  // Extract quantity
  const qtyMatch = bodyText.match(/qty[:\s]*([0-9]+)/i);
  if (qtyMatch && qtyMatch[1]) {
    out.quantity = parseInt(qtyMatch[1]);
    console.log("Found Target quantity:", out.quantity);
  }
  
  // Extract product image from Target email
  const imageSelectors = [
    'img[src*="target.com"]',
    'img[src*="target"]',
    'img[alt*="Pokémon"]',
    'img[alt*="Trading Card"]',
    'img[alt*="Box"]',
    'img[src*="product"]',
    'img[src*="item"]'
  ];
  
  for (const selector of imageSelectors) {
    const img = $(selector).first();
    if (img.length) {
      const src = img.attr('src');
      const alt = img.attr('alt') || '';
      if (src && !src.includes('logo') && !src.includes('bullseye') && !src.includes('target.com/static')) {
        out.image_url = src;
        console.log("Found Target product image:", src, "alt:", alt);
        break;
      }
    }
  }
  
  console.log("Final Target parsed data:", out);
  console.log("=== END TARGET PARSING DEBUG ===");
  
  return out;
}

function parseTargetShipping(html, text) {
  const base = parseTargetOrder(html, text);
  return {
    ...base,
    status: "in_transit",
    carrier: "Target",
  };
}

function parseTargetDelivered(html, text) {
  const base = parseTargetOrder(html, text);
  return {
    ...base,
    status: "delivered",
  };
}

/* ------------------------------ Macy's-specific parsers ------------------------------ */
function parseMacysOrder(html, text) {
  const $ = cheerio.load(html || "");
  const bodyText = $("body").text();
  
  console.log("=== MACY'S PARSING DEBUG ===");
  console.log("HTML length:", (html || "").length);
  console.log("Body text length:", bodyText.length);
  console.log("First 1000 chars of body text:", bodyText.substring(0, 1000));
  
  const out = {};
  
  // Extract order ID from Macy's format - look for various patterns
  const orderIdPatterns = [
    /order\s*#\s*([0-9]+)/i,
    /order\s*number\s*([0-9]+)/i,
    /order\s*([0-9]{6,})/i,
    /#\s*([0-9]{6,})/,
    /([0-9]{8,})/ // Look for long numbers that might be order IDs
  ];
  
  for (const pattern of orderIdPatterns) {
    const match = bodyText.match(pattern);
    if (match && match[1] && match[1] !== "000000") {
      out.order_id = match[1];
      console.log("Found Macy's order ID:", out.order_id, "using pattern:", pattern);
      break;
    }
  }
  
  // Extract total price - look for various price patterns
  const pricePatterns = [
    /total\s*\$([0-9,]+\.?[0-9]*)/i,
    /order\s*total\s*\$([0-9,]+\.?[0-9]*)/i,
    /\$([0-9,]+\.?[0-9]*)\s*total/i,
    /\$([0-9,]+\.?[0-9]*)/g
  ];
  
  for (const pattern of pricePatterns) {
    const matches = [...bodyText.matchAll(pattern)];
    for (const match of matches) {
      const price = parseFloat(match[1].replace(/,/g, ''));
      if (price > 0 && price < 10000) { // Reasonable price range
        out.total_cents = Math.round(price * 100);
        console.log("Found Macy's total:", price, "cents:", out.total_cents);
        break;
      }
    }
    if (out.total_cents) break;
  }
  
  // Extract item name - be very careful to avoid tracking cookies and JS variables
  const itemNameSelectors = [
    '.product-name',
    '.item-name',
    '.product-title',
    '.item-title',
    '[class*="product"]',
    '[class*="item"]',
    'h1', 'h2', 'h3',
    'strong', 'b'
  ];
  
  let itemName = null;
  
  // First try HTML selectors
  for (const selector of itemNameSelectors) {
    const elements = $(selector);
    for (let i = 0; i < elements.length; i++) {
      const element = $(elements[i]);
      const text = element.text().trim();
      
      // Filter out tracking cookies, JS variables, and other junk
      if (text && 
          text.length > 5 && 
          text.length < 200 &&
          !text.includes('_dTCookie') &&
          !text.includes('_ga') &&
          !text.includes('_gid') &&
          !text.includes('utm_') &&
          !text.includes('Macy') &&
          !text.includes('Order') &&
          !text.includes('Total') &&
          !text.includes('$') &&
          !text.includes('javascript:') &&
          !text.includes('function') &&
          !/^[0-9]+$/.test(text) && // Not just numbers
          !/^[A-Z_]+$/.test(text)) { // Not just uppercase with underscores
        itemName = text;
        console.log("Found Macy's item name from selector", selector, ":", itemName);
        break;
      }
    }
    if (itemName) break;
  }
  
  // Fallback: look for quoted text or product descriptions
  if (!itemName) {
    const textPatterns = [
      /"([^"]{10,100})"/g, // Quoted text
      /([A-Za-z][^,]{10,100}),\s*[A-Za-z]/g, // Text with commas
      /([A-Za-z][^:]{10,100}):\s*[A-Za-z]/g // Text with colons
    ];
    
    for (const pattern of textPatterns) {
      const matches = [...bodyText.matchAll(pattern)];
      for (const match of matches) {
        const candidate = match[1].trim();
        if (candidate && 
            candidate.length > 10 && 
            candidate.length < 200 &&
            !candidate.includes('_dTCookie') &&
            !candidate.includes('Macy') &&
            !candidate.includes('Order') &&
            !candidate.includes('Total') &&
            !candidate.includes('$') &&
            !/^[0-9]+$/.test(candidate)) {
          itemName = candidate;
          console.log("Found Macy's item name from pattern:", itemName);
          break;
        }
      }
      if (itemName) break;
    }
  }
  
  if (itemName) {
    out.item_name = itemName;
  }
  
  // Extract quantity
  const qtyPatterns = [
    /qty[:\s]*([0-9]+)/i,
    /quantity[:\s]*([0-9]+)/i,
    /([0-9]+)\s*x\s*[A-Za-z]/i
  ];
  
  for (const pattern of qtyPatterns) {
    const match = bodyText.match(pattern);
    if (match && match[1]) {
      out.quantity = parseInt(match[1]);
      console.log("Found Macy's quantity:", out.quantity);
      break;
    }
  }
  
  // Extract product image from Macy's email
  const imageSelectors = [
    'img[src*="macys.com"]',
    'img[src*="macy"]',
    'img[alt*="product"]',
    'img[alt*="item"]',
    'img[src*="product"]',
    'img[src*="item"]'
  ];
  
  for (const selector of imageSelectors) {
    const img = $(selector).first();
    if (img.length) {
      const src = img.attr('src');
      const alt = img.attr('alt') || '';
      if (src && 
          !src.includes('logo') && 
          !src.includes('macy') && 
          !src.includes('tracking') &&
          !src.includes('pixel') &&
          !src.includes('cookie')) {
        out.image_url = src;
        console.log("Found Macy's product image:", src, "alt:", alt);
        break;
      }
    }
  }
  
  console.log("Final Macy's parsed data:", out);
  console.log("=== END MACY'S PARSING DEBUG ===");
  
  return out;
}

function parseMacysShipping(html, text) {
  const base = parseMacysOrder(html, text);
  return {
    ...base,
    status: "in_transit",
    carrier: "Macy's",
  };
}

function parseMacysDelivered(html, text) {
  const base = parseMacysOrder(html, text);
  return {
    ...base,
    status: "delivered",
  };
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

  // Test product page fetching
  if (event?.queryStringParameters?.test === "product") {
    const testUrl = event.queryStringParameters?.url;
    if (!testUrl) {
      return json({ error: "Missing url parameter" }, 400);
    }
    try {
      const result = await fetchAmazonProductName(testUrl);
      return json({ 
        url: testUrl, 
        result: result,
        success: !!result 
      });
    } catch (error) {
      return json({ 
        url: testUrl, 
        error: error.message,
        success: false 
      }, 500);
    }
  }

  // Test with the specific Magic: The Gathering product
  if (event?.queryStringParameters?.test === "magic") {
    const testUrl = "https://www.amazon.com/dp/B0DV1VCPQF?ref_=pe_125775000_1044873430_t_fed_asin_title";
    try {
      const result = await fetchAmazonProductName(testUrl);
      return json({ 
        url: testUrl, 
        result: result,
        success: !!result,
        expected: "Magic: The Gathering | Marvel's Spider-Man - Bundle: Gift Edition"
      });
    } catch (error) {
      return json({ 
        url: testUrl, 
        error: error.message,
        success: false 
      }, 500);
    }
  }

  // Test retailer classification
  if (event?.queryStringParameters?.test === "classify") {
    const from = event.queryStringParameters?.from;
    const subject = event.queryStringParameters?.subject;
    
    if (!from || !subject) {
      return json({ error: "Missing from or subject parameter" }, 400);
    }
    
    const retailer = classifyRetailer(from);
    const type = classifyType(retailer, subject);
    
    return json({ 
      from, 
      subject, 
      retailer: retailer.name, 
      type,
      senderMatch: retailer.senderMatch ? retailer.senderMatch(from) : false
    });
  }

  // Test all retailers
  if (event?.queryStringParameters?.test === "retailers") {
    const testEmails = [
      "auto-confirm@amazon.com",
      "orders@oe1.target.com", 
      "CustomerService@oes.macys.com",
      "nike@ship.notifications.nike.com"
    ];
    
    const results = testEmails.map(email => {
      const retailer = classifyRetailer(email);
      return {
        email,
        retailer: retailer.name,
        senderMatch: retailer.senderMatch ? retailer.senderMatch(email) : false
      };
    });
    
    return json({ results });
  }

  try {
    const mode = (event.queryStringParameters?.mode || "").toLowerCase();
    const accounts = await getAccounts(); // Get all connected accounts
    
    let totalImported = 0;
    let totalUpdated = 0;
    let totalSkipped = 0;
    let totalErrors = 0;
    let totalProcessed = 0;
    const allProposed = [];
    
    // Process each connected Gmail account
    for (const acct of accounts) {
      console.log(`Processing Gmail account: ${acct.email_address}`);
      
      const gmail = await getGmailClient(acct);
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
        
        console.log(`Processing email from: ${from}, retailer: ${retailer.name}, type: ${type}`);
        
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
          ((subject.match(/order\s*number\s*([0-9\-]+)/i) || [])[1]) ||
          ((subject.match(/([0-9]{10,})/) || [])[1]) || // long numbers
        null;
        
        // Add debug info to the response for browser visibility
        if (!parsed.item_name || parsed.item_name.includes('...')) {
          console.log(`DEBUG: Item name issue - name: "${parsed.item_name}", has ellipsis: ${parsed.item_name?.includes('...')}`);
        }
        if (!parsed.image_url) {
          console.log(`DEBUG: No image found for order ${order_id}`);
        }

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
      // Accumulate results from this account
      totalImported += imported;
      totalUpdated += updated;
      totalSkipped += skipped_existing;
      totalErrors += errors;
      totalProcessed += processed;
      allProposed.push(...proposed);
    }
    
    const totalStats = {
      imported: totalImported,
      updated: totalUpdated,
      skipped_existing: totalSkipped,
      errors: totalErrors,
      processed: totalProcessed,
      accounts_processed: accounts.length,
      duration_ms: Date.now() - startTime
    };

    if (mode === "preview") return json({ proposed: allProposed, stats: totalStats });
    return json(totalStats);
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