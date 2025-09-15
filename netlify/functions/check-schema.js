const { createClient } = require('@supabase/supabase-js');

// Initialize Supabase client
const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const supabase = createClient(supabaseUrl, supabaseServiceKey);

exports.handler = async (event, context) => {
  console.log('Check schema function triggered');
  
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
    
    console.log('Checking database schema...');
    
    // Check if the table exists and get its structure
    const { data: tableInfo, error: tableError } = await supabase
      .from('information_schema.tables')
      .select('*')
      .eq('table_name', 'price_charting_products')
      .eq('table_schema', 'public');
    
    if (tableError) {
      console.error('Error checking table:', tableError);
    }
    
    // Check for unique constraints
    const { data: constraints, error: constraintError } = await supabase
      .from('information_schema.table_constraints')
      .select('*')
      .eq('table_name', 'price_charting_products')
      .eq('table_schema', 'public')
      .eq('constraint_type', 'UNIQUE');
    
    if (constraintError) {
      console.error('Error checking constraints:', constraintError);
    }
    
    // Get column information
    const { data: columns, error: columnError } = await supabase
      .from('information_schema.columns')
      .select('column_name, data_type, is_nullable, column_default')
      .eq('table_name', 'price_charting_products')
      .eq('table_schema', 'public')
      .order('ordinal_position');
    
    if (columnError) {
      console.error('Error checking columns:', columnError);
    }
    
    console.log('Schema check completed');
    
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
        tableExists: tableInfo && tableInfo.length > 0,
        uniqueConstraints: constraints || [],
        columns: columns || [],
        message: `Table exists: ${tableInfo && tableInfo.length > 0}, Unique constraints: ${constraints ? constraints.length : 0}`
      })
    };
    
  } catch (error) {
    console.error('Check schema error:', error);
    
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
