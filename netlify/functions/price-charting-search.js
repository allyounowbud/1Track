/* netlify/functions/price-charting-search.js
   Price Charting API search endpoint
   CJS module (Netlify functions default). Keep this filename as .js. */

const { createClient } = require("@supabase/supabase-js");

/* ----------------------------- Supabase init ----------------------------- */
const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_ANON_KEY;
if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
  console.error("Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY");
}
const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
  auth: { persistSession: false },
});

/* ----------------------------- Price Charting API Config ----------------------------- */
const PRICE_CHARTING_API_KEY = process.env.PRICE_CHARTING_API_KEY;
const PRICE_CHARTING_BASE_URL = "https://www.pricecharting.com/api";
const CACHE_DURATION_HOURS = 24; // Cache API responses for 24 hours
const MAX_API_CALLS_PER_DAY = 1000; // Adjust based on your API plan

/* ----------------------------- Helper Functions ----------------------------- */
function json(data, statusCode = 200) {
  return {
    statusCode,
    headers: {
      "Content-Type": "application/json",
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Headers": "Content-Type, Authorization",
      "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
    },
    body: JSON.stringify(data),
  };
}

function error(message, statusCode = 400) {
  return json({ error: message }, statusCode);
}

// Clean and normalize product names for API search
function normalizeProductName(name) {
  return name
    .trim()
    .toLowerCase()
    .replace(/[^\w\s-]/g, '') // Remove special characters except spaces and hyphens
    .replace(/\s+/g, ' ') // Normalize spaces
    .substring(0, 100); // Limit length
}

// Check if we've exceeded daily API rate limit
async function checkRateLimit() {
  const today = new Date().toISOString().split('T')[0];
  const { data, error } = await supabase
    .from('price_cache')
    .select('id')
    .gte('cached_at', `${today}T00:00:00Z`)
    .lt('cached_at', `${today}T23:59:59Z`);
  
  if (error) {
    console.error('Rate limit check failed:', error);
    return false;
  }
  
  return data.length < MAX_API_CALLS_PER_DAY;
}

// Check cache for existing API response
async function getCachedResponse(productName) {
  const normalizedName = normalizeProductName(productName);
  
  const { data, error } = await supabase
    .from('price_cache')
    .select('api_response, cached_at, expires_at')
    .eq('product_name', normalizedName)
    .gt('expires_at', new Date().toISOString())
    .single();
  
  if (error || !data) {
    return null;
  }
  
  return data.api_response;
}

// Cache API response
async function cacheResponse(productName, apiResponse) {
  const normalizedName = normalizeProductName(productName);
  const now = new Date();
  const expiresAt = new Date(now.getTime() + (CACHE_DURATION_HOURS * 60 * 60 * 1000));
  
  const { error } = await supabase
    .from('price_cache')
    .upsert({
      product_name: normalizedName,
      api_response: apiResponse,
      cached_at: now.toISOString(),
      expires_at: expiresAt.toISOString(),
    });
  
  if (error) {
    console.error('Failed to cache response:', error);
  }
}

// Search for products using Price Charting API
async function searchProducts(productName) {
  if (!PRICE_CHARTING_API_KEY) {
    throw new Error('Price Charting API key not configured');
  }
  
  const normalizedName = normalizeProductName(productName);
  const searchUrl = `${PRICE_CHARTING_BASE_URL}/api/products?q=${encodeURIComponent(normalizedName)}&t=${PRICE_CHARTING_API_KEY}`;
  
  console.log(`Searching Price Charting API for: ${normalizedName}`);
  
  const response = await fetch(searchUrl, {
    method: 'GET',
    headers: {
      'Accept': 'application/json',
    },
  });
  
  if (!response.ok) {
    throw new Error(`Price Charting API error: ${response.status} ${response.statusText}`);
  }
  
  const data = await response.json();
  return data;
}

/* ----------------------------- Main Handler ----------------------------- */
exports.handler = async (event) => {
  // Handle CORS preflight
  if (event.httpMethod === 'OPTIONS') {
    return json({});
  }
  
  try {
    const { queryStringParameters } = event;
    const params = queryStringParameters || {};
    
    const productName = params.q;
    
    if (!productName) {
      return error('Product name is required');
    }
    
    // Check cache first
    const cachedResponse = await getCachedResponse(productName);
    if (cachedResponse) {
      console.log('Returning cached response for:', productName);
      return json({
        success: true,
        cached: true,
        data: cachedResponse,
      });
    }
    
    // Check rate limit
    const withinRateLimit = await checkRateLimit();
    if (!withinRateLimit) {
      return error('Daily API rate limit exceeded. Please try again tomorrow.', 429);
    }
    
    // Search API
    const apiResponse = await searchProducts(productName);
    
    // Cache the response
    await cacheResponse(productName, apiResponse);
    
    return json({
      success: true,
      cached: false,
      data: apiResponse,
    });
    
  } catch (err) {
    console.error('Search error:', err);
    return error(`Search failed: ${err.message}`, 500);
  }
};
