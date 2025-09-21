import { supabase, useMockData } from './supabase';
import { marketDataService } from './marketDataService';

// Mock data for development
const mockOrders = [
  {
    id: '1',
    user_id: 'user-1',
    item_id: 'item-1',
    item_name: 'Blastoise ex 200/165',
    item_set: 'Pokemon 151',
    buy_date: '2024-01-15',
    buy_price_cents: 50000,
    buy_quantity: 1,
    buy_retailer_id: 'retailer-1',
    buy_retailer_name: 'Pokemon Center',
    sell_date: null,
    sell_price_cents: null,
    sell_quantity: null,
    sell_marketplace_id: null,
    sell_marketplace_name: null,
    status: 'ordered',
    notes: null,
    created_at: '2024-01-15T10:00:00Z',
    updated_at: '2024-01-15T10:00:00Z'
  },
  {
    id: '2',
    user_id: 'user-1',
    item_id: 'item-2',
    item_name: 'Charizard ex 199/165',
    item_set: 'Pokemon 151',
    buy_date: '2024-01-20',
    buy_price_cents: 80000,
    buy_quantity: 1,
    buy_retailer_id: 'retailer-2',
    buy_retailer_name: 'Target',
    sell_date: null,
    sell_price_cents: null,
    sell_quantity: null,
    sell_marketplace_id: null,
    sell_marketplace_name: null,
    status: 'ordered',
    notes: null,
    created_at: '2024-01-20T14:30:00Z',
    updated_at: '2024-01-20T14:30:00Z'
  },
  {
    id: '3',
    user_id: 'user-1',
    item_id: 'item-1',
    item_name: 'Blastoise ex 200/165',
    item_set: 'Pokemon 151',
    buy_date: '2024-01-25',
    buy_price_cents: 52000,
    buy_quantity: 2,
    buy_retailer_id: 'retailer-1',
    buy_retailer_name: 'Pokemon Center',
    sell_date: null,
    sell_price_cents: null,
    sell_quantity: null,
    sell_marketplace_id: null,
    sell_marketplace_name: null,
    status: 'ordered',
    notes: null,
    created_at: '2024-01-25T10:00:00Z',
    updated_at: '2024-01-25T10:00:00Z'
  },
  {
    id: '4',
    user_id: 'user-1',
    item_id: 'item-3',
    item_name: 'Prismatic Evolutions Booster Bundle',
    item_set: 'Prismatic Evolutions',
    buy_date: '2024-01-30',
    buy_price_cents: 38000,
    buy_quantity: 3,
    buy_retailer_id: 'retailer-3',
    buy_retailer_name: 'GameStop',
    sell_date: null,
    sell_price_cents: null,
    sell_quantity: null,
    sell_marketplace_id: null,
    sell_marketplace_name: null,
    status: 'ordered',
    notes: null,
    created_at: '2024-01-30T10:00:00Z',
    updated_at: '2024-01-30T10:00:00Z'
  }
];

const mockItems = [
  {
    id: 'item-1',
    name: 'Blastoise ex 200/165',
    console_name: 'Pokemon',
    category: 'tcg_singles',
    set_name: 'Pokemon 151',
    api_product_id: 'pokemon-151-blastoise-ex-200',
    loose_price: 93.05,
    cib_price: 95.00,
    new_price: 100.00,
    price_source: 'api',
    image_url: 'https://example.com/blastoise.jpg',
    api_last_updated: '2024-01-15T10:00:00Z',
    api_response: {},
    created_at: '2024-01-15T10:00:00Z',
    updated_at: '2024-01-15T10:00:00Z'
  },
  {
    id: 'item-2',
    name: 'Charizard ex 199/165',
    console_name: 'Pokemon',
    category: 'tcg_singles',
    set_name: 'Pokemon 151',
    api_product_id: 'pokemon-151-charizard-ex-199',
    loose_price: 120.00,
    cib_price: 125.00,
    new_price: 130.00,
    price_source: 'api',
    image_url: 'https://example.com/charizard.jpg',
    api_last_updated: '2024-01-20T14:30:00Z',
    api_response: {},
    created_at: '2024-01-20T14:30:00Z',
    updated_at: '2024-01-20T14:30:00Z'
  },
  {
    id: 'item-3',
    name: 'Prismatic Evolutions Booster Bundle',
    console_name: 'Pokemon',
    category: 'sealed',
    set_name: 'Prismatic Evolutions',
    api_product_id: 'pokemon-prismatic-evolutions-bundle',
    loose_price: 42.00,
    cib_price: 45.00,
    new_price: 48.00,
    price_source: 'api',
    image_url: 'https://example.com/bundle.jpg',
    api_last_updated: '2024-01-30T10:00:00Z',
    api_response: {},
    created_at: '2024-01-30T10:00:00Z',
    updated_at: '2024-01-30T10:00:00Z'
  }
];

const mockRetailers = [
  { id: 'retailer-1', name: 'Pokemon Center', website: 'https://pokemoncenter.com', is_global: true, user_id: null },
  { id: 'retailer-2', name: 'Target', website: 'https://target.com', is_global: true, user_id: null },
  { id: 'retailer-3', name: 'GameStop', website: 'https://gamestop.com', is_global: true, user_id: null },
  { id: 'retailer-4', name: 'Amazon', website: 'https://amazon.com', is_global: true, user_id: null }
];

const mockMarketplaces = [
  { id: 'marketplace-1', name: 'eBay', website: 'https://ebay.com', is_global: true, user_id: null },
  { id: 'marketplace-2', name: 'TCGPlayer', website: 'https://tcgplayer.com', is_global: true, user_id: null },
  { id: 'marketplace-3', name: 'Card Kingdom', website: 'https://cardkingdom.com', is_global: true, user_id: null }
];

// Data service for the new schema
export const dataServiceV2 = {
  // ==============================================
  // ORDERS (Order Book)
  // ==============================================

  async getOrders() {
    if (useMockData || !supabase) {
      console.log('getOrders: Using mock data');
      return mockOrders;
    }

    try {
      console.log('getOrders: Fetching from Supabase...');
      // Simple query without foreign key relationships for now
      const { data, error } = await supabase
        .from('orders')
        .select('*')
        .order('buy_date', { ascending: false });

      if (error) throw error;
      console.log('getOrders: Raw data from Supabase:', data);
      console.log('getOrders: Number of orders:', data?.length || 0);
      return data || [];
    } catch (error) {
      console.error('Error fetching orders:', error);
      return mockOrders;
    }
  },

  async addOrder(orderData) {
    if (useMockData || !supabase) {
      const newOrder = {
        id: Date.now().toString(),
        user_id: 'user-1',
        ...orderData,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      };
      mockOrders.unshift(newOrder);
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

  async updateOrder(id, updates) {
    if (useMockData || !supabase) {
      const index = mockOrders.findIndex(order => order.id === id);
      if (index !== -1) {
        mockOrders[index] = { ...mockOrders[index], ...updates };
        return mockOrders[index];
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

  async deleteOrder(id) {
    if (useMockData || !supabase) {
      const index = mockOrders.findIndex(order => order.id === id);
      if (index !== -1) {
        return mockOrders.splice(index, 1)[0];
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

  // ==============================================
  // ITEMS (PriceCharting API Data)
  // ==============================================

  async getItems() {
    if (useMockData || !supabase) {
      console.log('getItems: Using mock data');
      return mockItems;
    }

    try {
      console.log('getItems: Fetching from Supabase...');
      const { data, error } = await supabase
        .from('items')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) throw error;
      console.log('getItems: Raw data from Supabase:', data);
      console.log('getItems: Number of items:', data?.length || 0);
      return data || [];
    } catch (error) {
      console.error('Error fetching items:', error);
      return mockItems;
    }
  },

  async addItem(itemData) {
    if (useMockData || !supabase) {
      const newItem = {
        id: Date.now().toString(),
        ...itemData,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      };
      mockItems.unshift(newItem);
      return newItem;
    }

    try {
      const { data, error } = await supabase
        .from('items')
        .insert([itemData])
        .select()
        .single();

      if (error) throw error;
      return data;
    } catch (error) {
      console.error('Error adding item:', error);
      throw error;
    }
  },

  async updateItem(id, updates) {
    if (useMockData || !supabase) {
      const index = mockItems.findIndex(item => item.id === id);
      if (index !== -1) {
        mockItems[index] = { ...mockItems[index], ...updates };
        return mockItems[index];
      }
      return null;
    }

    try {
      const { data, error } = await supabase
        .from('items')
        .update(updates)
        .eq('id', id)
        .select()
        .single();

      if (error) throw error;
      return data;
    } catch (error) {
      console.error('Error updating item:', error);
      throw error;
    }
  },

  // ==============================================
  // RETAILERS (Buy Locations)
  // ==============================================

  async getRetailers() {
    if (useMockData || !supabase) {
      return mockRetailers;
    }

    try {
      const { data, error } = await supabase
        .from('retailers')
        .select('*')
        .order('name', { ascending: true });

      if (error) throw error;
      return data || [];
    } catch (error) {
      console.error('Error fetching retailers:', error);
      return mockRetailers;
    }
  },

  async addRetailer(retailerData) {
    if (useMockData || !supabase) {
      const newRetailer = {
        id: Date.now().toString(),
        ...retailerData,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      };
      mockRetailers.push(newRetailer);
      return newRetailer;
    }

    try {
      const { data, error } = await supabase
        .from('retailers')
        .insert([retailerData])
        .select()
        .single();

      if (error) throw error;
      return data;
    } catch (error) {
      console.error('Error adding retailer:', error);
      throw error;
    }
  },

  // ==============================================
  // MARKETPLACES (Sell Locations)
  // ==============================================

  async getMarketplaces() {
    if (useMockData || !supabase) {
      return mockMarketplaces;
    }

    try {
      const { data, error } = await supabase
        .from('marketplaces')
        .select('*')
        .order('name', { ascending: true });

      if (error) throw error;
      return data || [];
    } catch (error) {
      console.error('Error fetching marketplaces:', error);
      return mockMarketplaces;
    }
  },

  async addMarketplace(marketplaceData) {
    if (useMockData || !supabase) {
      const newMarketplace = {
        id: Date.now().toString(),
        ...marketplaceData,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      };
      mockMarketplaces.push(newMarketplace);
      return newMarketplace;
    }

    try {
      const { data, error } = await supabase
        .from('marketplaces')
        .insert([marketplaceData])
        .select()
        .single();

      if (error) throw error;
      return data;
    } catch (error) {
      console.error('Error adding marketplace:', error);
      throw error;
    }
  },

  // ==============================================
  // COLLECTION (Active Orders)
  // ==============================================

  async getCollectionItems() {
    console.log('getCollectionItems called');
    const orders = await this.getOrders();
    const items = await this.getItems();

    console.log('Orders from getOrders():', orders);
    console.log('Items from getItems():', items);
    console.log('Number of orders:', orders?.length || 0);
    console.log('Number of items:', items?.length || 0);

    // Filter to only include orders that are NOT sold (status = 'ordered')
    const activeOrders = orders.filter(order => order.status === 'ordered');
    console.log('Active orders (status = ordered):', activeOrders);
    console.log('Number of active orders:', activeOrders.length);

    // Map orders to collection items
    let collectionItems = activeOrders.map(order => {
      // Find matching item data
      const itemData = items.find(i => i.id === order.item_id);
      console.log(`Mapping order ${order.id} (${order.item_name}) with item data:`, itemData);

      return {
        id: order.id,
        name: order.item_name,
        set: order.item_set,
        buyPrice: order.buy_price_cents,
        quantity: order.buy_quantity,
        status: order.status,
        orderDate: order.buy_date,
        marketValue: itemData?.loose_price ? Math.round(itemData.loose_price * 100) : Math.round(order.buy_price_cents * 1.2), // 20% markup fallback
        notes: order.notes,
        imageUrl: itemData?.image_url,
        retailer: order.buy_retailer?.name || order.buy_retailer_name,
        orderId: order.id,
        item: itemData,
        apiProductId: itemData?.api_product_id,
        priceSource: itemData?.price_source || 'estimate'
      };
    });

    console.log('Final collection items before market data update:', collectionItems);
    console.log('Number of collection items:', collectionItems.length);

    // If not using mock data and we have items, try to update with market data
    // Temporarily disabled to prevent infinite loading
    // if (!useMockData && supabase && collectionItems.length > 0) {
    //   try {
    //     collectionItems = await marketDataService.updateCollectionWithMarketData(collectionItems);
    //   } catch (error) {
    //     console.error('Failed to update market data:', error);
    //     // Continue with existing data if market data fails
    //   }
    // }

    console.log('Final collection items returned:', collectionItems);
    return collectionItems;
  },

  // Get aggregated collection items (grouped by name)
  async getAggregatedCollectionItems() {
    const collectionItems = await this.getCollectionItems();
    
    console.log('Raw collection items:', collectionItems);
    console.log('Number of raw items:', collectionItems.length);
    
    // Group items by name and aggregate quantities/prices
    const itemGroups = {};
    
    collectionItems.forEach(item => {
      const key = item.name || 'Unknown Item';
      console.log('Processing item:', key, 'with quantity:', item.quantity);
      
      if (!itemGroups[key]) {
        itemGroups[key] = {
          id: item.id,
          name: item.name || 'Unknown Item',
          totalQuantity: 0,
          totalPaid: 0,
          totalMarketValue: 0,
          status: item.status,
          orderDate: item.orderDate,
          notes: item.notes,
          imageUrl: item.imageUrl,
          item: item.item,
          apiProductId: item.apiProductId,
          priceSource: item.priceSource,
          orderIds: []
        };
      }
      
      itemGroups[key].totalQuantity += item.quantity || 1;
      itemGroups[key].totalPaid += (item.buyPrice || 0) * (item.quantity || 1);
      itemGroups[key].totalMarketValue += (item.marketValue || 0) * (item.quantity || 1);
      itemGroups[key].orderIds.push(item.orderId);
    });
    
    console.log('Item groups:', itemGroups);
    console.log('Number of unique items:', Object.keys(itemGroups).length);
    
    // Convert back to array and calculate averages
    const result = Object.values(itemGroups).map(group => ({
      ...group,
      quantity: group.totalQuantity,
      buyPrice: group.totalPaid / group.totalQuantity, // Average buy price
      marketValue: group.totalMarketValue / group.totalQuantity, // Average market value
      totalPaid: group.totalPaid,
      totalMarketValue: group.totalMarketValue
    }));
    
    console.log('Final aggregated result:', result);
    return result;
  },

  async getCollectionStats() {
    const collectionItems = await this.getAggregatedCollectionItems();
    
    const totalValue = collectionItems.reduce((sum, item) => sum + (item.totalMarketValue || 0), 0);
    const totalPaid = collectionItems.reduce((sum, item) => sum + (item.totalPaid || 0), 0);
    const totalItems = collectionItems.reduce((sum, item) => sum + (item.quantity || 0), 0);
    
    // Categorize items based on item data
    const ungraded = collectionItems.filter(item => {
      const category = item.item?.category || '';
      return !category.includes('graded') && !category.includes('sealed');
    }).reduce((sum, item) => sum + (item.quantity || 0), 0);
    
    const graded = collectionItems.filter(item => {
      const category = item.item?.category || '';
      return category.includes('graded');
    }).reduce((sum, item) => sum + (item.quantity || 0), 0);
    
    const sealed = collectionItems.filter(item => {
      const category = item.item?.category || '';
      return category.includes('sealed');
    }).reduce((sum, item) => sum + (item.quantity || 0), 0);

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

  // ==============================================
  // SEARCH (PriceCharting API)
  // ==============================================

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
  },

  // ==============================================
  // MARKET DATA
  // ==============================================

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
  }
};
