const { createClient } = require('@supabase/supabase-js');

// Initialize Supabase client
const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
  throw new Error('Missing Supabase configuration');
}

const supabase = createClient(supabaseUrl, supabaseServiceKey);

exports.handler = async (event, context) => {
  console.log('Resume sync function triggered');
  
  try {
    const { category = 'pokemon_cards' } = JSON.parse(event.body || '{}');
    
    // Check current progress
    const { data: currentData, error: countError } = await supabase
      .from('price_charting_products')
      .select('id', { count: 'exact' })
      .eq('category', category);
    
    if (countError) {
      throw countError;
    }
    
    const currentCount = currentData?.length || 0;
    
    // Get latest download log
    const { data: logs, error: logError } = await supabase
      .from('csv_download_logs')
      .select('*')
      .eq('category', category)
      .order('downloaded_at', { ascending: false })
      .limit(1);
    
    return {
      statusCode: 200,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*'
      },
      body: JSON.stringify({
        success: true,
        category,
        currentCount,
        lastSync: logs?.[0]?.downloaded_at || null,
        message: `Currently have ${currentCount} products for ${category}`
      })
    };
    
  } catch (error) {
    console.error('Resume sync error:', error);
    
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
