import { supabase, useMockData } from './supabase';
import { marketDataService } from './marketDataService';

// Mock data that matches your real data structure
const mockEmailOrders = [
  {
    id: 1,
    retailer: 'Pokemon Center',
    order_id: 'PC-2024-001',
    order_date: '2024-01-15',
    item_name: 'Blastoise ex 200/165',
    quantity: 1,
    unit_price_cents: 50000,
    total_cents: 50000,
    image_url: null,
    status: 'ordered',
    created_at: '2024-01-15T10:00:00Z'
  },
  {
    id: 2,
    retailer: 'Target',
    order_id: 'TGT-2024-002',
    order_date: '2024-01-10',
    item_name: 'Alakazam ex 201/165',
    quantity: 1,
    unit_price_cents: 30000,
    total_cents: 30000,
    image_url: null,
    status: 'ordered',
    created_at: '2024-01-10T14:30:00Z'
  },
  {
    id: 3,
    retailer: 'Walmart',
    order_id: 'WM-2024-003',
    order_date: '2024-01-20',
    item_name: 'Thundurus 209',
    quantity: 1,
    unit_price_cents: 25000,
    total_cents: 25000,
    image_url: null,
    status: 'ordered',
    created_at: '2024-01-20T09:15:00Z'
  },
  {
    id: 4,
    retailer: 'GameStop',
    order_id: 'GS-2024-004',
    order_date: '2024-01-25',
    item_name: 'Mimikyu 075',
    quantity: 1,
    unit_price_cents: 15000,
    total_cents: 15000,
    image_url: null,
    status: 'ordered',
    created_at: '2024-01-25T16:45:00Z'
  },
  {
    id: 5,
    retailer: 'Best Buy',
    order_id: 'BB-2024-005',
    order_date: '2024-01-30',
    item_name: 'Charizard ex 199/165',
    quantity: 1,
    unit_price_cents: 80000,
    total_cents: 80000,
    image_url: null,
    status: 'ordered',
    created_at: '2024-01-30T11:20:00Z'
  },
  {
    id: 6,
    retailer: 'Amazon',
    order_id: 'AMZ-2024-006',
    order_date: '2024-02-01',
    item_name: 'Snorlax 051',
    quantity: 1,
    unit_price_cents: 5000,
    total_cents: 5000,
    image_url: null,
    status: 'ordered',
    created_at: '2024-02-01T13:10:00Z'
  }
];

const mockProducts = [
  {
    id: 1,
    name: 'Blastoise ex 200/165',
    category: 'tcg_singles',
    market_value_cents: 93050,
    price_source: 'api',
    api_product_id: 'pokemon-151-blastoise-ex-200',
    created_at: '2024-01-15T10:00:00Z'
  },
  {
    id: 2,
    name: 'Alakazam ex 201/165',
    category: 'tcg_singles',
    market_value_cents: 58250,
    price_source: 'api',
    api_product_id: 'pokemon-151-alakazam-ex-201',
    created_at: '2024-01-10T14:30:00Z'
  },
  {
    id: 3,
    name: 'Thundurus 209',
    category: 'tcg_singles',
    market_value_cents: 25200,
    price_source: 'api',
    api_product_id: 'pokemon-sv-promos-thundurus-209',
    created_at: '2024-01-20T09:15:00Z'
  },
  {
    id: 4,
    name: 'Mimikyu 075',
    category: 'tcg_singles',
    market_value_cents: 11260,
    price_source: 'api',
    api_product_id: 'pokemon-sv-promos-mimikyu-075',
    created_at: '2024-01-25T16:45:00Z'
  },
  {
    id: 5,
    name: 'Charizard ex 199/165',
    category: 'tcg_singles',
    market_value_cents: 120000,
    price_source: 'api',
    api_product_id: 'pokemon-151-charizard-ex-199',
    created_at: '2024-01-30T11:20:00Z'
  },
  {
    id: 6,
    name: 'Snorlax 051',
    category: 'tcg_singles',
    market_value_cents: 7500,
    price_source: 'api',
    api_product_id: 'pokemon-sv-promos-snorlax-051',
    created_at: '2024-02-01T13:10:00Z'
  }
];

// Data service functions
export const dataService = {
  // Get all orders (from orders table)
  async getOrders() {
    if (useMockData || !supabase) {
      return mockEmailOrders;
    }

    try {
      const { data, error } = await supabase
        .from('orders')
        .select(
          'id, order_date, item, profile_name, retailer, marketplace, buy_price_cents, sale_price_cents, sale_date, fees_pct, shipping_cents, status'
        )
        .order('order_date', { ascending: false });

      if (error) throw error;
      return data || [];
    } catch (error) {
      console.error('Error fetching orders:', error);
      return mockEmailOrders; // Fallback to mock data
    }
  },

  // Get all items (from items table)
  async getItems() {
    if (useMockData || !supabase) {
      return mockProducts;
    }

    try {
      const { data, error } = await supabase
        .from('items')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) {
        console.error('Error fetching items:', error);
        // If items table doesn't exist, return empty array
        if (error.code === 'PGRST205') {
          console.log('Items table does not exist yet, returning empty array');
          return [];
        }
        throw error;
      }
      return data || [];
    } catch (error) {
      console.error('Error fetching items:', error);
      return []; // Return empty array instead of mock data for now
    }
  },

  // Get collection items (from orders table)
  async getCollectionItems() {
    const orders = await this.getOrders();
    const items = await this.getItems();

    // Filter to only include orders that are NOT sold (status = 'ordered')
    const activeOrders = orders.filter(order => order.status === 'ordered');

    // Map orders to collection items
    let collectionItems = activeOrders.map(order => {
      // Find matching item data
      const itemData = items.find(i => i.name === order.item);

      return {
        id: order.id,
        name: order.item || 'Unknown Item',
        buyPrice: order.buy_price_cents,
        quantity: 1, // Default quantity since it's not in the orders table
        status: order.status,
        orderDate: order.order_date,
        marketValue: itemData?.market_value_cents || order.buy_price_cents,
        notes: `${order.retailer || order.marketplace || 'Unknown'} • ${order.profile_name || 'Order'}`,
        imageUrl: null, // Not available in orders table
        retailer: order.retailer || order.marketplace,
        orderId: order.id,
        item: itemData,
        apiProductId: itemData?.api_product_id,
        priceSource: itemData?.price_source || 'manual'
      };
    });

    // If not using mock data and we have items, try to update with market data
    if (!useMockData && supabase && collectionItems.length > 0) {
      try {
        collectionItems = await marketDataService.updateCollectionWithMarketData(collectionItems);
      } catch (error) {
        console.error('Failed to update market data:', error);
        // Continue with existing data if market data fails
      }
    }

    return collectionItems;
  },


  // Add new order
  async addOrder(orderData) {
    if (useMockData || !supabase) {
      const newOrder = {
        id: Date.now(),
        ...orderData,
        created_at: new Date().toISOString()
      };
      mockEmailOrders.unshift(newOrder);
      return newOrder;
    }

    try {
      const { data, error } = await supabase
        .from('orders')
        .insert([orderData])
        .select()
        .single();

      if (error) throw error;
      return data;
    } catch (error) {
      console.error('Error adding order:', error);
      throw error;
    }
  },

  // Update order
  async updateOrder(id, updates) {
    if (useMockData || !supabase) {
      const index = mockEmailOrders.findIndex(order => order.id === id);
      if (index !== -1) {
        mockEmailOrders[index] = { ...mockEmailOrders[index], ...updates };
        return mockEmailOrders[index];
      }
      return null;
    }

    try {
      const { data, error } = await supabase
        .from('orders')
        .update(updates)
        .eq('id', id)
        .select()
        .single();

      if (error) throw error;
      return data;
    } catch (error) {
      console.error('Error updating order:', error);
      throw error;
    }
  },

  // Delete order
  async deleteOrder(id) {
    if (useMockData || !supabase) {
      const index = mockEmailOrders.findIndex(order => order.id === id);
      if (index !== -1) {
        return mockEmailOrders.splice(index, 1)[0];
      }
      return null;
    }

    try {
      const { data, error } = await supabase
        .from('orders')
        .delete()
        .eq('id', id)
        .select()
        .single();

      if (error) throw error;
      return data;
    } catch (error) {
      console.error('Error deleting order:', error);
      throw error;
    }
  },

  // Get collection statistics
  async getCollectionStats() {
    const collectionItems = await this.getCollectionItems();
    
    const totalValue = collectionItems.reduce((sum, item) => sum + (item.marketValue || 0), 0);
    const totalPaid = collectionItems.reduce((sum, item) => sum + (item.buyPrice || 0), 0);
    const totalItems = collectionItems.length;
    
    // Categorize items based on item data
    const ungraded = collectionItems.filter(item => {
      const category = item.item?.category || '';
      return !category.includes('graded') && !category.includes('sealed');
    }).length;
    
    const graded = collectionItems.filter(item => {
      const category = item.item?.category || '';
      return category.includes('graded');
    }).length;
    
    const sealed = collectionItems.filter(item => {
      const category = item.item?.category || '';
      return category.includes('sealed');
    }).length;

    return {
      totalValue,
      totalPaid,
      totalItems,
      ungraded,
      graded,
      sealed,
      profitLoss: totalValue - totalPaid,
      profitLossPercent: totalPaid > 0 ? ((totalValue - totalPaid) / totalPaid) * 100 : 0
    };
  },

  // Auto-update market values for all items
  async autoUpdateMarketValues() {
    if (useMockData || !supabase) {
      return { success: true, message: 'Mock data mode - no market updates needed' };
    }

    try {
      return await marketDataService.autoUpdateMarketValues();
    } catch (error) {
      console.error('Error auto-updating market values:', error);
      throw error;
    }
  },

  // Search for products using PriceCharting API
  async searchProducts(productName) {
    if (useMockData || !supabase) {
      return { success: true, data: { products: [] } };
    }

    try {
      return await marketDataService.searchProducts(productName);
    } catch (error) {
      console.error('Error searching products:', error);
      throw error;
    }
  }
};
