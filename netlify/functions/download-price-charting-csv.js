const { createClient } = require('@supabase/supabase-js');

// Initialize Supabase client
const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const supabase = createClient(supabaseUrl, supabaseServiceKey);

// Price Charting API configuration
const PRICE_CHARTING_API_KEY = process.env.PRICE_CHARTING_API_KEY;

// CSV download URLs for different categories
const CSV_URLS = {
  'pokemon_cards': 'https://www.pricecharting.com/api/download/pokemon-cards.csv',
  'video_games': 'https://www.pricecharting.com/api/download/video-games.csv',
  'trading_cards': 'https://www.pricecharting.com/api/download/trading-cards.csv',
  'all': 'https://www.pricecharting.com/api/download/all.csv'
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

// Download and process CSV data
async function downloadAndProcessCSV(category = 'all') {
  console.log(`Downloading Price Charting CSV for category: ${category}`);
  
  if (!PRICE_CHARTING_API_KEY) {
    throw new Error('Price Charting API key not configured');
  }
  
  const csvUrl = CSV_URLS[category] || CSV_URLS['all'];
  const urlWithAuth = `${csvUrl}?t=${PRICE_CHARTING_API_KEY}`;
  
  console.log(`Downloading from: ${csvUrl}`);
  
  try {
    const response = await fetch(urlWithAuth, {
      method: 'GET',
      headers: {
        'Accept': 'text/csv',
        'User-Agent': '1Track/1.0',
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
    
    return {
      success: true,
      category,
      productCount: products.length,
      downloadUrl: csvUrl
    };
    
  } catch (error) {
    console.error(`Error downloading/processing CSV:`, error);
    throw error;
  }
}

// Store products in database
async function storeProductsInDatabase(products, category) {
  console.log(`Storing ${products.length} products in database...`);
  
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

// Search for products in local database
async function searchLocalProducts(searchTerm, category = null) {
  console.log(`Searching local database for: "${searchTerm}"`);
  
  let query = supabase
    .from('price_charting_products')
    .select('*')
    .ilike('product_name', `%${searchTerm}%`)
    .limit(10);
    
  if (category) {
    query = query.eq('category', category);
  }
  
  const { data, error } = await query;
  
  if (error) {
    console.error('Error searching local products:', error);
    throw error;
  }
  
  console.log(`Found ${data.length} local products matching "${searchTerm}"`);
  return data || [];
}

// Main handler
exports.handler = async (event, context) => {
  console.log('Price Charting CSV download function called');
  
  try {
    const { category = 'all', action = 'download' } = JSON.parse(event.body || '{}');
    
    if (action === 'search') {
      const { searchTerm, category: searchCategory } = JSON.parse(event.body);
      
      if (!searchTerm) {
        return {
          statusCode: 400,
          body: JSON.stringify({ error: 'Search term is required' })
        };
      }
      
      const results = await searchLocalProducts(searchTerm, searchCategory);
      
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
          results,
          searchTerm,
          category: searchCategory,
          totalResults: results.length
        })
      };
    }
    
    // Default action is download
    const result = await downloadAndProcessCSV(category);
    
    return {
      statusCode: 200,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Headers': 'Content-Type',
        'Access-Control-Allow-Methods': 'POST, OPTIONS'
      },
      body: JSON.stringify(result)
    };
    
  } catch (error) {
    console.error('CSV download error:', error);
    
    return {
      statusCode: 500,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*'
      },
      body: JSON.stringify({
        success: false,
        error: error.message,
        details: error.stack
      })
    };
  }
};
