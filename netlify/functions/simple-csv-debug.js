exports.handler = async (event, context) => {
  console.log('Simple CSV debug function triggered');
  
  try {
    const csvUrl = 'https://www.pricecharting.com/price-guide/download-custom?t=c48c819005ad6b004f469e4e2d9329b3368ca30d&category=pokemon-cards';
    
    const response = await fetch(csvUrl, {
      method: 'GET',
      headers: {
        'Accept': 'text/csv',
        'User-Agent': '1Track-SimpleDebug/1.0',
      },
    });
    
    if (!response.ok) {
      throw new Error(`Failed to download CSV: ${response.status}`);
    }
    
    const csvText = await response.text();
    const lines = csvText.split('\n');
    
    // Get first 5 lines to see structure
    const firstFiveLines = lines.slice(0, 5);
    
    // Parse the header to see field names
    const headers = firstFiveLines[0].split(',').map(h => h.trim().replace(/"/g, ''));
    
    // Parse first data row to see values
    let sampleData = null;
    if (firstFiveLines.length > 1) {
      const values = firstFiveLines[1].split(',').map(v => v.trim().replace(/"/g, ''));
      sampleData = {};
      headers.forEach((header, index) => {
        sampleData[header] = values[index];
      });
    }
    
    return {
      statusCode: 200,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*'
      },
      body: JSON.stringify({
        success: true,
        totalLines: lines.length,
        headers: headers,
        sampleData: sampleData,
        firstFiveLines: firstFiveLines,
        message: `CSV has ${lines.length} lines with ${headers.length} columns: ${headers.join(', ')}`
      })
    };
    
  } catch (error) {
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
