const { createClient } = require('@supabase/supabase-js');

// Initialize Supabase client
const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
  throw new Error('Missing Supabase configuration. Please check environment variables.');
}

const supabase = createClient(supabaseUrl, supabaseServiceKey);

// CSV download URLs for different categories
const CSV_URLS = {
  'pokemon_cards': 'https://www.pricecharting.com/price-guide/download-custom?t=c48c819005ad6b004f469e4e2d9329b3368ca30d&category=pokemon-cards'
};

// Helper function to parse a single CSV line (handles quoted values with commas)
function parseCSVLine(line) {
  const values = [];
  let current = '';
  let inQuotes = false;
  
  for (let i = 0; i < line.length; i++) {
    const char = line[i];
    
    if (char === '"') {
      inQuotes = !inQuotes;
    } else if (char === ',' && !inQuotes) {
      values.push(current.trim());
      current = '';
    } else {
      current += char;
    }
  }
  
  values.push(current.trim());
  return values.map(v => v.replace(/"/g, ''));
}

exports.handler = async (event, context) => {
  console.log(`[${new Date().toISOString()}] Debug CSV structure function triggered`);
  
  try {
    const csvUrl = CSV_URLS['pokemon_cards'];
    console.log(`Downloading from: ${csvUrl}`);
    
    const response = await fetch(csvUrl, {
      method: 'GET',
      headers: {
        'Accept': 'text/csv',
        'User-Agent': '1Track-Debug/1.0',
      },
    });
    
    if (!response.ok) {
      throw new Error(`Failed to download CSV: ${response.status} ${response.statusText}`);
    }
    
    const csvText = await response.text();
    console.log(`Downloaded CSV with ${csvText.length} characters`);
    
    // Parse just the first few lines to see structure
    const lines = csvText.split('\n');
    const headers = lines[0].split(',').map(h => h.trim().replace(/"/g, ''));
    
    console.log(`CSV Headers (${headers.length}):`, headers);
    
    // Show first 3 data rows
    const sampleData = [];
    for (let i = 1; i <= Math.min(3, lines.length - 1); i++) {
      if (lines[i].trim()) {
        const values = parseCSVLine(lines[i]);
        const product = {};
        headers.forEach((header, index) => {
          product[header] = values[index];
        });
        sampleData.push(product);
      }
    }
    
    console.log('Sample products:', sampleData);
    
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
        message: `CSV has ${lines.length} lines with headers: ${headers.join(', ')}`
      })
    };
    
  } catch (error) {
    console.error(`[${new Date().toISOString()}] Debug CSV error:`, error);
    
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
