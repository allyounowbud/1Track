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
  console.log('Chunked Pokemon sync function triggered');
  
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
    
    const { action = 'start', chunkIndex = 0, chunkSize = 500, clearExisting = false } = JSON.parse(event.body || '{}');
    
    console.log(`Chunked sync action: ${action}, chunkIndex: ${chunkIndex}, chunkSize: ${chunkSize}`);
    
    if (action === 'start') {
      // Initialize the sync process
      const csvUrl = `https://www.pricecharting.com/price-guide/download-custom?t=${PRICE_CHARTING_API_KEY}&category=pokemon-cards`;
      
      console.log('Downloading Pokemon cards CSV...');
      const response = await fetch(csvUrl, {
        method: 'GET',
        headers: {
          'Accept': 'text/csv',
          'User-Agent': '1Track-ChunkedPokemonSync/1.0',
        },
      });
      
      if (!response.ok) {
        throw new Error(`Failed to download CSV: ${response.status}`);
      }
      
      const csvText = await response.text();
      const lines = csvText.split('\n');
      const headers = parseCSVLine(lines[0]);
      
      console.log(`CSV downloaded: ${lines.length} lines`);
      
      // Clear existing Pokemon cards data if requested
      if (clearExisting) {
        console.log('Clearing existing Pokemon cards data...');
        const { error: deleteError } = await supabase
          .from('price_charting_products')
          .delete()
          .eq('category', 'pokemon_cards');
          
        if (deleteError) {
          throw new Error(`Failed to clear existing data: ${deleteError.message}`);
        }
        console.log('Cleared existing Pokemon cards data');
      }
      
      const totalProducts = lines.length - 1;
      const totalChunks = Math.ceil(totalProducts / chunkSize);
      
      // Log the start
      await supabase
        .from('csv_download_logs')
        .insert({
          category: 'pokemon_cards',
          product_count: 0,
          success: true,
          error_message: `Chunked sync started. Total products: ${totalProducts}, Chunks: ${totalChunks}`,
          downloaded_at: new Date().toISOString()
        });
      
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
          action: 'started',
          totalProducts,
          totalChunks,
          chunkSize,
          message: `Chunked sync initialized. Processing ${totalProducts} products in ${totalChunks} chunks of ${chunkSize}`
        })
      };
    }
    
    if (action === 'process') {
      // Process a specific chunk
      const csvUrl = `https://www.pricecharting.com/price-guide/download-custom?t=${PRICE_CHARTING_API_KEY}&category=pokemon-cards`;
      
      const response = await fetch(csvUrl, {
        method: 'GET',
        headers: {
          'Accept': 'text/csv',
          'User-Agent': '1Track-ChunkedPokemonSync/1.0',
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
      
      console.log(`Processing chunk ${chunkIndex}: lines ${startLine} to ${endLine - 1}`);
      
      const batchProducts = [];
      let skippedCount = 0;
      let errorCount = 0;
      
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
              skippedCount++;
            }
          } else {
            skippedCount++;
          }
        } catch (lineError) {
          console.error(`Error processing line ${i}:`, lineError);
          errorCount++;
        }
      }
      
      // Insert batch into database using UPSERT to handle duplicates
      if (batchProducts.length > 0) {
        try {
          console.log(`Upserting ${batchProducts.length} products into database...`);
          
          // Use upsert to handle duplicate product_ids
          const { error: upsertError } = await supabase
            .from('price_charting_products')
            .upsert(batchProducts, {
              onConflict: 'category,product_id',
              ignoreDuplicates: false
            });
          
          if (upsertError) {
            console.error(`Database upsert error for chunk ${chunkIndex}:`, upsertError);
            errorCount += batchProducts.length;
          } else {
            console.log(`Successfully upserted ${batchProducts.length} products for chunk ${chunkIndex}`);
          }
        } catch (upsertError) {
          console.error(`Database upsert exception for chunk ${chunkIndex}:`, upsertError);
          errorCount += batchProducts.length;
        }
      }
      
      // Log the chunk completion
      await supabase
        .from('csv_download_logs')
        .insert({
          category: 'pokemon_cards',
          product_count: batchProducts.length,
          success: true,
          error_message: `Chunk ${chunkIndex} completed. Processed: ${batchProducts.length}, Skipped: ${skippedCount}, Errors: ${errorCount}`,
          downloaded_at: new Date().toISOString()
        });
      
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
          action: 'processed',
          chunkIndex,
          processed: batchProducts.length,
          skipped: skippedCount,
          errors: errorCount,
          message: `Chunk ${chunkIndex} completed: ${batchProducts.length} products processed`
        })
      };
    }
    
    return {
      statusCode: 400,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*'
      },
      body: JSON.stringify({
        success: false,
        error: 'Invalid action. Use "start" or "process"'
      })
    };
    
  } catch (error) {
    console.error('Chunked Pokemon sync error:', error);
    
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
