const { createClient } = require('@supabase/supabase-js');

// Initialize Supabase client
const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const supabase = createClient(supabaseUrl, supabaseServiceKey);

const PRICE_CHARTING_API_KEY = process.env.PRICE_CHARTING_API_KEY;

// Helper function to parse CSV lines
function parseCSVLine(line) {
  const result = [];
  let current = '';
  let inQuotes = false;
  
  for (let i = 0; i < line.length; i++) {
    const char = line[i];
    
    if (char === '"') {
      inQuotes = !inQuotes;
    } else if (char === ',' && !inQuotes) {
      result.push(current.trim());
      current = '';
    } else {
      current += char;
    }
  }
  
  result.push(current.trim());
  return result;
}

// Helper function to parse price strings
function parsePrice(priceStr) {
  if (!priceStr || priceStr === '' || priceStr === 'null') return null;
  
  // Remove $ and convert to number
  const cleaned = priceStr.replace(/[$,]/g, '');
  const parsed = parseFloat(cleaned);
  
  return isNaN(parsed) ? null : parsed;
}

// Main handler
exports.handler = async (event, context) => {
  console.log('Minimal CSV test function triggered');
  
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
    
    const csvUrl = `https://www.pricecharting.com/price-guide/download-custom?t=${PRICE_CHARTING_API_KEY}&category=pokemon-cards`;
    
    console.log(`Downloading CSV for minimal test...`);
    const response = await fetch(csvUrl, {
      method: 'GET',
      headers: {
        'Accept': 'text/csv',
        'User-Agent': '1Track-MinimalTest/1.0',
      },
    });
    
    if (!response.ok) {
      throw new Error(`Failed to download CSV: ${response.status}`);
    }
    
    const csvText = await response.text();
    const lines = csvText.split('\n');
    const headers = parseCSVLine(lines[0]);
    
    console.log(`CSV downloaded: ${lines.length} lines`);
    console.log(`Headers: ${headers.join(', ')}`);
    
    // Process only the first 10 products to test
    const testProducts = [];
    for (let i = 1; i <= Math.min(10, lines.length - 1); i++) {
      const line = lines[i];
      if (!line.trim()) continue;
      
      try {
        const values = parseCSVLine(line);
        if (values.length === headers.length) {
          const product = {};
          headers.forEach((header, index) => {
            product[header] = values[index];
          });
          
          // Validate required fields
          const productName = product['product-name'] || '';
          const productId = product.id || '';
          
          if (productName.trim() && productId.trim()) {
            const productData = {
              category: 'pokemon_cards',
              product_id: productId,
              product_name: productName,
              console_name: product['console-name'] || null,
              loose_price: parsePrice(product['loose-price']),
              cib_price: parsePrice(product['cib-price']),
              new_price: parsePrice(product['new-price']),
              graded_price: parsePrice(product['graded-price']),
              box_price: parsePrice(product['box-only-price']),
              manual_price: parsePrice(product['manual-only-price']),
              raw_data: product,
              downloaded_at: new Date().toISOString()
            };
            
            testProducts.push(productData);
          }
        }
      } catch (lineError) {
        console.error(`Error processing line ${i}:`, lineError);
      }
    }
    
    // Insert test products into database
    if (testProducts.length > 0) {
      const { error: insertError } = await supabase
        .from('price_charting_products')
        .insert(testProducts);
      
      if (insertError) {
        console.error('Database insert error:', insertError);
        throw new Error(`Database insert failed: ${insertError.message}`);
      }
    }
    
    console.log(`Minimal test completed: processed ${testProducts.length} products`);
    
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
        processed: testProducts.length,
        totalLines: lines.length,
        message: `Successfully processed ${testProducts.length} test products`
      })
    };
    
  } catch (error) {
    console.error('Minimal CSV test error:', error);
    
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
