// Main handler
exports.handler = async (event, context) => {
  console.log('Simple test function triggered');
  
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
    
    console.log('Simple test function executing...');
    
    // Test environment variables
    const supabaseUrl = process.env.VITE_SUPABASE_URL;
    const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
    const priceChartingApiKey = process.env.PRICE_CHARTING_API_KEY;
    
    console.log(`Supabase URL configured: ${!!supabaseUrl}`);
    console.log(`Supabase Service Key configured: ${!!supabaseServiceKey}`);
    console.log(`Price Charting API Key configured: ${!!priceChartingApiKey}`);
    console.log(`API Key length: ${priceChartingApiKey ? priceChartingApiKey.length : 0}`);
    
    // Test basic fetch
    console.log('Testing basic fetch...');
    const testUrl = 'https://httpbin.org/get';
    const response = await fetch(testUrl, {
      method: 'GET',
      headers: {
        'User-Agent': '1Track-SimpleTest/1.0',
      },
    });
    
    console.log(`Test fetch response: ${response.status}`);
    
    if (!response.ok) {
      throw new Error(`Test fetch failed: ${response.status}`);
    }
    
    const testData = await response.json();
    console.log('Test fetch successful');
    
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
        message: 'Simple test successful',
        environment: {
          supabaseUrl: !!supabaseUrl,
          supabaseServiceKey: !!supabaseServiceKey,
          priceChartingApiKey: !!priceChartingApiKey,
          apiKeyLength: priceChartingApiKey ? priceChartingApiKey.length : 0
        },
        testFetch: {
          status: response.status,
          url: testUrl
        },
        timestamp: new Date().toISOString()
      })
    };
    
  } catch (error) {
    console.error('Simple test error:', error);
    
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
