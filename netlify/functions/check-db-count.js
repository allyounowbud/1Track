const { createClient } = require('@supabase/supabase-js');

// Initialize Supabase client
const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const supabase = createClient(supabaseUrl, supabaseServiceKey);

exports.handler = async (event, context) => {
  console.log('Check database count function triggered');
  
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
    
    const { category = 'pokemon_cards' } = JSON.parse(event.body || '{}');
    
    console.log(`Checking database count for ${category}...`);
    
    // Get count of products in database
    const { count, error: countError } = await supabase
      .from('price_charting_products')
      .select('*', { count: 'exact', head: true })
      .eq('category', category);
    
    if (countError) {
      console.error('Error getting count:', countError);
      throw new Error(`Failed to get count: ${countError.message}`);
    }
    
    // Get a sample of recent products
    const { data: sampleData, error: sampleError } = await supabase
      .from('price_charting_products')
      .select('id, product_id, product_name, downloaded_at')
      .eq('category', category)
      .order('downloaded_at', { ascending: false })
      .limit(5);
    
    if (sampleError) {
      console.error('Error getting sample data:', sampleError);
    }
    
    console.log(`Database count for ${category}: ${count}`);
    
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
        count: count || 0,
        sampleData: sampleData || [],
        message: `Database contains ${count || 0} products for ${category}`
      })
    };
    
  } catch (error) {
    console.error('Check database count error:', error);
    
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
