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
    
    console.log(`HTML length: ${html.length} characters`)
    
    // Multiple regex patterns to catch different image formats
    const imagePatterns = [
      // PriceCharting specific image URLs (priority) - various formats
      /(https?:\/\/storage\.googleapis\.com\/images\.pricecharting\.com\/[^"'\s]*\/240\.jpg)/gi,
      /(https?:\/\/storage\.googleapis\.com\/images\.pricecharting\.com\/[^"'\s]*\/[0-9]+\.jpg)/gi,
      // Relative PriceCharting image paths
      /(\/images\/[^"'\s]*\/240\.jpg)/gi,
      /(\/images\/[^"'\s]*\/[0-9]+\.jpg)/gi,
      // Standard img tags with src
      /<img[^>]+src=["']([^"']*\.(?:jpg|jpeg|png|gif|webp))["'][^>]*>/gi,
      // Data attributes
      /data-[^=]*image[^=]*=["']([^"']*\.(?:jpg|jpeg|png|gif|webp))["']/gi,
      // Background images in style attributes
      /background-image:\s*url\(["']?([^"')]*\.(?:jpg|jpeg|png|gif|webp))["']?\)/gi,
      // Any URL containing image file extensions
      /(https?:\/\/[^"'\s]*\.(?:jpg|jpeg|png|gif|webp))/gi
    ]
    
    // Extract images using all patterns
    for (const pattern of imagePatterns) {
      let match
      while ((match = pattern.exec(html)) !== null) {
        const imageUrl = match[1]
        if (imageUrl && !imageUrls.includes(imageUrl)) {
          // Ensure it's a full URL
          let fullUrl = imageUrl
          if (!imageUrl.startsWith('http')) {
            // Handle PriceCharting image paths specifically
            if (imageUrl.startsWith('/images/')) {
              fullUrl = `https://storage.googleapis.com/images.pricecharting.com${imageUrl.replace('/images/', '')}`
            } else {
              fullUrl = imageUrl.startsWith('/') 
                ? `https://www.pricecharting.com${imageUrl}`
                : `https://www.pricecharting.com/${imageUrl}`
            }
          }
          imageUrls.push(fullUrl)
        }
      }
    }
    
    console.log(`Found ${imageUrls.length} total image URLs before filtering`)
    
    // Filter and prioritize images
    const priceChartingImages = imageUrls.filter(url => 
      url.includes('storage.googleapis.com/images.pricecharting.com') ||
      url.includes('images.pricecharting.com')
    )
    
    const otherImages = imageUrls
      .filter(url => {
        // Filter out common non-product images
        const lowerUrl = url.toLowerCase()
        return !lowerUrl.includes('storage.googleapis.com/images.pricecharting.com') &&
               !lowerUrl.includes('images.pricecharting.com') &&
               !lowerUrl.includes('logo') && 
               !lowerUrl.includes('icon') && 
               !lowerUrl.includes('banner') &&
               !lowerUrl.includes('placeholder') &&
               !lowerUrl.includes('no-image') &&
               !lowerUrl.includes('spacer') &&
               !lowerUrl.includes('pixel') &&
               // Keep images that might be product images
               (lowerUrl.includes('product') || 
                lowerUrl.includes('item') || 
                lowerUrl.includes('card') ||
                lowerUrl.includes('game') ||
                lowerUrl.includes('pokemon') ||
                lowerUrl.includes('magic') ||
                lowerUrl.includes('yugioh') ||
                lowerUrl.includes('sports') ||
                lowerUrl.includes('video') ||
                lowerUrl.includes('sealed') ||
                lowerUrl.includes('singles') ||
                // Or just any image that's not obviously a UI element
                (!lowerUrl.includes('ui') && !lowerUrl.includes('button') && !lowerUrl.includes('arrow')))
      })
    
    // Prioritize PriceCharting images first, then other images
    const filteredImages = [...priceChartingImages, ...otherImages].slice(0, 5)
    
    console.log(`Found ${priceChartingImages.length} PriceCharting images and ${otherImages.length} other images for ${productName}`)
    console.log(`Total filtered images: ${filteredImages.length}`)
    if (filteredImages.length > 0) {
      console.log('Sample image URLs:', filteredImages.slice(0, 2))
      if (priceChartingImages.length > 0) {
        console.log('PriceCharting images found:', priceChartingImages.slice(0, 2))
      }
    } else {
      console.log('No images found. Sample raw URLs:', imageUrls.slice(0, 5))
    }
    return filteredImages
    
  } catch (error) {
    console.error(`Error scraping images for ${productName}:`, error)
    return []
  }
}

// Cache image URLs in database
async function cacheImageUrls(productName: string, consoleName: string, imageUrls: string[]): Promise<void> {
  try {
    const { error } = await supabase
      .from('product_images')
      .upsert({
        product_name: productName,
        console_name: consoleName || '',
        image_urls: imageUrls,
        last_scraped: new Date().toISOString(),
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
async function getCachedImageUrls(productName: string, consoleName: string): Promise<string[]> {
  try {
    const { data, error } = await supabase
      .from('product_images')
      .select('image_urls, last_scraped')
      .eq('product_name', productName)
      .eq('console_name', consoleName || '')
      .single()
    
    if (error || !data) {
      return []
    }
    
    // Check if cache is still valid (24 hours)
    const scrapedAt = new Date(data.last_scraped)
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
      const cachedImages = await getCachedImageUrls(productName, consoleName || '')
      if (cachedImages.length > 0) {
        return json({
          success: true,
          data: {
            product_name: productName,
            console_name: consoleName,
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
      await cacheImageUrls(productName, consoleName || '', imageUrls)
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
