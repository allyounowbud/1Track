import { useState, useEffect, useRef } from 'react';
import { useLocation } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '../lib/supabaseClient';
import { getBatchMarketData, getMarketValueInCents, marketDataService } from '../services/marketDataService';
import ItemMatchingManager from '../components/ItemMatchingManager.jsx';

// Data fetching functions
async function getOrders() {
  const { data, error } = await supabase
    .from("orders")
    .select("id, order_date, item, buy_price_cents, sale_price_cents, status")
    .order("order_date", { ascending: false });
  if (error) throw error;
  return data || [];
}

async function getItems() {
  const { data, error } = await supabase
    .from("items")
    .select("id, name, market_value_cents")
    .order("name", { ascending: true });
  if (error) throw error;
  return data || [];
}

const Collection = () => {
  const location = useLocation();
  const [searchQuery, setSearchQuery] = useState(
    location.state?.searchQuery || ''
  );
  const [timeRange, setTimeRange] = useState('7D');
  const [showCurrencyDropdown, setShowCurrencyDropdown] = useState(false);
  const [selectedCurrency, setSelectedCurrency] = useState({
    code: 'USD',
    name: 'United States Dollar',
    flag: (
      <svg className="w-5 h-4" viewBox="0 0 20 15" fill="none">
        <rect width="20" height="15" fill="#B22234"/>
        <rect y="1.15" width="20" height="1.15" fill="white"/>
        <rect y="3.46" width="20" height="1.15" fill="white"/>
        <rect y="5.77" width="20" height="1.15" fill="white"/>
        <rect y="8.08" width="20" height="1.15" fill="white"/>
        <rect y="10.38" width="20" height="1.15" fill="white"/>
        <rect y="12.69" width="20" height="1.15" fill="white"/>
        <rect width="8" height="8.08" fill="#3C3B6E"/>
      </svg>
    )
  });
  const [selectedItems, setSelectedItems] = useState(new Set());
  const [isSelectionMode, setIsSelectionMode] = useState(false);
  const [showBulkActionsMenu, setShowBulkActionsMenu] = useState(false);
  const [showItemMenu, setShowItemMenu] = useState(false);
  const [selectedItemId, setSelectedItemId] = useState(null);
  const [showFilterDropdown, setShowFilterDropdown] = useState(false);
  const [selectedFilter, setSelectedFilter] = useState('All');

  // Fetch real data
  const { data: orders = [], isLoading: ordersLoading, error: ordersError } = useQuery({
    queryKey: ["collection_orders"],
    queryFn: getOrders,
  });

  const { data: items = [], isLoading: itemsLoading, error: itemsError } = useQuery({
    queryKey: ["collection_items"],
    queryFn: getItems,
  });

  // Market data state
  const [marketData, setMarketData] = useState({});
  const [marketDataLoading, setMarketDataLoading] = useState(false);


  // Fetch market data from database (centralized prices)
  useEffect(() => {
    const fetchMarketData = async () => {
      if (orders.length === 0) return;
      
      // Get unique items from orders that are currently in inventory (not sold)
      const inventoryItems = orders
        .filter(order => order.status === 'ordered' || !order.sale_price_cents)
        .map(order => order.item)
        .filter(Boolean);
      
      const uniqueItems = [...new Set(inventoryItems)];
      
      console.log('🔍 Collection items to fetch market data for:', uniqueItems);
      
      if (uniqueItems.length > 0) {
        setMarketDataLoading(true);
        
        try {
          // Fetch prices from API
          console.log(`🚀 Fetching market data from API for ${uniqueItems.length} items...`);
          const result = await getBatchMarketData(uniqueItems);
          if (result.success && result.data) {
            setMarketData(result.data);
          } else {
            setMarketData({});
          }
          console.log(`✅ API market data fetch complete: ${Object.keys(result.data || {}).length}/${uniqueItems.length} items found`);
        } catch (error) {
          console.error('❌ Error fetching market data:', error);
          setMarketData({});
        } finally {
          setMarketDataLoading(false);
        }
      }
    };

    // Add a small delay to prevent excessive calls during rapid re-renders
    const timeoutId = setTimeout(fetchMarketData, 100);
    return () => clearTimeout(timeoutId);
  }, [orders]);

  // Available currencies with SVG flag components
  const currencies = [
    { 
      code: 'USD', 
      name: 'United States Dollar', 
      flag: (
        <svg className="w-5 h-4" viewBox="0 0 20 15" fill="none">
          <rect width="20" height="15" fill="#B22234"/>
          <rect y="1.15" width="20" height="1.15" fill="white"/>
          <rect y="3.46" width="20" height="1.15" fill="white"/>
          <rect y="5.77" width="20" height="1.15" fill="white"/>
          <rect y="8.08" width="20" height="1.15" fill="white"/>
          <rect y="10.38" width="20" height="1.15" fill="white"/>
          <rect y="12.69" width="20" height="1.15" fill="white"/>
          <rect width="8" height="8.08" fill="#3C3B6E"/>
        </svg>
      )
    },
    { 
      code: 'CAD', 
      name: 'Canadian Dollar', 
      flag: (
        <svg className="w-5 h-4" viewBox="0 0 20 15" fill="none">
          <rect width="20" height="15" fill="#FF0000"/>
          <rect width="6.67" height="15" fill="white"/>
          <rect x="13.33" width="6.67" height="15" fill="white"/>
          <rect x="6.67" y="5" width="6.67" height="5" fill="#FF0000"/>
        </svg>
      )
    },
    { 
      code: 'EUR', 
      name: 'European Euro', 
      flag: (
        <svg className="w-5 h-4" viewBox="0 0 20 15" fill="none">
          <rect width="20" height="15" fill="#003399"/>
          <circle cx="10" cy="7.5" r="3" fill="#FFCC00"/>
        </svg>
      )
    },
    { 
      code: 'GBP', 
      name: 'British Pound', 
      flag: (
        <svg className="w-5 h-4" viewBox="0 0 20 15" fill="none">
          <rect width="20" height="15" fill="#012169"/>
          <path d="M0 0l20 15M20 0L0 15" stroke="white" strokeWidth="2"/>
          <path d="M0 7.5h20M10 0v15" stroke="white" strokeWidth="2"/>
        </svg>
      )
    },
    { 
      code: 'AUD', 
      name: 'Australian Dollar', 
      flag: (
        <svg className="w-5 h-4" viewBox="0 0 20 15" fill="none">
          <rect width="20" height="15" fill="#00008B"/>
          <circle cx="5" cy="5" r="2" fill="white"/>
          <path d="M0 0l20 15M20 0L0 15" stroke="white" strokeWidth="0.5"/>
        </svg>
      )
    },
    { 
      code: 'NZD', 
      name: 'New Zealand Dollar', 
      flag: (
        <svg className="w-5 h-4" viewBox="0 0 20 15" fill="none">
          <rect width="20" height="15" fill="#000080"/>
          <circle cx="5" cy="5" r="2" fill="white"/>
          <path d="M0 0l20 15M20 0L0 15" stroke="white" strokeWidth="0.5"/>
        </svg>
      )
    },
    { 
      code: 'MXN', 
      name: 'Mexican Peso', 
      flag: (
        <svg className="w-5 h-4" viewBox="0 0 20 15" fill="none">
          <rect width="6.67" height="15" fill="#006847"/>
          <rect x="6.67" width="6.67" height="15" fill="white"/>
          <rect x="13.33" width="6.67" height="15" fill="#CE1126"/>
        </svg>
      )
    },
    { 
      code: 'NOK', 
      name: 'Norwegian Krone', 
      flag: (
        <svg className="w-5 h-4" viewBox="0 0 20 15" fill="none">
          <rect width="20" height="15" fill="#EF2B2D"/>
          <rect x="6" width="2" height="15" fill="white"/>
          <rect y="6" width="20" height="2" fill="white"/>
          <rect x="5" width="4" height="15" fill="#002868"/>
          <rect y="5" width="20" height="4" fill="#002868"/>
        </svg>
      )
    },
    { 
      code: 'SEK', 
      name: 'Swedish Krona', 
      flag: (
        <svg className="w-5 h-4" viewBox="0 0 20 15" fill="none">
          <rect width="20" height="15" fill="#006AA7"/>
          <rect x="6" width="2" height="15" fill="#FECC00"/>
          <rect y="6" width="20" height="2" fill="#FECC00"/>
        </svg>
      )
    },
    { 
      code: 'DKK', 
      name: 'Danish Krone', 
      flag: (
        <svg className="w-5 h-4" viewBox="0 0 20 15" fill="none">
          <rect width="20" height="15" fill="#C60C30"/>
          <rect x="6" width="2" height="15" fill="white"/>
          <rect y="6" width="20" height="2" fill="white"/>
        </svg>
      )
    },
    { 
      code: 'MYR', 
      name: 'Malaysian Ringgit', 
      flag: (
        <svg className="w-5 h-4" viewBox="0 0 20 15" fill="none">
          <rect width="20" height="3" fill="#FF0000"/>
          <rect y="3" width="20" height="3" fill="white"/>
          <rect y="6" width="20" height="3" fill="#FF0000"/>
          <rect y="9" width="20" height="3" fill="white"/>
          <rect y="12" width="20" height="3" fill="#FF0000"/>
          <rect width="8" height="9" fill="#000080"/>
        </svg>
      )
    },
    { 
      code: 'JPY', 
      name: 'Japanese Yen', 
      flag: (
        <svg className="w-5 h-4" viewBox="0 0 20 15" fill="none">
          <rect width="20" height="15" fill="white"/>
          <circle cx="10" cy="7.5" r="3" fill="#BC002D"/>
        </svg>
      )
    },
  ];

  // Click outside handler for currency dropdown
  const dropdownRef = useRef(null);
  const filterDropdownRef = useRef(null);
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
        setShowCurrencyDropdown(false);
      }
      if (filterDropdownRef.current && !filterDropdownRef.current.contains(event.target)) {
        setShowFilterDropdown(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Currency conversion rates (to USD)
  const exchangeRates = {
    USD: 1.0,
    CAD: 0.74,
    EUR: 1.08,
    GBP: 1.27,
    AUD: 0.66,
    NZD: 0.61,
    MXN: 0.059,
    NOK: 0.093,
    SEK: 0.092,
    DKK: 0.145,
    MYR: 0.21,
    JPY: 0.0067,
  };

  // Currency symbols
  const currencySymbols = {
    USD: '$',
    CAD: 'C$',
    EUR: '€',
    GBP: '£',
    AUD: 'A$',
    NZD: 'NZ$',
    MXN: '$',
    NOK: 'kr',
    SEK: 'kr',
    DKK: 'kr',
    MYR: 'RM',
    JPY: '¥',
  };

  // Convert values based on selected currency
  const convertValue = (usdValue) => {
    const rate = exchangeRates[selectedCurrency.code] || 1.0;
    return usdValue / rate;
  };

  const getCurrencySymbol = () => {
    return currencySymbols[selectedCurrency.code] || '$';
  };

  const formatPrice = (price) => {
    const convertedPrice = convertValue(price);
    const symbol = getCurrencySymbol();
    
    if (selectedCurrency.code === 'JPY') {
      return `${symbol}${Math.round(convertedPrice).toLocaleString()}`;
    } else {
      return `${symbol}${convertedPrice.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
    }
  };

  // Get date range and labels based on selected time range
  const getDateRange = () => {
    const today = new Date();
    const ranges = {
      '7D': {
        days: 7,
        label: 'Last 7 days',
        dates: [
          new Date(today.getTime() - 6 * 24 * 60 * 60 * 1000),
          new Date(today.getTime() - 3 * 24 * 60 * 60 * 1000),
          today
        ]
      },
      '1M': {
        days: 30,
        label: 'Last 30 days',
        dates: [
          new Date(today.getTime() - 29 * 24 * 60 * 60 * 1000),
          new Date(today.getTime() - 15 * 24 * 60 * 60 * 1000),
          today
        ]
      },
      '3M': {
        days: 90,
        label: 'Last 90 days',
        dates: [
          new Date(today.getTime() - 89 * 24 * 60 * 60 * 1000),
          new Date(today.getTime() - 45 * 24 * 60 * 60 * 1000),
          today
        ]
      },
      '6M': {
        days: 180,
        label: 'Last 180 days',
        dates: [
          new Date(today.getTime() - 179 * 24 * 60 * 60 * 1000),
          new Date(today.getTime() - 90 * 24 * 60 * 60 * 1000),
          today
        ]
      },
      '1Y': {
        days: 365,
        label: 'Last 365 days',
        dates: [
          new Date(today.getTime() - 364 * 24 * 60 * 60 * 1000),
          new Date(today.getTime() - 182 * 24 * 60 * 60 * 1000),
          today
        ]
      }
    };
    return ranges[timeRange] || ranges['7D'];
  };

  const formatDate = (date) => {
    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  };

  const currentDateRange = getDateRange();

  // Selection functions
  const handleItemSelect = (itemId) => {
    const newSelectedItems = new Set(selectedItems);
    if (newSelectedItems.has(itemId)) {
      newSelectedItems.delete(itemId);
    } else {
      newSelectedItems.add(itemId);
    }
    setSelectedItems(newSelectedItems);
    
    if (newSelectedItems.size === 0) {
      setIsSelectionMode(false);
    }
  };

  const handleLongPress = (itemId) => {
    setIsSelectionMode(true);
    handleItemSelect(itemId);
  };

  const clearSelection = () => {
    setSelectedItems(new Set());
    setIsSelectionMode(false);
  };

  const selectAll = () => {
    const allItemIds = new Set(collectionData.items.map(item => item.id));
    setSelectedItems(allItemIds);
    setIsSelectionMode(true);
  };

         // Track long press state
         const longPressRef = useRef(null);
         const longPressTriggeredRef = useRef(false);

  // Process real data into collection format
  const collectionData = (() => {
    if (ordersLoading || itemsLoading) {
      return {
        totalValue: 0,
        totalPaid: 0,
        profitLoss: 0,
        profitLossPercent: 0,
        totalItems: 0,
        ungraded: 0,
        graded: 0,
        sealed: 0,
        items: []
      };
    }

    // Group orders by item name
    const itemGroups = {};
    orders.forEach(order => {
      if (!order.item) return;
      
      if (!itemGroups[order.item]) {
        itemGroups[order.item] = {
          name: order.item,
          quantity: 0,
          totalPaid: 0,
          orders: []
        };
      }
      
      itemGroups[order.item].quantity += 1;
      itemGroups[order.item].totalPaid += order.buy_price_cents || 0;
      itemGroups[order.item].orders.push(order);
    });

    // Convert to collection items format
    const collectionItems = Object.values(itemGroups).map((group, index) => {
      const marketInfo = marketData[group.name];
      const currentValue = marketInfo ? getMarketValueInCents(marketInfo) : group.totalPaid;
      const profit = currentValue - group.totalPaid;
      const profitPercent = group.totalPaid > 0 ? (profit / group.totalPaid) * 100 : 0;
      
      // Determine status based on item name
      let status = "Ungraded";
      if (group.name.toLowerCase().includes('graded') || group.name.toLowerCase().includes('psa') || group.name.toLowerCase().includes('bgs')) {
        status = "Graded";
      } else if (group.name.toLowerCase().includes('box') || group.name.toLowerCase().includes('bundle') || 
                 group.name.toLowerCase().includes('pack') || group.name.toLowerCase().includes('collection') ||
                 group.name.toLowerCase().includes('tin') || group.name.toLowerCase().includes('display')) {
        status = "Sealed";
      }

      return {
        id: index + 1,
        name: group.name,
        set: marketInfo?.set || "Unknown Set",
        status: status,
        value: currentValue / 100, // Convert cents to dollars
        paid: group.totalPaid / 100, // Convert cents to dollars
        quantity: group.quantity,
        profit: profit / 100, // Convert cents to dollars
        profitPercent: profitPercent,
        image: marketInfo?.imageUrl || null
      };
    });

    // Calculate totals
    const totalValue = collectionItems.reduce((sum, item) => sum + (item.value * item.quantity), 0);
    const totalPaid = collectionItems.reduce((sum, item) => sum + (item.paid * item.quantity), 0);
    const profitLoss = totalValue - totalPaid;
    const profitLossPercent = totalPaid > 0 ? (profitLoss / totalPaid) * 100 : 0;

    return {
      totalValue,
      totalPaid,
      profitLoss,
      profitLossPercent,
      totalItems: collectionItems.reduce((sum, item) => sum + item.quantity, 0),
      ungraded: collectionItems.filter(item => item.status === "Ungraded").reduce((sum, item) => sum + item.quantity, 0),
      graded: collectionItems.filter(item => item.status === "Graded").reduce((sum, item) => sum + item.quantity, 0),
      sealed: collectionItems.filter(item => item.status === "Sealed").reduce((sum, item) => sum + item.quantity, 0),
      items: collectionItems
    };
  })();


  // Loading state
  if (ordersLoading || itemsLoading) {
    return (
      <div className="min-h-screen bg-gray-950 text-white flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-500 mx-auto mb-4"></div>
          <div className="text-gray-300">Loading your collection...</div>
        </div>
      </div>
    );
  }

  // Error state
  if (ordersError || itemsError) {
    return (
      <div className="min-h-screen bg-gray-950 text-white flex items-center justify-center">
        <div className="text-center">
          <div className="text-red-500 mb-4">Error loading collection data</div>
          <div className="text-gray-300 text-sm">
            {ordersError?.message || itemsError?.message || 'Unknown error occurred'}
          </div>
          <div className="text-gray-400 text-xs mt-2">
            Make sure your Supabase connection is configured correctly
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-950 text-white">
      {/* Header */}
      <div className="px-4 py-3">
        <div className="flex items-center justify-between mb-2">
          {/* Logo */}
          <div className="text-lg text-white">OneTrack</div>
          
          
          {/* Currency Selector */}
          <div className="relative" ref={dropdownRef}>
            <button 
              onClick={() => setShowCurrencyDropdown(!showCurrencyDropdown)}
              className="flex items-center gap-1 px-3 py-1.5 text-xs text-white hover:bg-gray-800/30 transition-colors"
            >
              <div className="flex items-center gap-1">
                <div className="rounded-full overflow-hidden">
                  {selectedCurrency.flag}
                </div>
                <span>{selectedCurrency.code}</span>
              </div>
              <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M5.293 7.293a1 1 0 011.414 0L10 10.586l3.293-3.293a1 1 0 111.414 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414z" clipRule="evenodd" />
              </svg>
            </button>
            
            {/* Currency Dropdown */}
            {showCurrencyDropdown && (
              <div className="absolute right-0 top-full mt-2 w-80 bg-gray-900 border border-gray-700 rounded-lg shadow-xl z-20">
                {/* Header */}
                <div className="px-4 py-3 border-b border-gray-700">
                  <h3 className="text-xs font-medium text-white">Choose App Currency</h3>
                </div>
                
                {/* Currency List */}
                <div className="max-h-80 overflow-y-auto">
                  {currencies.map((currency) => (
                    <button
                      key={currency.code}
                      onClick={() => {
                        setSelectedCurrency(currency);
                        setShowCurrencyDropdown(false);
                      }}
                      className={`w-full flex items-center gap-3 px-4 py-3 text-left hover:bg-gray-800 transition-colors ${
                        selectedCurrency.code === currency.code ? 'bg-gray-800' : ''
                      }`}
                    >
                      <div className="flex items-center gap-2">
                        {currency.flag}
                        <span className="text-sm text-white">{currency.code}</span>
                      </div>
                      <span className="text-sm text-white flex-1">{currency.name}</span>
                      {selectedCurrency.code === currency.code ? (
                        <svg className="w-4 h-4 text-indigo-500" fill="currentColor" viewBox="0 0 20 20">
                          <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                        </svg>
                      ) : (
                        <svg className="w-4 h-4 text-gray-400" fill="currentColor" viewBox="0 0 20 20">
                          <path fillRule="evenodd" d="M7.293 14.707a1 1 0 010-1.414L10.586 10 7.293 6.707a1 1 0 011.414-1.414l4 4a1 1 0 010 1.414l-4 4a1 1 0 01-1.414 0z" clipRule="evenodd" />
                        </svg>
                      )}
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>



        {/* Collection Value */}
        <div className="text-center mb-3 pt-4">
          <div className="text-xs text-gray-300 mb-0.5">Your collection is worth</div>
          <div className="text-3xl font-bold text-indigo-500 mb-0.5">
            {marketDataLoading ? (
              <div className="flex items-center gap-2">
                <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-indigo-500"></div>
                <span className="text-sm">Loading market data...</span>
              </div>
            ) : (
              formatPrice(collectionData.totalValue)
            )}
          </div>
          <div className="text-xs text-gray-300">Total Paid • {formatPrice(collectionData.totalPaid)} <span className="text-indigo-500">({collectionData.profitLossPercent.toFixed(1)}%)</span></div>
        </div>

        {/* Item Status Breakdown */}
        <div className="grid grid-cols-3 gap-3 mb-4 pt-2">
          <div className="text-center">
            <div className="text-xs text-gray-400 mb-1">Ungraded</div>
            <div className="text-xs text-indigo-500">
              {collectionData.items.filter(item => item.status === "Ungraded").reduce((sum, item) => sum + item.quantity, 0)}
            </div>
          </div>
          <div className="text-center">
            <div className="text-xs text-gray-400 mb-1">Graded</div>
            <div className="text-xs text-indigo-500">
              {collectionData.items.filter(item => item.status === "Graded").reduce((sum, item) => sum + item.quantity, 0)}
            </div>
          </div>
          <div className="text-center">
            <div className="text-xs text-gray-400 mb-1">Sealed</div>
            <div className="text-xs text-indigo-500">
              {collectionData.items.filter(item => item.status === "Sealed").reduce((sum, item) => sum + item.quantity, 0)}
            </div>
          </div>
        </div>
      </div>


      {/* Collection History */}
      <div className="px-3 py-2">
        <div className="bg-gray-900 border border-gray-800 rounded-lg p-3">
          <div className="flex items-center justify-between mb-2">
            <div className="text-xs font-medium text-white">Collection History</div>
            {/* Share Collection */}
            <button className="flex items-center gap-1 px-2 py-1 border border-gray-600/50 rounded-lg text-xs text-white bg-gray-800/30">
              <svg className="w-3 h-3 text-indigo-400" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M3 17a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1zm3.293-7.707a1 1 0 011.414 0L9 10.586V3a1 1 0 112 0v7.586l1.293-1.293a1 1 0 111.414 1.414l-3 3a1 1 0 01-1.414 0l-3-3a1 1 0 010-1.414z" clipRule="evenodd" />
              </svg>
              <span>Share Collection</span>
            </button>
          </div>

          {/* Summary Text */}
          <div className="flex items-center justify-between mb-2 text-xs">
            <div className="text-gray-400">{currentDateRange.label} <span className="text-indigo-500">{formatPrice(collectionData.totalValue)}</span> (0.00%)</div>
          </div>
          
                 {/* Chart */}
                 <div className="h-36 mb-2 px-3">
                   <svg width="100%" height="100%" viewBox="0 0 300 100" className="overflow-visible">
                     <defs>
                       {/* Gradient for area under line */}
                       <linearGradient id="chartGradient" x1="0%" y1="0%" x2="0%" y2="100%">
                         <stop offset="0%" stopColor="#6366f1" stopOpacity="0.3"/>
                         <stop offset="100%" stopColor="#6366f1" stopOpacity="0"/>
                       </linearGradient>
                     </defs>

                     {/* Dynamic chart based on time range */}
                     {timeRange === '7D' && (
                       <>
                         {/* Area under the line for 7D */}
                         <path
                           d="M 0 50 L 300 50 L 300 100 L 0 100 Z"
                           fill="url(#chartGradient)"
                         />
                         {/* Flat line for 7D */}
                         <line
                           x1="0"
                           y1="50"
                           x2="300"
                           y2="50"
                           stroke="#6366f1"
                           strokeWidth="2"
                           strokeLinecap="round"
                         />
                         {/* Data point circle */}
                         <circle
                           cx="300"
                           cy="50"
                           r="3"
                           fill="#6366f1"
                           stroke="#1f2937"
                           strokeWidth="1"
                         />
                       </>
                     )}

                     {timeRange === '1M' && (
                       <>
                         {/* Slight upward trend for 1M */}
                         <path
                           d="M 0 60 L 100 55 L 200 45 L 300 40 L 300 100 L 0 100 Z"
                           fill="url(#chartGradient)"
                         />
                         <path
                           d="M 0 60 L 100 55 L 200 45 L 300 40"
                           stroke="#6366f1"
                           strokeWidth="2"
                           strokeLinecap="round"
                           fill="none"
                         />
                         <circle
                           cx="300"
                           cy="40"
                           r="3"
                           fill="#6366f1"
                           stroke="#1f2937"
                           strokeWidth="1"
                         />
                       </>
                     )}

                     {timeRange === '3M' && (
                       <>
                         {/* More pronounced trend for 3M */}
                         <path
                           d="M 0 70 L 75 60 L 150 35 L 225 25 L 300 20 L 300 100 L 0 100 Z"
                           fill="url(#chartGradient)"
                         />
                         <path
                           d="M 0 70 L 75 60 L 150 35 L 225 25 L 300 20"
                           stroke="#6366f1"
                           strokeWidth="2"
                           strokeLinecap="round"
                           fill="none"
                         />
                         <circle
                           cx="300"
                           cy="20"
                           r="3"
                           fill="#6366f1"
                           stroke="#1f2937"
                           strokeWidth="1"
                         />
                       </>
                     )}

                     {timeRange === '6M' && (
                       <>
                         {/* Steep upward trend for 6M */}
                         <path
                           d="M 0 80 L 50 70 L 100 50 L 150 30 L 200 15 L 250 10 L 300 5 L 300 100 L 0 100 Z"
                           fill="url(#chartGradient)"
                         />
                         <path
                           d="M 0 80 L 50 70 L 100 50 L 150 30 L 200 15 L 250 10 L 300 5"
                           stroke="#6366f1"
                           strokeWidth="2"
                           strokeLinecap="round"
                           fill="none"
                         />
                         <circle
                           cx="300"
                           cy="5"
                           r="3"
                           fill="#6366f1"
                           stroke="#1f2937"
                           strokeWidth="1"
                         />
                       </>
                     )}

                     {timeRange === '1Y' && (
                       <>
                         {/* Dramatic upward trend for 1Y */}
                         <path
                           d="M 0 85 L 30 80 L 60 70 L 90 55 L 120 35 L 150 20 L 180 10 L 210 5 L 240 3 L 270 2 L 300 1 L 300 100 L 0 100 Z"
                           fill="url(#chartGradient)"
                         />
                         <path
                           d="M 0 85 L 30 80 L 60 70 L 90 55 L 120 35 L 150 20 L 180 10 L 210 5 L 240 3 L 270 2 L 300 1"
                           stroke="#6366f1"
                           strokeWidth="2"
                           strokeLinecap="round"
                           fill="none"
                         />
                         <circle
                           cx="300"
                           cy="1"
                           r="3"
                           fill="#6366f1"
                           stroke="#1f2937"
                           strokeWidth="1"
                         />
                       </>
                     )}
                   </svg>
                 </div>
          
                 {/* Date labels below chart */}
                 <div className="flex justify-between text-xs text-gray-500/60 mb-3 px-2">
                   <span>{formatDate(currentDateRange.dates[0])}</span>
                   <span>{formatDate(currentDateRange.dates[1])}</span>
                   <span>{formatDate(currentDateRange.dates[2])}</span>
                 </div>
          
                 {/* Time range buttons below chart - centered */}
                 <div className="flex justify-center gap-1 mb-3">
                   {['7D', '1M', '3M', '6M', '1Y'].map((range) => (
                     <button
                       key={range}
                       onClick={() => setTimeRange(range)}
                       className={`px-6 py-1.5 rounded-md text-xs ${
                         timeRange === range
                           ? 'bg-indigo-600 text-white'
                           : 'bg-gray-700/50 text-gray-300'
                       }`}
                     >
                       {range}
                     </button>
                   ))}
                 </div>
          
            {/* Disclaimer text - centered and smaller */}
            <div className="text-center text-xs text-gray-500/40 leading-tight px-6 py-4">
              <div>Collection history tracks the total value of your items for each day since the day they're added.</div>
            </div>
        </div>
      </div>



      {/* Collected Items */}
      <div className="px-3 py-2">
        <div className="p-3">
          <div className="flex items-center justify-between mb-2">
            <div>
              <div className="flex items-center gap-1">
                <span className="text-xs font-medium text-white">Collected Items •</span>
                <div className="relative" ref={filterDropdownRef}>
                  <button 
                    onClick={() => setShowFilterDropdown(!showFilterDropdown)}
                    className="text-xs font-medium text-indigo-400 hover:text-indigo-300 transition-colors"
                  >
                    {selectedFilter}
                  </button>
                  
                  {/* Filter Dropdown */}
                  {showFilterDropdown && (
                    <div className="absolute top-full left-0 mt-1 w-32 bg-gray-900 border border-gray-700 rounded-lg shadow-xl z-20">
                      <div className="py-1">
                        {['All', 'Ungraded', 'Graded', 'Sealed'].map((filter) => (
                          <button
                            key={filter}
                            onClick={() => {
                              setSelectedFilter(filter);
                              setShowFilterDropdown(false);
                            }}
                            className={`w-full text-left px-3 py-2 text-xs transition-colors ${
                              selectedFilter === filter
                                ? 'bg-indigo-500/20 text-indigo-400'
                                : 'text-white hover:bg-gray-800'
                            }`}
                          >
                            {filter}
                          </button>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              </div>
              <div className="text-xs text-gray-400">
                {selectedFilter === 'All' 
                  ? collectionData.items.length 
                  : collectionData.items.filter(item => item.status === selectedFilter).reduce((sum, item) => sum + item.quantity, 0)
                } Results
              </div>
            </div>
            <div className="text-right">
              <div className="text-xs font-medium text-white">Total Value • <span className="text-indigo-500">
                {formatPrice(
                  selectedFilter === 'All' 
                    ? collectionData.totalValue 
                    : collectionData.items
                        .filter(item => item.status === selectedFilter)
                        .reduce((sum, item) => sum + (item.value * item.quantity), 0)
                )}
              </span></div>
              <div className="text-xs text-gray-400">Press + Hold To Multi-Select</div>
            </div>
          </div>

        {/* Item Matching Manager */}
        <div className="mb-6">
          <ItemMatchingManager />
        </div>

        {/* Search Bar */}
        <div className="relative mb-3">
          <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
            <svg className="h-3 w-3 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
          </div>
          <input
            type="text"
            placeholder="Search your items..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-8 pr-3 py-2 bg-gray-800 border border-gray-700 rounded-lg text-xs text-white placeholder-gray-400 focus:outline-none focus:ring-1 focus:ring-indigo-500 focus:border-transparent"
          />
        </div>

        {/* Filter Buttons */}
        <div className="flex gap-2 mb-3">
          <button className="flex items-center gap-1 px-2 py-1 bg-gray-800 border border-gray-700 rounded-lg text-xs text-white hover:bg-gray-700 transition-colors">
            <svg className="h-3 w-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            Sort By Recent
          </button>
          <button className="flex items-center gap-1 px-2 py-1 bg-gray-800 border border-gray-700 rounded-lg text-xs text-white hover:bg-gray-700 transition-colors">
            <svg className="h-3 w-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 4a1 1 0 011-1h16a1 1 0 011 1v2.586a1 1 0 01-.293.707l-6.414 6.414a1 1 0 00-.293.707V17l-4 4v-6.586a1 1 0 00-.293-.707L3.293 7.293A1 1 0 013 6.586V4z" />
            </svg>
            All Items
          </button>
        </div>

        {/* Items Grid */}
        <div className="grid grid-cols-2 gap-3">
          {collectionData.items
            .filter(item => selectedFilter === 'All' || item.status === selectedFilter)
            .map((item) => {
            const isSelected = selectedItems.has(item.id);
            return (
                   <div 
                     key={item.id} 
                     className={`relative border rounded-lg overflow-hidden transition-all duration-200 ${
                       isSelected 
                         ? 'border-indigo-500 bg-indigo-900/20' 
                         : 'border-gray-700 hover:border-gray-600'
                     }`}
                     onTouchStart={(e) => {
                       longPressTriggeredRef.current = false;
                       longPressRef.current = setTimeout(() => {
                         handleLongPress(item.id);
                         longPressTriggeredRef.current = true;
                         longPressRef.current = null;
                       }, 500);
                     }}
                     onTouchEnd={(e) => {
                       if (longPressRef.current) {
                         clearTimeout(longPressRef.current);
                         longPressRef.current = null;
                       }
                     }}
                     onMouseDown={(e) => {
                       if (e.button === 0) { // Left click
                         longPressTriggeredRef.current = false;
                         longPressRef.current = setTimeout(() => {
                           handleLongPress(item.id);
                           longPressTriggeredRef.current = true;
                           longPressRef.current = null;
                         }, 500);
                       }
                     }}
                     onMouseUp={(e) => {
                       if (longPressRef.current) {
                         clearTimeout(longPressRef.current);
                         longPressRef.current = null;
                       }
                     }}
                     onClick={(e) => {
                       // Prevent click if long press was triggered
                       if (longPressTriggeredRef.current) {
                         e.preventDefault();
                         e.stopPropagation();
                         longPressTriggeredRef.current = false;
                         return;
                       }
                       
                       // Only handle click if we're already in selection mode
                       if (isSelectionMode) {
                         e.preventDefault();
                         handleItemSelect(item.id);
                       }
                     }}
                   >
              {/* Card Image */}
              <div className="aspect-[4/3] flex items-center justify-center py-2 relative">
                {/* Status Pill - Top Left */}
                <div className={`absolute top-2 left-2 z-10 inline-block px-2 py-0.5 rounded-full text-xs font-medium ${
                  item.status === 'Ungraded' ? 'bg-yellow-500/60 text-yellow-100' :
                  item.status === 'Graded' ? 'bg-purple-500/60 text-purple-100' :
                  item.status === 'Sealed' ? 'bg-blue-500/60 text-blue-100' :
                  'bg-gray-500/60 text-gray-100'
                }`}>
                  {item.status}
                </div>
                
                {item.image ? (
                  <img 
                    src={item.image} 
                    alt={item.name}
                    className="w-full h-full object-contain"
                    onError={(e) => {
                      e.target.style.display = 'none';
                      e.target.nextSibling.style.display = 'flex';
                    }}
                  />
                ) : null}
                <div className={`w-full h-full flex items-center justify-center bg-gray-800 ${item.image ? 'hidden' : 'flex'}`}>
                  <div className="text-center">
                    <div className="text-2xl mb-1">📦</div>
                  <div className="text-gray-400 text-xs">No Image</div>
                  </div>
                </div>
              </div>
              
              {/* Card Details */}
              <div className="p-2 space-y-1">
                {/* Item Name - First Line */}
                <div>
                  <h3 className="text-white leading-tight line-clamp-2 font-bold" style={{fontSize: '12px'}}>
                    {item.name}
                  </h3>
                </div>
                
                {/* Set Name - Ghost Text */}
                <div className="text-xs text-gray-400 truncate" style={{fontSize: '12px'}}>
                  {item.set}
                </div>
                
                {/* Spacing */}
                <div className="h-1"></div>
                
                {/* Financial Details */}
                <div className="space-y-0.5">
                  <div className="text-xs text-white" style={{fontSize: '12px'}}>
                    {item.value > 0 ? formatPrice(item.value) : 'No Market Data'} Value • Qty {item.quantity}
                  </div>
                  <div className="flex items-center justify-between">
                    <div className="text-xs text-white" style={{fontSize: '12px'}}>
                      {formatPrice(item.paid)} Paid 
                      {item.value > 0 ? (
                      <span className={`ml-1 ${item.profit > 0 ? 'text-green-400' : 'text-red-400'}`}>
                        ({item.profit > 0 ? '+' : ''}{item.profitPercent.toFixed(1)}%)
                      </span>
                      ) : (
                        <span className="ml-1 text-gray-400">(No market data)</span>
                      )}
                    </div>
                    
                    {/* Menu Button / Check Icon - Bottom Right */}
                    {isSelected ? (
                      <div className="text-indigo-400">
                        <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                          <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                        </svg>
                      </div>
                    ) : (
                      <button 
                        onClick={(e) => {
                          e.stopPropagation();
                          setSelectedItemId(item.id);
                          setShowItemMenu(true);
                        }}
                        className="text-gray-400 hover:text-white"
                      >
                        <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 20 20">
                          <path d="M10 6a2 2 0 110-4 2 2 0 010 4zM10 12a2 2 0 110-4 2 2 0 010 4zM10 18a2 2 0 110-4 2 2 0 010 4z" />
                        </svg>
                      </button>
                    )}
                  </div>
                </div>
              </div>
            </div>
            );
          })}
        </div>
        </div>
      </div>

      {/* Bulk Actions Bar - Fixed at bottom */}
      {isSelectionMode && (
        <div className="fixed bottom-16 left-0 right-0 z-50">
          <div className="bg-indigo-600 border-t border-indigo-500 px-4 py-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <span className="text-sm text-white font-medium">
                  {selectedItems.size}/{collectionData.items.filter(item => selectedFilter === 'All' || item.status === selectedFilter).length} Selected
                </span>
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={selectAll}
                  className="px-3 py-1 bg-indigo-500 hover:bg-indigo-400 rounded-md text-xs text-white transition-colors"
                >
                  Select All
                </button>
                <button 
                  onClick={() => setShowBulkActionsMenu(true)}
                  className="px-3 py-1 bg-indigo-500 hover:bg-indigo-400 rounded-md text-xs text-white transition-colors flex items-center gap-1"
                >
                  Bulk Actions
                  <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M5.293 7.293a1 1 0 011.414 0L10 10.586l3.293-3.293a1 1 0 111.414 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414z" clipRule="evenodd" />
                  </svg>
                </button>
                <button
                  onClick={clearSelection}
                  className="text-white hover:text-indigo-200 transition-colors"
                >
                  <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd" />
                  </svg>
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Bulk Actions Menu Overlay */}
      {showBulkActionsMenu && (
        <div 
          className="fixed inset-0 bg-black/50 z-50 flex items-end"
          onClick={() => setShowBulkActionsMenu(false)}
        >
          <div 
            className="w-full bg-gray-950 border border-indigo-500/50 rounded-t-2xl max-h-[80vh] overflow-y-auto"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header */}
            <div className="px-6 pt-6 pb-4">
              <h2 className="text-sm font-semibold text-white">
                Change {selectedItems.size} Selection{selectedItems.size !== 1 ? 's' : ''}
              </h2>
            </div>

            {/* Action Options */}
            <div className="px-3 pb-6 space-y-1">
              {/* Edit Price Paid */}
              <button className="w-full flex items-center justify-between p-3 hover:bg-gray-700/50 transition-colors">
                <div className="flex items-center gap-3">
                  <svg className="w-4 h-4 text-indigo-400" fill="currentColor" viewBox="0 0 20 20">
                    <path d="M13.586 3.586a2 2 0 112.828 2.828l-.793.793-2.828-2.828.793-.793zM11.379 5.793L3 14.172V17h2.828l8.38-8.379-2.83-2.828z"/>
                  </svg>
                  <div className="text-left">
                    <div className="text-xs font-medium text-white">Edit Price Paid</div>
                    <div className="text-xs text-gray-400">Change the price you paid for these selections.</div>
                  </div>
                </div>
                <svg className="w-4 h-4 text-gray-400" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M7.293 14.707a1 1 0 010-1.414L10.586 10 7.293 6.707a1 1 0 011.414-1.414l4 4a1 1 0 010 1.414l-4 4a1 1 0 01-1.414 0z" clipRule="evenodd" />
                </svg>
              </button>

              {/* Change Group */}
              <button className="w-full flex items-center justify-between p-3 hover:bg-gray-700/50 transition-colors">
                <div className="flex items-center gap-3">
                  <svg className="w-4 h-4 text-indigo-400" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M3 4a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1zm0 4a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1zm0 4a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1zm0 4a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1z" clipRule="evenodd"/>
                  </svg>
                  <div className="text-left">
                    <div className="text-xs font-medium text-white">Change Group</div>
                    <div className="text-xs text-gray-400">Move these selections to another group in your collection.</div>
                  </div>
                </div>
                <svg className="w-4 h-4 text-gray-400" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M7.293 14.707a1 1 0 010-1.414L10.586 10 7.293 6.707a1 1 0 011.414-1.414l4 4a1 1 0 010 1.414l-4 4a1 1 0 01-1.414 0z" clipRule="evenodd" />
                </svg>
              </button>

              {/* Set Custom Tags */}
              <button className="w-full flex items-center justify-between p-3 hover:bg-gray-700/50 transition-colors">
                <div className="flex items-center gap-3">
                  <svg className="w-4 h-4 text-indigo-400" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M17.707 9.293a1 1 0 010 1.414l-7 7a1 1 0 01-1.414 0l-7-7A.997.997 0 012 10V5a3 3 0 013-3h5c.256 0 .512.098.707.293l7 7zM5 6a1 1 0 100-2 1 1 0 000 2z" clipRule="evenodd"/>
                  </svg>
                  <div className="text-left">
                    <div className="text-xs font-medium text-white">Set Custom Tags</div>
                    <div className="text-xs text-gray-400">Tag these selections with a custom searchable note.</div>
                  </div>
                </div>
                <svg className="w-4 h-4 text-gray-400" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M7.293 14.707a1 1 0 010-1.414L10.586 10 7.293 6.707a1 1 0 011.414-1.414l4 4a1 1 0 010 1.414l-4 4a1 1 0 01-1.414 0z" clipRule="evenodd" />
                </svg>
              </button>

              {/* Delete All Selected */}
              <button className="w-full flex items-center justify-between p-3 hover:bg-gray-700/50 transition-colors">
                <div className="flex items-center gap-3">
                  <svg className="w-4 h-4 text-red-400" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M9 2a1 1 0 000 2h2a1 1 0 100-2H9z" clipRule="evenodd"/>
                    <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd"/>
                  </svg>
                  <div className="text-left">
                    <div className="text-xs text-red-400 font-medium">Delete All Selected</div>
                    <div className="text-xs text-gray-400">Remove these selections from your collection.</div>
                  </div>
                </div>
                <svg className="w-4 h-4 text-gray-400" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M7.293 14.707a1 1 0 010-1.414L10.586 10 7.293 6.707a1 1 0 011.414-1.414l4 4a1 1 0 010 1.414l-4 4a1 1 0 01-1.414 0z" clipRule="evenodd" />
                </svg>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Individual Item Menu Overlay */}
      {showItemMenu && (
        <div 
          className="fixed inset-0 bg-black/50 z-50 flex items-end"
          onClick={() => setShowItemMenu(false)}
        >
          <div 
            className="w-full bg-gray-950 border border-indigo-500/50 rounded-t-2xl max-h-[80vh] overflow-y-auto"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header */}
            <div className="px-6 pt-6 pb-4">
              <h2 className="text-sm font-semibold text-white">
                Manage Collected Product
              </h2>
            </div>

            {/* Action Options */}
            <div className="px-3 pb-6 space-y-1">
              {/* Set Custom Price */}
              <button className="w-full flex items-center justify-between p-3 hover:bg-gray-700/50 transition-colors">
                <div className="flex items-center gap-3">
                  <svg className="w-4 h-4 text-indigo-400" fill="currentColor" viewBox="0 0 20 20">
                    <path d="M8.433 7.418c.155-.103.346-.196.567-.267v1.698a2.305 2.305 0 01-.567-.267C8.07 8.34 8 8.114 8 8c0-.114.07-.34.433-.582zM11 12.849v-1.698c.22.071.412.164.567.267.364.243.433.468.433.582 0 .114-.07.34-.433.582a2.305 2.305 0 01-.567.267z"/>
                    <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm1-13a1 1 0 10-2 0v.092a4.535 4.535 0 00-1.676.662C6.602 6.234 6 7.009 6 8c0 .99.602 1.765 1.324 2.246.48.32 1.054.545 1.676.662v1.941c-.391-.127-.68-.317-.843-.504a1 1 0 10-1.51 1.31c.562.649 1.413 1.076 2.353 1.253V15a1 1 0 102 0v-.092a4.535 4.535 0 001.676-.662C13.398 13.766 14 12.991 14 12c0-.99-.602-1.765-1.324-2.246A4.535 4.535 0 0011 9.092V7.151c.391.127.68.317.843.504a1 1 0 101.511-1.31c-.563-.649-1.413-1.076-2.354-1.253V5z" clipRule="evenodd"/>
                  </svg>
                  <div className="text-left">
                    <div className="text-xs font-medium text-white">Set Custom Price</div>
                    <div className="text-xs text-gray-400">Override this product's price with your own.</div>
                  </div>
                </div>
                <svg className="w-4 h-4 text-gray-400" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M7.293 14.707a1 1 0 010-1.414L10.586 10 7.293 6.707a1 1 0 011.414-1.414l4 4a1 1 0 010 1.414l-4 4a1 1 0 01-1.414 0z" clipRule="evenodd" />
                </svg>
              </button>

              {/* Edit Price Paid */}
              <button className="w-full flex items-center justify-between p-3 hover:bg-gray-700/50 transition-colors">
                <div className="flex items-center gap-3">
                  <svg className="w-4 h-4 text-indigo-400" fill="currentColor" viewBox="0 0 20 20">
                    <path d="M13.586 3.586a2 2 0 112.828 2.828l-.793.793-2.828-2.828.793-.793zM11.379 5.793L3 14.172V17h2.828l8.38-8.379-2.83-2.828z"/>
                  </svg>
                  <div className="text-left">
                    <div className="text-xs font-medium text-white">Edit Price Paid</div>
                    <div className="text-xs text-gray-400">Change the price you paid for this product.</div>
                  </div>
                </div>
                <svg className="w-4 h-4 text-gray-400" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M7.293 14.707a1 1 0 010-1.414L10.586 10 7.293 6.707a1 1 0 011.414-1.414l4 4a1 1 0 010 1.414l-4 4a1 1 0 01-1.414 0z" clipRule="evenodd" />
                </svg>
              </button>

              {/* Mark Sold */}
              <button className="w-full flex items-center justify-between p-3 hover:bg-gray-700/50 transition-colors">
                <div className="flex items-center gap-3">
                  <svg className="w-4 h-4 text-indigo-400" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd"/>
                  </svg>
                  <div className="text-left">
                    <div className="text-xs font-medium text-white">Mark Sold</div>
                    <div className="text-xs text-gray-400">Add this product to the sold items log.</div>
                  </div>
                </div>
                <svg className="w-4 h-4 text-gray-400" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M7.293 14.707a1 1 0 010-1.414L10.586 10 7.293 6.707a1 1 0 011.414-1.414l4 4a1 1 0 010 1.414l-4 4a1 1 0 01-1.414 0z" clipRule="evenodd" />
                </svg>
              </button>

              {/* Delete Product */}
              <button className="w-full flex items-center justify-between p-3 hover:bg-gray-700/50 transition-colors">
                <div className="flex items-center gap-3">
                  <svg className="w-4 h-4 text-red-400" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M9 2a1 1 0 000 2h2a1 1 0 100-2H9z" clipRule="evenodd"/>
                    <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd"/>
                  </svg>
                  <div className="text-left">
                    <div className="text-xs text-red-400 font-medium">Delete Product</div>
                    <div className="text-xs text-gray-400">Remove this product from your collection.</div>
                  </div>
                </div>
                <svg className="w-4 h-4 text-gray-400" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M7.293 14.707a1 1 0 010-1.414L10.586 10 7.293 6.707a1 1 0 011.414-1.414l4 4a1 1 0 010 1.414l-4 4a1 1 0 01-1.414 0z" clipRule="evenodd" />
                </svg>
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
};

export default Collection;