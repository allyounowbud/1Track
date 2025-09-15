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
  console.log('Full Pokemon sync function triggered');
  
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
    
    const { clearExisting = true } = JSON.parse(event.body || '{}');
    
    console.log('Starting full Pokemon cards sync...');
    
    const csvUrl = `https://www.pricecharting.com/price-guide/download-custom?t=${PRICE_CHARTING_API_KEY}&category=pokemon-cards`;
    
    // Download CSV
    console.log('Downloading Pokemon cards CSV...');
    const response = await fetch(csvUrl, {
      method: 'GET',
      headers: {
        'Accept': 'text/csv',
        'User-Agent': '1Track-FullPokemonSync/1.0',
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
    
    // Process all products in small batches to avoid timeouts
    const batchSize = 100; // Small batches for reliability
    const totalProducts = lines.length - 1; // Subtract header
    let processedCount = 0;
    let skippedCount = 0;
    let errorCount = 0;
    
    console.log(`Processing ${totalProducts} Pokemon cards in batches of ${batchSize}`);
    
    for (let startIndex = 1; startIndex < lines.length; startIndex += batchSize) {
      const endIndex = Math.min(startIndex + batchSize, lines.length);
      console.log(`Processing batch: lines ${startIndex} to ${endIndex - 1}`);
      
      const batchProducts = [];
      
      for (let i = startIndex; i < endIndex; i++) {
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
          console.log(`Inserting ${batchProducts.length} products into database...`);
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
      
      // Add small delay to prevent overwhelming the database
      if (endIndex < lines.length) {
        await new Promise(resolve => setTimeout(resolve, 100));
      }
    }
    
    // Log the completion
    await supabase
      .from('csv_download_logs')
      .insert({
        category: 'pokemon_cards',
        product_count: processedCount,
        success: true,
        error_message: `Full sync completed. Processed: ${processedCount}, Skipped: ${skippedCount}, Errors: ${errorCount}`,
        downloaded_at: new Date().toISOString()
      });
    
    console.log(`Full Pokemon cards sync completed:`);
    console.log(`- Processed: ${processedCount}`);
    console.log(`- Skipped: ${skippedCount}`);
    console.log(`- Errors: ${errorCount}`);
    
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
        processed: processedCount,
        skipped: skippedCount,
        errors: errorCount,
        total: totalProducts,
        message: `Successfully processed ${processedCount} Pokemon cards`
      })
    };
    
  } catch (error) {
    console.error('Full Pokemon sync error:', error);
    
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
