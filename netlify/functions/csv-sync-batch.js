const { createClient } = require('@supabase/supabase-js');

// Initialize Supabase client
const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
  throw new Error('Missing Supabase configuration');
}

const supabase = createClient(supabaseUrl, supabaseServiceKey);

// CSV download URLs
const CSV_URLS = {
  'pokemon_cards': 'https://www.pricecharting.com/price-guide/download-custom?t=c48c819005ad6b004f469e4e2d9329b3368ca30d&category=pokemon-cards'
};

// Helper function to parse a single CSV line
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

// Parse price string to float
function parsePrice(priceStr) {
  if (!priceStr || priceStr === '$0.00' || priceStr === '') return 0;
  return parseFloat(priceStr.replace(/[$,]/g, '')) || 0;
}

// Process a batch of CSV lines
async function processBatch(category, headers, lines, startIndex, batchSize) {
  console.log(`Processing batch ${startIndex}-${startIndex + batchSize} for ${category}`);
  
  const batchProducts = [];
  const endIndex = Math.min(startIndex + batchSize, lines.length);
  let skippedCount = 0;
  
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
          // Additional validation for data integrity
          try {
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
          } catch (validationError) {
            console.error(`Validation error for line ${i}:`, validationError);
            skippedCount++;
          }
        } else {
          skippedCount++;
        }
      } else {
        console.log(`Line ${i} has ${values.length} values, expected ${headers.length}`);
        skippedCount++;
      }
    } catch (error) {
      console.error(`Error parsing line ${i}:`, error);
      skippedCount++;
    }
  }
  
  console.log(`Batch ${startIndex}: ${batchProducts.length} valid products, ${skippedCount} skipped`);
  
  if (batchProducts.length > 0) {
    try {
      const { error } = await supabase
        .from('price_charting_products')
        .insert(batchProducts);
        
      if (error) {
        console.error(`Database error for batch starting at ${startIndex}:`, error);
        console.error(`First few products in batch:`, batchProducts.slice(0, 3));
        throw error;
      }
    } catch (dbError) {
      console.error(`Database insertion failed for batch ${startIndex}:`, dbError);
      throw dbError;
    }
  }
  
  return {
    processed: batchProducts.length,
    skipped: skippedCount,
    total: endIndex - startIndex
  };
}

// Main handler
exports.handler = async (event, context) => {
  console.log('CSV batch sync function triggered');
  
  try {
    const { category = 'pokemon_cards', action = 'start', batchIndex = 0, batchSize = 1000 } = JSON.parse(event.body || '{}');
    
    if (action === 'start') {
      // Initialize sync - clear existing data and return total count
      console.log(`Starting sync for ${category}`);
      
      const csvUrl = CSV_URLS[category];
      const response = await fetch(csvUrl, {
        method: 'GET',
        headers: {
          'Accept': 'text/csv',
          'User-Agent': '1Track-BatchSync/1.0',
        },
      });
      
      if (!response.ok) {
        throw new Error(`Failed to download CSV: ${response.status}`);
      }
      
      const csvText = await response.text();
      const lines = csvText.split('\n');
      const headers = lines[0].split(',').map(h => h.trim().replace(/"/g, ''));
      
      // Clear existing data
      const { error: deleteError } = await supabase
        .from('price_charting_products')
        .delete()
        .eq('category', category);
        
      if (deleteError) {
        console.error('Error clearing existing data:', deleteError);
      }
      
      const totalLines = lines.length - 1; // Subtract header
      const totalBatches = Math.ceil(totalLines / batchSize);
      
      // Log start
      await supabase
        .from('csv_download_logs')
        .insert({
          category,
          product_count: 0,
          success: true,
          error_message: null,
          downloaded_at: new Date().toISOString()
        });
      
      return {
        statusCode: 200,
        headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*'
        },
        body: JSON.stringify({
          success: true,
          action: 'start',
          totalLines,
          totalBatches,
          batchSize,
          message: `Ready to process ${totalLines} products in ${totalBatches} batches`
        })
      };
      
    } else if (action === 'process') {
      // Process a specific batch
      console.log(`Processing batch ${batchIndex} for ${category}`);
      
      const csvUrl = CSV_URLS[category];
      const response = await fetch(csvUrl, {
        method: 'GET',
        headers: {
          'Accept': 'text/csv',
          'User-Agent': '1Track-BatchSync/1.0',
        },
      });
      
      if (!response.ok) {
        throw new Error(`Failed to download CSV: ${response.status}`);
      }
      
      const csvText = await response.text();
      const lines = csvText.split('\n');
      const headers = lines[0].split(',').map(h => h.trim().replace(/"/g, ''));
      
      const startIndex = (batchIndex * batchSize) + 1; // Skip header
      const result = await processBatch(category, headers, lines, startIndex, batchSize);
      
      return {
        statusCode: 200,
        headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*'
        },
        body: JSON.stringify({
          success: true,
          action: 'process',
          batchIndex,
          batchSize,
          processed: result.processed,
          message: `Processed batch ${batchIndex}: ${result.processed} products`
        })
      };
      
    } else if (action === 'complete') {
      // Mark sync as complete
      const { data: countData } = await supabase
        .from('price_charting_products')
        .select('id', { count: 'exact' })
        .eq('category', category);
      
      const productCount = countData?.length || 0;
      
      // Update the log
      await supabase
        .from('csv_download_logs')
        .insert({
          category,
          product_count: productCount,
          success: true,
          error_message: null,
          downloaded_at: new Date().toISOString()
        });
      
      return {
        statusCode: 200,
        headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*'
        },
        body: JSON.stringify({
          success: true,
          action: 'complete',
          productCount,
          message: `Sync completed: ${productCount} products imported`
        })
      };
      
    } else {
      return {
        statusCode: 400,
        headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*'
        },
        body: JSON.stringify({
          success: false,
          error: 'Invalid action. Use "start", "process", or "complete"'
        })
      };
    }
    
  } catch (error) {
    console.error('CSV batch sync error:', error);
    
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
