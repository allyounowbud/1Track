// Service to fetch market prices from database instead of API
import { supabase } from '../lib/supabaseClient.js';

class DatabasePriceService {
  constructor() {
    this.cache = new Map();
    this.cacheTimeout = 5 * 60 * 1000; // 5 minutes cache
  }

  // Get market prices from database
  async getMarketPrices(productNames) {
    try {
      const { data: prices, error } = await supabase
        .from('market_prices')
        .select('*')
        .in('item_name', productNames);

      if (error) throw error;

      // Convert to the expected format
      const results = {};
      prices.forEach(price => {
        results[price.item_name] = {
          name: price.item_name,
          marketValue: price.market_value_cents,
          imageUrl: price.image_url,
          set: price.set_name,
          rarity: price.rarity,
          source: price.source,
          lastUpdated: price.last_updated
        };
      });

      console.log(`📊 Found ${prices.length}/${productNames.length} prices in database`);
      return results;

    } catch (error) {
      console.error('Error fetching market prices from database:', error);
      return {};
    }
  }

  // Get single product price
  async getProductPrice(productName) {
    try {
      const { data: price, error } = await supabase
        .from('market_prices')
        .select('*')
        .eq('item_name', productName)
        .single();

      if (error) {
        if (error.code === 'PGRST116') {
          // No rows returned
          return null;
        }
        throw error;
      }

      return {
        name: price.product_name,
        marketValue: price.market_value_cents,
        imageUrl: price.image_url,
        set: price.set_name,
        rarity: price.rarity,
        source: price.source,
        lastUpdated: price.last_updated
      };

    } catch (error) {
      console.error(`Error fetching price for ${productName}:`, error);
      return null;
    }
  }

  // Get all market prices (for admin/debugging)
  async getAllMarketPrices() {
    try {
      const { data: prices, error } = await supabase
        .from('market_prices')
        .select('*')
        .order('last_updated', { ascending: false });

      if (error) throw error;

      return prices;

    } catch (error) {
      console.error('Error fetching all market prices:', error);
      return [];
    }
  }

  // Get price update status
  async getPriceUpdateStatus() {
    try {
      const { data: prices, error } = await supabase
        .from('market_prices')
        .select('last_updated')
        .order('last_updated', { ascending: false })
        .limit(1);

      if (error) throw error;

      if (!prices || prices.length === 0) {
        return { lastUpdated: null, needsUpdate: true };
      }

      const latestPrice = prices[0];
      const lastUpdated = new Date(latestPrice.last_updated);
      const now = new Date();
      const hoursSinceUpdate = (now - lastUpdated) / (1000 * 60 * 60);

      return {
        lastUpdated: lastUpdated,
        needsUpdate: hoursSinceUpdate >= 24, // Updated for 24-hour refresh cycle
        hoursSinceUpdate: Math.floor(hoursSinceUpdate)
      };

    } catch (error) {
      console.error('Error checking price update status:', error);
      return { lastUpdated: null, needsUpdate: true };
    }
  }

  // Get market value in cents (helper function)
  getMarketValueInCents(marketData) {
    if (!marketData) return 0;
    return marketData.marketValue || 0;
  }

  // Get market value formatted (helper function)
  getMarketValueFormatted(marketData) {
    if (!marketData) return '$0.00';
    const cents = marketData.marketValue || 0;
    return `$${(cents / 100).toFixed(2)}`;
  }
}

export const databasePriceService = new DatabasePriceService();
