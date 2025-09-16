const { createClient } = require('@supabase/supabase-js');

// Initialize Supabase client
const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const supabase = createClient(supabaseUrl, supabaseServiceKey);

// Helper function to calculate string similarity with improved algorithm
function calculateSimilarity(str1, str2) {
  if (!str1 || !str2) return 0;
  
  const s1 = str1.toLowerCase().trim();
  const s2 = str2.toLowerCase().trim();
  
  // Exact match
  if (s1 === s2) return 1.0;
  
  // Contains match (high score)
  if (s1.includes(s2) || s2.includes(s1)) return 0.9;
  
  // Word-based similarity
  const words1 = s1.split(/\s+/);
  const words2 = s2.split(/\s+/);
  
  let matchingWords = 0;
  for (const word1 of words1) {
    for (const word2 of words2) {
      if (word1 === word2 || word1.includes(word2) || word2.includes(word1)) {
        matchingWords++;
        break;
      }
    }
  }
  
  // If most words match, give high score
  if (matchingWords > 0) {
    const maxWords = Math.max(words1.length, words2.length);
    const wordSimilarity = matchingWords / maxWords;
    if (wordSimilarity >= 0.5) return wordSimilarity;
  }
  
  // Fall back to Levenshtein distance
  const longer = s1.length > s2.length ? s1 : s2;
  const shorter = s1.length > s2.length ? s2 : s1;
  
  if (longer.length === 0) return 1.0;
  
  const distance = levenshteinDistance(longer, shorter);
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
  
  // Try different search strategies with improved algorithms
  const searchStrategies = [
    // Strategy 1: Exact match (case insensitive)
    () => searchWithStrategy(cleanQuery, 'exact'),
    // Strategy 2: Contains match in product name
    () => searchWithStrategy(cleanQuery, 'contains'),
    // Strategy 3: Contains match in console_name (set name)
    () => searchWithConsoleStrategy(cleanQuery, 'contains'),
    // Strategy 4: Combined search (product_name OR console_name)
    () => searchWithCombinedStrategy(cleanQuery),
    // Strategy 5: First word only (for Pokemon cards like "151 Blooming Waters")
    () => searchWithStrategy(cleanQuery.split(' ')[0], 'contains'),
    // Strategy 6: First word in console name
    () => searchWithConsoleStrategy(cleanQuery.split(' ')[0], 'contains'),
    // Strategy 7: Without numbers (for "151 Blooming Waters" -> "blooming waters")
    () => {
      const withoutNumbers = cleanQuery.replace(/\d+/g, '').trim();
      if (withoutNumbers.length > 2) {
        return searchWithStrategy(withoutNumbers, 'contains');
      }
      return Promise.resolve([]);
    },
    // Strategy 8: Individual words
    () => {
      const words = cleanQuery.split(' ').filter(word => word.length > 2);
      return Promise.all(words.map(word => searchWithStrategy(word, 'contains')))
        .then(results => results.flat());
    },
    // Strategy 9: Full-text search
    () => searchWithFullText(cleanQuery)
  ];
  
  const allResults = [];
  
  for (let i = 0; i < searchStrategies.length; i++) {
    try {
      console.log(`Trying search strategy ${i + 1} for: "${query}"`);
      const results = await searchStrategies[i]();
      
      if (results && results.length > 0) {
        console.log(`Strategy ${i + 1} successful: found ${results.length} results`);
        
        // Calculate similarity scores against both product_name and console_name
        const scoredResults = results.map(result => {
          const productSimilarity = calculateSimilarity(query, result.product_name || '');
          const consoleSimilarity = calculateSimilarity(query, result.console_name || '');
          const maxSimilarity = Math.max(productSimilarity, consoleSimilarity);
          
          return {
            ...result,
            similarity_score: maxSimilarity,
            match_type: productSimilarity > consoleSimilarity ? 'product_name' : 'console_name'
          };
        }).filter(result => result.similarity_score >= 0.2); // Lower threshold for better results
        
        if (scoredResults.length > 0) {
          allResults.push(...scoredResults);
        }
      }
    } catch (error) {
      console.log(`Strategy ${i + 1} failed:`, error.message);
    }
  }
  
  // Remove duplicates and sort by similarity
  const uniqueResults = allResults.filter((result, index, self) => 
    index === self.findIndex(r => r.product_id === result.product_id)
  );
  
  return uniqueResults
    .sort((a, b) => {
      // Prioritize exact matches first, then by similarity score
      if (a.similarity_score === 1.0 && b.similarity_score !== 1.0) return -1;
      if (b.similarity_score === 1.0 && a.similarity_score !== 1.0) return 1;
      return b.similarity_score - a.similarity_score;
    })
    .slice(0, 100); // Increased limit to show more results like Price Charting
}

// Search with specific strategy
async function searchWithStrategy(searchTerm, strategy) {
  let query = supabase
    .from('price_charting_products')
    .select('*')
    .limit(50); // Increased limit for more comprehensive results
  
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

// Search console_name (set names) with specific strategy
async function searchWithConsoleStrategy(searchTerm, strategy) {
  let query = supabase
    .from('price_charting_products')
    .select('*')
    .not('console_name', 'is', null) // Only search products that have console_name
    .limit(50);
  
  switch (strategy) {
    case 'exact':
      query = query.ilike('console_name', searchTerm);
      break;
    case 'contains':
      query = query.ilike('console_name', `%${searchTerm}%`);
      break;
  }
  
  const { data, error } = await query;
  
  if (error) {
    console.error(`Console search error for "${searchTerm}":`, error);
    throw error;
  }
  
  return data || [];
}

// Combined search (product_name OR console_name)
async function searchWithCombinedStrategy(searchTerm) {
  const { data, error } = await supabase
    .from('price_charting_products')
    .select('*')
    .or(`product_name.ilike.%${searchTerm}%,console_name.ilike.%${searchTerm}%`)
    .limit(50);
  
  if (error) {
    console.error(`Combined search error for "${searchTerm}":`, error);
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
