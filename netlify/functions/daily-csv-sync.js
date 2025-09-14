const { createClient } = require('@supabase/supabase-js');

// Initialize Supabase client
const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const supabase = createClient(supabaseUrl, supabaseServiceKey);

// Price Charting API configuration
const PRICE_CHARTING_API_KEY = process.env.PRICE_CHARTING_API_KEY;

// CSV download URLs for different categories
const CSV_URLS = {
  'video_games': 'https://www.pricecharting.com/price-guide/download-custom?t=c48c819005ad6b004f469e4e2d9329b3368ca30d',
  'pokemon_cards': 'https://www.pricecharting.com/price-guide/download-custom?t=c48c819005ad6b004f469e4e2d9329b3368ca30d&category=pokemon-cards',
  'magic_cards': 'https://www.pricecharting.com/price-guide/download-custom?t=c48c819005ad6b004f469e4e2d9329b3368ca30d&category=magic-cards',
  'yugioh_cards': 'https://www.pricecharting.com/price-guide/download-custom?t=c48c819005ad6b004f469e4e2d9329b3368ca30d&category=yugioh-cards'
};

// Helper function to parse CSV data
function parseCSV(csvText) {
  const lines = csvText.split('\n');
  const headers = lines[0].split(',').map(h => h.trim().replace(/"/g, ''));
  const products = [];
  
  for (let i = 1; i < lines.length; i++) {
    const line = lines[i].trim();
    if (!line) continue;
    
    const values = parseCSVLine(line);
    if (values.length === headers.length) {
      const product = {};
      headers.forEach((header, index) => {
        product[header] = values[index];
      });
      products.push(product);
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

// Download and store CSV data for a specific category
async function downloadAndStoreCSV(category) {
  console.log(`[${new Date().toISOString()}] Starting CSV download for category: ${category}`);
  
  if (!PRICE_CHARTING_API_KEY) {
    throw new Error('Price Charting API key not configured');
  }
  
  const csvUrl = CSV_URLS[category];
  
  console.log(`Downloading from: ${csvUrl}`);
  
  try {
    const response = await fetch(csvUrl, {
      method: 'GET',
      headers: {
        'Accept': 'text/csv',
        'User-Agent': '1Track-DailySync/1.0',
      },
    });
    
    if (!response.ok) {
      throw new Error(`Failed to download CSV: ${response.status} ${response.statusText}`);
    }
    
    const csvText = await response.text();
    console.log(`Downloaded CSV with ${csvText.length} characters`);
    
    // Parse the CSV
    const products = parseCSV(csvText);
    console.log(`Parsed ${products.length} products from CSV`);
    
    // Store in database
    await storeProductsInDatabase(products, category);
    
    // Log the download
    await logDownloadActivity(category, products.length, null);
    
    return {
      success: true,
      category,
      productCount: products.length,
      timestamp: new Date().toISOString()
    };
    
  } catch (error) {
    console.error(`Error downloading/processing CSV for ${category}:`, error);
    
    // Log the error
    await logDownloadActivity(category, 0, error.message);
    
    throw error;
  }
}

// Store products in database
async function storeProductsInDatabase(products, category) {
  console.log(`Storing ${products.length} products in database for category: ${category}`);
  
  // Clear existing data for this category
  const { error: deleteError } = await supabase
    .from('price_charting_products')
    .delete()
    .eq('category', category);
    
  if (deleteError) {
    console.error('Error clearing existing data:', deleteError);
    throw deleteError;
  }
  
  // Prepare products for insertion
  const productsToInsert = products.map(product => ({
    category,
    product_id: product.id || product.product_id,
    product_name: product.product_name || product.name,
    console_name: product.console_name || product.console,
    loose_price: parseFloat(product.loose_price) || 0,
    cib_price: parseFloat(product.cib_price) || 0,
    new_price: parseFloat(product.new_price) || 0,
    graded_price: parseFloat(product.graded_price) || 0,
    box_price: parseFloat(product.box_price) || 0,
    manual_price: parseFloat(product.manual_price) || 0,
    raw_data: product,
    downloaded_at: new Date().toISOString()
  }));
  
  // Insert in batches to avoid size limits
  const batchSize = 1000;
  for (let i = 0; i < productsToInsert.length; i += batchSize) {
    const batch = productsToInsert.slice(i, i + batchSize);
    
    const { error: insertError } = await supabase
      .from('price_charting_products')
      .insert(batch);
      
    if (insertError) {
      console.error(`Error inserting batch ${i}-${i + batchSize}:`, insertError);
      throw insertError;
    }
    
    console.log(`Inserted batch ${i}-${i + batchSize} (${batch.length} products)`);
  }
  
  console.log(`Successfully stored ${products.length} products in database`);
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

// Main handler - this will be called by Netlify's scheduled functions
exports.handler = async (event, context) => {
  console.log(`[${new Date().toISOString()}] Daily CSV sync function triggered`);
  
  try {
    // Download data for all categories
    const categories = ['video_games', 'pokemon_cards', 'magic_cards', 'yugioh_cards'];
    const results = [];
    
    for (const category of categories) {
      try {
        console.log(`Processing category: ${category}`);
        const result = await downloadAndStoreCSV(category);
        results.push(result);
        console.log(`✅ Successfully processed ${category}: ${result.productCount} products`);
      } catch (error) {
        console.error(`❌ Failed to process ${category}:`, error.message);
        results.push({
          success: false,
          category,
          error: error.message,
          timestamp: new Date().toISOString()
        });
      }
    }
    
    // Summary
    const successful = results.filter(r => r.success).length;
    const failed = results.filter(r => !r.success).length;
    const totalProducts = results.reduce((sum, r) => sum + (r.productCount || 0), 0);
    
    console.log(`[${new Date().toISOString()}] Daily sync completed: ${successful} successful, ${failed} failed, ${totalProducts} total products`);
    
    return {
      statusCode: 200,
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        success: true,
        timestamp: new Date().toISOString(),
        summary: {
          categoriesProcessed: results.length,
          successful,
          failed,
          totalProducts
        },
        results
      })
    };
    
  } catch (error) {
    console.error(`[${new Date().toISOString()}] Daily CSV sync error:`, error);
    
    return {
      statusCode: 500,
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        success: false,
        error: error.message,
        timestamp: new Date().toISOString(),
        details: error.stack
      })
    };
  }
};
