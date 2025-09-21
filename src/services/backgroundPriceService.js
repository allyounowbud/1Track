// Background service to fetch and store market prices in database
import { supabase } from '../lib/supabaseClient.js';
import { marketDataService } from './marketDataService.js';
import { API_CONFIG } from '../config/apiConfig.js';

class BackgroundPriceService {
  constructor() {
    this.isRunning = false;
    this.lastRun = null;
  }

  // Get all unique product names from orders
  async getAllProductNames() {
    try {
      const { data: orders, error } = await supabase
        .from('orders')
        .select('item')
        .not('item', 'is', null)
        .eq('status', 'ordered');

      if (error) throw error;

      // Get unique product names
      const uniqueNames = [...new Set(orders.map(order => order.item))];
      console.log(`📦 Found ${uniqueNames.length} unique products to update`);
      
      return uniqueNames;
    } catch (error) {
      console.error('Error fetching product names:', error);
      return [];
    }
  }

  // Update market prices in database
  async updateMarketPrices() {
    if (this.isRunning) {
      console.log('⏳ Background price update already running, skipping...');
      return;
    }

    this.isRunning = true;
    console.log('🚀 Starting background market price update...');

    try {
      const productNames = await this.getAllProductNames();
      
      if (productNames.length === 0) {
        console.log('📭 No products found to update');
        return;
      }

      let updatedCount = 0;
      let errorCount = 0;

      // Process products in batches
      const batchSize = API_CONFIG.batchSize;
      for (let i = 0; i < productNames.length; i += batchSize) {
        const batch = productNames.slice(i, i + batchSize);
        
        console.log(`📊 Processing batch ${Math.floor(i/batchSize) + 1}/${Math.ceil(productNames.length/batchSize)}`);

        // Process batch in parallel
        const batchPromises = batch.map(async (productName) => {
          try {
            const result = await marketDataService.getProductMarketData(productName);
            
            if (result.success && result.data) {
              const marketData = result.data;
              const marketValueCents = marketDataService.getMarketValueInCents(marketData);
              
              if (marketValueCents > 0) {
                // Upsert market price
                const { error } = await supabase
                  .from('market_prices')
                  .upsert({
                    item_name: productName,
                    market_value_cents: marketValueCents,
                    image_url: marketData.imageUrl || null,
                    set_name: marketData.set || null,
                    rarity: marketData.rarity || null,
                    source: marketData.source || 'cardmarket'
                  }, {
                    onConflict: 'item_name'
                  });

                if (error) throw error;
                
                updatedCount++;
                console.log(`✅ Updated: ${productName} - $${(marketValueCents/100).toFixed(2)}`);
              } else {
                console.log(`⚠️ No market value for: ${productName}`);
              }
            } else {
              console.log(`❌ Failed to get data for: ${productName}`);
              errorCount++;
            }
          } catch (error) {
            console.error(`❌ Error updating ${productName}:`, error);
            errorCount++;
          }
        });

        await Promise.all(batchPromises);
        
        // Small delay between batches
        if (i + batchSize < productNames.length) {
          await new Promise(resolve => setTimeout(resolve, API_CONFIG.batchDelay));
        }
      }

      this.lastRun = new Date();
      console.log(`✅ Background price update complete: ${updatedCount} updated, ${errorCount} errors`);

    } catch (error) {
      console.error('❌ Background price update failed:', error);
    } finally {
      this.isRunning = false;
    }
  }

  // Check if prices need updating (every 6 hours with upgraded plan)
  shouldUpdatePrices() {
    if (!this.lastRun) return true;
    
    const now = new Date();
    const lastRun = new Date(this.lastRun);
    const hoursSinceLastRun = (now - lastRun) / (1000 * 60 * 60);
    
    return hoursSinceLastRun >= API_CONFIG.priceUpdateInterval;
  }

  // Start the background service
  async start() {
    console.log('🔄 Starting background price service...');
    
    // Check if we should update prices
    if (this.shouldUpdatePrices()) {
      await this.updateMarketPrices();
    } else {
      console.log('⏰ Prices updated recently, skipping...');
    }

    // Schedule next update (check every 30 minutes)
    setInterval(async () => {
      if (this.shouldUpdatePrices()) {
        await this.updateMarketPrices();
      }
    }, API_CONFIG.checkInterval * 60 * 1000); // Configurable check interval
  }

  // Get status
  getStatus() {
    return {
      isRunning: this.isRunning,
      lastRun: this.lastRun,
      shouldUpdate: this.shouldUpdatePrices()
    };
  }
}

export const backgroundPriceService = new BackgroundPriceService();
