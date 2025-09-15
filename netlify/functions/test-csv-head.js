const PRICE_CHARTING_API_KEY = process.env.PRICE_CHARTING_API_KEY;

// Main handler
exports.handler = async (event, context) => {
  console.log('Test CSV HEAD function triggered');
  
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
    
    if (!PRICE_CHARTING_API_KEY) {
      throw new Error('Missing Price Charting API key');
    }
    
    console.log(`API Key configured: ${!!PRICE_CHARTING_API_KEY}`);
    console.log(`API Key length: ${PRICE_CHARTING_API_KEY.length}`);
    
    const csvUrl = `https://www.pricecharting.com/price-guide/download-custom?t=${PRICE_CHARTING_API_KEY}&category=pokemon-cards`;
    console.log(`CSV URL: ${csvUrl.substring(0, 50)}...`);
    
    // Test CSV URL accessibility with HEAD request
    console.log('Testing CSV URL accessibility...');
    
    const response = await fetch(csvUrl, {
      method: 'HEAD', // Only get headers, not content
      headers: {
        'User-Agent': '1Track-TestHead/1.0',
      },
    });
    
    console.log(`Response status: ${response.status}`);
    console.log(`Response headers:`, Object.fromEntries(response.headers.entries()));
    
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }
    
    const contentLength = response.headers.get('content-length');
    const contentType = response.headers.get('content-type');
    
    console.log(`✅ CSV URL accessible: ${response.status}`);
    console.log(`Content-Type: ${contentType}`);
    console.log(`Content-Length: ${contentLength}`);
    
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
        csvUrl: csvUrl.substring(0, 50) + '...',
        status: response.status,
        contentType,
        contentLength: contentLength ? parseInt(contentLength) : null,
        contentLengthMB: contentLength ? Math.round(parseInt(contentLength) / 1024 / 1024 * 100) / 100 : null,
        message: `CSV URL accessible: ${contentLength ? Math.round(parseInt(contentLength) / 1024 / 1024 * 100) / 100 + 'MB' : 'unknown size'}`
      })
    };
    
  } catch (error) {
    console.error('Test CSV HEAD error:', error);
    
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
