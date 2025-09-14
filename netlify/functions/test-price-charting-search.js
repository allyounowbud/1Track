const { createClient } = require('@supabase/supabase-js');

// Initialize Supabase client
const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const supabase = createClient(supabaseUrl, supabaseServiceKey);

// Price Charting API configuration
const PRICE_CHARTING_BASE_URL = "https://www.pricecharting.com";
const PRICE_CHARTING_API_KEY = process.env.PRICE_CHARTING_API_KEY;

// Test function to debug search issues
async function testProductSearch(productName) {
  console.log(`\n=== Testing search for: "${productName}" ===`);
  
  if (!PRICE_CHARTING_API_KEY) {
    throw new Error('Price Charting API key not configured');
  }
  
  console.log(`API Key length: ${PRICE_CHARTING_API_KEY.length}`);
  console.log(`API Key starts with: ${PRICE_CHARTING_API_KEY.substring(0, 8)}...`);
  
  // Test different search variations
  const searchVariations = [
    productName,
    productName.toLowerCase(),
    productName.replace(/^\d+\s*/, ''), // Remove leading numbers
    productName.replace(/\s*\d+$/, ''), // Remove trailing numbers
    productName.split(' ')[0], // Just first word
    productName.replace(/\d+/g, '').trim(), // Remove all numbers
    // Pokemon-specific variations for "151 Blooming Waters"
    'blooming waters premium collection box',
    'pokemon 151 blooming waters',
    'scarlet violet 151 blooming waters',
    'blooming waters collection box',
    'pokemon card blooming waters',
    'pokemon 151',
    'scarlet violet 151'
  ];
  
  console.log(`\nTrying ${searchVariations.length} search variations:`);
  
  for (let i = 0; i < searchVariations.length; i++) {
    const searchTerm = searchVariations[i];
    if (!searchTerm || searchTerm.length < 2) continue;
    
    console.log(`\n${i + 1}. Searching for: "${searchTerm}"`);
    
    try {
      const searchUrl = `${PRICE_CHARTING_BASE_URL}/api/products?q=${encodeURIComponent(searchTerm)}&t=${PRICE_CHARTING_API_KEY}`;
      console.log(`URL: ${searchUrl}`);
      
      const response = await fetch(searchUrl, {
        method: 'GET',
        headers: {
          'Accept': 'application/json',
          'User-Agent': '1Track-Test/1.0',
        },
      });
      
      console.log(`Response status: ${response.status} ${response.statusText}`);
      
      if (response.ok) {
        const data = await response.json();
        console.log(`Response type: ${typeof data}`);
        
        if (Array.isArray(data)) {
          console.log(`Found ${data.length} results`);
          if (data.length > 0) {
            console.log(`First result:`, {
              id: data[0].id,
              name: data[0].product_name || data[0].name,
              console: data[0].console_name || data[0].console,
            });
          }
        } else if (data.products) {
          console.log(`Found ${data.products.length} results in products array`);
          if (data.products.length > 0) {
            console.log(`First result:`, {
              id: data.products[0].id,
              name: data.products[0].product_name || data.products[0].name,
              console: data.products[0].console_name || data.products[0].console,
            });
          }
        } else {
          console.log(`Response structure:`, Object.keys(data));
        }
      } else {
        const errorText = await response.text();
        console.log(`Error response: ${errorText}`);
      }
    } catch (error) {
      console.log(`Search error: ${error.message}`);
    }
  }
  
  // Test with a known working product
  console.log(`\n=== Testing with known product (EarthBound) ===`);
  try {
    const testUrl = `${PRICE_CHARTING_BASE_URL}/api/product?id=6910&t=${PRICE_CHARTING_API_KEY}`;
    console.log(`Test URL: ${testUrl}`);
    
    const response = await fetch(testUrl, {
      method: 'GET',
      headers: {
        'Accept': 'application/json',
      },
    });
    
    console.log(`Known product response status: ${response.status}`);
    
    if (response.ok) {
      const data = await response.json();
      console.log(`Known product data:`, {
        id: data.id,
        name: data.product_name,
        console: data.console_name,
      });
    } else {
      const errorText = await response.text();
      console.log(`Known product error: ${errorText}`);
    }
  } catch (error) {
    console.log(`Known product test error: ${error.message}`);
  }
  
  // Test with the specific Blooming Waters product ID
  console.log(`\n=== Testing with Blooming Waters product (ID: 8425581) ===`);
  try {
    const bloomingUrl = `${PRICE_CHARTING_BASE_URL}/api/product?id=8425581&t=${PRICE_CHARTING_API_KEY}`;
    console.log(`Blooming Waters URL: ${bloomingUrl}`);
    
    const response = await fetch(bloomingUrl, {
      method: 'GET',
      headers: {
        'Accept': 'application/json',
      },
    });
    
    console.log(`Blooming Waters response status: ${response.status}`);
    
    if (response.ok) {
      const data = await response.json();
      console.log(`Blooming Waters product data:`, {
        id: data.id,
        name: data.product_name,
        console: data.console_name,
        price: data.loose_price,
        cib_price: data.cib_price
      });
    } else {
      const errorText = await response.text();
      console.log(`Blooming Waters error: ${errorText}`);
    }
  } catch (error) {
    console.log(`Blooming Waters test error: ${error.message}`);
  }
}

// Main handler
exports.handler = async (event, context) => {
  console.log('Test search function called');
  
  try {
    if (event.httpMethod !== 'POST') {
      return {
        statusCode: 405,
        body: JSON.stringify({ error: 'Method not allowed' })
      };
    }
    
    const { productName } = JSON.parse(event.body);
    
    if (!productName) {
      return {
        statusCode: 400,
        body: JSON.stringify({ error: 'Product name is required' })
      };
    }
    
    await testProductSearch(productName);
    
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
        message: `Test completed for: ${productName}`,
        checkLogs: 'Check Netlify function logs for detailed results'
      })
    };
    
  } catch (error) {
    console.error('Test search error:', error);
    
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
