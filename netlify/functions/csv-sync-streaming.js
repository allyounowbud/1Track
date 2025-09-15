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
  console.log('Streaming CSV sync function triggered');
  
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
    
    const { category = 'pokemon_cards', clearExisting = false, startLine = 1, maxLines = 1000 } = JSON.parse(event.body || '{}');
    
    console.log(`Starting streaming sync for ${category} from line ${startLine}, max ${maxLines} lines`);
    
    const csvUrl = `https://www.pricecharting.com/price-guide/download-custom?t=${PRICE_CHARTING_API_KEY}&category=${category}`;
    
    // Download CSV
    console.log(`Downloading CSV for ${category}...`);
    const response = await fetch(csvUrl, {
      method: 'GET',
      headers: {
        'Accept': 'text/csv',
        'User-Agent': '1Track-StreamingSync/1.0',
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
    
    // Clear existing data if requested and this is the first batch
    if (clearExisting && startLine === 1) {
      console.log(`Clearing existing data for ${category}...`);
      const { error: deleteError } = await supabase
        .from('price_charting_products')
        .delete()
        .eq('category', category);
        
      if (deleteError) {
        console.error('Error clearing existing data:', deleteError);
      } else {
        console.log(`Cleared existing data for ${category}`);
      }
    }
    
    // Process only the requested range of lines
    const endLine = Math.min(startLine + maxLines, lines.length);
    const batchSize = 100; // Smaller batches for faster processing
    let processedCount = 0;
    let skippedCount = 0;
    let errorCount = 0;
    
    console.log(`Processing lines ${startLine} to ${endLine - 1} in batches of ${batchSize}`);
    
    for (let startIndex = startLine; startIndex < endLine; startIndex += batchSize) {
      const batchEndIndex = Math.min(startIndex + batchSize, endLine);
      console.log(`Processing batch: lines ${startIndex} to ${batchEndIndex - 1}`);
      
      const batchProducts = [];
      
      for (let i = startIndex; i < batchEndIndex; i++) {
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
                category,
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
              
              batchProducts.push(productData);
            } else {
              skippedCount++;
            }
          } else {
            console.log(`Line ${i} has ${values.length} values, expected ${headers.length}`);
            skippedCount++;
          }
        } catch (lineError) {
          console.error(`Error processing line ${i}:`, lineError);
          errorCount++;
        }
      }
      
      // Insert batch into database
      if (batchProducts.length > 0) {
        try {
          const { error: insertError } = await supabase
            .from('price_charting_products')
            .insert(batchProducts);
          
          if (insertError) {
            console.error(`Database insert error for batch starting at line ${startIndex}:`, insertError);
            errorCount += batchProducts.length;
          } else {
            processedCount += batchProducts.length;
            console.log(`Successfully inserted ${batchProducts.length} products`);
          }
        } catch (insertError) {
          console.error(`Database insert exception for batch starting at line ${startIndex}:`, insertError);
          errorCount += batchProducts.length;
        }
      }
    }
    
    // Log the completion
    await supabase
      .from('csv_download_logs')
      .insert({
        category,
        product_count: processedCount,
        success: true,
        error_message: `Streaming batch: lines ${startLine}-${endLine - 1}, Processed: ${processedCount}, Skipped: ${skippedCount}, Errors: ${errorCount}`,
        downloaded_at: new Date().toISOString()
      });
    
    console.log(`Streaming sync completed for ${category}:`);
    console.log(`- Processed: ${processedCount}`);
    console.log(`- Skipped: ${skippedCount}`);
    console.log(`- Errors: ${errorCount}`);
    console.log(`- Next start line: ${endLine}`);
    
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
        processed: processedCount,
        skipped: skippedCount,
        errors: errorCount,
        nextStartLine: endLine,
        hasMore: endLine < lines.length,
        totalLines: lines.length,
        message: `Processed ${processedCount} products (lines ${startLine}-${endLine - 1})`
      })
    };
    
  } catch (error) {
    console.error('Streaming CSV sync error:', error);
    
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
