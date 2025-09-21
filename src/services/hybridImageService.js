// Hybrid image service that combines API data with reliable image sources
// This uses Card Market API first (for high-quality images), then falls back to PriceCharting API

import { getProductMarketData } from './marketDataService.js';

// Cache for in-memory image storage
const imageCache = new Map();
const CACHE_DURATION = 24 * 60 * 60 * 1000; // 24 hours in milliseconds

// Generate image URLs based on product data
function generateImageUrl(productName, productId, consoleName) {
  // Clean the product name for URL generation
  const cleanName = productName
    .toLowerCase()
    .replace(/[^\w\s-]/g, '')
    .replace(/\s+/g, '-')
    .substring(0, 50);
  
  // Try different image URL patterns based on product type
  const imageUrls = [];
  
  // Pattern 1: PriceCharting direct image URLs (if we have product ID)
  if (productId) {
    imageUrls.push(`https://storage.googleapis.com/images.pricecharting.com/${productId}/240.jpg`);
    imageUrls.push(`https://storage.googleapis.com/images.pricecharting.com/${productId}/480.jpg`);
    imageUrls.push(`https://images.pricecharting.com/images/${productId}/240.jpg`);
    imageUrls.push(`https://images.pricecharting.com/images/${productId}/480.jpg`);
  }
  
  // Pattern 2: Generic product images based on console/platform
  if (consoleName) {
    const consoleLower = consoleName.toLowerCase();
    if (consoleLower.includes('pokemon')) {
      imageUrls.push(`https://images.pricecharting.com/images/240/240.jpg`);
    } else if (consoleLower.includes('magic')) {
      imageUrls.push(`https://images.pricecharting.com/images/240/240.jpg`);
    } else if (consoleLower.includes('yugioh')) {
      imageUrls.push(`https://images.pricecharting.com/images/240/240.jpg`);
    }
  }
  
  // Pattern 3: Fallback to generic product image
  imageUrls.push(`https://images.pricecharting.com/images/240/240.jpg`);
  
  return imageUrls;
}

// Get images for a product using hybrid approach
export async function getProductImages(productName, consoleName = null, forceRefresh = false) {
  if (!productName) return [];
  
  // Clean the product name for better matching
  const cleanProductName = productName.trim();
  
  // Check in-memory cache first
  const cacheKey = `${cleanProductName}_${consoleName || ''}`;
  const cached = imageCache.get(cacheKey);
  
  if (!forceRefresh && cached && (Date.now() - cached.timestamp) < CACHE_DURATION) {
    console.log(`Using cached images for: ${cleanProductName}`);
    return cached.images;
  }
  
  try {
    console.log(`Getting images for: ${cleanProductName}`);
    
    // First, try Card Market API for high-quality images
    try {
      const marketDataResult = await getProductMarketData(cleanProductName);
      
      if (marketDataResult.success && marketDataResult.data.imageUrl) {
        const cardMarketImages = [marketDataResult.data.imageUrl];
        
        // Cache the result
        imageCache.set(cacheKey, {
          images: cardMarketImages,
          timestamp: Date.now()
        });
        
        console.log(`Found Card Market API image for: ${cleanProductName}`);
        return cardMarketImages;
      }
    } catch (error) {
      console.warn(`Card Market API failed for ${cleanProductName}, falling back to PriceCharting:`, error.message);
    }
    
    // Fallback to PriceCharting API
    const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
    const supabaseKey = import.meta.env.VITE_SUPABASE_ANON_KEY;
    
    const searchUrl = `${supabaseUrl}/functions/v1/price-charting/search?q=${encodeURIComponent(cleanProductName)}`;
    
    const response = await fetch(searchUrl, {
      headers: {
        'Authorization': `Bearer ${supabaseKey}`,
        'Content-Type': 'application/json',
      },
    });
    
    if (response.ok) {
      const data = await response.json();
      
      if (data.success && data.data) {
        let products = [];
        
        // Handle different possible response structures
        if (data.data.products && Array.isArray(data.data.products)) {
          products = data.data.products;
        } else if (Array.isArray(data.data)) {
          products = data.data;
        } else if (data.data.product) {
          products = [data.data.product];
        }
        
        // Find the best matching product
        const matchingProduct = products.find(product => {
          const productNameMatch = product['product-name']?.toLowerCase().includes(cleanProductName.toLowerCase()) ||
                                  product.product_name?.toLowerCase().includes(cleanProductName.toLowerCase());
          const consoleMatch = !consoleName || 
                              product['console-name']?.toLowerCase().includes(consoleName.toLowerCase()) ||
                              product.console_name?.toLowerCase().includes(consoleName.toLowerCase());
          return productNameMatch && consoleMatch;
        }) || products[0];
        
        if (matchingProduct) {
          const productId = matchingProduct.id || matchingProduct['product-id'] || matchingProduct.product_id;
          const actualProductName = matchingProduct['product-name'] || matchingProduct.product_name || cleanProductName;
          const actualConsoleName = matchingProduct['console-name'] || matchingProduct.console_name || consoleName;
          
          // Generate image URLs based on the product data
          const imageUrls = generateImageUrl(actualProductName, productId, actualConsoleName);
          
          // Cache the result
          imageCache.set(cacheKey, {
            images: imageUrls,
            timestamp: Date.now()
          });
          
          console.log(`Generated ${imageUrls.length} PriceCharting image URLs for: ${cleanProductName}`);
          console.log('Sample image URLs:', imageUrls.slice(0, 2));
          return imageUrls;
        }
      }
    }
    
    // Fallback: generate generic image URLs
    const fallbackUrls = generateImageUrl(cleanProductName, null, consoleName);
    
    // Cache the fallback result
    imageCache.set(cacheKey, {
      images: fallbackUrls,
      timestamp: Date.now()
    });
    
    console.log(`Using fallback images for: ${cleanProductName}`);
    return fallbackUrls;
    
  } catch (error) {
    console.error(`Error getting images for ${cleanProductName}:`, error);
    
    // Return fallback images even on error
    const fallbackUrls = generateImageUrl(cleanProductName, null, consoleName);
    return fallbackUrls;
  }
}

// Get images for multiple products in batch
export async function getBatchProductImages(products, forceRefresh = false) {
  const results = new Map();
  
  // Process in batches to avoid overwhelming the API
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
    
    // Add delay between batches
    if (i + batchSize < products.length) {
      await new Promise(resolve => setTimeout(resolve, 500));
    }
  }
  
  return results;
}

// Get images for search results (optimized for search dropdown)
export async function getSearchResultImages(searchResults, maxResults = 5) {
  const results = new Map();
  
  // Only fetch images for the top results
  const topResults = searchResults.slice(0, maxResults);
  
  for (const product of topResults) {
    const productName = product.product_name || product.name;
    const consoleName = product.console_name || product.console;
    
    if (productName) {
      try {
        const images = await getProductImages(productName, consoleName);
        results.set(`${productName}_${consoleName || ''}`, images);
      } catch (error) {
        console.error(`Error getting images for ${productName}:`, error);
        results.set(`${productName}_${consoleName || ''}`, []);
      }
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
