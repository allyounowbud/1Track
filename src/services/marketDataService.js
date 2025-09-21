import { supabase } from '../lib/supabaseClient.js';

// Market data service supporting both PriceCharting API and Card Market API via RapidAPI
class MarketDataService {
  constructor() {
    // API configurations
    this.priceChartingApiKey = import.meta.env.VITE_PRICECHARTING_API_KEY;
    this.rapidApiKey = import.meta.env.VITE_RAPIDAPI_KEY;
    
    // Debug environment variables
    console.log('🔧 MarketDataService constructor:');
    console.log('🔑 VITE_RAPIDAPI_KEY:', this.rapidApiKey ? `${this.rapidApiKey.substring(0, 10)}...` : 'NOT FOUND');
    console.log('🔑 VITE_PRICECHARTING_API_KEY:', this.priceChartingApiKey ? `${this.priceChartingApiKey.substring(0, 10)}...` : 'NOT FOUND');
    console.log('🌐 All env vars:', import.meta.env);
    
    // API endpoints
    this.priceChartingBaseUrl = "https://www.pricecharting.com/api";
    this.cardMarketBaseUrl = "https://cardmarket-api-tcg.p.rapidapi.com";
    
    // Cache for API responses
    this.cache = new Map();
    this.cacheTimeout = 6 * 60 * 60 * 1000; // 6 hours (more frequent updates with upgraded plan)
    
    // API preference: 'cardmarket' (with images) or 'pricecharting' (fallback)
    this.preferredApi = this.rapidApiKey ? 'cardmarket' : 'pricecharting';
    
    // Load persistent cache from localStorage
    this.loadPersistentCache();
    
    console.log('🎯 Preferred API:', this.preferredApi);
  }

  // Check if API keys are available
  getApiStatus() {
    return {
      priceCharting: !!this.priceChartingApiKey,
      cardMarket: !!this.rapidApiKey,
      preferred: this.preferredApi
    };
  }

  // Clear cache for debugging
  clearCache() {
    this.cache.clear();
    localStorage.removeItem('marketDataCache');
    console.log('🗑️ Cache cleared');
  }

  // Force refresh cached data with proper formatting
  async refreshCachedData(searchTerm) {
    const cacheKey = this.getCacheKey('cardmarket', 'search_products', { searchTerm, limit: 20 });
    this.cache.delete(cacheKey);
    console.log(`🔄 Cleared cache for: "${searchTerm}"`);
  }

  // Load persistent cache from localStorage
  loadPersistentCache() {
    try {
      const stored = localStorage.getItem('marketDataCache');
      if (stored) {
        const { data, timestamp } = JSON.parse(stored);
        const age = Date.now() - timestamp;
        
        if (age < this.cacheTimeout) {
          // Restore cache from localStorage
          Object.entries(data).forEach(([key, value]) => {
            this.cache.set(key, value);
          });
          console.log(`📦 Restored ${Object.keys(data).length} cached market data entries from localStorage`);
        } else {
          console.log('🕐 Market data cache expired, clearing localStorage');
          localStorage.removeItem('marketDataCache');
        }
      }
    } catch (error) {
      console.error('Error loading market data cache from localStorage:', error);
    }
  }

  // Save cache to localStorage
  savePersistentCache() {
    try {
      const cacheData = Object.fromEntries(this.cache);
      localStorage.setItem('marketDataCache', JSON.stringify({
        data: cacheData,
        timestamp: Date.now()
      }));
    } catch (error) {
      console.error('Error saving market data cache to localStorage:', error);
    }
  }

  // Track API usage for quota management
  trackApiUsage() {
    try {
      const today = new Date().toDateString();
      const usage = JSON.parse(localStorage.getItem('apiUsage') || '{}');
      
      if (!usage[today]) {
        usage[today] = 0;
      }
      
      usage[today]++;
      
      // Keep only last 7 days of usage data
      const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toDateString();
      Object.keys(usage).forEach(date => {
        if (date < sevenDaysAgo) {
          delete usage[date];
        }
      });
      
      localStorage.setItem('apiUsage', JSON.stringify(usage));
      
      console.log(`📊 API Usage Today: ${usage[today]} calls`);
      return usage[today];
    } catch (error) {
      console.error('Error tracking API usage:', error);
      return 0;
    }
  }

  // Get current API usage
  getApiUsage() {
    try {
      const today = new Date().toDateString();
      const usage = JSON.parse(localStorage.getItem('apiUsage') || '{}');
      return {
        today: usage[today] || 0,
        total: Object.values(usage).reduce((sum, count) => sum + count, 0)
      };
    } catch (error) {
      return { today: 0, total: 0 };
    }
  }

  // Get user's update day (staggered updates to spread API calls)
  getUserUpdateDay() {
    try {
      let userUpdateDay = localStorage.getItem('userUpdateDay');
      if (!userUpdateDay) {
        // Assign user to a random day of the week (0-6)
        userUpdateDay = Math.floor(Math.random() * 7).toString();
        localStorage.setItem('userUpdateDay', userUpdateDay);
      }
      return parseInt(userUpdateDay);
    } catch (error) {
      return 0; // Default to Sunday
    }
  }

  // Check if user should update today (staggered system)
  shouldUpdateToday() {
    const today = new Date().getDay(); // 0 = Sunday, 1 = Monday, etc.
    const userUpdateDay = this.getUserUpdateDay();
    return today === userUpdateDay;
  }

  // Test the Card Market API with a simple search
  async testCardMarketAPI() {
    if (!this.rapidApiKey) {
      throw new Error('Card Market API key not configured');
    }

    console.log('🧪 Testing Card Market API...');
    console.log('🔑 API Key:', this.rapidApiKey.substring(0, 10) + '...');
    console.log('🌐 Base URL:', this.cardMarketBaseUrl);
    
    // Test multiple endpoints to see which one works
    const testEndpoints = [
      {
        name: 'Pokemon Cards Search',
        url: `${this.cardMarketBaseUrl}/pokemon/cards?search=charizard&sort=price_lowest`,
        headers: {
          'X-RapidAPI-Key': this.rapidApiKey,
          'X-RapidAPI-Host': 'cardmarket-api-tcg.p.rapidapi.com'
        }
      },
      {
        name: 'Pokemon Cards (no sort)',
        url: `${this.cardMarketBaseUrl}/pokemon/cards?search=charizard`,
      headers: {
          'X-RapidAPI-Key': this.rapidApiKey,
          'X-RapidAPI-Host': 'cardmarket-api-tcg.p.rapidapi.com'
        }
      },
      {
        name: 'Pokemon Cards (minimal)',
        url: `${this.cardMarketBaseUrl}/pokemon/cards`,
        headers: {
          'X-RapidAPI-Key': this.rapidApiKey,
          'X-RapidAPI-Host': 'cardmarket-api-tcg.p.rapidapi.com'
        }
      }
    ];

    for (const endpoint of testEndpoints) {
      try {
        console.log(`\n🧪 Testing ${endpoint.name}...`);
        console.log(`🌐 URL: ${endpoint.url}`);
        
        const response = await fetch(endpoint.url, {
          method: 'GET',
          headers: endpoint.headers
        });

        console.log(`📡 Response: ${response.status} ${response.statusText}`);
        
        if (response.ok) {
          const data = await response.json();
          console.log(`✅ ${endpoint.name} successful!`);
          console.log('📄 Response data:', data);
          console.log('📊 Response keys:', Object.keys(data));
          
          // Check for the correct data structure
          const cards = data.data || data.cards || [];
          if (Array.isArray(cards)) {
            console.log(`🎯 Found ${cards.length} cards`);
            if (cards.length > 0) {
              console.log('🎴 First card:', cards[0]);
            }
          } else {
            console.log('📊 Response structure:', Object.keys(data));
            console.log('📄 Full response:', data);
          }
          
          return { success: true, data, endpoint: endpoint.name };
        } else {
          const errorText = await response.text();
          console.error(`❌ ${endpoint.name} failed:`, response.status, errorText);
        }
      } catch (error) {
        console.error(`❌ ${endpoint.name} error:`, error.message);
      }
    }

    return { success: false, error: 'All endpoints failed' };
  }

  // Cache management
  getCacheKey(api, endpoint, params) {
    return `${api}:${endpoint}:${JSON.stringify(params)}`;
  }

  getFromCache(key) {
    const cached = this.cache.get(key);
    if (cached && Date.now() - cached.timestamp < this.cacheTimeout) {
      return cached.data;
    }
    this.cache.delete(key);
    return null;
  }

  setCache(key, data) {
    this.cache.set(key, {
      data,
      timestamp: Date.now()
    });
    // Save to localStorage for persistence
    this.savePersistentCache();
  }

  // Card Market API functions
  // New dedicated search function for multiple results
  async searchCardMarketCards(searchTerm, limit = 20) {
    if (!this.rapidApiKey) {
      throw new Error('Card Market API key not configured');
    }

    const cacheKey = this.getCacheKey('cardmarket', 'search_cards', { searchTerm, limit });
    const cached = this.getFromCache(cacheKey);
    if (cached) return cached;

    try {
      console.log(`🔍 Searching Card Market API for: "${searchTerm}"`);
      
      // Use the proper search endpoint for cards with pagination
      const allCards = [];
      let totalResults = 0;
      let currentPage = 1;
      const pageSize = 20; // API seems to return 20 per page
      
      // Optimized pagination - limit to 3 pages max to avoid API spam
      const maxPages = 3;
      while (allCards.length < limit && currentPage <= maxPages) {
        const url = `${this.cardMarketBaseUrl}/pokemon/cards?search=${encodeURIComponent(searchTerm)}&sort=price_lowest&limit=${pageSize}&page=${currentPage}`;
        console.log(`🌐 Making API call to: ${url}`);
        
        const response = await fetch(url, {
          method: 'GET',
          headers: {
            'X-RapidAPI-Key': this.rapidApiKey,
            'X-RapidAPI-Host': 'cardmarket-api-tcg.p.rapidapi.com'
          }
        });
        
        console.log(`📡 API Response status: ${response.status} ${response.statusText}`);
      
      if (!response.ok) {
          throw new Error(`Card Market API error: ${response.status} ${response.statusText}`);
      }
      
      const data = await response.json();
        console.log(`📄 API Response data (page ${currentPage}):`, data);

        // The API returns data in structure: { data: [...], paging: {...}, results: number }
        const cards = data.data || data.cards || [];
        totalResults = data.results || totalResults;
        
        console.log(`📄 Page ${currentPage}: Found ${cards.length} results`);
        console.log(`📊 Total results available: ${totalResults}`);
        
        if (cards.length === 0) {
          console.log(`📄 No more results on page ${currentPage}, stopping pagination`);
          break;
        }
        
        allCards.push(...cards);
        currentPage++;
        
        // Stop if we have enough results for the requested limit
        if (allCards.length >= limit) {
          console.log(`📄 Reached requested limit (${limit}), stopping pagination`);
          break;
        }
      }
      
      console.log(`✅ Total collected: ${allCards.length} results for "${searchTerm}"`);
      console.log(`📊 Total available: ${totalResults}`);
      
      // Format the results for display
      const formattedResults = allCards
        .slice(0, limit) // Limit to requested amount
        .map(card => this.formatCardResult(card))
        .filter(card => card !== null); // Remove any null results
      
      console.log(`🎯 Final formatted results: ${formattedResults.length} cards`);
      
      const result = {
        cards: formattedResults,
        totalResults: totalResults,
        searchTerm: searchTerm
      };

      this.setCache(cacheKey, result);
      return result;

    } catch (error) {
      console.error(`❌ Card Market API search failed for "${searchTerm}":`, error);
      throw error;
    }
  }

  // Search for products (sealed products, boxes, etc.)
  async searchCardMarketProducts(searchTerm, limit = 20) {
    if (!this.rapidApiKey) {
      throw new Error('Card Market API key not configured');
    }

    const cacheKey = this.getCacheKey('cardmarket', 'search_products', { searchTerm, limit });
    const cached = this.getFromCache(cacheKey);
    if (cached) return cached;

    try {
      console.log(`🔍 Searching Card Market API products for: "${searchTerm}" (limit: ${limit})`);
      
      const allProducts = [];
      let totalResults = 0;
      let currentPage = 1;
      const pageSize = 20; // API seems to return 20 per page
      
      // Optimized pagination - limit to 3 pages max to avoid API spam
      const maxPages = 3;
      while (allProducts.length < limit && currentPage <= maxPages) {
        const url = `${this.cardMarketBaseUrl}/pokemon/products?search=${encodeURIComponent(searchTerm)}&sort=price_lowest&limit=${pageSize}&page=${currentPage}`;
        console.log(`🌐 Making API call to: ${url}`);
        
        const response = await fetch(url, {
          method: 'GET',
      headers: {
            'X-RapidAPI-Key': this.rapidApiKey,
            'X-RapidAPI-Host': 'cardmarket-api-tcg.p.rapidapi.com'
          }
    });
    
    if (!response.ok) {
          throw new Error(`Card Market API error: ${response.status} ${response.statusText}`);
    }
    
    const data = await response.json();
        console.log(`📄 API Response data (page ${currentPage}):`, data);

        const products = data.data || data.products || [];
        totalResults = data.results || totalResults;
        
        console.log(`📄 Page ${currentPage}: Found ${products.length} results`);
        console.log(`📊 Total results available: ${totalResults}`);
        
        if (products.length === 0) {
          console.log(`📄 No more results on page ${currentPage}, stopping pagination`);
          break;
        }
        
        allProducts.push(...products);
        currentPage++;
        
        // Stop if we have enough results for the requested limit
        if (allProducts.length >= limit) {
          console.log(`📄 Reached requested limit (${limit}), stopping pagination`);
          break;
        }
      }
      
      console.log(`✅ Total collected: ${allProducts.length} results for "${searchTerm}"`);
      console.log(`📊 Total available: ${totalResults}`);
      
      // Format the results for display
      const formattedResults = allProducts
        .slice(0, limit) // Limit to requested amount
        .map(product => this.formatProductResult(product))
        .filter(product => product !== null); // Remove any null results
      
      console.log(`🎯 Final formatted results: ${formattedResults.length} products`);
      
      const result = {
        cards: formattedResults,
        totalResults: totalResults,
        searchTerm: searchTerm
      };

      this.setCache(cacheKey, result);
      return result;

    } catch (error) {
      console.error(`❌ Card Market API products search failed for "${searchTerm}":`, error);
      throw error;
    }
  }

  // Combined search function that tries both cards and products with multiple search strategies
  async searchCardMarketAll(searchTerm, limit = 20) {
    const allResults = [];
    let totalAvailableResults = 0;
    
    // Use only the most effective search variations to minimize API calls
    const searchVariations = [
      searchTerm, // Original search term
      searchTerm.toLowerCase(), // Lowercase version
    ].filter((term, index, self) => self.indexOf(term) === index);
    
    console.log(`🔍 Trying ${searchVariations.length} optimized search variations:`, searchVariations);
    
    // Use higher limits but fewer API calls
    const effectiveLimit = Math.min(limit, 100); // Reasonable limit to avoid API spam
    
    for (const searchVariation of searchVariations) {
      try {
        // Try cards with higher limit
        const cardResults = await this.searchCardMarketCards(searchVariation, effectiveLimit);
        if (cardResults.cards && cardResults.cards.length > 0) {
          allResults.push(...cardResults.cards);
          totalAvailableResults = Math.max(totalAvailableResults, cardResults.totalResults || 0);
          console.log(`🎯 Cards (${searchVariation}): Found ${cardResults.cards.length} results, ${cardResults.totalResults} total available`);
        }
      } catch (error) {
        console.warn(`Card search failed for "${searchVariation}":`, error.message);
      }

      try {
        // Try products with higher limit
        const productResults = await this.searchCardMarketProducts(searchVariation, effectiveLimit);
        if (productResults.cards && productResults.cards.length > 0) {
          allResults.push(...productResults.cards);
          totalAvailableResults = Math.max(totalAvailableResults, productResults.totalResults || 0);
          console.log(`🎯 Products (${searchVariation}): Found ${productResults.cards.length} results, ${productResults.totalResults} total available`);
        }
      } catch (error) {
        console.warn(`Product search failed for "${searchVariation}":`, error.message);
      }
    }

    // Remove duplicates based on name and set
    const uniqueResults = allResults.filter((result, index, self) => 
      index === self.findIndex(r => r.name === result.name && r.set === result.set)
    );

    console.log(`🎯 Optimized search: ${allResults.length} total, ${uniqueResults.length} unique results`);

    if (uniqueResults.length > 0) {
      return {
        cards: uniqueResults.slice(0, limit), // Limit total results
        totalResults: Math.max(totalAvailableResults, uniqueResults.length),
        searchTerm: searchTerm
      };
    } else {
      console.log(`❌ No results found for search term: "${searchTerm}"`);
      return {
        success: false,
        data: {
          cards: [],
          totalResults: 0,
          searchTerm: searchTerm
        },
        error: 'No results found from any search endpoint'
      };
    }
  }

  // Optimized search for specific expansions/sets with minimal API calls
  async searchCardMarketExpansion(expansionName, limit = 50) {
    if (!this.rapidApiKey) {
      throw new Error('Card Market API key not configured');
    }

    const cacheKey = this.getCacheKey('cardmarket', 'search_expansion', { expansionName, limit });
    const cached = this.getFromCache(cacheKey);
    if (cached) {
      console.log(`📦 Using cached expansion results for: "${expansionName}"`);
      return cached;
    }

    try {
      console.log(`🔍 Optimized expansion search for: "${expansionName}"`);
      
      // Use the regular search with higher limits instead of multiple API calls
      // This is more efficient than trying to find the expansion ID first
      const result = await this.searchCardMarketAll(expansionName, limit);
      
      // Add expansion metadata if available
      if (result && result.cards) {
        result.expansion = { name: expansionName };
        this.setCache(cacheKey, result);
      }
      
      return result;

    } catch (error) {
      console.error(`❌ Card Market API expansion search failed for "${expansionName}":`, error);
      throw error;
    }
  }

  // Legacy function for backward compatibility
  async searchCardMarketProductsLegacy(productName) {
    if (!this.rapidApiKey) {
      throw new Error('Card Market API key not configured');
    }

    const cacheKey = this.getCacheKey('cardmarket', 'search', { productName });
    const cached = this.getFromCache(cacheKey);
    if (cached) return cached;

    try {
      // Try multiple search strategies for better matching
      const searchStrategies = this.generateSearchStrategies(productName);
      
      for (const searchTerm of searchStrategies) {
        console.log(`Trying Card Market API search: "${searchTerm}"`);
        
        const url = `${this.cardMarketBaseUrl}/pokemon/cards/search?search=${encodeURIComponent(searchTerm)}&sort=price_lowest`;
        console.log(`🌐 Making API call to: ${url}`);
        console.log(`🔑 Using API key: ${this.rapidApiKey.substring(0, 10)}...`);
        
        const response = await fetch(url, {
          method: 'GET',
          headers: {
            'X-RapidAPI-Key': this.rapidApiKey,
            'X-RapidAPI-Host': 'cardmarket-api-tcg.p.rapidapi.com'
          }
        });
        
        console.log(`📡 API Response status: ${response.status} ${response.statusText}`);
      
      if (!response.ok) {
          console.warn(`Card Market API error for "${searchTerm}": ${response.status} ${response.statusText}`);
          continue;
      }
      
      const data = await response.json();
          console.log(`📄 API Response data:`, data);

          // The API returns data in a different structure than expected
          // It has: { data: [...], paging: {...}, results: number }
          const cards = data.data || data.cards || [];
          
          if (cards && cards.length > 0) {
            console.log(`✅ Found ${cards.length} results for "${searchTerm}"`);
            console.log(`🎯 First result:`, cards[0]);
            console.log(`📊 Total results available: ${data.results || cards.length}`);
            
            // Return the data in the expected format
            const formattedData = {
              cards: cards,
              totalResults: data.results || cards.length,
              paging: data.paging
            };
            
            this.setCache(cacheKey, formattedData);
            return formattedData;
          } else {
            console.log(`⚠️ No results for "${searchTerm}"`);
            console.log(`📄 Response structure:`, Object.keys(data));
            console.log(`📄 Available data:`, data);
          }
      }

      // If no strategies worked, return empty result
      console.log(`❌ No results found for any search strategy for "${productName}"`);
      const emptyResult = { cards: [] };
      this.setCache(cacheKey, emptyResult);
      return emptyResult;

  } catch (error) {
      console.error('Error searching Card Market API:', error);
      throw error;
    }
  }

  // Generate multiple search strategies for better matching
  generateSearchStrategies(productName) {
    const strategies = [];
    
    // Strategy 1: Original product name
    strategies.push(productName);
    
    // Strategy 2: Remove common prefixes/suffixes
    let cleaned = productName
      .replace(/^Elite Trainer Box\s*-\s*/i, '')
      .replace(/^Premium Collection\s*-\s*/i, '')
      .replace(/^Booster Bundle\s*-\s*/i, '')
      .replace(/^Booster Box\s*-\s*/i, '')
      .replace(/\s*-\s*Pokemon\s+/i, ' ')
      .trim();
    
    if (cleaned !== productName) {
      strategies.push(cleaned);
    }
    
    // Strategy 3: Extract set name only
    const setMatch = productName.match(/(?:Pokemon\s+)?([A-Za-z\s]+?)(?:\s*-\s*|$)/i);
    if (setMatch && setMatch[1]) {
      strategies.push(setMatch[1].trim());
    }
    
    // Strategy 4: Try without "Pokemon" prefix
    const withoutPokemon = productName.replace(/^Pokemon\s+/i, '').trim();
    if (withoutPokemon !== productName) {
      strategies.push(withoutPokemon);
    }
    
    // Strategy 5: Try just the last part after the last dash
    const parts = productName.split(' - ');
    if (parts.length > 1) {
      strategies.push(parts[parts.length - 1].trim());
    }
    
    // Strategy 6: For Elite Trainer Boxes, try generic search
    if (productName.toLowerCase().includes('elite trainer box')) {
      strategies.push('Elite Trainer Box');
    }
    
    // Remove duplicates and empty strings
    return [...new Set(strategies)].filter(strategy => strategy.length > 0);
  }

  async getCardMarketProductDetails(productId) {
    if (!this.rapidApiKey) {
      throw new Error('Card Market API key not configured');
    }

    const cacheKey = this.getCacheKey('cardmarket', 'details', { productId });
    const cached = this.getFromCache(cacheKey);
    if (cached) return cached;

    try {
      const response = await fetch(`${this.cardMarketBaseUrl}/pokemon/cards/${productId}`, {
        method: 'GET',
        headers: {
          'X-RapidAPI-Key': this.rapidApiKey,
          'X-RapidAPI-Host': 'cardmarket-api-tcg.p.rapidapi.com'
        }
      });
      
      if (!response.ok) {
        throw new Error(`Card Market API error: ${response.status} ${response.statusText}`);
      }
      
      const data = await response.json();
      this.setCache(cacheKey, data);
      return data;
    } catch (error) {
      console.error('Error getting Card Market product details:', error);
      throw error;
    }
  }

  // PriceCharting API functions (existing functionality)
  async searchPriceChartingProducts(productName) {
    if (!this.priceChartingApiKey) {
      throw new Error('PriceCharting API key not configured');
    }

    const cacheKey = this.getCacheKey('pricecharting', 'search', { productName });
    const cached = this.getFromCache(cacheKey);
    if (cached) return cached;

    try {
      const response = await fetch(`${this.priceChartingBaseUrl}/products?q=${encodeURIComponent(productName)}&t=${this.priceChartingApiKey}`);
            
            if (!response.ok) {
        throw new Error(`PriceCharting API error: ${response.status} ${response.statusText}`);
            }
            
            const data = await response.json();
      this.setCache(cacheKey, data);
      return data;
    } catch (error) {
      console.error('Error searching PriceCharting API:', error);
      throw error;
    }
  }

  // Unified search function that tries Card Market first, then PriceCharting
  async searchProducts(productName) {
    try {
      // Try Card Market API first (has images)
      if (this.rapidApiKey) {
        const cardMarketResults = await this.searchCardMarketProducts(productName);
        if (cardMarketResults && cardMarketResults.cards && cardMarketResults.cards.length > 0) {
          return {
            success: true,
            source: 'cardmarket',
            data: cardMarketResults
          };
        }
      }
    } catch (error) {
      console.warn('Card Market API failed, falling back to PriceCharting:', error.message);
    }

    // Fallback to PriceCharting API
    try {
      if (this.priceChartingApiKey) {
        const priceChartingResults = await this.searchPriceChartingProducts(productName);
        return {
          success: true,
          source: 'pricecharting',
          data: priceChartingResults
        };
      }
    } catch (error) {
      console.error('PriceCharting API also failed:', error.message);
    }

    return {
      success: false,
      error: 'No API keys configured or all APIs failed'
    };
  }

  // Extract market data from Card Market API response
  extractCardMarketData(cardData) {
    // Handle the correct data structure: { data: [...], paging: {...}, results: number }
    const cards = cardData.data || cardData.cards || [];
    
    if (!cardData || cards.length === 0) {
      console.log('❌ No cards found in Card Market data:', cardData);
      return null;
    }

    const card = cards[0]; // Get the first (best match) card
    console.log('🎴 Processing Card Market card:', card);
    
    return {
      name: card.name,
      productId: card.id,
      imageUrl: card.image,
      set: card.set?.name,
      rarity: card.rarity,
      prices: {
        lowest: card.prices?.cardmarket?.lowest_near_mint || card.prices?.cardmarket?.lowest_excellent,
        average: card.prices?.cardmarket?.average,
        highest: card.prices?.cardmarket?.highest
      },
      marketValue: card.prices?.cardmarket?.lowest_near_mint || card.prices?.cardmarket?.lowest_excellent,
      source: 'cardmarket'
    };
  }

  // Format individual card from cards search results
  formatCardResult(card) {
    if (!card) {
      console.log('❌ Null card in search results');
      return null;
    }

    console.log('🎴 Formatting card result:', card);
    
    // Extract basic card information
    const cardName = card.name || 'Unknown Card';
    const cardId = card.id || card.tcgid || 'unknown';
    const cardImage = card.image || card.imageUrl || null;
    const cardRarity = card.rarity || 'Unknown';
    const cardNumber = card.card_number || card.number || null;
    const hp = card.hp || null;
    const supertype = card.supertype || 'Pokémon';
    
    // Extract set/episode information
    const episode = card.episode || {};
    const cardSet = episode.name || card.set?.name || card.set || 'Unknown Set';
    const setCode = episode.code || '';
    const setLogo = episode.logo || null;
    const releaseDate = episode.released_at || null;
    
    // Extract pricing information with enhanced data
    const prices = card.prices || {};
    const cardmarketPrices = prices.cardmarket || {};
    const tcgPlayerPrices = prices.tcg_player || {};
    
    // Get market value (prefer CardMarket, fallback to TCGPlayer)
    let marketValue = null;
    let priceSource = 'unknown';
    let priceCurrency = 'EUR';
    
    if (cardmarketPrices.lowest_near_mint) {
      marketValue = this.convertEurToUsd(cardmarketPrices.lowest_near_mint);
      priceSource = 'cardmarket';
      priceCurrency = 'EUR';
    } else if (cardmarketPrices.lowest) {
      marketValue = this.convertEurToUsd(cardmarketPrices.lowest);
      priceSource = 'cardmarket';
      priceCurrency = 'EUR';
    } else if (tcgPlayerPrices.market_price) {
      marketValue = tcgPlayerPrices.market_price;
      priceSource = 'tcgplayer';
      priceCurrency = 'USD';
    } else if (tcgPlayerPrices.mid_price) {
      marketValue = tcgPlayerPrices.mid_price;
      priceSource = 'tcgplayer';
      priceCurrency = 'USD';
    }
    
    // Extract historical pricing data
    const historicalData = {
      average7d: cardmarketPrices['7d_average'] ? this.convertEurToUsd(cardmarketPrices['7d_average']) : null,
      average30d: cardmarketPrices['30d_average'] ? this.convertEurToUsd(cardmarketPrices['30d_average']) : null,
      lowestDE: cardmarketPrices.lowest_DE ? this.convertEurToUsd(cardmarketPrices.lowest_DE) : null,
      lowestFR: cardmarketPrices.lowest_FR ? this.convertEurToUsd(cardmarketPrices.lowest_FR) : null
    };
    
    // Extract graded pricing data
    const gradedPrices = cardmarketPrices.graded || {};
    const psaPrices = gradedPrices.psa || {};
    const cgcPrices = gradedPrices.cgc || {};
    
    const gradedData = {
      psa10: psaPrices.psa10 ? this.convertEurToUsd(psaPrices.psa10) : null,
      psa9: psaPrices.psa9 ? this.convertEurToUsd(psaPrices.psa9) : null,
      cgc10: cgcPrices.cgc10 ? this.convertEurToUsd(cgcPrices.cgc10) : null
    };
    
    // Calculate trend if we have historical data
    let trend = null;
    if (historicalData.average7d && historicalData.average30d) {
      const change = ((historicalData.average7d - historicalData.average30d) / historicalData.average30d) * 100;
      trend = {
        value: Math.round(change * 100) / 100,
        direction: change > 0 ? 'up' : change < 0 ? 'down' : 'stable'
      };
    }
    
    const formattedCard = {
      name: cardName,
      productId: cardId,
      imageUrl: cardImage,
      set: cardSet,
      rarity: cardRarity,
      prices: {
        lowest: marketValue,
        average: cardmarketPrices.average ? this.convertEurToUsd(cardmarketPrices.average) : null,
        highest: cardmarketPrices.highest ? this.convertEurToUsd(cardmarketPrices.highest) : null
      },
      marketValue: marketValue,
      source: 'cardmarket',
      type: 'card',
      // Enhanced data
      nameNumbered: card.name_numbered || cardName,
      slug: card.slug || cardName.toLowerCase().replace(/\s+/g, '-'),
      cardNumber: cardNumber,
      hp: hp,
      supertype: supertype,
      setCode: setCode,
      setLogo: setLogo,
      releaseDate: releaseDate,
      priceSource: priceSource,
      priceCurrency: priceCurrency,
      historicalData: historicalData,
      gradedData: gradedData,
      trend: trend,
      artist: card.artist?.name || null,
      tcggoUrl: card.tcggo_url || null,
      rawPrices: prices
    };
    
    console.log(`[marketDataService] Final formatted card for ${cardName}:`, formattedCard);
    return formattedCard;
  }

  // Format individual product from products search results
  formatProductResult(product) {
    if (!product) {
      console.log('❌ Null product in search results');
      return null;
    }

    console.log('📦 Formatting product result:', product);
    
    // Extract basic product information
    const productName = product.name || 'Unknown Product';
    const productId = product.id || 'unknown';
    const productImage = product.image || product.imageUrl || null;
    const productType = product.type || 'sealed';
    const slug = product.slug || productName.toLowerCase().replace(/\s+/g, '-');
    
    // Extract set/episode information
    const episode = product.episode || {};
    const productSet = episode.name || product.expansion?.name || product.expansion || 'Unknown Set';
    const setCode = episode.code || '';
    const setLogo = episode.logo || null;
    const releaseDate = episode.released_at || null;
    
    // Extract pricing information
    const prices = product.prices || {};
    const cardmarketPrices = prices.cardmarket || {};
    const tcgPlayerPrices = prices.tcg_player || {};
    
    // Get market value (prefer CardMarket, fallback to TCGPlayer)
    let marketValue = null;
    let priceSource = 'unknown';
    let priceCurrency = 'EUR';
    
    if (cardmarketPrices.lowest_near_mint) {
      marketValue = this.convertEurToUsd(cardmarketPrices.lowest_near_mint);
      priceSource = 'cardmarket';
      priceCurrency = 'EUR';
    } else if (cardmarketPrices.lowest) {
      marketValue = this.convertEurToUsd(cardmarketPrices.lowest);
      priceSource = 'cardmarket';
      priceCurrency = 'EUR';
    } else if (tcgPlayerPrices.market_price) {
      marketValue = tcgPlayerPrices.market_price;
      priceSource = 'tcgplayer';
      priceCurrency = 'USD';
    } else if (tcgPlayerPrices.mid_price) {
      marketValue = tcgPlayerPrices.mid_price;
      priceSource = 'tcgplayer';
      priceCurrency = 'USD';
    } else if (product.price) {
      // Direct price field
      marketValue = this.convertEurToUsd(product.price);
      priceSource = 'cardmarket';
      priceCurrency = 'EUR';
    } else if (product.prices?.lowest) {
      // Direct lowest price
      marketValue = this.convertEurToUsd(product.prices.lowest);
      priceSource = 'cardmarket';
      priceCurrency = 'EUR';
    } else if (product.prices?.average) {
      // Direct average price
      marketValue = this.convertEurToUsd(product.prices.average);
      priceSource = 'cardmarket';
      priceCurrency = 'EUR';
    }
    
    // Extract historical pricing data
    const historicalData = {
      average7d: cardmarketPrices['7d_average'] ? this.convertEurToUsd(cardmarketPrices['7d_average']) : null,
      average30d: cardmarketPrices['30d_average'] ? this.convertEurToUsd(cardmarketPrices['30d_average']) : null,
      lowestDE: cardmarketPrices.lowest_DE ? this.convertEurToUsd(cardmarketPrices.lowest_DE) : null,
      lowestFR: cardmarketPrices.lowest_FR ? this.convertEurToUsd(cardmarketPrices.lowest_FR) : null
    };
    
    // Calculate trend
    let trend = null;
    if (historicalData.average7d && historicalData.average30d) {
      const change = ((historicalData.average7d - historicalData.average30d) / historicalData.average30d) * 100;
      trend = {
        value: Math.round(change * 100) / 100,
        direction: change > 0 ? 'up' : change < 0 ? 'down' : 'stable'
      };
    }
    
    const formattedProduct = {
      name: productName,
      productId: productId,
      imageUrl: productImage,
      set: productSet,
      rarity: product.rarity || 'Unknown',
      prices: {
        lowest: marketValue,
        average: cardmarketPrices.average ? this.convertEurToUsd(cardmarketPrices.average) : null,
        highest: cardmarketPrices.highest ? this.convertEurToUsd(cardmarketPrices.highest) : null
      },
      marketValue: marketValue,
      source: 'cardmarket',
      type: 'product',
      // Enhanced data
      slug: slug,
      productType: productType,
      setCode: setCode,
      setLogo: setLogo,
      releaseDate: releaseDate,
      priceSource: priceSource,
      priceCurrency: priceCurrency,
      historicalData: historicalData,
      trend: trend,
      tcggoUrl: product.tcggo_url || null,
      rawPrices: prices
    };
    
    console.log('📦 Formatted product:', formattedProduct);
    return formattedProduct;
  }

  // Extract market data from PriceCharting API response
  extractPriceChartingData(priceChartingData) {
    if (!priceChartingData || !priceChartingData.products || priceChartingData.products.length === 0) {
      return null;
    }

    const product = priceChartingData.products[0]; // Get the first product
    
    return {
      name: product.product_name,
      productId: product.id,
      imageUrl: product.image_url,
      set: product.console_name,
      prices: {
        loose: product.loose_price,
        cib: product.cib_price,
        new: product.new_price
      },
      marketValue: product.loose_price || product.cib_price || product.new_price,
      source: 'pricecharting'
    };
  }

  // Get market data for a single product
  async getProductMarketData(productName) {
    try {
      const searchResult = await this.searchProducts(productName);
      
      if (!searchResult.success) {
        return {
          success: false,
          error: searchResult.error
        };
      }

      let marketData = null;
      
      if (searchResult.source === 'cardmarket') {
        marketData = this.extractCardMarketData(searchResult.data);
      } else if (searchResult.source === 'pricecharting') {
        marketData = this.extractPriceChartingData(searchResult.data);
      }

      if (!marketData) {
        return {
          success: false,
          error: 'No market data found for product'
        };
      }

      return {
        success: true,
        data: marketData
      };
    } catch (error) {
      console.error('Error getting product market data:', error);
      return {
        success: false,
        error: error.message
      };
    }
  }

  // Get market data for multiple products (batch processing)
  async getBatchMarketData(productNames) {
    const results = {};
    const errors = [];

    // Check if user should update today (staggered system)
    const shouldUpdate = this.shouldUpdateToday();
    const userUpdateDay = this.getUserUpdateDay();
    const today = new Date().getDay();
    
    console.log(`📅 User update day: ${userUpdateDay}, Today: ${today}, Should update: ${shouldUpdate}`);

    // Check cache first and only fetch missing items
    const itemsToFetch = [];
    productNames.forEach(name => {
      const cacheKey = this.getCacheKey('cardmarket', 'search', { productName: name });
      const cached = this.getFromCache(cacheKey);
      if (cached) {
        results[name] = cached;
      } else if (shouldUpdate) {
        // Only fetch if it's the user's update day
        itemsToFetch.push(name);
      }
    });

    console.log(`📊 Cache hit rate: ${productNames.length - itemsToFetch.length}/${productNames.length} items cached`);
    
    if (!shouldUpdate) {
      console.log(`⏰ Not user's update day (${userUpdateDay}), using cached data only`);
    }

    if (itemsToFetch.length === 0) {
      return { success: true, data: results };
    }

    // Process only uncached products in batches to avoid rate limits
    const batchSize = 8;
    for (let i = 0; i < itemsToFetch.length; i += batchSize) {
      const batch = itemsToFetch.slice(i, i + batchSize);
      
      const batchPromises = batch.map(async (productName) => {
        try {
          const result = await this.getProductMarketData(productName);
          if (result.success) {
            results[productName] = result.data;
            // Track API usage
            this.trackApiUsage();
          } else {
            errors.push({ product: productName, error: result.error });
          }
        } catch (error) {
          errors.push({ product: productName, error: error.message });
        }
      });

      await Promise.all(batchPromises);
      
      // Add small delay between batches to respect rate limits
      if (i + batchSize < itemsToFetch.length) {
        await new Promise(resolve => setTimeout(resolve, 200));
      }
    }

    return {
      success: true,
      data: results,
      errors: errors
    };
  }

  // Convert EUR to USD (approximate rate)
  convertEurToUsd(eurValue) {
    const eurToUsdRate = 1.08; // Approximate current rate
    
    // Check if the value looks like it's in cents (very large numbers)
    if (eurValue > 1000) {
      // Likely in cents, convert to dollars first, then to USD
      return (eurValue / 100) * eurToUsdRate;
    } else {
      // Likely already in dollars/euros, just convert currency
      return eurValue * eurToUsdRate;
    }
  }

  // Get market value in cents for a product
  getMarketValueInCents(marketData) {
    if (!marketData) return 0;
    
    let value = 0;
    
    if (marketData.source === 'cardmarket') {
      value = marketData.prices?.lowest || marketData.marketValue || 0;
      // CardMarket prices are already converted to USD dollars by convertEurToUsd
      if (value > 0) {
        // Convert dollars to cents for storage
        return Math.round(value * 100);
      }
    } else if (marketData.source === 'pricecharting') {
      value = marketData.prices?.loose || marketData.prices?.cib || marketData.prices?.new || marketData.marketValue || 0;
      // PriceCharting prices are already in dollars
      if (value > 0) {
        return Math.round(value * 100);
      }
    }
    
    return Math.round(value);
  }

  // Get formatted market value string
  getMarketValueFormatted(marketData) {
    const cents = this.getMarketValueInCents(marketData);
    if (cents === 0) return 'N/A';
    
    const dollars = (cents / 100).toFixed(2);
    return `$${dollars}`;
  }

  // Legacy functions for backward compatibility
  async getPortfolioData(productNames) {
    return this.getBatchMarketData(productNames);
  }

  async updateItemPrice(itemId, productId) {
    // This would typically update the database with new market data
    // For now, just return success
    return { success: true, message: 'Price update not implemented' };
  }

  async bulkUpdatePrices(itemIds) {
    // This would typically update multiple items in the database
    // For now, just return success
    return { success: true, message: 'Bulk update not implemented' };
  }

  async getCacheStatus() {
    return {
      cacheSize: this.cache.size,
      cacheTimeout: this.cacheTimeout,
      entries: Array.from(this.cache.keys())
    };
  }

  // Update collection items with market data
  async updateCollectionWithMarketData(items) {
    try {
      // Extract unique product names from items
      const productNames = [...new Set(items.map(item => item.name).filter(Boolean))];
      
      if (productNames.length === 0) {
        return items;
      }

      // Get market data for all products
      const marketDataResponse = await this.getBatchMarketData(productNames);
      
      if (!marketDataResponse.success) {
        console.error('Failed to get market data:', marketDataResponse.error);
        // Return items with fallback market values (1.2x buy price as estimate)
        return items.map(item => ({
          ...item,
          marketValue: item.marketValue || Math.round(item.buyPrice * 1.2), // 20% markup estimate
          priceSource: 'estimate'
        }));
      }

      // Update items with market data
      const updatedItems = items.map(item => {
        const marketData = marketDataResponse.data[item.name];
        
        if (marketData) {
          const marketValueCents = this.getMarketValueInCents(marketData);
          
          if (marketValueCents > 0) {
            return {
              ...item,
              marketValue: marketValueCents,
              apiProductId: marketData.productId,
              priceSource: marketData.source,
              imageUrl: marketData.imageUrl || item.imageUrl,
              set: marketData.set || item.set,
              rarity: marketData.rarity || item.rarity,
            };
          }
        }
        
        // Fallback to estimated market value
        return {
          ...item,
          marketValue: item.marketValue || Math.round(item.buyPrice * 1.2), // 20% markup estimate
          priceSource: item.priceSource || 'estimate'
        };
      });

      return updatedItems;
    } catch (error) {
      console.error('Error updating collection with market data:', error);
      // Return items with fallback market values
      return items.map(item => ({
        ...item,
        marketValue: item.marketValue || Math.round(item.buyPrice * 1.2), // 20% markup estimate
        priceSource: 'estimate'
      }));
    }
  }

  // Auto-update market values and manage items table
  async autoUpdateMarketValues() {
    try {
      // Get all active orders (not sold)
      const { data: orders, error: ordersError } = await supabase
        .from('orders')
        .select('id, item, buy_price_cents, status')
        .eq('status', 'ordered');

      if (ordersError) {
        throw new Error(`Failed to fetch orders: ${ordersError.message}`);
      }

      if (orders.length === 0) {
        return { success: true, message: 'No active orders found' };
      }

      // Get unique item names from active orders
      const uniqueItemNames = [...new Set(orders.map(order => order.item).filter(Boolean))];
      
      // Get existing items from items table
      const { data: existingItems, error: itemsError } = await supabase
        .from('items')
        .select('id, name, market_value_cents, api_last_updated, api_product_id');

      if (itemsError) {
        console.warn('Items table not found or accessible:', itemsError.message);
      }

      // Find items that need market data updates
      const itemsNeedingUpdate = uniqueItemNames.filter(itemName => {
        const existingItem = existingItems?.find(item => item.name === itemName);
        return !existingItem || !existingItem.market_value_cents || 
               !existingItem.api_last_updated || 
               (new Date() - new Date(existingItem.api_last_updated)) > 24 * 60 * 60 * 1000; // 24 hours
      });

      if (itemsNeedingUpdate.length === 0) {
        return { success: true, message: 'All items have up-to-date market data' };
      }

      // Get market data for items that need updates
      const marketDataResponse = await this.getBatchMarketData(itemsNeedingUpdate);
      
      if (!marketDataResponse.success) {
        console.error('Failed to get market data:', marketDataResponse.error);
        return { success: false, error: marketDataResponse.error };
      }

      // Process each item and update/create in items table
      const updatePromises = [];
      
      for (const itemName of itemsNeedingUpdate) {
        const marketData = marketDataResponse.data[itemName];
        const existingItem = existingItems?.find(item => item.name === itemName);
        
        if (marketData) {
          const marketValueCents = this.getMarketValueInCents(marketData);
          
          if (marketValueCents > 0) {
            const itemData = {
              name: itemName,
              market_value_cents: marketValueCents,
              api_product_id: marketData.productId?.toString(),
              api_last_updated: new Date().toISOString(),
              price_source: marketData.source,
              console_name: marketData.set,
              image_url: marketData.imageUrl,
              rarity: marketData.rarity,
              updated_at: new Date().toISOString()
            };

            if (existingItem) {
              // Update existing item
              updatePromises.push(
                supabase
                  .from('items')
                  .update(itemData)
                  .eq('id', existingItem.id)
              );
            } else {
              // Create new item
              updatePromises.push(
                supabase
                  .from('items')
                  .insert([{
                    ...itemData,
                    created_at: new Date().toISOString()
                  }])
              );
            }
          }
        }
      }

      // Clean up items that are no longer in active orders (all sold)
      if (existingItems) {
        const activeItemNames = new Set(uniqueItemNames);
        const itemsToRemove = existingItems.filter(item => !activeItemNames.has(item.name));
        
        if (itemsToRemove.length > 0) {
          const removePromises = itemsToRemove.map(item => 
            supabase
              .from('items')
              .delete()
              .eq('id', item.id)
          );
          updatePromises.push(...removePromises);
        }
      }

      // Execute all updates
      const results = await Promise.all(updatePromises);
      const errors = results.filter(result => result.error);
      
      if (errors.length > 0) {
        console.warn('Some updates failed:', errors);
      }

  return {
        success: true,
        message: `Updated market data for ${itemsNeedingUpdate.length} items`,
        updatedCount: itemsNeedingUpdate.length,
        errors: errors.length
      };
    } catch (error) {
      console.error('Error auto-updating market values:', error);
      throw error;
    }
  }
}

// Create singleton instance
export const marketDataService = new MarketDataService();

// Export individual functions for backward compatibility
export const getProductMarketData = (productName) => marketDataService.getProductMarketData(productName);
export const getBatchMarketData = (productNames) => marketDataService.getBatchMarketData(productNames);
export const getMarketValueInCents = (marketData) => marketDataService.getMarketValueInCents(marketData);
export const getMarketValueFormatted = (marketData) => marketDataService.getMarketValueFormatted(marketData);

export default marketDataService;