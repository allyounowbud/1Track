// Service for handling product image scraping and caching
import { supabase } from '../lib/supabaseClient.js';

// Cache for in-memory image storage
const imageCache = new Map();
const CACHE_DURATION = 24 * 60 * 60 * 1000; // 24 hours in milliseconds

// Get images for a product
export async function getProductImages(productName, consoleName = null, forceRefresh = false) {
  if (!productName) return [];
  
  // Check in-memory cache first
  const cacheKey = `${productName}_${consoleName || ''}`;
  const cached = imageCache.get(cacheKey);
  
  if (!forceRefresh && cached && (Date.now() - cached.timestamp) < CACHE_DURATION) {
    return cached.images;
  }
  
  try {
    // Call the image scraping edge function
    const response = await fetch(
      `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/price-charting-images?product=${encodeURIComponent(productName)}${consoleName ? `&console=${encodeURIComponent(consoleName)}` : ''}${forceRefresh ? '&refresh=true' : ''}`,
      {
        headers: {
          'Authorization': `Bearer ${import.meta.env.VITE_SUPABASE_ANON_KEY}`,
          'Content-Type': 'application/json',
        }
      }
    );
    
    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }
    
    const data = await response.json();
    
    if (data.success && data.data && data.data.image_urls) {
      const images = data.data.image_urls;
      
      // Cache the result
      imageCache.set(cacheKey, {
        images,
        timestamp: Date.now()
      });
      
      console.log(`Found ${images.length} real images for: ${productName}`);
      return images;
    }
    
    console.log(`No images found for: ${productName}`);
    return [];
  } catch (error) {
    console.error('Error fetching product images:', error);
    return [];
  }
}

// Get images for multiple products in batch
export async function getBatchProductImages(products, forceRefresh = false) {
  const results = new Map();
  
  // Process in batches to avoid overwhelming the server
  const batchSize = 5;
  for (let i = 0; i < products.length; i += batchSize) {
    const batch = products.slice(i, i + batchSize);
    
    const promises = batch.map(async (product) => {
      const productName = product['product-name'] || product.product_name || product.name;
      const consoleName = product['console-name'] || product.console_name || product.console;
      
      if (productName) {
        const images = await getProductImages(productName, consoleName, forceRefresh);
        results.set(productName, images);
      }
    });
    
    await Promise.all(promises);
    
    // Add delay between batches to be respectful to the server
    if (i + batchSize < products.length) {
      await new Promise(resolve => setTimeout(resolve, 1000));
    }
  }
  
  return results;
}

// Clear the in-memory cache
export function clearImageCache() {
  imageCache.clear();
}

// Get cache statistics
export function getCacheStats() {
  return {
    size: imageCache.size,
    entries: Array.from(imageCache.keys())
  };
}
