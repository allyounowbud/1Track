const { createClient } = require('@supabase/supabase-js');

// Initialize Supabase client
const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const supabase = createClient(supabaseUrl, supabaseServiceKey);

const PRICE_CHARTING_API_KEY = process.env.PRICE_CHARTING_API_KEY;

const CSV_URLS = {
  video_games: `https://www.pricecharting.com/download/video-games.csv?t=${PRICE_CHARTING_API_KEY}`,
  pokemon_cards: `https://www.pricecharting.com/download/pokemon-cards.csv?t=${PRICE_CHARTING_API_KEY}`,
  magic_cards: `https://www.pricecharting.com/download/magic-cards.csv?t=${PRICE_CHARTING_API_KEY}`,
  yugioh_cards: `https://www.pricecharting.com/download/yugioh-cards.csv?t=${PRICE_CHARTING_API_KEY}`
};

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
  console.log('Efficient CSV sync function triggered');
  
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
    
    const { category = 'pokemon_cards', clearExisting = false } = JSON.parse(event.body || '{}');
    
    console.log(`Starting efficient sync for ${category}`);
    console.log(`API Key configured: ${!!PRICE_CHARTING_API_KEY}`);
    console.log(`API Key length: ${PRICE_CHARTING_API_KEY ? PRICE_CHARTING_API_KEY.length : 0}`);
    
    const csvUrl = CSV_URLS[category];
    if (!csvUrl) {
      throw new Error(`Unknown category: ${category}`);
    }
    
    console.log(`CSV URL: ${csvUrl.substring(0, 50)}...`);
    
    // Download CSV once
    console.log(`Downloading CSV for ${category}...`);
    const response = await fetch(csvUrl, {
      method: 'GET',
      headers: {
        'Accept': 'text/csv',
        'User-Agent': '1Track-EfficientSync/1.0',
      },
    });
    
    if (!response.ok) {
      throw new Error(`Failed to download CSV: ${response.status}`);
    }
    
    const csvText = await response.text();
    const lines = csvText.split('\n');
    const headers = lines[0].split(',').map(h => h.trim().replace(/"/g, ''));
    
    console.log(`CSV downloaded: ${lines.length} lines`);
    console.log(`Headers: ${headers.join(', ')}`);
    
    // Clear existing data if requested
    if (clearExisting) {
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
    
    // Process all products in chunks to avoid memory issues
    const batchSize = 500; // Smaller batches for better reliability
    const totalProducts = lines.length - 1; // Subtract header
    let processedCount = 0;
    let skippedCount = 0;
    let errorCount = 0;
    
    console.log(`Processing ${totalProducts} products in batches of ${batchSize}`);
    
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
      
      // Add small delay to prevent overwhelming the database
      if (endIndex < lines.length) {
        await new Promise(resolve => setTimeout(resolve, 100));
      }
    }
    
    // Log the completion
    await supabase
      .from('csv_download_logs')
      .insert({
        category,
        product_count: processedCount,
        success: true,
        error_message: `Processed: ${processedCount}, Skipped: ${skippedCount}, Errors: ${errorCount}`,
        downloaded_at: new Date().toISOString()
      });
    
    console.log(`Efficient sync completed for ${category}:`);
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
        category,
        processed: processedCount,
        skipped: skippedCount,
        errors: errorCount,
        total: totalProducts,
        message: `Successfully processed ${processedCount} products for ${category}`
      })
    };
    
  } catch (error) {
    console.error('Efficient CSV sync error:', error);
    
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
