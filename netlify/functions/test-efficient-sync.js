const { createClient } = require('@supabase/supabase-js');

// Initialize Supabase client
const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const supabase = createClient(supabaseUrl, supabaseServiceKey);

const PRICE_CHARTING_API_KEY = process.env.PRICE_CHARTING_API_KEY;

// Main handler
exports.handler = async (event, context) => {
  console.log('Test efficient sync function triggered');
  
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
    
    if (!PRICE_CHARTING_API_KEY) {
      throw new Error('Missing Price Charting API key. Please check environment variables.');
    }
    
    console.log(`API Key configured: ${!!PRICE_CHARTING_API_KEY}`);
    console.log(`API Key length: ${PRICE_CHARTING_API_KEY ? PRICE_CHARTING_API_KEY.length : 0}`);
    console.log(`Supabase URL configured: ${!!supabaseUrl}`);
    console.log(`Supabase Service Key configured: ${!!supabaseServiceKey}`);
    
    const { category = 'pokemon_cards' } = JSON.parse(event.body || '{}');
    
    // Use the correct URL format from the working csv-download-chunked function
    const csvUrls = [
      `https://www.pricecharting.com/price-guide/download-custom?t=${PRICE_CHARTING_API_KEY}&category=pokemon-cards`,
      `https://www.pricecharting.com/price-guide/download-custom?t=${PRICE_CHARTING_API_KEY}&category=pokemon_cards`,
      `https://www.pricecharting.com/price-guide/download-custom?t=${PRICE_CHARTING_API_KEY}&category=pokemon-cards&format=csv`,
      `https://www.pricecharting.com/price-guide/download-custom?t=${PRICE_CHARTING_API_KEY}&category=pokemon_cards&format=csv`
    ];
    
    console.log('Trying different CSV URL formats...');
    let csvUrl = null;
    let csvText = null;
    
    for (let i = 0; i < csvUrls.length; i++) {
      const testUrl = csvUrls[i];
      console.log(`Trying URL ${i + 1}: ${testUrl.substring(0, 50)}...`);
      
      try {
        const headers = {
          'Accept': 'text/csv',
          'User-Agent': '1Track-TestSync/1.0',
        };
        
        // For URLs without t parameter, try Authorization header
        if (!testUrl.includes('?t=')) {
          headers['Authorization'] = `Bearer ${PRICE_CHARTING_API_KEY}`;
        }
        
        const response = await fetch(testUrl, {
          method: 'GET',
          headers,
        });
        
        if (response.ok) {
          csvUrl = testUrl;
          csvText = await response.text();
          console.log(`✅ Success with URL ${i + 1}: ${response.status}`);
          break;
        } else {
          console.log(`❌ Failed with URL ${i + 1}: ${response.status} ${response.statusText}`);
        }
      } catch (error) {
        console.log(`❌ Error with URL ${i + 1}: ${error.message}`);
      }
    }
    
    if (!csvUrl || !csvText) {
      throw new Error(`All CSV URL formats failed. API key length: ${PRICE_CHARTING_API_KEY.length}`);
    }
    
    console.log(`✅ CSV downloaded successfully from: ${csvUrl.substring(0, 50)}...`);
    
    // CSV already downloaded above
    const lines = csvText.split('\n');
    const headers = lines[0].split(',').map(h => h.trim().replace(/"/g, ''));
    
    console.log(`CSV downloaded: ${lines.length} lines`);
    console.log(`Headers: ${headers.slice(0, 5).join(', ')}...`);
    
    // Test database connection
    console.log('Testing database connection...');
    const { data: testData, error: testError } = await supabase
      .from('price_charting_products')
      .select('id', { count: 'exact' })
      .limit(1);
    
    if (testError) {
      throw new Error(`Database test failed: ${testError.message}`);
    }
    
    console.log('Database connection successful');
    
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
        category,
        csvLines: lines.length,
        headers: headers.slice(0, 10),
        databaseConnected: true,
        apiKeyConfigured: !!PRICE_CHARTING_API_KEY,
        message: `Test successful: CSV has ${lines.length} lines, database connected`
      })
    };
    
  } catch (error) {
    console.error('Test efficient sync error:', error);
    
    return {
      statusCode: 500,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*'
      },
      body: JSON.stringify({
        success: false,
        error: error.message,
        stack: error.stack,
        timestamp: new Date().toISOString()
      })
    };
  }
};
