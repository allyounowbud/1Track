const PRICE_CHARTING_API_KEY = process.env.PRICE_CHARTING_API_KEY;

// Main handler
exports.handler = async (event, context) => {
  console.log('Test CSV download function triggered');
  
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
    
    // Test CSV download with timeout
    console.log('Testing CSV download...');
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 10000); // 10 second timeout
    
    try {
      const response = await fetch(csvUrl, {
        method: 'GET',
        headers: {
          'Accept': 'text/csv',
          'User-Agent': '1Track-TestDownload/1.0',
        },
        signal: controller.signal
      });
      
      clearTimeout(timeoutId);
      
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }
      
      // Just get the first few lines to test
      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let csvText = '';
      let lineCount = 0;
      
      while (lineCount < 10) { // Only read first 10 lines
        const { done, value } = await reader.read();
        if (done) break;
        
        csvText += decoder.decode(value, { stream: true });
        lineCount = csvText.split('\n').length;
      }
      
      reader.cancel(); // Stop reading
      
      const lines = csvText.split('\n');
      const headers = lines[0] ? lines[0].split(',').map(h => h.trim().replace(/"/g, '')) : [];
      
      console.log(`✅ CSV download successful: ${lines.length} lines read`);
      console.log(`Headers: ${headers.slice(0, 5).join(', ')}...`);
      
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
          linesRead: lines.length,
          headers: headers.slice(0, 10),
          sampleData: lines.slice(1, 3), // First 2 data rows
          message: `CSV download successful: ${lines.length} lines read`
        })
      };
      
    } catch (fetchError) {
      clearTimeout(timeoutId);
      if (fetchError.name === 'AbortError') {
        throw new Error('CSV download timed out after 10 seconds');
      }
      throw fetchError;
    }
    
  } catch (error) {
    console.error('Test CSV download error:', error);
    
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
