import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
}

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

// Clean product name for URL search
function cleanProductNameForUrl(name: string): string {
  return name
    .trim()
    .toLowerCase()
    .replace(/[^\w\s-]/g, '') // Remove special characters except spaces and hyphens
    .replace(/\s+/g, '+') // Replace spaces with + for URL
    .substring(0, 100) // Limit length
}

// Scrape images from PriceCharting search results
async function scrapeProductImages(productName: string, consoleName?: string): Promise<string[]> {
  try {
    // Construct search URL
    const searchQuery = cleanProductNameForUrl(productName)
    const searchUrl = `https://www.pricecharting.com/search?q=${encodeURIComponent(searchQuery)}`
    
    console.log(`Scraping images for: ${productName} from ${searchUrl}`)
    
    // Fetch the search page
    const response = await fetch(searchUrl, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
        'Accept-Language': 'en-US,en;q=0.5',
        'Accept-Encoding': 'gzip, deflate, br',
        'Connection': 'keep-alive',
        'Upgrade-Insecure-Requests': '1',
      }
    })
    
    if (!response.ok) {
      throw new Error(`Failed to fetch search page: ${response.status}`)
    }
    
    const html = await response.text()
    
    // Parse HTML to extract image URLs
    const imageUrls: string[] = []
    
    // Look for product images in various possible selectors
    const imageSelectors = [
      // Common PriceCharting selectors
      'img[src*="pricecharting.com"]',
      'img[src*="/images/"]',
      '.product-image img',
      '.item-image img',
      '.search-result img',
      '.product img',
      'img[alt*="' + productName.toLowerCase() + '"]'
    ]
    
    // Use regex to find image URLs in the HTML
    const imageRegex = /<img[^>]+src=["']([^"']*pricecharting\.com[^"']*\.(?:jpg|jpeg|png|gif|webp))["'][^>]*>/gi
    let match
    
    while ((match = imageRegex.exec(html)) !== null) {
      const imageUrl = match[1]
      if (imageUrl && !imageUrls.includes(imageUrl)) {
        // Ensure it's a full URL
        const fullUrl = imageUrl.startsWith('http') ? imageUrl : `https://www.pricecharting.com${imageUrl}`
        imageUrls.push(fullUrl)
      }
    }
    
    // Also look for data attributes that might contain image URLs
    const dataImageRegex = /data-[^=]*image[^=]*=["']([^"']*\.(?:jpg|jpeg|png|gif|webp))["']/gi
    while ((match = dataImageRegex.exec(html)) !== null) {
      const imageUrl = match[1]
      if (imageUrl && !imageUrls.includes(imageUrl)) {
        const fullUrl = imageUrl.startsWith('http') ? imageUrl : `https://www.pricecharting.com${imageUrl}`
        imageUrls.push(fullUrl)
      }
    }
    
    // Filter and prioritize images
    const filteredImages = imageUrls
      .filter(url => {
        // Filter out common non-product images
        const lowerUrl = url.toLowerCase()
        return !lowerUrl.includes('logo') && 
               !lowerUrl.includes('icon') && 
               !lowerUrl.includes('banner') &&
               !lowerUrl.includes('placeholder') &&
               !lowerUrl.includes('no-image')
      })
      .slice(0, 5) // Limit to 5 images max
    
    console.log(`Found ${filteredImages.length} images for ${productName}`)
    return filteredImages
    
  } catch (error) {
    console.error(`Error scraping images for ${productName}:`, error)
    return []
  }
}

// Cache image URLs in database
async function cacheImageUrls(productName: string, imageUrls: string[]): Promise<void> {
  try {
    const { error } = await supabase
      .from('product_images')
      .upsert({
        product_name: productName,
        image_urls: imageUrls,
        scraped_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      })
    
    if (error) {
      console.error('Error caching image URLs:', error)
    }
  } catch (error) {
    console.error('Error caching image URLs:', error)
  }
}

// Get cached image URLs
async function getCachedImageUrls(productName: string): Promise<string[]> {
  try {
    const { data, error } = await supabase
      .from('product_images')
      .select('image_urls, scraped_at')
      .eq('product_name', productName)
      .single()
    
    if (error || !data) {
      return []
    }
    
    // Check if cache is still valid (24 hours)
    const scrapedAt = new Date(data.scraped_at)
    const now = new Date()
    const hoursDiff = (now.getTime() - scrapedAt.getTime()) / (1000 * 60 * 60)
    
    if (hoursDiff < 24 && data.image_urls && data.image_urls.length > 0) {
      return data.image_urls
    }
    
    return []
  } catch (error) {
    console.error('Error getting cached image URLs:', error)
    return []
  }
}

// Main handler
serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response(null, { status: 200, headers: corsHeaders })
  }
  
  try {
    const url = new URL(req.url)
    const productName = url.searchParams.get('product')
    const consoleName = url.searchParams.get('console')
    const forceRefresh = url.searchParams.get('refresh') === 'true'
    
    if (!productName) {
      return error('Product name is required', 400)
    }
    
    // Check cache first (unless force refresh)
    if (!forceRefresh) {
      const cachedImages = await getCachedImageUrls(productName)
      if (cachedImages.length > 0) {
        return json({
          success: true,
          data: {
            product_name: productName,
            image_urls: cachedImages,
            cached: true
          }
        })
      }
    }
    
    // Scrape images from PriceCharting
    const imageUrls = await scrapeProductImages(productName, consoleName || undefined)
    
    // Cache the results
    if (imageUrls.length > 0) {
      await cacheImageUrls(productName, imageUrls)
    }
    
    return json({
      success: true,
      data: {
        product_name: productName,
        image_urls: imageUrls,
        cached: false
      }
    })
    
  } catch (error) {
    console.error('Error in image scraper:', error)
    return error('Internal server error', 500)
  }
})
