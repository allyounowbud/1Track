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
  console.log('Debug chunk errors function triggered');
  
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
    
    const { chunkIndex = 28, chunkSize = 500 } = JSON.parse(event.body || '{}');
    
    console.log(`Debugging chunk ${chunkIndex}...`);
    
    const csvUrl = `https://www.pricecharting.com/price-guide/download-custom?t=${PRICE_CHARTING_API_KEY}&category=pokemon-cards`;
    
    const response = await fetch(csvUrl, {
      method: 'GET',
      headers: {
        'Accept': 'text/csv',
        'User-Agent': '1Track-DebugChunk/1.0',
      },
    });
    
    if (!response.ok) {
      throw new Error(`Failed to download CSV: ${response.status}`);
    }
    
    const csvText = await response.text();
    const lines = csvText.split('\n');
    const headers = parseCSVLine(lines[0]);
    
    const startLine = (chunkIndex * chunkSize) + 1; // +1 to skip header
    const endLine = Math.min(startLine + chunkSize, lines.length);
    
    console.log(`Analyzing chunk ${chunkIndex}: lines ${startLine} to ${endLine - 1}`);
    
    const batchProducts = [];
    const errors = [];
    
    for (let i = startLine; i < endLine; i++) {
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
              upc_code: product.upc || null,
              raw_data: product,
              downloaded_at: new Date().toISOString()
            };
            
            batchProducts.push(productData);
          } else {
            errors.push(`Line ${i}: Missing product name or ID`);
          }
        } else {
          errors.push(`Line ${i}: Expected ${headers.length} fields, got ${values.length}`);
        }
      } catch (lineError) {
        errors.push(`Line ${i}: ${lineError.message}`);
      }
    }
    
    // Try to insert a few products to see what happens
    const testProducts = batchProducts.slice(0, 3);
    let insertError = null;
    
    if (testProducts.length > 0) {
      try {
        const { error } = await supabase
          .from('price_charting_products')
          .insert(testProducts);
        
        if (error) {
          insertError = error;
        }
      } catch (e) {
        insertError = e;
      }
    }
    
    console.log(`Chunk ${chunkIndex} analysis completed:`);
    console.log(`- Valid products: ${batchProducts.length}`);
    console.log(`- Parse errors: ${errors.length}`);
    console.log(`- Insert error: ${insertError ? insertError.message : 'None'}`);
    
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
        chunkIndex,
        validProducts: batchProducts.length,
        parseErrors: errors.slice(0, 10), // First 10 errors
        insertError: insertError ? {
          message: insertError.message,
          details: insertError.details,
          hint: insertError.hint,
          code: insertError.code
        } : null,
        sampleProduct: batchProducts[0] || null,
        message: `Chunk ${chunkIndex} analysis: ${batchProducts.length} valid products, ${errors.length} parse errors`
      })
    };
    
  } catch (error) {
    console.error('Debug chunk errors error:', error);
    
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
