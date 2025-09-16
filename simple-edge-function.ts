import { serve } from "https://deno.land/std@0.168.0/http/server.ts"

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
}

// Price Charting API Configuration
const PRICE_CHARTING_API_KEY = Deno.env.get('PRICE_CHARTING_API_KEY')

// Helper Functions
function json(data: any, statusCode = 200) {
  return new Response(JSON.stringify(data), {
    status: statusCode,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  })
}

function error(message: string, statusCode = 400) {
  return json({ error: message }, statusCode)
}

// Main handler
serve(async (req) => {
  console.log('Edge Function called:', req.method, req.url)
  
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }
  
  try {
    const url = new URL(req.url)
    const params = url.searchParams
    
    console.log('URL:', url.toString())
    console.log('Params:', Object.fromEntries(params.entries()))
    
    // Route requests based on path
    const pathParts = url.pathname.split('/').filter(Boolean)
    const action = pathParts[pathParts.length - 1] || 'search'
    
    console.log('Action:', action)
    
    switch (action) {
      case 'search':
        return await handleSearch(params)
      
      case 'test':
        return await handleTest()
      
      default:
        return error('Invalid action', 404)
    }
    
  } catch (err) {
    console.error('Edge Function error:', err)
    return error(`Internal server error: ${err.message}`, 500)
  }
})

// Test handler
async function handleTest() {
  try {
    console.log('Test endpoint called')
    
    const hasApiKey = !!PRICE_CHARTING_API_KEY
    const apiKeyLength = PRICE_CHARTING_API_KEY ? PRICE_CHARTING_API_KEY.length : 0
    
    return json({
      success: true,
      message: 'Edge Function is working',
      apiKeyConfigured: hasApiKey,
      apiKeyLength: apiKeyLength,
      timestamp: new Date().toISOString()
    })
  } catch (err) {
    console.error('Test error:', err)
    return error(`Test failed: ${err.message}`, 500)
  }
}

// Search handler
async function handleSearch(params: URLSearchParams) {
  try {
    console.log('Search endpoint called')
    
    const productName = params.get('q')
    console.log('Product name:', productName)
    
    if (!productName) {
      return error('Product name is required')
    }
    
    if (!PRICE_CHARTING_API_KEY) {
      return error('Price Charting API key not configured')
    }
    
    console.log('API Key present:', !!PRICE_CHARTING_API_KEY)
    
    // Clean the product name
    const cleanName = productName.trim().replace(/[^\w\s-]/g, '').replace(/\s+/g, ' ')
    console.log('Clean name:', cleanName)
    
    // Make API call
    const apiUrl = `https://www.pricecharting.com/api/products?q=${encodeURIComponent(cleanName)}&api_key=${PRICE_CHARTING_API_KEY}`
    console.log('API URL:', apiUrl.replace(PRICE_CHARTING_API_KEY, 'HIDDEN'))
    
    const response = await fetch(apiUrl, {
      method: 'GET',
      headers: {
        'Accept': 'application/json',
        'User-Agent': '1Track/1.0',
      },
    })
    
    console.log('API Response status:', response.status)
    
    if (!response.ok) {
      const errorText = await response.text()
      console.log('API Error response:', errorText)
      return error(`Price Charting API error: ${response.status} ${response.statusText} - ${errorText}`)
    }
    
    const data = await response.json()
    console.log('API Response data keys:', Object.keys(data))
    
    return json({
      success: true,
      data: data,
      searchedFor: productName
    })
    
  } catch (err) {
    console.error('Search error:', err)
    return error(`Search failed: ${err.message}`, 500)
  }
}
