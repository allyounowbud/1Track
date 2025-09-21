import { supabase } from '../lib/supabaseClient.js';
import marketDataService from './marketDataService.js';

// Service to match existing database items with Card Market API data
class ItemMatchingService {
  constructor() {
    this.batchSize = 5; // Process items in small batches to avoid API limits
    this.delayBetweenBatches = 2000; // 2 seconds between batches
  }

  // Get all unique item names from orders that need market data updates
  async getItemsNeedingUpdate() {
    try {
      console.log('🔍 Fetching items from orders that need market data updates...');
      
      // Get all unique item names from orders
      const { data: orders, error: ordersError } = await supabase
        .from('orders')
        .select('item')
        .not('item', 'is', null);
      
      if (ordersError) {
        console.error('❌ Error fetching orders:', ordersError);
        return [];
      }

      // Get unique item names
      const uniqueItems = [...new Set(orders.map(order => order.item))];
      console.log(`📊 Found ${uniqueItems.length} unique items in orders`);

      // Check which items already have market data
      const { data: existingMarketData, error: marketError } = await supabase
        .from('market_prices')
        .select('item_name, last_updated')
        .in('item_name', uniqueItems);

      if (marketError) {
        console.error('❌ Error fetching existing market data:', marketError);
        return uniqueItems; // Return all items if we can't check existing data
      }

      // Filter out items that have recent market data (less than 24 hours old)
      const now = new Date();
      const twentyFourHoursAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000);
      
      const itemsNeedingUpdate = uniqueItems.filter(itemName => {
        const existingData = existingMarketData.find(data => data.item_name === itemName);
        if (!existingData) return true; // No market data exists
        
        const lastUpdated = new Date(existingData.last_updated);
        return lastUpdated < twentyFourHoursAgo; // Older than 24 hours
      });

      console.log(`🔄 ${itemsNeedingUpdate.length} items need market data updates`);
      return itemsNeedingUpdate;

    } catch (error) {
      console.error('❌ Error getting items needing update:', error);
      return [];
    }
  }

  // Match a single item with Card Market API and update market data
  async matchAndUpdateItem(itemName) {
    try {
      console.log(`🔍 Matching item: "${itemName}"`);
      
      // Try multiple search strategies
      const searchStrategies = [
        itemName, // Original name
        itemName.toLowerCase(), // Lowercase
        itemName.replace(/\[.*?\]/g, '').trim(), // Remove brackets
        itemName.replace(/\s*-\s*Pokemon.*$/i, '').trim(), // Remove "- Pokemon Set" suffix
        itemName.replace(/\s*\(.*?\)/g, '').trim(), // Remove parentheses
        itemName.split(' - ')[0], // Take only the first part before " - "
        itemName.split(' [')[0], // Take only the first part before " ["
      ];
      
      // Remove duplicates and empty strings
      const uniqueStrategies = [...new Set(searchStrategies)].filter(strategy => strategy.length > 0);
      
      let searchResult = null;
      let successfulStrategy = null;
      
      // Try each search strategy
      for (const strategy of uniqueStrategies) {
        console.log(`🔍 Trying search strategy: "${strategy}"`);
        searchResult = await marketDataService.searchCardMarketAll(strategy, 5);
        
        if (searchResult.success && searchResult.data && searchResult.data.cards.length > 0) {
          successfulStrategy = strategy;
          console.log(`✅ Found results with strategy: "${strategy}"`);
          break;
        }
        
        // Small delay between searches
        await new Promise(resolve => setTimeout(resolve, 200));
      }
      
      if (!searchResult || !searchResult.success || !searchResult.data || !searchResult.data.cards.length) {
        console.log(`❌ No results found for: "${itemName}" with any strategy`);
        return { success: false, reason: 'No API results found with any search strategy' };
      }

      // Find the best match (exact name match preferred)
      const bestMatch = this.findBestMatch(itemName, searchResult.data.cards);
      
      if (!bestMatch) {
        console.log(`❌ No good match found for: "${itemName}"`);
        return { success: false, reason: 'No good match found' };
      }

      console.log(`✅ Found match for "${itemName}": "${bestMatch.name}" (using strategy: "${successfulStrategy}")`);

      // Update market_prices table with the new data
      const updateResult = await this.updateMarketPrice(itemName, bestMatch);
      
      if (updateResult.success) {
        console.log(`✅ Updated market data for: "${itemName}"`);
        return { 
          success: true, 
          matchedItem: bestMatch,
          marketValue: bestMatch.marketValue,
          searchStrategy: successfulStrategy
        };
      } else {
        console.log(`❌ Failed to update market data for: "${itemName}"`);
        return { success: false, reason: 'Database update failed' };
      }

    } catch (error) {
      console.error(`❌ Error matching item "${itemName}":`, error);
      return { success: false, reason: error.message };
    }
  }

  // Find the best match from API results
  findBestMatch(itemName, apiResults) {
    if (!apiResults || apiResults.length === 0) return null;

    // Normalize names for comparison
    const normalizeName = (name) => {
      return name.toLowerCase()
        .replace(/[^\w\s]/g, '') // Remove special characters
        .replace(/\s+/g, ' ') // Normalize spaces
        .trim();
    };

    const normalizedItemName = normalizeName(itemName);
    
    // Try to find exact match first
    let bestMatch = apiResults.find(result => 
      normalizeName(result.name) === normalizedItemName
    );

    if (bestMatch) {
      console.log(`🎯 Exact match found: "${bestMatch.name}"`);
      return bestMatch;
    }

    // Try partial matches
    const partialMatches = apiResults.filter(result => {
      const normalizedResultName = normalizeName(result.name);
      return normalizedResultName.includes(normalizedItemName) || 
             normalizedItemName.includes(normalizedResultName);
    });

    if (partialMatches.length > 0) {
      // Prefer matches with market values
      bestMatch = partialMatches.find(match => match.marketValue) || partialMatches[0];
      console.log(`🎯 Partial match found: "${bestMatch.name}"`);
      return bestMatch;
    }

    // If no good match, return the first result with a market value
    bestMatch = apiResults.find(result => result.marketValue) || apiResults[0];
    console.log(`🎯 Using first available result: "${bestMatch.name}"`);
    return bestMatch;
  }

  // Update market_prices table with new data
  async updateMarketPrice(itemName, apiData) {
    try {
      const marketValueCents = apiData.marketValue ? 
        Math.round(apiData.marketValue * 100) : null;

      const marketPriceData = {
        item_name: itemName,
        market_value_cents: marketValueCents,
        image_url: apiData.imageUrl,
        set_name: apiData.set,
        rarity: apiData.rarity,
        source: 'cardmarket',
        last_updated: new Date().toISOString()
      };

      // Use upsert to insert or update
      const { data, error } = await supabase
        .from('market_prices')
        .upsert(marketPriceData, { 
          onConflict: 'item_name',
          ignoreDuplicates: false 
        })
        .select();

      if (error) {
        console.error('❌ Database error:', error);
        return { success: false, error: error.message };
      }

      return { success: true, data };

    } catch (error) {
      console.error('❌ Error updating market price:', error);
      return { success: false, error: error.message };
    }
  }

  // Process all items in batches
  async processAllItems() {
    try {
      console.log('🚀 Starting batch processing of items...');
      
      const itemsToProcess = await this.getItemsNeedingUpdate();
      
      if (itemsToProcess.length === 0) {
        console.log('✅ No items need updating');
        return { success: true, processed: 0, results: [] };
      }

      const results = [];
      const totalBatches = Math.ceil(itemsToProcess.length / this.batchSize);

      for (let i = 0; i < totalBatches; i++) {
        const startIndex = i * this.batchSize;
        const endIndex = Math.min(startIndex + this.batchSize, itemsToProcess.length);
        const batch = itemsToProcess.slice(startIndex, endIndex);

        console.log(`📦 Processing batch ${i + 1}/${totalBatches} (${batch.length} items)`);

        // Process batch items in parallel
        const batchPromises = batch.map(itemName => this.matchAndUpdateItem(itemName));
        const batchResults = await Promise.all(batchPromises);
        
        results.push(...batchResults);

        // Add delay between batches to respect API limits
        if (i < totalBatches - 1) {
          console.log(`⏳ Waiting ${this.delayBetweenBatches/1000}s before next batch...`);
          await new Promise(resolve => setTimeout(resolve, this.delayBetweenBatches));
        }
      }

      // Summary
      const successful = results.filter(r => r.success).length;
      const failed = results.filter(r => !r.success).length;
      
      console.log(`✅ Batch processing complete:`);
      console.log(`   📊 Total processed: ${results.length}`);
      console.log(`   ✅ Successful: ${successful}`);
      console.log(`   ❌ Failed: ${failed}`);

      return {
        success: true,
        processed: results.length,
        successful,
        failed,
        results
      };

    } catch (error) {
      console.error('❌ Error in batch processing:', error);
      return { success: false, error: error.message };
    }
  }

  // Get matching statistics
  async getMatchingStats() {
    try {
      // Get total unique items from orders
      const { data: orders } = await supabase
        .from('orders')
        .select('item')
        .not('item', 'is', null);
      
      const totalItems = [...new Set(orders.map(order => order.item))].length;

      // Get items with market data
      const { data: marketData } = await supabase
        .from('market_prices')
        .select('item_name, market_value_cents, source, last_updated');

      const itemsWithMarketData = marketData.length;
      const itemsWithCardMarketData = marketData.filter(item => item.source === 'cardmarket').length;
      const itemsWithValues = marketData.filter(item => item.market_value_cents && item.market_value_cents > 0).length;

      // Get recent updates (last 24 hours)
      const now = new Date();
      const twentyFourHoursAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000);
      const recentUpdates = marketData.filter(item => 
        new Date(item.last_updated) > twentyFourHoursAgo
      ).length;

      return {
        totalItems,
        itemsWithMarketData,
        itemsWithCardMarketData,
        itemsWithValues,
        recentUpdates,
        coverage: totalItems > 0 ? Math.round((itemsWithMarketData / totalItems) * 100) : 0
      };

    } catch (error) {
      console.error('❌ Error getting matching stats:', error);
      return null;
    }
  }
}

// Create and export singleton instance
const itemMatchingService = new ItemMatchingService();
export default itemMatchingService;
