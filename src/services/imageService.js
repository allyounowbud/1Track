// Service for handling product image scraping and caching
import { supabase } from '../lib/supabaseClient.js';

// Cache for in-memory image storage
const imageCache = new Map();
const CACHE_DURATION = 24 * 60 * 60 * 1000; // 24 hours in milliseconds

// Get images for a product
export async function getProductImages(productName, consoleName = null, forceRefresh = false) {
  if (!productName) return [];
  
  // Clean the product name for better matching
  const cleanProductName = productName.trim();
  
  // Check in-memory cache first
  const cacheKey = `${cleanProductName}_${consoleName || ''}`;
  const cached = imageCache.get(cacheKey);
  
  if (!forceRefresh && cached && (Date.now() - cached.timestamp) < CACHE_DURATION) {
    return cached.images;
  }
  
  try {
    // Use the environment variables directly since they're working
    const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
    const supabaseKey = import.meta.env.VITE_SUPABASE_ANON_KEY;
    
    // Construct the URL
    const imageUrl = `${supabaseUrl}/functions/v1/price-charting-images?product=${encodeURIComponent(cleanProductName)}${consoleName ? `&console=${encodeURIComponent(consoleName)}` : ''}${forceRefresh ? '&refresh=true' : ''}`;
    console.log('Calling image service URL:', imageUrl);
    
    // Call the image scraping edge function
    const response = await fetch(imageUrl, {
      headers: {
        'Authorization': `Bearer ${supabaseKey}`,
        'Content-Type': 'application/json',
      }
    });
    
    if (!response.ok) {
      console.error(`Image service HTTP error! status: ${response.status}`);
      const errorText = await response.text();
      console.error('Error response:', errorText);
      throw new Error(`HTTP error! status: ${response.status}`);
    }
    
    const data = await response.json();
    console.log('Image service response data:', data);
    
    if (data.success && data.data && data.data.image_urls) {
      const images = data.data.image_urls;
      
      // Cache the result
      imageCache.set(cacheKey, {
        images,
        timestamp: Date.now()
      });
      
      console.log(`Found ${images.length} real images for: ${cleanProductName}`);
      return images;
    }
    
    console.log(`No images found for: ${cleanProductName}`);
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

// Get images for search results (optimized for search dropdown)
export async function getSearchResultImages(searchResults, maxResults = 5) {
  const results = new Map();
  
  // Only fetch images for the top results to avoid overwhelming the server
  const topResults = searchResults.slice(0, maxResults);
  
  const promises = topResults.map(async (product) => {
    const productName = product.product_name || product.name;
    const consoleName = product.console_name || product.console;
    
    if (productName) {
      try {
        const images = await getProductImages(productName, consoleName);
        results.set(`${productName}_${consoleName || ''}`, images);
      } catch (error) {
        console.error(`Error fetching images for ${productName}:`, error);
        results.set(`${productName}_${consoleName || ''}`, []);
      }
    }
  });
  
  await Promise.all(promises);
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
