// Background market data service for pre-loading portfolio data
import { supabase } from '../lib/supabaseClient.js';

// Global cache for background market data
const backgroundMarketDataCache = new Map();
const CACHE_DURATION = 24 * 60 * 60 * 1000; // 24 hours
const BATCH_SIZE = 5;
const BATCH_DELAY = 200;

// Track loading state
let isBackgroundLoading = false;
let backgroundLoadPromise = null;

// Get all unique product names from orders
async function getAllPortfolioProductNames() {
  try {
    const { data: orders, error } = await supabase
      .from("orders")
      .select("item")
      .eq("status", "ordered")
      .not("item", "is", null);
    
    if (error) throw error;
    
    const names = new Set();
    orders.forEach(order => {
      if (order.item) {
        // Add the full display name
        names.add(order.item);
        
        // Also add the base product name (before " - ")
        const baseProductName = order.item.split(' - ')[0];
        if (baseProductName !== order.item) {
          names.add(baseProductName);
        }
      }
    });
    
    return Array.from(names);
  } catch (error) {
    console.error('Error fetching portfolio product names:', error);
    return [];
  }
}

// Fetch market data for a single product
async function fetchProductMarketData(productName) {
  try {
    const response = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/price-charting/search?q=${encodeURIComponent(productName)}`, {
      headers: {
        'Authorization': `Bearer ${import.meta.env.VITE_SUPABASE_ANON_KEY}`,
        'Content-Type': 'application/json',
      }
    });
    
    if (!response.ok) {
      return null;
    }
    
    const data = await response.json();
    
    if (data.success && data.data) {
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
        return {
          product_id: product.id || product['product-id'] || product.product_id || '',
          product_name: product['product-name'] || product.product_name || product.name || product.title || 'Unknown Product',
          console_name: product['console-name'] || product.console_name || product.console || product.platform || '',
          loose_price: product['loose-price'] ? (parseFloat(product['loose-price']) / 100).toFixed(2) : '',
          cib_price: product['cib-price'] ? (parseFloat(product['cib-price']) / 100).toFixed(2) : '',
          new_price: product['new-price'] ? (parseFloat(product['new-price']) / 100).toFixed(2) : '',
          image_url: '', // PriceCharting API doesn't provide image URLs
        };
      }
    }
    
    return null;
  } catch (error) {
    console.error(`Error fetching market data for ${productName}:`, error);
    return null;
  }
}

// Background loading function
async function loadBackgroundMarketData() {
  if (isBackgroundLoading) {
    return backgroundLoadPromise;
  }
  
  isBackgroundLoading = true;
  console.log('🔄 Starting background market data loading...');
  
  backgroundLoadPromise = (async () => {
    try {
      const productNames = await getAllPortfolioProductNames();
      
      if (productNames.length === 0) {
        console.log('📭 No portfolio items found for background loading');
        return;
      }
      
      console.log(`🔄 Background loading market data for ${productNames.length} products...`);
      
      let foundCount = 0;
      let notFoundCount = 0;
      
      // Process products in parallel batches
      for (let i = 0; i < productNames.length; i += BATCH_SIZE) {
        const batch = productNames.slice(i, i + BATCH_SIZE);
        
        // Process batch in parallel
        const batchPromises = batch.map(async (productName) => {
          const marketData = await fetchProductMarketData(productName);
          return { productName, marketData };
        });
        
        // Wait for batch to complete
        const batchResults = await Promise.all(batchPromises);
        
        // Process batch results
        batchResults.forEach(({ productName, marketData }) => {
          if (marketData) {
            backgroundMarketDataCache.set(productName.toLowerCase().trim(), {
              data: marketData,
              timestamp: Date.now()
            });
            foundCount++;
          } else {
            notFoundCount++;
          }
        });
        
        // Small delay between batches
        if (i + BATCH_SIZE < productNames.length) {
          await new Promise(resolve => setTimeout(resolve, BATCH_DELAY));
        }
      }
      
      console.log(`✅ Background market data loading complete: ${foundCount} found, ${notFoundCount} not found`);
      
      // Store in localStorage for persistence across sessions
      const cacheData = Object.fromEntries(backgroundMarketDataCache);
      localStorage.setItem('backgroundMarketData', JSON.stringify({
        data: cacheData,
        timestamp: Date.now()
      }));
      
    } catch (error) {
      console.error('❌ Background market data loading failed:', error);
    } finally {
      isBackgroundLoading = false;
    }
  })();
  
  return backgroundLoadPromise;
}

// Initialize background loading
export function initializeBackgroundMarketData() {
  // Load from localStorage first
  try {
    const stored = localStorage.getItem('backgroundMarketData');
    if (stored) {
      const { data, timestamp } = JSON.parse(stored);
      const age = Date.now() - timestamp;
      const hoursOld = Math.floor(age / (1000 * 60 * 60));
      
      if (age < CACHE_DURATION) {
        // Restore cache from localStorage
        Object.entries(data).forEach(([key, value]) => {
          backgroundMarketDataCache.set(key, value);
        });
        console.log(`📦 Restored ${Object.keys(data).length} cached market data entries from localStorage (${hoursOld}h old)`);
        return;
      } else {
        console.log(`🕐 Background market data cache expired (${hoursOld}h old), will refresh`);
        // Clear expired cache
        localStorage.removeItem('backgroundMarketData');
      }
    } else {
      console.log('📭 No background market data found in localStorage');
    }
  } catch (error) {
    console.error('Error loading background market data from localStorage:', error);
  }
  
  // Start background loading after a short delay
  setTimeout(() => {
    loadBackgroundMarketData();
  }, 2000); // 2 second delay to let the app initialize
}

// Get market data from background cache
export function getBackgroundMarketData(productNames) {
  const results = {};
  
  productNames.forEach(name => {
    const cacheKey = name.toLowerCase().trim();
    const cached = backgroundMarketDataCache.get(cacheKey);
    
    if (cached && Date.now() - cached.timestamp < CACHE_DURATION) {
      results[name] = cached.data;
    }
  });
  
  return results;
}

// Check if background loading is complete
export function isBackgroundLoadingComplete() {
  return !isBackgroundLoading;
}

// Check if background data is available and ready
export function isBackgroundDataReady() {
  return backgroundMarketDataCache.size > 0;
}

// Get background cache stats
export function getBackgroundCacheStats() {
  return {
    size: backgroundMarketDataCache.size,
    isLoading: isBackgroundLoading,
    hasData: backgroundMarketDataCache.size > 0
  };
}

// Force refresh background data (for manual refresh)
export function refreshBackgroundMarketData() {
  backgroundMarketDataCache.clear();
  localStorage.removeItem('backgroundMarketData');
  return loadBackgroundMarketData();
}
