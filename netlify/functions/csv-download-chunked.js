const { createClient } = require('@supabase/supabase-js');

// Initialize Supabase client
const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

console.log(`Supabase URL configured: ${!!supabaseUrl}`);
console.log(`Supabase Service Key configured: ${!!supabaseServiceKey}`);

if (!supabaseUrl || !supabaseServiceKey) {
  throw new Error('Missing Supabase configuration. Please check environment variables.');
}

const supabase = createClient(supabaseUrl, supabaseServiceKey);

// CSV download URLs for different categories
const CSV_URLS = {
  'video_games': 'https://www.pricecharting.com/price-guide/download-custom?t=c48c819005ad6b004f469e4e2d9329b3368ca30d',
  'pokemon_cards': 'https://www.pricecharting.com/price-guide/download-custom?t=c48c819005ad6b004f469e4e2d9329b3368ca30d&category=pokemon-cards',
  'magic_cards': 'https://www.pricecharting.com/price-guide/download-custom?t=c48c819005ad6b004f469e4e2d9329b3368ca30d&category=magic-cards',
  'yugioh_cards': 'https://www.pricecharting.com/price-guide/download-custom?t=c48c819005ad6b004f469e4e2d9329b3368ca30d&category=yugioh-cards'
};

// Helper function to parse CSV data in chunks
function parseCSVChunked(csvText, chunkSize = 1000) {
  const lines = csvText.split('\n');
  const headers = lines[0].split(',').map(h => h.trim().replace(/"/g, ''));
  const products = [];
  
  // Process in chunks to avoid memory issues
  for (let i = 1; i < lines.length; i += chunkSize) {
    const chunk = lines.slice(i, i + chunkSize);
    
    for (const line of chunk) {
      if (!line.trim()) continue;
      
      const values = parseCSVLine(line);
      if (values.length === headers.length) {
        const product = {};
        headers.forEach((header, index) => {
          product[header] = values[index];
        });
        products.push(product);
      }
    }
  }
  
  return products;
}

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

// Download CSV and return just the count (for status checking)
async function downloadCSVStatus(category) {
  console.log(`Checking CSV status for category: ${category}`);
  
  const csvUrl = CSV_URLS[category];
  console.log(`Downloading from: ${csvUrl}`);
  
  try {
    const response = await fetch(csvUrl, {
      method: 'GET',
      headers: {
        'Accept': 'text/csv',
        'User-Agent': '1Track-StatusCheck/1.0',
      },
    });
    
    if (!response.ok) {
      throw new Error(`Failed to download CSV: ${response.status} ${response.statusText}`);
    }
    
    const csvText = await response.text();
    console.log(`Downloaded CSV with ${csvText.length} characters`);
    
    // Parse just to count rows (don't store yet)
    const lines = csvText.split('\n');
    const productCount = lines.length - 1; // Subtract header row
    
    console.log(`CSV contains ${productCount} products`);
    
    return {
      success: true,
      category,
      productCount,
      csvSize: csvText.length,
      timestamp: new Date().toISOString()
    };
    
  } catch (error) {
    console.error(`Error checking CSV for ${category}:`, error);
    throw error;
  }
}

// Download and store CSV data in smaller batches
async function downloadAndStoreCSVBatch(category, batchSize = 500) {
  console.log(`Starting batch download for category: ${category}`);
  
  const csvUrl = CSV_URLS[category];
  console.log(`Downloading from: ${csvUrl}`);
  
  try {
    const response = await fetch(csvUrl, {
      method: 'GET',
      headers: {
        'Accept': 'text/csv',
        'User-Agent': '1Track-BatchDownload/1.0',
      },
    });
    
    if (!response.ok) {
      throw new Error(`Failed to download CSV: ${response.status} ${response.statusText}`);
    }
    
    const csvText = await response.text();
    console.log(`Downloaded CSV with ${csvText.length} characters`);
    
    // Clear existing data for this category
    const { error: deleteError } = await supabase
      .from('price_charting_products')
      .delete()
      .eq('category', category);
      
    if (deleteError) {
      console.error('Error clearing existing data:', deleteError);
      throw deleteError;
    }
    
    // Parse CSV in chunks
    const lines = csvText.split('\n');
    const headers = lines[0].split(',').map(h => h.trim().replace(/"/g, ''));
    
    console.log(`CSV Headers: ${headers.join(', ')}`);
    console.log(`Total lines: ${lines.length}`);
    
    let totalProcessed = 0;
    const batches = [];
    
    // Process in batches
    for (let i = 1; i < lines.length; i += batchSize) {
      const batchLines = lines.slice(i, i + batchSize);
      const batchProducts = [];
      
      for (const line of batchLines) {
        if (!line.trim()) continue;
        
        const values = parseCSVLine(line);
        if (values.length === headers.length) {
          const product = {};
          headers.forEach((header, index) => {
            // Keep the original hyphenated field names from CSV
            product[header] = values[index];
          });
          
          // Log first few products for debugging
          if (totalProcessed < 3) {
            console.log(`Sample product ${totalProcessed + 1}:`, product);
          }
          
          // Validate required fields - using correct CSV field names
          const productName = product['product-name'] || '';
          const productId = product.id || '';
          
          // Skip products with missing required fields
          if (!productName.trim() || !productId.trim()) {
            console.log(`Skipping product with missing data: name="${productName}", id="${productId}"`);
            continue;
          }
          
          // Parse prices (remove $ and convert to float)
          const parsePrice = (priceStr) => {
            if (!priceStr || priceStr === '$0.00' || priceStr === '') return 0;
            return parseFloat(priceStr.replace(/[$,]/g, '')) || 0;
          };
          
          batchProducts.push({
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
          });
        }
      }
      
      if (batchProducts.length > 0) {
        batches.push(batchProducts);
      }
    }
    
    // Store batches
    for (const batch of batches) {
      const { error: insertError } = await supabase
        .from('price_charting_products')
        .insert(batch);
        
      if (insertError) {
        console.error('Error inserting batch:', insertError);
        throw insertError;
      }
      
      totalProcessed += batch.length;
      console.log(`Inserted batch: ${batch.length} products (Total: ${totalProcessed})`);
    }
    
    // Log the download
    await logDownloadActivity(category, totalProcessed, null);
    
    return {
      success: true,
      category,
      productCount: totalProcessed,
      batchesProcessed: batches.length,
      timestamp: new Date().toISOString()
    };
    
  } catch (error) {
    console.error(`Error downloading/processing CSV for ${category}:`, error);
    await logDownloadActivity(category, 0, error.message);
    throw error;
  }
}

// Log download activity
async function logDownloadActivity(category, productCount, error = null) {
  try {
    const { error: logError } = await supabase
      .from('csv_download_logs')
      .insert({
        category,
        product_count: productCount,
        success: !error,
        error_message: error,
        downloaded_at: new Date().toISOString()
      });
      
    if (logError) {
      console.error('Error logging download activity:', logError);
    }
  } catch (error) {
    console.error('Error logging download activity:', error);
  }
}

// Main handler
exports.handler = async (event, context) => {
  console.log(`[${new Date().toISOString()}] Chunked CSV download function triggered`);
  console.log(`Event method: ${event.httpMethod}`);
  console.log(`Event body: ${event.body}`);
  
  try {
    // Handle OPTIONS request for CORS
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
    
    const { category = 'pokemon_cards', action = 'status' } = JSON.parse(event.body || '{}');
    
    if (action === 'status') {
      // Just check the CSV size and row count
      const result = await downloadCSVStatus(category);
      
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
          action: 'status',
          message: `CSV for ${category} contains ${result.productCount} products (${Math.round(result.csvSize / 1024)}KB)`,
          result
        })
      };
    } else if (action === 'download') {
      // Actually download and store the data
      const result = await downloadAndStoreCSVBatch(category);
      
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
          action: 'download',
          message: `Successfully downloaded and stored ${result.productCount} products for ${category}`,
          result
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
          error: 'Invalid action. Use "status" or "download"'
        })
      };
    }
    
  } catch (error) {
    console.error(`[${new Date().toISOString()}] Chunked CSV download error:`, error);
    
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
