import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
}

// Price Charting API Configuration
const PRICE_CHARTING_API_KEY = Deno.env.get('PRICE_CHARTING_API_KEY')
const PRICE_CHARTING_BASE_URL = "https://www.pricecharting.com/api"

// Initialize Supabase client
const supabaseUrl = Deno.env.get('SUPABASE_URL')!
const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
const supabase = createClient(supabaseUrl, supabaseServiceKey)

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

// Search for products using Price Charting API
async function searchProducts(productName: string): Promise<any> {
  if (!PRICE_CHARTING_API_KEY) {
    throw new Error('Price Charting API key not configured')
  }
  
  // Clean the product name
  const cleanName = productName.trim().replace(/[^\w\s-]/g, '').replace(/\s+/g, ' ')
  
  // Try different API endpoints and formats
  const endpoints = [
    // Format 1: Standard search
    `${PRICE_CHARTING_BASE_URL}/products?q=${encodeURIComponent(cleanName)}&api_key=${PRICE_CHARTING_API_KEY}`,
    // Format 2: With category
    `${PRICE_CHARTING_BASE_URL}/products?q=${encodeURIComponent(cleanName)}&category=pokemon-cards&api_key=${PRICE_CHARTING_API_KEY}`,
    // Format 3: Alternative format
    `${PRICE_CHARTING_BASE_URL}/products?q=${encodeURIComponent(cleanName)}&api_key=${PRICE_CHARTING_API_KEY}&format=json`
  ]
  
  console.log(`Searching Price Charting API for: ${cleanName}`)
  console.log(`API Key present: ${!!PRICE_CHARTING_API_KEY}`)
  
  // Try each endpoint until one works
  for (let i = 0; i < endpoints.length; i++) {
    try {
      console.log(`Trying endpoint ${i + 1}: ${endpoints[i].replace(PRICE_CHARTING_API_KEY, 'HIDDEN')}`)
      
      const response = await fetch(endpoints[i], {
        method: 'GET',
        headers: {
          'Accept': 'application/json',
          'User-Agent': '1Track/1.0',
        },
      })
      
      console.log(`Response status: ${response.status}`)
      
      if (response.ok) {
        const data = await response.json()
        console.log(`Success with endpoint ${i + 1}`)
        return data
      } else {
        const errorText = await response.text()
        console.log(`Endpoint ${i + 1} failed: ${response.status} - ${errorText}`)
        
        // If this is the last endpoint, throw the error
        if (i === endpoints.length - 1) {
          throw new Error(`Price Charting API error: ${response.status} ${response.statusText} - ${errorText}`)
        }
      }
    } catch (err) {
      console.log(`Endpoint ${i + 1} error: ${err.message}`)
      
      // If this is the last endpoint, throw the error
      if (i === endpoints.length - 1) {
        throw err
      }
    }
  }
}

// Main handler
serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }
  
  try {
    const url = new URL(req.url)
    const params = url.searchParams
    
    // Parse request body if present
    let requestData = {}
    if (req.method === 'POST') {
      try {
        requestData = await req.json()
      } catch (e) {
        return error('Invalid JSON in request body')
      }
    }
    
    // Route requests based on path
    const pathParts = url.pathname.split('/').filter(Boolean)
    const action = pathParts[pathParts.length - 1] || 'search'
    
    switch (action) {
      case 'search':
        return await handleSearch(params, requestData)
      
      case 'portfolio-data':
        return await handlePortfolioData(params, requestData)
      
      case 'test':
        return await handleTest()
      
      default:
        return error('Invalid action', 404)
    }
    
  } catch (err) {
    console.error('Price Charting API error:', err)
    return error(`Internal server error: ${err.message}`, 500)
  }
})

// Test handler to check API key and basic functionality
async function handleTest() {
  try {
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
    return error(`Test failed: ${err.message}`, 500)
  }
}

// Search handler
async function handleSearch(params: URLSearchParams, requestData: any) {
  const productName = params.get('q') || requestData.productName
  
  if (!productName) {
    return error('Product name is required')
  }
  
  try {
    // Search API
    const apiResponse = await searchProducts(productName)
    
    return json({
      success: true,
      data: apiResponse,
      searchedFor: productName
    })
    
  } catch (err) {
    console.error('Search error:', err)
    return error(`Search failed: ${err.message}`, 500)
  }
}

// Portfolio data handler
async function handlePortfolioData(params: URLSearchParams, requestData: any) {
  const { productNames } = requestData
  
  if (!productNames || !Array.isArray(productNames) || productNames.length === 0) {
    return error('Product names array is required')
  }
  
  try {
    // Get unique product names
    const uniqueNames = [...new Set(productNames)]
    
    // Process each product
    const results: Record<string, any> = {}
    
    for (const productName of uniqueNames) {
      try {
        const apiResponse = await searchProducts(productName)
        
        // Format results for portfolio use
        if (apiResponse && apiResponse.products && apiResponse.products.length > 0) {
          const product = apiResponse.products[0] // Get first result
          results[productName] = {
            product_id: product.id,
            product_name: product.product_name,
            console_name: product.console_name,
            loose_price: product.loose_price,
            cib_price: product.cib_price,
            new_price: product.new_price,
            image_url: product.image_url,
          }
        }
        
        // Small delay to respect rate limits
        await new Promise(resolve => setTimeout(resolve, 200))
      } catch (error) {
        console.error(`Failed to fetch data for ${productName}:`, error)
      }
    }
    
    return json({
      success: true,
      data: results,
      summary: {
        total: uniqueNames.length,
        successful: Object.keys(results).length,
      },
    })
    
  } catch (err) {
    console.error('Portfolio data error:', err)
    return error(`Portfolio data failed: ${err.message}`, 500)
  }
}
