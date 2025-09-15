const { createClient } = require('@supabase/supabase-js');

// Initialize Supabase client
const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const supabase = createClient(supabaseUrl, supabaseServiceKey);

exports.handler = async (event, context) => {
  console.log('Database analysis function triggered');
  
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
    
    console.log('Analyzing database contents...');
    
    // Get total count
    const { count: totalCount, error: totalError } = await supabase
      .from('price_charting_products')
      .select('*', { count: 'exact', head: true });
    
    if (totalError) {
      throw new Error(`Failed to get total count: ${totalError.message}`);
    }
    
    // Get count by category
    const { data: categoryData, error: categoryError } = await supabase
      .from('price_charting_products')
      .select('category, downloaded_at')
      .order('downloaded_at', { ascending: false });
    
    if (categoryError) {
      throw new Error(`Failed to get category data: ${categoryError.message}`);
    }
    
    // Analyze by category
    const categoryAnalysis = {};
    categoryData.forEach(product => {
      if (!categoryAnalysis[product.category]) {
        categoryAnalysis[product.category] = {
          count: 0,
          lastUpdated: product.downloaded_at,
          firstSeen: product.downloaded_at
        };
      }
      categoryAnalysis[product.category].count++;
      if (product.downloaded_at > categoryAnalysis[product.category].lastUpdated) {
        categoryAnalysis[product.category].lastUpdated = product.downloaded_at;
      }
      if (product.downloaded_at < categoryAnalysis[product.category].firstSeen) {
        categoryAnalysis[product.category].firstSeen = product.downloaded_at;
      }
    });
    
    // Get sample products from each category
    const sampleProducts = {};
    for (const category of Object.keys(categoryAnalysis)) {
      const { data: samples, error: sampleError } = await supabase
        .from('price_charting_products')
        .select('product_id, product_name, console_name, loose_price, downloaded_at')
        .eq('category', category)
        .order('downloaded_at', { ascending: false })
        .limit(3);
      
      if (!sampleError && samples) {
        sampleProducts[category] = samples;
      }
    }
    
    // Get recent download logs
    const { data: recentLogs, error: logsError } = await supabase
      .from('csv_download_logs')
      .select('*')
      .order('downloaded_at', { ascending: false })
      .limit(10);
    
    console.log(`Database analysis completed. Total: ${totalCount}, Categories: ${Object.keys(categoryAnalysis).length}`);
    
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
        totalCount: totalCount || 0,
        categoryAnalysis,
        sampleProducts,
        recentLogs: recentLogs || [],
        message: `Database contains ${totalCount || 0} total products across ${Object.keys(categoryAnalysis).length} categories`
      })
    };
    
  } catch (error) {
    console.error('Database analysis error:', error);
    
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
