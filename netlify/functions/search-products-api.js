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

// Search products with multiple strategies
async function searchProducts(query, category = 'pokemon_cards') {
  console.log(`Searching products for: "${query}" in category: ${category}`);
  
  if (!query || query.trim().length < 2) {
    return [];
  }
  
  const cleanQuery = query.trim().toLowerCase();
  
  // Try different search strategies
  const searchStrategies = [
    // Strategy 1: Contains match (most likely to find results)
    () => searchWithStrategy(cleanQuery, 'contains'),
    // Strategy 2: First word only (for Pokemon cards like "151 Blooming Waters")
    () => searchWithStrategy(cleanQuery.split(' ')[0], 'contains'),
    // Strategy 3: Without numbers (for "151 Blooming Waters" -> "blooming waters")
    () => searchWithStrategy(cleanQuery.replace(/\d+/g, '').trim(), 'contains'),
    // Strategy 4: Individual words
    () => {
      const words = cleanQuery.split(' ').filter(word => word.length > 2);
      return Promise.all(words.map(word => searchWithStrategy(word, 'contains')))
        .then(results => results.flat());
    }
  ];
  
  for (let i = 0; i < searchStrategies.length; i++) {
    try {
      console.log(`Trying search strategy ${i + 1} for: "${query}"`);
      const results = await searchStrategies[i]();
      
      if (results && results.length > 0) {
        console.log(`Strategy ${i + 1} successful: found ${results.length} results`);
        
        // Calculate similarity scores and filter
        const scoredResults = results.map(result => ({
          ...result,
          similarity_score: calculateSimilarity(query, result.product_name)
        })).filter(result => result.similarity_score >= 0.3); // Lower threshold for search
        
        if (scoredResults.length > 0) {
          // Remove duplicates and sort by similarity
          const uniqueResults = scoredResults.filter((result, index, self) => 
            index === self.findIndex(r => r.product_id === result.product_id)
          );
          
          return uniqueResults
            .sort((a, b) => b.similarity_score - a.similarity_score)
            .slice(0, 20); // Limit to top 20 results
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
    .limit(15); // Reduced limit for faster queries
  
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

// Main handler
exports.handler = async (event, context) => {
  console.log('Product search API called');
  
  try {
    // Handle CORS preflight
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
    
    if (event.httpMethod !== 'GET' && event.httpMethod !== 'POST') {
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
    
    let query, category;
    
    if (event.httpMethod === 'GET') {
      // Parse query parameters
      const params = new URLSearchParams(event.queryStringParameters || {});
      query = params.get('q');
      category = params.get('category') || 'pokemon_cards';
    } else {
      // Parse POST body
      const body = JSON.parse(event.body || '{}');
      query = body.query;
      category = body.category || 'pokemon_cards';
    }
    
    if (!query) {
      return {
        statusCode: 400,
        headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*'
        },
        body: JSON.stringify({ error: 'Query parameter is required' })
      };
    }
    
    console.log(`Searching for: "${query}" in category: ${category}`);
    
    const results = await searchProducts(query, category);
    
    console.log(`Found ${results.length} products`);
    
    return {
      statusCode: 200,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Headers': 'Content-Type',
        'Access-Control-Allow-Methods': 'GET, POST, OPTIONS'
      },
      body: JSON.stringify({
        success: true,
        query,
        category,
        results,
        count: results.length
      })
    };
    
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
        error: error.message,
        timestamp: new Date().toISOString()
      })
    };
  }
};
