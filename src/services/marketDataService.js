// Centralized service for market data fetching and caching
import { supabase } from '../lib/supabaseClient.js';

// Cache for market data to avoid repeated API calls
const marketDataCache = new Map();
const CACHE_DURATION = 5 * 60 * 1000; // 5 minutes

// Get market data for a single product
export async function getProductMarketData(productName) {
  if (!productName) return null;
  
  // Check cache first
  const cacheKey = productName.toLowerCase().trim();
  const cached = marketDataCache.get(cacheKey);
  if (cached && Date.now() - cached.timestamp < CACHE_DURATION) {
    return cached.data;
  }
  
  try {
    const response = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/price-charting/search?q=${encodeURIComponent(productName)}`, {
      headers: {
        'Authorization': `Bearer ${import.meta.env.VITE_SUPABASE_ANON_KEY}`,
        'Content-Type': 'application/json',
      },
    });
    
    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }
    
    const data = await response.json();
    
    if (data.success && data.data) {
      // Handle different possible response structures
      let products = [];
      
      if (data.data.products && Array.isArray(data.data.products)) {
        products = data.data.products;
      } else if (Array.isArray(data.data)) {
        products = data.data;
      } else if (data.data.product) {
        products = [data.data.product];
      }
      
      if (products.length > 0) {
        const product = products[0];
        const marketData = {
          product_id: product.id || product['product-id'] || product.product_id || '',
          product_name: product['product-name'] || product.product_name || product.name || product.title || 'Unknown Product',
          console_name: product['console-name'] || product.console_name || product.console || product.platform || '',
          loose_price: product['loose-price'] ? (parseFloat(product['loose-price']) / 100).toFixed(2) : '',
          cib_price: product['cib-price'] ? (parseFloat(product['cib-price']) / 100).toFixed(2) : '',
          new_price: product['new-price'] ? (parseFloat(product['new-price']) / 100).toFixed(2) : '',
          image_url: product['image-url'] || product.image_url || product.image || product.thumbnail || '',
        };
        
        // Cache the result
        marketDataCache.set(cacheKey, {
          data: marketData,
          timestamp: Date.now()
        });
        
        return marketData;
      }
    }
    
    return null;
  } catch (error) {
    console.error('Error fetching market data for', productName, ':', error);
    return null;
  }
}

// Get market data for multiple products in batch
export async function getBatchMarketData(productNames) {
  if (!productNames || productNames.length === 0) return {};
  
  const results = {};
  const uncachedNames = [];
  
  // Check cache for each product
  productNames.forEach(name => {
    const cacheKey = name.toLowerCase().trim();
    const cached = marketDataCache.get(cacheKey);
    if (cached && Date.now() - cached.timestamp < CACHE_DURATION) {
      results[name] = cached.data;
    } else {
      uncachedNames.push(name);
    }
  });
  
  // Fetch uncached products
  if (uncachedNames.length > 0) {
    try {
      console.log(`Fetching market data for ${uncachedNames.length} uncached products:`, uncachedNames);
      
      // Use search endpoint for each product since portfolio-data endpoint has issues
      console.log(`Fetching market data for ${uncachedNames.length} products using search endpoint...`);
      
      let foundCount = 0;
      let notFoundCount = 0;
      
      // Process each product individually using the search endpoint
      for (const productName of uncachedNames) {
        try {
          console.log(`Searching for: ${productName}`);
          
          const response = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/price-charting/search?q=${encodeURIComponent(productName)}`, {
            headers: {
              'Authorization': `Bearer ${import.meta.env.VITE_SUPABASE_ANON_KEY}`,
              'Content-Type': 'application/json',
            }
          });
          
          if (!response.ok) {
            console.error(`HTTP error for ${productName}: ${response.status}`);
            notFoundCount++;
            continue;
          }
          
          const data = await response.json();
          
          if (data.success && data.data) {
            // Handle search endpoint response format
            let products = [];
            
            if (data.data.products && Array.isArray(data.data.products)) {
              products = data.data.products;
            } else if (Array.isArray(data.data)) {
              products = data.data;
            } else if (data.data.product) {
              products = [data.data.product];
            }
            
            if (products.length > 0) {
              const product = products[0];
              const formattedData = {
                product_id: product.id || product['product-id'] || product.product_id || '',
                product_name: product['product-name'] || product.product_name || product.name || product.title || 'Unknown Product',
                console_name: product['console-name'] || product.console_name || product.console || product.platform || '',
                loose_price: product['loose-price'] ? (parseFloat(product['loose-price']) / 100).toFixed(2) : '',
                cib_price: product['cib-price'] ? (parseFloat(product['cib-price']) / 100).toFixed(2) : '',
                new_price: product['new-price'] ? (parseFloat(product['new-price']) / 100).toFixed(2) : '',
                image_url: product['image-url'] || product.image_url || product.image || product.thumbnail || '',
              };
              
              results[productName] = formattedData;
              foundCount++;
              
              // Cache the result
              const cacheKey = productName.toLowerCase().trim();
              marketDataCache.set(cacheKey, {
                data: formattedData,
                timestamp: Date.now()
              });
              
              console.log(`✅ Market data found for: ${productName}`);
            } else {
              console.log(`❌ No products found for: ${productName}`);
              notFoundCount++;
            }
          } else {
            console.log(`❌ No data returned for: ${productName}`);
            notFoundCount++;
          }
          
          // Small delay to respect rate limits
          await new Promise(resolve => setTimeout(resolve, 100));
          
        } catch (error) {
          console.error(`Error fetching data for ${productName}:`, error);
          notFoundCount++;
        }
      }
      
      console.log(`Market data fetch complete: ${foundCount} found, ${notFoundCount} not found`);
      
      // Log products that weren't found for debugging
      if (notFoundCount > 0) {
        const notFoundProducts = uncachedNames.filter(name => !results[name]);
        console.log('Products without market data:', notFoundProducts);
      }
    } catch (error) {
      console.error('Error fetching batch market data:', error);
    }
  }
  
  return results;
}

// Get market value in cents for a product (for calculations)
export function getMarketValueInCents(marketData) {
  if (!marketData) return 0;
  
  // Try loose_price first, then cib_price, then new_price
  const price = marketData.loose_price || marketData.cib_price || marketData.new_price;
  if (price) {
    return Math.round(parseFloat(price) * 100);
  }
  
  return 0;
}

// Get market value as formatted string
export function getMarketValueFormatted(marketData) {
  if (!marketData) return 'N/A';
  
  const price = marketData.loose_price || marketData.cib_price || marketData.new_price;
  return price ? `$${price}` : 'N/A';
}

// Clear cache (useful for testing or when you want fresh data)
export function clearMarketDataCache() {
  marketDataCache.clear();
}

// Get cache stats
export function getCacheStats() {
  return {
    size: marketDataCache.size,
    entries: Array.from(marketDataCache.keys())
  };
}
