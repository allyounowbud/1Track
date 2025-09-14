/* netlify/functions/price-charting-bulk-update.js
   Price Charting API bulk update endpoint
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

// Search for products using Price Charting API
async function searchProducts(productName) {
  if (!PRICE_CHARTING_API_KEY) {
    throw new Error('Price Charting API key not configured');
  }
  
  const normalizedName = productName
    .trim()
    .toLowerCase()
    .replace(/[^\w\s-]/g, '') // Remove special characters except spaces and hyphens
    .replace(/\s+/g, ' ') // Normalize spaces
    .substring(0, 100); // Limit length
    
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
  console.log('Bulk update function called:', event.httpMethod, event.path);
  
  // Handle CORS preflight
  if (event.httpMethod === 'OPTIONS') {
    return json({});
  }
  
  try {
    const { body } = event;
    
    // Parse request body
    let requestData = {};
    if (body) {
      try {
        requestData = JSON.parse(body);
      } catch (e) {
        return error('Invalid JSON in request body');
      }
    }
    
    const { itemIds } = requestData;
    
    if (!itemIds || !Array.isArray(itemIds) || itemIds.length === 0) {
      return error('Item IDs array is required');
    }
    
    if (itemIds.length > 50) {
      return error('Maximum 50 items can be updated at once');
    }
    
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
    
    // Process each item with auto-search
    for (const item of items) {
      try {
        // First, try to search for the product if no API product ID exists
        if (!item.api_product_id) {
          // Search for the product
          const searchResponse = await searchProducts(item.name);
          const products = searchResponse.products || [];
          
          if (products.length === 0) {
            errors.push({
              itemId: item.id,
              itemName: item.name,
              error: 'Product not found in Price Charting database',
            });
            continue;
          }
          
          // Use the first search result (most relevant)
          const product = products[0];
          const productId = product.id;
          
          // Update the item with the found product
          const apiResponse = await getProductPrice(productId);
          const updateResult = await updateItemWithApiPrice(item.id, apiResponse);
          
          results.push(updateResult);
        } else {
          // Product already linked, just update price
          const apiResponse = await getProductPrice(item.api_product_id);
          const updateResult = await updateItemWithApiPrice(item.id, apiResponse);
          
          results.push(updateResult);
        }
        
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
    console.error('Error stack:', err.stack);
    return error(`Bulk update failed: ${err.message}`, 500);
  }
};
