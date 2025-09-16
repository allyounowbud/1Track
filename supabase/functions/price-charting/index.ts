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
const CACHE_DURATION_HOURS = 24
const MAX_API_CALLS_PER_DAY = 1000
const BATCH_SIZE = 10
const API_DELAY_MS = 100

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

// Clean and normalize product names for API search
function normalizeProductName(name: string): string {
  return name
    .trim()
    .toLowerCase()
    .replace(/[^\w\s-]/g, '') // Remove special characters except spaces and hyphens
    .replace(/\s+/g, ' ') // Normalize spaces
    .substring(0, 100) // Limit length
}

// Check if we've exceeded daily API rate limit
async function checkRateLimit(): Promise<boolean> {
  const today = new Date().toISOString().split('T')[0]
  const { data, error } = await supabase
    .from('price_cache')
    .select('id')
    .gte('cached_at', `${today}T00:00:00Z`)
    .lt('cached_at', `${today}T23:59:59Z`)
  
  if (error) {
    console.error('Rate limit check failed:', error)
    return false
  }
  
  return data.length < MAX_API_CALLS_PER_DAY
}

// Check cache for existing API response
async function getCachedResponse(productName: string): Promise<any> {
  const normalizedName = normalizeProductName(productName)
  
  const { data, error } = await supabase
    .from('price_cache')
    .select('api_response, cached_at, expires_at')
    .eq('product_name', normalizedName)
    .gt('expires_at', new Date().toISOString())
    .single()
  
  if (error || !data) {
    return null
  }
  
  return data.api_response
}

// Cache API response
async function cacheResponse(productName: string, apiResponse: any): Promise<void> {
  const normalizedName = normalizeProductName(productName)
  const now = new Date()
  const expiresAt = new Date(now.getTime() + (CACHE_DURATION_HOURS * 60 * 60 * 1000))
  
  const { error } = await supabase
    .from('price_cache')
    .upsert({
      product_name: normalizedName,
      api_response: apiResponse,
      cached_at: now.toISOString(),
      expires_at: expiresAt.toISOString(),
    })
  
  if (error) {
    console.error('Failed to cache response:', error)
  }
}

// Search for products using Price Charting API
async function searchProducts(productName: string): Promise<any> {
  if (!PRICE_CHARTING_API_KEY) {
    throw new Error('Price Charting API key not configured')
  }
  
  const normalizedName = normalizeProductName(productName)
  const searchUrl = `${PRICE_CHARTING_BASE_URL}/api/products?q=${encodeURIComponent(normalizedName)}&t=${PRICE_CHARTING_API_KEY}`
  
  console.log(`Searching Price Charting API for: ${normalizedName}`)
  
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
  
  // Log the structure for debugging
  console.log('API Response structure:', {
    type: typeof data,
    keys: Object.keys(data),
    hasProducts: !!(data.products),
    productsLength: data.products ? data.products.length : 0,
    firstProduct: data.products && data.products.length > 0 ? data.products[0] : null
  })
  
  return data
}

// Get detailed price information for a specific product
async function getProductPrice(productId: string): Promise<any> {
  if (!PRICE_CHARTING_API_KEY) {
    throw new Error('Price Charting API key not configured')
  }
  
  const priceUrl = `${PRICE_CHARTING_BASE_URL}/api/product/${productId}?t=${PRICE_CHARTING_API_KEY}`
  
  console.log(`Fetching price for product ID: ${productId}`)
  
  const response = await fetch(priceUrl, {
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

// Route Handlers
async function handleSearch(params: URLSearchParams, requestData: any) {
  const productName = params.get('q') || requestData.productName
  
  if (!productName) {
    return error('Product name is required')
  }
  
  try {
    // Check cache first
    const cachedResponse = await getCachedResponse(productName)
    if (cachedResponse) {
      console.log('Returning cached response for:', productName)
      return json({
        success: true,
        cached: true,
        data: cachedResponse,
      })
    }
    
    // Check rate limit
    const withinRateLimit = await checkRateLimit()
    if (!withinRateLimit) {
      return error('Daily API rate limit exceeded. Please try again tomorrow.', 429)
    }
    
    // Search API
    const apiResponse = await searchProducts(productName)
    
    // Cache the response
    await cacheResponse(productName, apiResponse)
    
    return json({
      success: true,
      cached: false,
      data: apiResponse,
    })
    
  } catch (err) {
    console.error('Search error:', err)
    return error(`Search failed: ${err.message}`, 500)
  }
}

async function handlePortfolioData(params: URLSearchParams, requestData: any) {
  const { productNames } = requestData
  
  if (!productNames || !Array.isArray(productNames) || productNames.length === 0) {
    return error('Product names array is required')
  }
  
  try {
    // Get unique product names
    const uniqueNames = [...new Set(productNames)]
    
    // Check cache first
    const cachedResults: Record<string, any> = {}
    const uncachedItems: string[] = []
    
    for (const productName of uniqueNames) {
      const cachedResponse = await getCachedResponse(productName)
      if (cachedResponse) {
        cachedResults[productName] = cachedResponse
      } else {
        uncachedItems.push(productName)
      }
    }
    
    // Process uncached items
    const newResults: Record<string, any> = {}
    if (uncachedItems.length > 0) {
      const withinRateLimit = await checkRateLimit()
      if (!withinRateLimit) {
        // Return cached results only if rate limit exceeded
        return json({
          success: true,
          data: cachedResults,
          rateLimitExceeded: true,
          message: 'Rate limit exceeded. Returning cached data only.',
        })
      }
      
      // Process uncached items
      for (const productName of uncachedItems) {
        try {
          const apiResponse = await searchProducts(productName)
          await cacheResponse(productName, apiResponse)
          newResults[productName] = apiResponse
          
          // Small delay to respect rate limits
          await new Promise(resolve => setTimeout(resolve, API_DELAY_MS))
        } catch (error) {
          console.error(`Failed to fetch data for ${productName}:`, error)
        }
      }
    }
    
    // Combine results
    const allResults = { ...cachedResults, ...newResults }
    
    // Format results for portfolio use
    const formattedResults: Record<string, any> = {}
    Object.entries(allResults).forEach(([productName, data]) => {
      if (data && data.products && data.products.length > 0) {
        const product = data.products[0] // Get first result
        formattedResults[productName] = {
          product_id: product.id,
          product_name: product.product_name,
          console_name: product.console_name,
          loose_price: product.loose_price,
          cib_price: product.cib_price,
          new_price: product.new_price,
          image_url: product.image_url,
          cached: !!cachedResults[productName],
        }
      }
    })
    
    return json({
      success: true,
      data: formattedResults,
      summary: {
        total: uniqueNames.length,
        cached: Object.keys(cachedResults).length,
        new: Object.keys(newResults).length,
        formatted: Object.keys(formattedResults).length,
      },
    })
    
  } catch (err) {
    console.error('Portfolio data error:', err)
    return error(`Portfolio data failed: ${err.message}`, 500)
  }
}

async function handleBulkSearch(params: URLSearchParams, requestData: any) {
  const { productNames } = requestData
  
  if (!productNames || !Array.isArray(productNames) || productNames.length === 0) {
    return error('Product names array is required')
  }
  
  if (productNames.length > 50) {
    return error('Maximum 50 products can be searched at once')
  }
  
  try {
    const results: Record<string, any> = {}
    const errors: any[] = []
    const cachedResults: Record<string, any> = {}
    
    // First, check cache for all products
    for (const productName of productNames) {
      const cachedResponse = await getCachedResponse(productName)
      if (cachedResponse) {
        cachedResults[productName] = cachedResponse
      }
    }
    
    // Check rate limit for uncached items
    const uncachedItems = productNames.filter((name: string) => !cachedResults[name])
    if (uncachedItems.length > 0) {
      const withinRateLimit = await checkRateLimit()
      if (!withinRateLimit) {
        return error('Daily API rate limit exceeded. Please try again tomorrow.', 429)
      }
    }
    
    // Process uncached items in batches
    for (let i = 0; i < uncachedItems.length; i += BATCH_SIZE) {
      const batch = uncachedItems.slice(i, i + BATCH_SIZE)
      
      const batchPromises = batch.map(async (productName: string) => {
        try {
          const apiResponse = await searchProducts(productName)
          await cacheResponse(productName, apiResponse)
          return { productName, data: apiResponse, cached: false }
        } catch (error) {
          return { productName, error: error.message, cached: false }
        }
      })
      
      const batchResults = await Promise.all(batchPromises)
      
      batchResults.forEach(({ productName, data, error }) => {
        if (error) {
          errors.push({ productName, error })
        } else {
          results[productName] = data
        }
      })
      
      // Add delay between batches
      if (i + BATCH_SIZE < uncachedItems.length) {
        await new Promise(resolve => setTimeout(resolve, API_DELAY_MS))
      }
    }
    
    // Combine cached and new results
    const allResults = { ...cachedResults, ...results }
    
    return json({
      success: true,
      data: allResults,
      errors,
      summary: {
        total: productNames.length,
        cached: Object.keys(cachedResults).length,
        new: Object.keys(results).length,
        failed: errors.length,
      },
    })
    
  } catch (err) {
    console.error('Bulk search error:', err)
    return error(`Bulk search failed: ${err.message}`, 500)
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
      
      case 'bulk-search':
        return await handleBulkSearch(params, requestData)
      
      default:
        return error('Invalid action', 404)
    }
    
  } catch (err) {
    console.error('Price Charting API error:', err)
    return error(`Internal server error: ${err.message}`, 500)
  }
})
