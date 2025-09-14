/* netlify/functions/price-charting.js
   Price Charting API integration for automatic market value fetching
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
  const searchUrl = `${PRICE_CHARTING_BASE_URL}/products?q=${encodeURIComponent(normalizedName)}&api_key=${PRICE_CHARTING_API_KEY}`;
  
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

// Get detailed price information for a specific product
async function getProductPrice(productId) {
  if (!PRICE_CHARTING_API_KEY) {
    throw new Error('Price Charting API key not configured');
  }
  
  const priceUrl = `${PRICE_CHARTING_BASE_URL}/product/${productId}?api_key=${PRICE_CHARTING_API_KEY}`;
  
  console.log(`Fetching price for product ID: ${productId}`);
  
  const response = await fetch(priceUrl, {
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

// Update item with API price data
async function updateItemWithApiPrice(itemId, apiData) {
  const priceData = apiData.prices || {};
  const currentPrice = priceData['used-price'] || priceData['complete-price'] || priceData['new-price'];
  
  if (!currentPrice || isNaN(currentPrice)) {
    throw new Error('No valid price found in API response');
  }
  
  const priceCents = Math.round(parseFloat(currentPrice) * 100);
  
  const { error } = await supabase
    .from('items')
    .update({
      api_price_cents: priceCents,
      api_product_id: apiData.id?.toString(),
      api_last_updated: new Date().toISOString(),
      price_source: 'api',
      // Only update market_value_cents if no manual override
      market_value_cents: priceCents,
    })
    .eq('id', itemId);
  
  if (error) {
    throw new Error(`Failed to update item: ${error.message}`);
  }
  
  return {
    itemId,
    priceCents,
    apiProductId: apiData.id?.toString(),
    priceSource: 'api',
  };
}

/* ----------------------------- Main Handler ----------------------------- */
exports.handler = async (event) => {
  // Handle CORS preflight
  if (event.httpMethod === 'OPTIONS') {
    return json({});
  }
  
  try {
    const { httpMethod, path, queryStringParameters, body } = event;
    const params = queryStringParameters || {};
    
    // Parse request body if present
    let requestData = {};
    if (body) {
      try {
        requestData = JSON.parse(body);
      } catch (e) {
        return error('Invalid JSON in request body');
      }
    }
    
    // Route requests based on path and method
    const pathParts = path.split('/').filter(Boolean);
    const action = pathParts[pathParts.length - 1] || 'search';
    
    switch (action) {
      case 'search':
        return await handleSearch(params, requestData);
      
      case 'update-price':
        return await handleUpdatePrice(params, requestData);
      
      case 'bulk-update':
        return await handleBulkUpdate(params, requestData);
      
      case 'cache-status':
        return await handleCacheStatus(params);
      
      default:
        return error('Invalid action', 404);
    }
    
  } catch (err) {
    console.error('Price Charting API error:', err);
    return error(`Internal server error: ${err.message}`, 500);
  }
};

/* ----------------------------- Route Handlers ----------------------------- */
async function handleSearch(params, requestData) {
  const productName = params.q || requestData.productName;
  
  if (!productName) {
    return error('Product name is required');
  }
  
  try {
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
}

async function handleUpdatePrice(params, requestData) {
  const { itemId, productId } = params;
  const { itemId: bodyItemId, productId: bodyProductId } = requestData;
  
  const finalItemId = itemId || bodyItemId;
  const finalProductId = productId || bodyProductId;
  
  if (!finalItemId) {
    return error('Item ID is required');
  }
  
  if (!finalProductId) {
    return error('Product ID is required');
  }
  
  try {
    // Check rate limit
    const withinRateLimit = await checkRateLimit();
    if (!withinRateLimit) {
      return error('Daily API rate limit exceeded. Please try again tomorrow.', 429);
    }
    
    // Get product price data
    const apiResponse = await getProductPrice(finalProductId);
    
    // Update item with new price
    const updateResult = await updateItemWithApiPrice(finalItemId, apiResponse);
    
    return json({
      success: true,
      message: 'Item price updated successfully',
      result: updateResult,
    });
    
  } catch (err) {
    console.error('Update price error:', err);
    return error(`Update failed: ${err.message}`, 500);
  }
}

async function handleBulkUpdate(params, requestData) {
  const { itemIds } = requestData;
  
  if (!itemIds || !Array.isArray(itemIds) || itemIds.length === 0) {
    return error('Item IDs array is required');
  }
  
  if (itemIds.length > 50) {
    return error('Maximum 50 items can be updated at once');
  }
  
  try {
    // Check rate limit
    const withinRateLimit = await checkRateLimit();
    if (!withinRateLimit) {
      return error('Daily API rate limit exceeded. Please try again tomorrow.', 429);
    }
    
    const results = [];
    const errors = [];
    
    // Get all items that need updating
    const { data: items, error: itemsError } = await supabase
      .from('items')
      .select('id, name, api_product_id')
      .in('id', itemIds);
    
    if (itemsError) {
      throw new Error(`Failed to fetch items: ${itemsError.message}`);
    }
    
    // Process each item
    for (const item of items) {
      try {
        if (!item.api_product_id) {
          errors.push({
            itemId: item.id,
            itemName: item.name,
            error: 'No API product ID found. Search for the product first.',
          });
          continue;
        }
        
        // Get current price
        const apiResponse = await getProductPrice(item.api_product_id);
        const updateResult = await updateItemWithApiPrice(item.id, apiResponse);
        
        results.push(updateResult);
        
        // Small delay to respect API rate limits
        await new Promise(resolve => setTimeout(resolve, 100));
        
      } catch (itemError) {
        errors.push({
          itemId: item.id,
          itemName: item.name,
          error: itemError.message,
        });
      }
    }
    
    return json({
      success: true,
      message: `Updated ${results.length} items successfully`,
      results,
      errors,
      summary: {
        total: itemIds.length,
        successful: results.length,
        failed: errors.length,
      },
    });
    
  } catch (err) {
    console.error('Bulk update error:', err);
    return error(`Bulk update failed: ${err.message}`, 500);
  }
}

async function handleCacheStatus(params) {
  try {
    const { data: cacheStats, error } = await supabase
      .from('price_cache')
      .select('id, product_name, cached_at, expires_at')
      .order('cached_at', { ascending: false })
      .limit(100);
    
    if (error) {
      throw new Error(`Failed to fetch cache status: ${error.message}`);
    }
    
    const now = new Date();
    const activeCache = cacheStats.filter(item => new Date(item.expires_at) > now);
    const expiredCache = cacheStats.filter(item => new Date(item.expires_at) <= now);
    
    return json({
      success: true,
      cache: {
        total: cacheStats.length,
        active: activeCache.length,
        expired: expiredCache.length,
        entries: activeCache.slice(0, 20), // Return first 20 active entries
      },
    });
    
  } catch (err) {
    console.error('Cache status error:', err);
    return error(`Cache status failed: ${err.message}`, 500);
  }
}
