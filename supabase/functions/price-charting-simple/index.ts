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
  
  const searchUrl = `${PRICE_CHARTING_BASE_URL}/products?q=${encodeURIComponent(productName)}&api_key=${PRICE_CHARTING_API_KEY}`
  
  console.log(`Searching Price Charting API for: ${productName}`)
  
  const response = await fetch(searchUrl, {
    method: 'GET',
    headers: {
      'Accept': 'application/json',
    },
  })
  
  if (!response.ok) {
    throw new Error(`Price Charting API error: ${response.status} ${response.statusText}`)
  }
  
  const data = await response.json()
  return data
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
      
      default:
        return error('Invalid action', 404)
    }
    
  } catch (err) {
    console.error('Price Charting API error:', err)
    return error(`Internal server error: ${err.message}`, 500)
  }
})

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
        await new Promise(resolve => setTimeout(resolve, 100))
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
