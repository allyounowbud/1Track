const { createClient } = require('@supabase/supabase-js');

// Initialize Supabase client
const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
  throw new Error('Missing Supabase configuration');
}

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

// Search products in the database
async function searchProducts(query, limit = 20) {
  console.log(`Searching for: "${query}"`);
  
  if (!query || query.trim().length < 2) {
    return [];
  }
  
  const searchTerm = query.trim().toLowerCase();
  
  // Try multiple search strategies
  const searchStrategies = [
    // Strategy 1: Exact match
    () => searchWithStrategy(searchTerm, 'exact'),
    // Strategy 2: Contains match
    () => searchWithStrategy(searchTerm, 'contains'),
    // Strategy 3: Individual words
    () => searchWithStrategy(searchTerm.split(' ')[0], 'contains'),
    // Strategy 4: Without numbers
    () => searchWithStrategy(searchTerm.replace(/\d+/g, '').trim(), 'contains'),
    // Strategy 5: Full-text search
    () => searchWithFullText(searchTerm)
  ];
  
  const allResults = [];
  
  for (let i = 0; i < searchStrategies.length; i++) {
    try {
      console.log(`Trying search strategy ${i + 1} for: "${query}"`);
      const results = await searchStrategies[i]();
      
      if (results && results.length > 0) {
        allResults.push(...results);
      }
    } catch (error) {
      console.log(`Strategy ${i + 1} failed:`, error.message);
    }
  }
  
  // Remove duplicates and calculate similarity scores
  const uniqueResults = new Map();
  
  allResults.forEach(result => {
    const key = result.product_id;
    if (!uniqueResults.has(key)) {
      uniqueResults.set(key, {
        ...result,
        similarity_score: calculateSimilarity(query, result.product_name)
      });
    }
  });
  
  // Filter by similarity and sort
  const scoredResults = Array.from(uniqueResults.values())
    .filter(result => result.similarity_score >= 0.3)
    .sort((a, b) => b.similarity_score - a.similarity_score)
    .slice(0, limit);
  
  console.log(`Found ${scoredResults.length} results for "${query}"`);
  
  return scoredResults;
}

// Search with specific strategy
async function searchWithStrategy(searchTerm, strategy) {
  let query = supabase
    .from('price_charting_products')
    .select('*')
    .limit(50);
  
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

// Full-text search using Supabase's built-in search
async function searchWithFullText(searchTerm) {
  const { data, error } = await supabase
    .from('price_charting_products')
    .select('*')
    .textSearch('product_name', searchTerm, {
      type: 'websearch',
      config: 'english'
    })
    .limit(50);
  
  if (error) {
    console.error(`Full-text search error for "${searchTerm}":`, error);
    // Don't throw error, just return empty array
    return [];
  }
  
  return data || [];
}

// Get product by ID
async function getProductById(productId) {
  console.log(`Getting product by ID: ${productId}`);
  
  const { data, error } = await supabase
    .from('price_charting_products')
    .select('*')
    .eq('product_id', productId)
    .single();
  
  if (error) {
    console.error(`Error getting product by ID:`, error);
    throw error;
  }
  
  return data;
}

// Main handler
exports.handler = async (event, context) => {
  console.log('Product search function called');
  
  try {
    // Handle OPTIONS request for CORS
    if (event.httpMethod === 'OPTIONS') {
      return {
        statusCode: 200,
        headers: {
          'Access-Control-Allow-Origin': '*',
          'Access-Control-Allow-Headers': 'Content-Type',
          'Access-Control-Allow-Methods': 'GET, POST, OPTIONS'
        },
        body: ''
      };
    }
    
    const { httpMethod, queryStringParameters, body } = event;
    
    if (httpMethod === 'GET') {
      // Search products
      const { q: query, limit = 20 } = queryStringParameters || {};
      
      if (!query) {
        return {
          statusCode: 400,
          headers: {
            'Content-Type': 'application/json',
            'Access-Control-Allow-Origin': '*'
          },
          body: JSON.stringify({
            success: false,
            error: 'Query parameter "q" is required'
          })
        };
      }
      
      const results = await searchProducts(query, parseInt(limit));
      
      return {
        statusCode: 200,
        headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*'
        },
        body: JSON.stringify({
          success: true,
          query,
          results,
          count: results.length
        })
      };
      
    } else if (httpMethod === 'POST') {
      // Get product by ID
      const { productId } = JSON.parse(body || '{}');
      
      if (!productId) {
        return {
          statusCode: 400,
          headers: {
            'Content-Type': 'application/json',
            'Access-Control-Allow-Origin': '*'
          },
          body: JSON.stringify({
            success: false,
            error: 'Product ID is required'
          })
        };
      }
      
      const product = await getProductById(productId);
      
      return {
        statusCode: 200,
        headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*'
        },
        body: JSON.stringify({
          success: true,
          product
        })
      };
      
    } else {
      return {
        statusCode: 405,
        headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*'
        },
        body: JSON.stringify({
          success: false,
          error: 'Method not allowed'
        })
      };
    }
    
  } catch (error) {
    console.error('Product search error:', error);
    
    return {
      statusCode: 500,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*'
      },
      body: JSON.stringify({
        success: false,
        error: error.message
      })
    };
  }
};
