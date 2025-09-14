const { createClient } = require('@supabase/supabase-js');

// Initialize Supabase client
const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const supabase = createClient(supabaseUrl, supabaseServiceKey);

// Price Charting API configuration
const PRICE_CHARTING_BASE_URL = "https://www.pricecharting.com";
const PRICE_CHARTING_API_KEY = process.env.PRICE_CHARTING_API_KEY;

// Fuzzy search configuration
const FUZZY_THRESHOLD = 0.6; // Minimum similarity score for matches
const MAX_SEARCH_VARIATIONS = 5; // Maximum number of search variations to try

// Helper function to calculate string similarity (Levenshtein distance)
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

// Helper function to generate search variations
function generateSearchVariations(productName) {
  const variations = [];
  
  // Original name
  variations.push(productName);
  
  // Remove common words that might not be in API
  const commonWords = ['the', 'a', 'an', 'and', 'or', 'but', 'in', 'on', 'at', 'to', 'for', 'of', 'with', 'by'];
  const words = productName.toLowerCase().split(/\s+/);
  const filteredWords = words.filter(word => !commonWords.includes(word) && word.length > 2);
  
  if (filteredWords.length > 0) {
    variations.push(filteredWords.join(' '));
  }
  
  // Try with first 2-3 words only
  if (words.length > 2) {
    variations.push(words.slice(0, 2).join(' '));
  }
  if (words.length > 3) {
    variations.push(words.slice(0, 3).join(' '));
  }
  
  // Try without numbers (for version numbers, years, etc.)
  const withoutNumbers = productName.replace(/\d+/g, '').replace(/\s+/g, ' ').trim();
  if (withoutNumbers !== productName && withoutNumbers.length > 3) {
    variations.push(withoutNumbers);
  }
  
  // Try with common gaming terms
  const gamingTerms = ['game', 'video game', 'trading card', 'card', 'pokemon', 'nintendo', 'playstation', 'xbox'];
  for (const term of gamingTerms) {
    if (productName.toLowerCase().includes(term)) {
      const withTerm = `${term} ${productName.replace(new RegExp(term, 'gi'), '').trim()}`;
      if (withTerm.length > 3) {
        variations.push(withTerm);
      }
    }
  }
  
  // Remove duplicates and limit
  return [...new Set(variations)].slice(0, MAX_SEARCH_VARIATIONS);
}

// Search Price Charting API with multiple strategies
async function searchPriceChartingWithFuzzy(productName, category = null, consoleName = null) {
  console.log(`Starting fuzzy search for: "${productName}"`);
  
  if (!PRICE_CHARTING_API_KEY) {
    throw new Error('Price Charting API key not configured');
  }
  
  // Test API key first
  const apiKeyWorks = await testApiKey();
  if (!apiKeyWorks) {
    throw new Error('API key test failed. Please verify your Price Charting API key is correct.');
  }
  
  // Generate search variations
  const searchVariations = generateSearchVariations(productName);
  console.log(`Generated ${searchVariations.length} search variations:`, searchVariations);
  
  const results = [];
  
  // Try each search variation
  for (const searchTerm of searchVariations) {
    try {
      console.log(`Searching with term: "${searchTerm}"`);
      
      // Try different endpoints and parameters
      const searchResults = await tryMultipleSearchMethods(searchTerm, category, consoleName);
      
      if (searchResults && searchResults.length > 0) {
        console.log(`Found ${searchResults.length} results for "${searchTerm}"`);
        
        // Calculate similarity scores and add to results
        for (const result of searchResults) {
          const similarity = calculateSimilarity(productName, result.product_name || result.name || '');
          result.similarity_score = similarity;
          result.search_term_used = searchTerm;
          
          if (similarity >= FUZZY_THRESHOLD) {
            results.push(result);
          }
        }
      }
    } catch (error) {
      console.log(`Search failed for "${searchTerm}":`, error.message);
      // Continue with next variation
    }
  }
  
  // Sort by similarity score and remove duplicates
  const uniqueResults = removeDuplicateResults(results);
  const sortedResults = uniqueResults.sort((a, b) => b.similarity_score - a.similarity_score);
  
  console.log(`Fuzzy search completed. Found ${sortedResults.length} potential matches above threshold ${FUZZY_THRESHOLD}`);
  
  return sortedResults;
}

// Try multiple search methods for a given term
async function tryMultipleSearchMethods(searchTerm, category, consoleName) {
  const results = [];
  
  // Method 1: Try /api/products endpoint
  try {
    const productsResults = await searchProductsEndpoint(searchTerm);
    if (productsResults && productsResults.length > 0) {
      results.push(...productsResults);
    }
  } catch (error) {
    console.log(`Products endpoint failed: ${error.message}`);
  }
  
  // Method 2: Try /api/product endpoint with different strategies
  try {
    const productResults = await searchProductEndpoint(searchTerm, category, consoleName);
    if (productResults && productResults.length > 0) {
      results.push(...productResults);
    }
  } catch (error) {
    console.log(`Product endpoint failed: ${error.message}`);
  }
  
  return results;
}

// Search using /api/products endpoint
async function searchProductsEndpoint(searchTerm) {
  const searchUrl = `${PRICE_CHARTING_BASE_URL}/api/products?q=${encodeURIComponent(searchTerm)}&t=${PRICE_CHARTING_API_KEY}`;
  
  try {
    const response = await fetch(searchUrl, {
      method: 'GET',
      headers: {
        'Accept': 'application/json',
        'User-Agent': '1Track/1.0',
      },
    });
    
    if (response.ok) {
      const data = await response.json();
      console.log(`Products endpoint success for "${searchTerm}":`, data);
      return Array.isArray(data) ? data : (data.products || []);
    } else {
      console.log(`Products endpoint returned ${response.status} for "${searchTerm}"`);
      return [];
    }
  } catch (error) {
    console.log(`Products endpoint error for "${searchTerm}":`, error.message);
    return [];
  }
}

// Search using /api/product endpoint (this might need different approach)
async function searchProductEndpoint(searchTerm, category, consoleName) {
  // This endpoint typically requires specific product IDs
  // We might need to implement a different strategy here
  // For now, return empty array as this endpoint is for specific products
  return [];
}

// Test API key with known product
async function testApiKey() {
  const testUrl = `${PRICE_CHARTING_BASE_URL}/api/product?id=6910&t=${PRICE_CHARTING_API_KEY}`;
  
  try {
    const response = await fetch(testUrl, {
      method: 'GET',
      headers: { 'Accept': 'application/json' },
    });
    
    return response.ok;
  } catch (error) {
    console.error('API key test error:', error);
    return false;
  }
}

// Remove duplicate results based on product ID or name
function removeDuplicateResults(results) {
  const seen = new Set();
  return results.filter(result => {
    const key = result.id || result.product_id || result.name || result.product_name;
    if (seen.has(key)) {
      return false;
    }
    seen.add(key);
    return true;
  });
}

// Main handler function
exports.handler = async (event, context) => {
  console.log('Fuzzy search function called');
  
  try {
    if (event.httpMethod !== 'POST') {
      return {
        statusCode: 405,
        body: JSON.stringify({ error: 'Method not allowed' })
      };
    }
    
    const { productName, category, consoleName } = JSON.parse(event.body);
    
    if (!productName) {
      return {
        statusCode: 400,
        body: JSON.stringify({ error: 'Product name is required' })
      };
    }
    
    console.log(`Fuzzy searching for: "${productName}"`);
    
    const results = await searchPriceChartingWithFuzzy(productName, category, consoleName);
    
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
        searchTerm: productName,
        totalResults: results.length,
        threshold: FUZZY_THRESHOLD
      })
    };
    
  } catch (error) {
    console.error('Fuzzy search error:', error);
    
    return {
      statusCode: 500,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*'
      },
      body: JSON.stringify({
        success: false,
        error: error.message,
        details: error.stack
      })
    };
  }
};
