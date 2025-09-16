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
  
  // Word-based similarity with emphasis on ALL words matching
  const words1 = s1.split(/\s+/);
  const words2 = s2.split(/\s+/);
  
  let matchingWords = 0;
  let totalWords = Math.max(words1.length, words2.length);
  
  for (const word1 of words1) {
    for (const word2 of words2) {
      if (word1 === word2 || word1.includes(word2) || word2.includes(word1)) {
        matchingWords++;
        break;
      }
    }
  }
  
  // Calculate word coverage (how many search words are found)
  let searchWordsFound = 0;
  for (const searchWord of words1) {
    if (s2.includes(searchWord)) {
      searchWordsFound++;
    }
  }
  
  // Boost score significantly if ALL search words are found
  if (searchWordsFound === words1.length && words1.length > 1) {
    return 0.95; // Very high score for complete word coverage
  }
  
  // If most words match, give good score
  if (matchingWords > 0) {
    const wordSimilarity = matchingWords / totalWords;
    return wordSimilarity;
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

// Check if a product is sealed (not an individual card)
function isSealedProduct(productName) {
  if (!productName) return false;
  
  // Single cards always have # in their name (e.g., "Pikachu #25", "Charizard #150")
  // If it has #, it's definitely a single card, not sealed
  if (productName.includes('#')) {
    return false;
  }
  
  const sealedKeywords = [
    'booster', 'bundle', 'box', 'collection', 'pack', 'tin', 'case', 'display',
    'booster box', 'booster bundle', 'booster pack', 'theme deck', 'starter deck',
    'elite trainer box', 'etb', 'premium collection', 'v box', 'vmax box',
    'mini tin', 'pin collection', 'build & battle box', 'champions path',
    'hidden fates', 'shining fates', 'celebrations', 'pokemon go', 'go'
  ];
  
  const name = productName.toLowerCase();
  return sealedKeywords.some(keyword => name.includes(keyword));
}

// Search products with multiple strategies
async function searchProducts(query, category = 'pokemon_cards') {
  console.log(`Searching products for: "${query}" in category: ${category}`);
  
  if (!query || query.trim().length < 2) {
    return [];
  }
  
  const cleanQuery = query.trim().toLowerCase();
  
  // Check if user is searching for sealed products specifically
  const isSealedSearch = cleanQuery.includes('sealed');
  
  // Try different search strategies with improved algorithms and weighting
  const searchStrategies = [
    // Strategy 1: Exact match (case insensitive) - HIGHEST PRIORITY
    () => searchWithStrategy(cleanQuery, 'exact').then(results => 
      results.map(r => ({ ...r, strategy_priority: 10 }))
    ),
    // Strategy 2: Exact match in console_name (set name) - HIGH PRIORITY
    () => searchWithConsoleStrategy(cleanQuery, 'exact').then(results => 
      results.map(r => ({ ...r, strategy_priority: 9 }))
    ),
    // Strategy 3: Combined exact search (product_name OR console_name) - HIGH PRIORITY
    () => searchWithCombinedStrategy(cleanQuery).then(results => 
      results.map(r => ({ ...r, strategy_priority: 8 }))
    ),
    // Strategy 4: Contains match in product name - MEDIUM PRIORITY
    () => searchWithStrategy(cleanQuery, 'contains').then(results => 
      results.map(r => ({ ...r, strategy_priority: 7 }))
    ),
    // Strategy 5: Contains match in console_name (set name) - MEDIUM PRIORITY
    () => searchWithConsoleStrategy(cleanQuery, 'contains').then(results => 
      results.map(r => ({ ...r, strategy_priority: 6 }))
    ),
    // Strategy 6: Word-based matching for all words - MEDIUM PRIORITY
    () => {
      const words = cleanQuery.split(' ').filter(word => word.length > 2);
      if (words.length === 0) return Promise.resolve([]);
      return Promise.all(words.map(word => searchWithStrategy(word, 'contains')))
        .then(results => results.flat().map(r => ({ ...r, strategy_priority: 5 })));
    },
    // Strategy 7: First word only - LOWER PRIORITY
    () => searchWithStrategy(cleanQuery.split(' ')[0], 'contains').then(results => 
      results.map(r => ({ ...r, strategy_priority: 4 }))
    ),
    // Strategy 8: First word in console name - LOWER PRIORITY
    () => searchWithConsoleStrategy(cleanQuery.split(' ')[0], 'contains').then(results => 
      results.map(r => ({ ...r, strategy_priority: 3 }))
    ),
    // Strategy 9: Without numbers - LOWER PRIORITY
    () => {
      const withoutNumbers = cleanQuery.replace(/\d+/g, '').trim();
      if (withoutNumbers.length > 2) {
        return searchWithStrategy(withoutNumbers, 'contains').then(results => 
          results.map(r => ({ ...r, strategy_priority: 2 }))
        );
      }
      return Promise.resolve([]);
    },
    // Strategy 10: Full-text search - LOWEST PRIORITY
    () => searchWithFullText(cleanQuery).then(results => 
      results.map(r => ({ ...r, strategy_priority: 1 }))
    )
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
          
          // Combine product name and set name for comprehensive matching
          const combinedText = `${result.product_name || ''} ${result.console_name || ''}`.trim();
          const combinedSimilarity = calculateSimilarity(query, combinedText);
          
          // Use the best similarity score (individual or combined)
          const maxSimilarity = Math.max(productSimilarity, consoleSimilarity, combinedSimilarity);
          
          // Boost score based on strategy priority (exact matches get higher scores)
          const priorityBoost = (result.strategy_priority || 0) * 0.1;
          const finalScore = Math.min(1.0, maxSimilarity + priorityBoost);
          
          // Determine match type
          let matchType = 'product_name';
          if (consoleSimilarity > productSimilarity) {
            matchType = 'console_name';
          } else if (combinedSimilarity > Math.max(productSimilarity, consoleSimilarity)) {
            matchType = 'combined';
          }
          
          return {
            ...result,
            similarity_score: finalScore,
            match_type: matchType
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
  let uniqueResults = allResults.filter((result, index, self) => 
    index === self.findIndex(r => r.product_id === result.product_id)
  );
  
  // Filter for sealed products only if "sealed" was in the search query
  if (isSealedSearch) {
    uniqueResults = uniqueResults.filter(result => isSealedProduct(result.product_name));
    console.log(`Filtered for sealed products only: ${uniqueResults.length} results`);
  }
  
  return uniqueResults
    .sort((a, b) => {
      // First sort by strategy priority (higher is better)
      const priorityDiff = (b.strategy_priority || 0) - (a.strategy_priority || 0);
      if (priorityDiff !== 0) return priorityDiff;
      
      // Then sort by similarity score (higher is better)
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
