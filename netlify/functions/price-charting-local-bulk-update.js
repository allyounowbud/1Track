const { createClient } = require('@supabase/supabase-js');

// Initialize Supabase client
const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const supabase = createClient(supabaseUrl, supabaseServiceKey);

// Helper function to calculate string similarity
function calculateSimilarity(str1, str2) {
  const longer = str1.length > str2.length ? str1 : str2;
  const shorter = str1.length > str2.length ? str2 : str1;
  
  if (longer.length === 0) return 1.0;
  
  const distance = levenshteinDistance(longer.toLowerCase(), shorter.toLowerCase());
  return (longer.length - distance) / longer.length;
}

function levenshteinDistance(str1, str2) {
  const matrix = [];
  
  for (let i = 0; i <= str2.length; i++) {
    matrix[i] = [i];
  }
  
  for (let j = 0; j <= str1.length; j++) {
    matrix[0][j] = j;
  }
  
  for (let i = 1; i <= str2.length; i++) {
    for (let j = 1; j <= str1.length; j++) {
      if (str2.charAt(i - 1) === str1.charAt(j - 1)) {
        matrix[i][j] = matrix[i - 1][j - 1];
      } else {
        matrix[i][j] = Math.min(
          matrix[i - 1][j - 1] + 1,
          matrix[i][j - 1] + 1,
          matrix[i - 1][j] + 1
        );
      }
    }
  }
  
  return matrix[str2.length][str1.length];
}

// Fast search for products in local CSV data (optimized for bulk operations)
async function searchLocalProductsFast(productName) {
  console.log(`Fast searching local CSV data for: "${productName}"`);
  
  // Clean the product name for better matching
  const cleanName = productName
    .trim()
    .toLowerCase()
    .replace(/[^\w\s-]/g, '')
    .replace(/\s+/g, ' ');
  
  // Try only the most effective search strategies to save time
  const searchStrategies = [
    // Strategy 1: Contains match (most likely to find results)
    () => searchWithStrategy(cleanName, 'contains'),
    // Strategy 2: First word only (for Pokemon cards like "151 Blooming Waters")
    () => searchWithStrategy(cleanName.split(' ')[0], 'contains'),
    // Strategy 3: Without numbers (for "151 Blooming Waters" -> "blooming waters")
    () => searchWithStrategy(cleanName.replace(/\d+/g, '').trim(), 'contains')
  ];
  
  for (let i = 0; i < searchStrategies.length; i++) {
    try {
      console.log(`Trying fast search strategy ${i + 1} for: "${productName}"`);
      const results = await searchStrategies[i]();
      
      if (results && results.length > 0) {
        console.log(`Fast strategy ${i + 1} successful: found ${results.length} results`);
        
        // Calculate similarity scores and filter (lower threshold for speed)
        const scoredResults = results.map(result => ({
          ...result,
          similarity_score: calculateSimilarity(productName, result.product_name)
        })).filter(result => result.similarity_score >= 0.5); // Lower threshold for speed
        
        if (scoredResults.length > 0) {
          return scoredResults.sort((a, b) => b.similarity_score - a.similarity_score).slice(0, 3); // Limit to top 3
        }
      }
    } catch (error) {
      console.log(`Fast strategy ${i + 1} failed:`, error.message);
    }
  }
  
  return [];
}

// Search for products in local CSV data (comprehensive version)
async function searchLocalProducts(productName) {
  console.log(`Searching local CSV data for: "${productName}"`);
  
  // Clean the product name for better matching
  const cleanName = productName
    .trim()
    .toLowerCase()
    .replace(/[^\w\s-]/g, '')
    .replace(/\s+/g, ' ');
  
  // Try different search strategies
  const searchStrategies = [
    // Strategy 1: Exact match
    () => searchWithStrategy(cleanName, 'exact'),
    // Strategy 2: Contains match
    () => searchWithStrategy(cleanName, 'contains'),
    // Strategy 3: Individual words
    () => searchWithStrategy(cleanName.split(' ')[0], 'contains'),
    // Strategy 4: Without numbers
    () => searchWithStrategy(cleanName.replace(/\d+/g, '').trim(), 'contains'),
    // Strategy 5: Pokemon-specific variations
    () => searchPokemonVariations(cleanName)
  ];
  
  for (let i = 0; i < searchStrategies.length; i++) {
    try {
      console.log(`Trying local search strategy ${i + 1} for: "${productName}"`);
      const results = await searchStrategies[i]();
      
      if (results && results.length > 0) {
        console.log(`Strategy ${i + 1} successful: found ${results.length} results`);
        
        // Calculate similarity scores and filter
        const scoredResults = results.map(result => ({
          ...result,
          similarity_score: calculateSimilarity(productName, result.product_name)
        })).filter(result => result.similarity_score >= 0.6);
        
        if (scoredResults.length > 0) {
          return scoredResults.sort((a, b) => b.similarity_score - a.similarity_score);
        }
      }
    } catch (error) {
      console.log(`Strategy ${i + 1} failed:`, error.message);
    }
  }
  
  return [];
}

// Search with specific strategy
async function searchWithStrategy(searchTerm, strategy) {
  let query = supabase
    .from('price_charting_products')
    .select('*')
    .limit(10); // Reduced limit for faster queries
  
  switch (strategy) {
    case 'exact':
      query = query.ilike('product_name', searchTerm);
      break;
    case 'contains':
      query = query.ilike('product_name', `%${searchTerm}%`);
      break;
  }
  
  const { data, error } = await query;
  
  if (error) {
    console.error(`Search error for "${searchTerm}":`, error);
    throw error;
  }
  
  return data || [];
}

// Pokemon-specific search variations
async function searchPokemonVariations(cleanName) {
  const results = [];
  
  if (cleanName.includes('151') || cleanName.includes('blooming') || cleanName.includes('waters')) {
    const pokemonSearches = [
      'blooming waters premium collection box',
      'pokemon 151 blooming waters',
      'scarlet violet 151 blooming waters',
      'blooming waters collection box',
      'blooming waters',
      'pokemon 151'
    ];
    
    for (const searchTerm of pokemonSearches) {
      try {
        const searchResults = await searchWithStrategy(searchTerm, 'contains');
        if (searchResults && searchResults.length > 0) {
          results.push(...searchResults);
        }
      } catch (error) {
        // Continue with next search term
      }
    }
  }
  
  return results;
}

// Get price for a specific product
async function getProductPrice(productId) {
  console.log(`Getting price for product ID: ${productId}`);
  
  const { data, error } = await supabase
    .from('price_charting_products')
    .select('*')
    .eq('product_id', productId)
    .single();
  
  if (error) {
    console.error(`Error getting product price:`, error);
    throw error;
  }
  
  return data;
}

// Update item with price data
async function updateItemPrice(itemId, productData) {
  console.log(`Updating item ${itemId} with price data`);
  
  // Use loose_price as the primary market value (most common for trading cards)
  const marketValue = productData.loose_price || productData.cib_price || productData.new_price || 0;
  
  const { error } = await supabase
    .from('items')
    .update({
      api_product_id: productData.product_id,
      market_value_cents: Math.round(marketValue * 100), // Convert to cents
      price_source: 'api',
      api_last_updated: new Date().toISOString(),
      upc_code: productData.upc_code || null,
      product_category: productData.category || null,
      console_name: productData.console_name || null
    })
    .eq('id', itemId);
  
  if (error) {
    console.error(`Error updating item price:`, error);
    throw error;
  }
  
  return {
    success: true,
    product_id: productData.product_id,
    product_name: productData.product_name,
    market_value: marketValue,
    console_name: productData.console_name
  };
}

// Main bulk update function
async function handleBulkUpdate(itemIds) {
  console.log(`Starting bulk update for ${itemIds.length} items using local CSV data`);
  
  const results = {
    successful: [],
    failed: []
  };
  
  // Get all items that need updating
  const { data: items, error: itemsError } = await supabase
    .from('items')
    .select('id, name, api_product_id')
    .in('id', itemIds);
  
  if (itemsError) {
    throw new Error(`Failed to fetch items: ${itemsError.message}`);
  }
  
  console.log(`Found ${items.length} items to update`);
  
  // Process items in smaller batches to avoid timeout
  const batchSize = 10; // Process 10 items at a time
  const batches = [];
  for (let i = 0; i < items.length; i += batchSize) {
    batches.push(items.slice(i, i + batchSize));
  }
  
  console.log(`Processing ${batches.length} batches of ${batchSize} items each`);
  
  for (let batchIndex = 0; batchIndex < batches.length; batchIndex++) {
    const batch = batches[batchIndex];
    console.log(`Processing batch ${batchIndex + 1}/${batches.length}`);
    
    for (const item of batch) {
      try {
        console.log(`Processing item: "${item.name}"`);
        
        // Use a faster, simpler search strategy first
        const searchResults = await searchLocalProductsFast(item.name);
        
        if (searchResults.length > 0) {
          // Use the best match (highest similarity score)
          const bestMatch = searchResults[0];
          console.log(`Found match: "${bestMatch.product_name}" (similarity: ${bestMatch.similarity_score})`);
          
          // Update the item with price data
          const updateResult = await updateItemPrice(item.id, bestMatch);
          results.successful.push({
            item_id: item.id,
            item_name: item.name,
            matched_product: bestMatch.product_name,
            product_id: bestMatch.product_id,
            market_value: updateResult.market_value,
            similarity_score: bestMatch.similarity_score
          });
        } else {
          console.log(`No match found for: "${item.name}"`);
          results.failed.push({
            item_id: item.id,
            item_name: item.name,
            error: 'Product not found in local CSV data'
          });
        }
      } catch (error) {
        console.error(`Error processing item "${item.name}":`, error);
        results.failed.push({
          item_id: item.id,
          item_name: item.name,
          error: error.message
        });
      }
    }
    
    // Add a small delay between batches to prevent overwhelming the database
    if (batchIndex < batches.length - 1) {
      await new Promise(resolve => setTimeout(resolve, 100));
    }
  }
  
  console.log(`Bulk update completed. Successful: ${results.successful.length}, Failed: ${results.failed.length}`);
  
  return results;
}

// Main handler
exports.handler = async (event, context) => {
  console.log('Local bulk update function called');
  console.log('Event method:', event.httpMethod);
  console.log('Event body:', event.body);
  
  try {
    // Handle CORS preflight
    if (event.httpMethod === 'OPTIONS') {
      return {
        statusCode: 200,
        headers: {
          'Access-Control-Allow-Origin': '*',
          'Access-Control-Allow-Headers': 'Content-Type',
          'Access-Control-Allow-Methods': 'POST, OPTIONS'
        },
        body: ''
      };
    }
    
    if (event.httpMethod !== 'POST') {
      return {
        statusCode: 405,
        headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*'
        },
        body: JSON.stringify({ error: 'Method not allowed' })
      };
    }
    
    // Validate environment variables
    if (!supabaseUrl || !supabaseServiceKey) {
      throw new Error('Missing Supabase configuration. Please check environment variables.');
    }
    
    console.log('Supabase URL configured:', !!supabaseUrl);
    console.log('Supabase Service Key configured:', !!supabaseServiceKey);
    
    let itemIds;
    try {
      const body = JSON.parse(event.body || '{}');
      itemIds = body.itemIds;
      console.log('Parsed itemIds:', itemIds);
    } catch (parseError) {
      console.error('Failed to parse event body:', parseError);
      throw new Error(`Invalid JSON in request body: ${parseError.message}`);
    }
    
    if (!itemIds || !Array.isArray(itemIds) || itemIds.length === 0) {
      return {
        statusCode: 400,
        headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*'
        },
        body: JSON.stringify({ error: 'Item IDs array is required' })
      };
    }
    
    console.log(`Processing ${itemIds.length} items`);
    
    const results = await handleBulkUpdate(itemIds);
    
    console.log('Bulk update completed successfully');
    
    return {
      statusCode: 200,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Headers': 'Content-Type',
        'Access-Control-Allow-Methods': 'POST, OPTIONS'
      },
      body: JSON.stringify({
        success: true,
        results,
        summary: {
          total: itemIds.length,
          successful: results.successful.length,
          failed: results.failed.length
        }
      })
    };
    
  } catch (error) {
    console.error('Local bulk update error:', error);
    console.error('Error stack:', error.stack);
    
    return {
      statusCode: 500,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*'
      },
      body: JSON.stringify({
        success: false,
        error: error.message,
        timestamp: new Date().toISOString()
      })
    };
  }
};
