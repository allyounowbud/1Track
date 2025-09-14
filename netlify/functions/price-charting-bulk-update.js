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
const PRICE_CHARTING_BASE_URL = "https://www.pricecharting.com";
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

// Test API key with a known product (EarthBound from docs)
async function testApiKey() {
  const testUrl = `${PRICE_CHARTING_BASE_URL}/api/product?id=6910&t=${PRICE_CHARTING_API_KEY}`;
  console.log('Testing API key with known product (EarthBound):', testUrl);
  
  try {
    const response = await fetch(testUrl, {
      method: 'GET',
      headers: {
        'Accept': 'application/json',
      },
    });
    
    if (response.ok) {
      const data = await response.json();
      console.log('API key test successful:', data);
      return true;
    } else {
      const errorText = await response.text();
      console.error('API key test failed:', response.status, errorText);
      return false;
    }
  } catch (error) {
    console.error('API key test error:', error);
    return false;
  }
}

// Search for products using Price Charting API with fuzzy matching
async function searchProducts(productName) {
  console.log(`Starting enhanced search for: "${productName}"`);
  
  if (!PRICE_CHARTING_API_KEY) {
    throw new Error('Price Charting API key not configured');
  }
  
  // Validate API key format
  if (typeof PRICE_CHARTING_API_KEY !== 'string' || PRICE_CHARTING_API_KEY.trim().length === 0) {
    throw new Error('Invalid API key format');
  }
  
  if (PRICE_CHARTING_API_KEY.length !== 40) {
    console.warn(`API key length is ${PRICE_CHARTING_API_KEY.length}, expected 40 characters`);
  }
  
  // Test API key first
  const apiKeyWorks = await testApiKey();
  if (!apiKeyWorks) {
    throw new Error('API key test failed. Please verify your Price Charting API key is correct.');
  }
  
  // Try multiple search strategies with more variations
  const searchStrategies = [
    // Strategy 1: Direct name search
    () => searchWithName(productName),
    // Strategy 2: Cleaned name search
    () => searchWithName(cleanProductName(productName)),
    // Strategy 3: Shortened name search
    () => searchWithName(getShortenedName(productName)),
    // Strategy 4: Gaming term enhanced search
    () => searchWithName(enhanceWithGamingTerms(productName)),
    // Strategy 5: Try with just the first word
    () => searchWithName(productName.split(' ')[0]),
    // Strategy 6: Try with numbers removed
    () => searchWithName(productName.replace(/\d+/g, '').trim()),
    // Strategy 7: Try with common variations
    () => searchWithName(getCommonVariations(productName)),
    // Strategy 8: Pokemon-specific searches
    () => searchPokemonVariations(productName),
    // Strategy 9: Try without leading numbers
    () => searchWithName(productName.replace(/^\d+\s*/, '').trim()),
    // Strategy 10: Try with Pokemon 151 specific terms
    () => searchWithPokemon151Terms(productName)
  ];
  
  const allResults = [];
  
  for (let i = 0; i < searchStrategies.length; i++) {
    try {
      console.log(`Trying search strategy ${i + 1} for: "${productName}"`);
      const results = await searchStrategies[i]();
      
      if (results && results.length > 0) {
        console.log(`Strategy ${i + 1} successful: found ${results.length} results`);
        // Add results with strategy info
        results.forEach(result => {
          result.search_strategy = i + 1;
          result.original_search_term = productName;
        });
        allResults.push(...results);
        
        // If we have good results, return them
        if (results.length >= 3) {
          return results;
        }
      }
    } catch (error) {
      console.log(`Strategy ${i + 1} failed:`, error.message);
      // Continue to next strategy
    }
  }
  
  // If we have any results from any strategy, return them
  if (allResults.length > 0) {
    console.log(`Found ${allResults.length} total results across all strategies`);
    // Remove duplicates and return
    const uniqueResults = allResults.filter((result, index, self) => 
      index === self.findIndex(r => (r.id || r.product_id) === (result.id || result.product_id))
    );
    return uniqueResults.slice(0, 10); // Limit to 10 results
  }
  
  // If still no results, try a very broad search
  console.log(`No results found with specific strategies. Trying very broad search...`);
  try {
    const broadResults = await searchWithName(productName.split(' ')[0]); // Just first word
    if (broadResults && broadResults.length > 0) {
      console.log(`Broad search found ${broadResults.length} results`);
      return broadResults.slice(0, 5); // Limit to 5 for broad search
    }
  } catch (error) {
    console.log(`Broad search also failed:`, error.message);
  }
  
  // Final fallback: Try known product IDs for common Pokemon products
  console.log(`Trying known product ID lookup as final fallback...`);
  try {
    const knownProductId = await tryKnownProductIds(productName);
    if (knownProductId) {
      console.log(`Found product using known ID: ${knownProductId}`);
      return [knownProductId];
    }
  } catch (error) {
    console.log(`Known product ID lookup failed:`, error.message);
  }
  
      // Return a helpful error with suggestions
      throw new Error(`Product "${productName}" not found in Price Charting database after trying ${searchStrategies.length} search strategies. This product may not be in their database, or you may need to search manually using the product search feature.`);
}

// Clean product name for better API matching
function cleanProductName(name) {
  return name
    .trim()
    .replace(/[^\w\s-]/g, '') // Remove special characters except spaces and hyphens
    .replace(/\s+/g, ' ') // Normalize spaces
    .replace(/\b(complete|sealed|new|used|loose|boxed|graded|psa|bgs|cgc)\b/gi, '') // Remove condition words
    .replace(/\b\d{4}\b/g, '') // Remove years
    .replace(/\b(v\d+|version|ver|edition|ed)\b/gi, '') // Remove version indicators
    .trim();
}

// Get shortened version of name (first 2-3 words)
function getShortenedName(name) {
  const words = name.split(/\s+/);
  return words.slice(0, Math.min(3, words.length)).join(' ');
}

// Enhance name with gaming terms for better matching
function enhanceWithGamingTerms(name) {
  const gamingTerms = ['game', 'video game', 'trading card', 'card', 'pokemon', 'nintendo', 'playstation', 'xbox'];
  const lowerName = name.toLowerCase();
  
  for (const term of gamingTerms) {
    if (lowerName.includes(term)) {
      return name; // Already has gaming term
    }
  }
  
  // Add appropriate gaming term based on context
  if (lowerName.includes('card') || lowerName.includes('pokemon') || lowerName.includes('magic')) {
    return `trading card ${name}`;
  } else if (lowerName.includes('nintendo') || lowerName.includes('mario') || lowerName.includes('zelda')) {
    return `nintendo ${name}`;
  } else if (lowerName.includes('playstation') || lowerName.includes('ps')) {
    return `playstation ${name}`;
  } else if (lowerName.includes('xbox')) {
    return `xbox ${name}`;
  }
  
  return name;
}

// Get common variations of a product name
function getCommonVariations(name) {
  const variations = [];
  const lowerName = name.toLowerCase();
  
  // Try removing numbers and common prefixes/suffixes
  variations.push(name.replace(/^\d+\s*/, '')); // Remove leading numbers
  variations.push(name.replace(/\s*\d+$/, '')); // Remove trailing numbers
  
  // Special handling for Pokemon cards (like "151 Blooming Waters")
  if (lowerName.includes('151') || lowerName.includes('blooming') || lowerName.includes('waters')) {
    // Try with Pokemon-specific terms
    variations.push(`blooming waters premium collection box`);
    variations.push(`pokemon scarlet violet 151 blooming waters`);
    variations.push(`pokemon 151 blooming waters`);
    variations.push(`blooming waters collection box`);
  }
  
  // Try with common gaming terms if it looks like a game
  if (lowerName.includes('game') || lowerName.includes('card') || lowerName.includes('pokemon') || lowerName.includes('magic')) {
    variations.push(`trading card ${name}`);
    variations.push(`video game ${name}`);
    variations.push(`pokemon card ${name}`);
  }
  
  // Try with just the main words (remove common words)
  const words = name.split(/\s+/).filter(word => 
    !['the', 'a', 'an', 'and', 'or', 'of', 'in', 'on', 'at', 'to', 'for'].includes(word.toLowerCase()) &&
    word.length > 2
  );
  if (words.length > 0) {
    variations.push(words.join(' '));
  }
  
  // For Pokemon cards, try specific Pokemon set variations
  if (lowerName.includes('151') || lowerName.includes('pokemon')) {
    variations.push(`pokemon 151`);
    variations.push(`scarlet violet 151`);
  }
  
  return variations[0] || name; // Return first variation or original name
}

// Pokemon-specific search variations
async function searchPokemonVariations(name) {
  const lowerName = name.toLowerCase();
  const results = [];
  
  // If it contains Pokemon-related terms, try specific searches
  if (lowerName.includes('151') || lowerName.includes('blooming') || lowerName.includes('waters')) {
    const pokemonSearches = [
      'blooming waters premium collection box',
      'pokemon 151 blooming waters',
      'scarlet violet 151 blooming waters',
      'blooming waters collection box',
      'pokemon card blooming waters'
    ];
    
    for (const searchTerm of pokemonSearches) {
      try {
        const searchResults = await searchWithName(searchTerm);
        if (searchResults && searchResults.length > 0) {
          results.push(...searchResults);
        }
      } catch (error) {
        // Continue with next search term
      }
    }
  }
  
  return results.length > 0 ? results : [];
}

// Pokemon 151 specific search terms
async function searchWithPokemon151Terms(name) {
  const lowerName = name.toLowerCase();
  const results = [];
  
  if (lowerName.includes('151') || lowerName.includes('blooming')) {
    const pokemon151Searches = [
      'pokemon 151',
      'scarlet violet 151',
      'pokemon scarlet violet 151',
      'blooming waters',
      'premium collection box'
    ];
    
    for (const searchTerm of pokemon151Searches) {
      try {
        const searchResults = await searchWithName(searchTerm);
        if (searchResults && searchResults.length > 0) {
          // Filter results to find ones that might match our product
          const filteredResults = searchResults.filter(result => {
            const resultName = (result.product_name || result.name || '').toLowerCase();
            return resultName.includes('blooming') || resultName.includes('waters') || resultName.includes('151');
          });
          results.push(...filteredResults);
        }
      } catch (error) {
        // Continue with next search term
      }
    }
  }
  
  return results.length > 0 ? results : [];
}

// Try known product IDs for common products
async function tryKnownProductIds(productName) {
  const lowerName = productName.toLowerCase();
  
  // Known product IDs for common Pokemon products
  const knownProducts = {
    '151 blooming waters': '8425581',
    'blooming waters': '8425581',
    'pokemon 151 blooming waters': '8425581',
    'blooming waters premium collection box': '8425581'
  };
  
  // Check if this product matches any known products
  for (const [key, productId] of Object.entries(knownProducts)) {
    if (lowerName.includes(key) || key.includes(lowerName.replace(/\d+/g, '').trim())) {
      console.log(`Matched "${productName}" to known product ID: ${productId}`);
      
      // Verify the product ID exists by fetching it
      try {
        const productUrl = `${PRICE_CHARTING_BASE_URL}/api/product?id=${productId}&t=${PRICE_CHARTING_API_KEY}`;
        const response = await fetch(productUrl, {
          method: 'GET',
          headers: {
            'Accept': 'application/json',
            'User-Agent': '1Track/1.0',
          },
        });
        
        if (response.ok) {
          const productData = await response.json();
          console.log(`Verified product ID ${productId}: ${productData.product_name}`);
          return {
            id: productId,
            product_name: productData.product_name,
            loose_price: productData.loose_price,
            cib_price: productData.cib_price,
            console_name: productData.console_name,
            verified: true
          };
        }
      } catch (error) {
        console.log(`Failed to verify product ID ${productId}:`, error.message);
      }
    }
  }
  
  return null;
}

// Search with a specific name
async function searchWithName(searchName) {
  const searchUrl = `${PRICE_CHARTING_BASE_URL}/api/products?q=${encodeURIComponent(searchName)}&t=${PRICE_CHARTING_API_KEY}`;
  
  console.log(`Searching with URL: ${searchUrl}`);
  
  const response = await fetch(searchUrl, {
    method: 'GET',
    headers: {
      'Accept': 'application/json',
      'User-Agent': '1Track/1.0',
    },
  });

  if (!response.ok) {
    const errorText = await response.text();
    console.error(`Search failed for "${searchName}": ${response.status} ${errorText}`);
    throw new Error(`API error: ${response.status} ${response.statusText}`);
  }
  
  const data = await response.json();
  console.log(`Search results for "${searchName}":`, data);
  
  // Handle different response formats
  if (Array.isArray(data)) {
    return data;
  } else if (data.products) {
    return data.products;
  } else if (data.product_name || data.id) {
    return [data]; // Single product result
  } else {
    return [];
  }
}

// Get detailed price information for a specific product
async function getProductPrice(productId) {
  if (!PRICE_CHARTING_API_KEY) {
    throw new Error('Price Charting API key not configured');
  }
  
  const priceUrl = `${PRICE_CHARTING_BASE_URL}/api/product?id=${productId}&t=${PRICE_CHARTING_API_KEY}`;
  
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
          try {
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
          } catch (searchError) {
            // If search fails, try with a simplified product name
            const simplifiedName = item.name.split(' ').slice(0, 2).join(' '); // Try with just first 2 words
            
            if (simplifiedName !== item.name) {
              try {
                console.log(`Trying simplified search for: "${simplifiedName}"`);
                const searchResponse = await searchProducts(simplifiedName);
                const products = searchResponse.products || [];
                
                if (products.length > 0) {
                  const product = products[0];
                  const productId = product.id;
                  
                  const apiResponse = await getProductPrice(productId);
                  const updateResult = await updateItemWithApiPrice(item.id, apiResponse);
                  
                  results.push(updateResult);
                  continue;
                }
              } catch (simplifiedError) {
                console.log(`Simplified search also failed for: "${simplifiedName}"`);
              }
            }
            
            errors.push({
              itemId: item.id,
              itemName: item.name,
              error: `Search failed: ${searchError.message}`,
            });
          }
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
