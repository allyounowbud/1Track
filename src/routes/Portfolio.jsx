// src/routes/Portfolio.jsx
import { useState, useEffect, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { useLocation } from "react-router-dom";
import { supabase } from "../lib/supabaseClient";
import LayoutWithSidebar from "../components/LayoutWithSidebar.jsx";
import PageHeader from "../components/PageHeader.jsx";
import { centsToStr, formatNumber } from "../utils/money.js";
import { card, inputBase, rowCard } from "../utils/ui.js";

// Icons
const TrendingUpIcon = () => (
  <svg className="w-5 h-5" viewBox="0 0 20 20" fill="currentColor">
    <path fillRule="evenodd" d="M3.293 9.707a1 1 0 010-1.414l6-6a1 1 0 011.414 0l6 6a1 1 0 01-1.414 1.414L11 5.414V17a1 1 0 11-2 0V5.414L4.707 9.707a1 1 0 01-1.414 0z" clipRule="evenodd" />
  </svg>
);

const TrendingDownIcon = () => (
  <svg className="w-5 h-5" viewBox="0 0 20 20" fill="currentColor">
    <path fillRule="evenodd" d="M16.707 10.293a1 1 0 010 1.414l-6 6a1 1 0 01-1.414 0l-6-6a1 1 0 111.414-1.414L9 14.586V3a1 1 0 012 0v11.586l4.293-4.293a1 1 0 011.414 0z" clipRule="evenodd" />
  </svg>
);

const CollectionIcon = () => (
  <svg className="w-5 h-5" viewBox="0 0 20 20" fill="currentColor">
    <path fillRule="evenodd" d="M3 4a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1zm0 4a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1zm0 4a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1zm0 4a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1z" clipRule="evenodd" />
  </svg>
);

const ChartIcon = () => (
  <svg className="w-5 h-5" viewBox="0 0 20 20" fill="currentColor">
    <path d="M2 11a1 1 0 011-1h2a1 1 0 011 1v5a1 1 0 01-1 1H3a1 1 0 01-1-1v-5zM8 7a1 1 0 011-1h2a1 1 0 011 1v9a1 1 0 01-1 1H9a1 1 0 01-1-1V7zM14 4a1 1 0 011-1h2a1 1 0 011 1v12a1 1 0 01-1 1h-2a1 1 0 01-1-1V4z" />
  </svg>
);

/* ----------------------------- data ---------------------------- */
async function getOrders() {
  const { data, error } = await supabase
    .from("orders")
    .select(
      "id, order_date, sale_date, item, buy_price_cents, sale_price_cents, fees_pct, shipping_cents, status"
    )
    .order("order_date", { ascending: false });
  if (error) throw error;
  return data || [];
}

async function getPortfolioItems() {
  // Get all unique items from orders that are currently in inventory (not sold)
  const { data, error } = await supabase
    .from("orders")
    .select("item, buy_price_cents, order_date")
    .eq("status", "ordered")
    .order("order_date", { ascending: false });
  
  if (error) throw error;
  return data || [];
}

// Get market data for a product using the search API
async function getProductMarketData(productName) {
  try {
    const response = await fetch(`/.netlify/functions/search-products-api?q=${encodeURIComponent(productName)}&category=pokemon_cards`);
    const data = await response.json();
    
    if (data.success && data.results && data.results.length > 0) {
      // Return the first (most relevant) result
      const product = data.results[0];
      return {
        product_id: product.product_id,
        product_name: product.product_name,
        console_name: product.console_name,
        loose_price: product.loose_price,
        cib_price: product.cib_price,
        new_price: product.new_price,
        image_url: product.image_url
      };
    }
    return null;
  } catch (error) {
    console.error('Error fetching market data:', error);
    return null;
  }
}

// Batch fetch market data for multiple products
async function getBatchMarketData(productNames) {
  const results = {};
  
  // Process in batches to avoid overwhelming the API
  const batchSize = 5;
  for (let i = 0; i < productNames.length; i += batchSize) {
    const batch = productNames.slice(i, i + batchSize);
    const promises = batch.map(async (name) => {
      const data = await getProductMarketData(name);
      return { name, data };
    });
    
    const batchResults = await Promise.all(promises);
    batchResults.forEach(({ name, data }) => {
      results[name] = data;
    });
    
    // Small delay between batches
    if (i + batchSize < productNames.length) {
      await new Promise(resolve => setTimeout(resolve, 200));
    }
  }
  
  return results;
}

/* ----------------------------- Portfolio Content Router ---------------------------- */
function PortfolioContent({ orders, portfolioItems, marketData, currentTab }) {
  switch (currentTab) {
    case 'collection':
      return <CollectionTab portfolioItems={portfolioItems} marketData={marketData} />;
    case 'trends':
      return <TrendsTab orders={orders} />;
    case 'overview':
    default:
      return <OverviewTab orders={orders} portfolioItems={portfolioItems} marketData={marketData} />;
  }
}

/* ----------------------------- Overview Tab ---------------------------- */
function OverviewTab({ orders, portfolioItems, marketData }) {
  // Calculate portfolio metrics
  const metrics = useMemo(() => {
    const totalItems = portfolioItems.length;
    const totalCost = portfolioItems.reduce((sum, item) => sum + (item.buy_price_cents || 0), 0);
    
    // Calculate current market value using real API data
    let estimatedMarketValue = 0;
    portfolioItems.forEach(item => {
      const marketInfo = marketData[item.item];
      if (marketInfo && marketInfo.loose_price) {
        // Use loose price as market value (convert to cents)
        estimatedMarketValue += Math.round(parseFloat(marketInfo.loose_price) * 100);
      } else {
        // Fallback to cost if no market data available
        estimatedMarketValue += item.buy_price_cents || 0;
      }
    });
    
    const totalProfit = estimatedMarketValue - totalCost;
    const profitPercentage = totalCost > 0 ? (totalProfit / totalCost) * 100 : 0;

    return {
      totalItems,
      totalCost,
      estimatedMarketValue,
      totalProfit,
      profitPercentage,
    };
  }, [portfolioItems, marketData]);

  return (
    <div className="space-y-6">
      {/* Portfolio Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className={`${card} p-6`}>
          <div className="flex items-center justify-between">
            <div>
              <p className="text-slate-400 text-sm">Total Items</p>
              <p className="text-2xl font-bold text-slate-100">{formatNumber(metrics.totalItems)}</p>
            </div>
            <div className="p-3 bg-yellow-500/20 rounded-xl">
              <CollectionIcon />
            </div>
          </div>
        </div>

        <div className={`${card} p-6`}>
          <div className="flex items-center justify-between">
            <div>
              <p className="text-slate-400 text-sm">Total Cost</p>
              <p className="text-2xl font-bold text-slate-100">{centsToStr(metrics.totalCost)}</p>
            </div>
            <div className="p-3 bg-slate-500/20 rounded-xl">
              <svg className="w-5 h-5" viewBox="0 0 20 20" fill="currentColor">
                <path d="M8.433 7.418c.155-.103.346-.196.567-.267v1.698a2.305 2.305 0 01-.567-.267C8.07 8.34 8 8.114 8 8c0-.114.07-.34.433-.582zM11 12.849v-1.698c.22.071.412.164.567.267.364.243.433.468.433.582 0 .114-.07.34-.433.582a2.305 2.305 0 01-.567.267z" />
                <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm1-13a1 1 0 10-2 0v.092a4.535 4.535 0 00-1.676.662C6.602 6.234 6 7.009 6 8c0 .99.602 1.765 1.324 2.246.48.32 1.054.545 1.676.662v1.941c-.391-.127-.68-.317-.843-.504a1 1 0 10-1.51 1.31c.562.649 1.413 1.076 2.353 1.253V15a1 1 0 102 0v-.092a4.535 4.535 0 001.676-.662C13.398 13.766 14 12.991 14 12c0-.99-.602-1.765-1.324-2.246A4.535 4.535 0 0011 9.092V7.151c.391.127.68.317.843.504a1 1 0 101.511-1.31c-.563-.649-1.413-1.076-2.354-1.253V5z" clipRule="evenodd" />
              </svg>
            </div>
          </div>
        </div>

        <div className={`${card} p-6`}>
          <div className="flex items-center justify-between">
            <div>
              <p className="text-slate-400 text-sm">Market Value</p>
              <p className="text-2xl font-bold text-slate-100">{centsToStr(metrics.estimatedMarketValue)}</p>
            </div>
            <div className="p-3 bg-green-500/20 rounded-xl">
              <TrendingUpIcon />
            </div>
          </div>
        </div>

        <div className={`${card} p-6`}>
          <div className="flex items-center justify-between">
            <div>
              <p className="text-slate-400 text-sm">Total Profit</p>
              <p className={`text-2xl font-bold ${metrics.totalProfit >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                {centsToStr(metrics.totalProfit)}
              </p>
              <p className={`text-sm ${metrics.profitPercentage >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                {metrics.profitPercentage >= 0 ? '+' : ''}{metrics.profitPercentage.toFixed(1)}%
              </p>
            </div>
            <div className={`p-3 rounded-xl ${metrics.totalProfit >= 0 ? 'bg-green-500/20' : 'bg-red-500/20'}`}>
              {metrics.totalProfit >= 0 ? <TrendingUpIcon /> : <TrendingDownIcon />}
            </div>
          </div>
        </div>
      </div>

      {/* Recent Activity */}
      <div className={`${card} p-6`}>
        <h3 className="text-lg font-semibold text-slate-100 mb-4">Recent Activity</h3>
        <div className="space-y-3">
          {orders.slice(0, 5).map((order) => (
            <div key={order.id} className="flex items-center justify-between py-2 border-b border-slate-800 last:border-b-0">
              <div className="flex items-center gap-3">
                <div className={`w-2 h-2 rounded-full ${order.status === 'sold' ? 'bg-green-500' : 'bg-yellow-500'}`}></div>
                <div>
                  <p className="text-slate-200 text-sm">{order.item}</p>
                  <p className="text-slate-400 text-xs">{order.order_date}</p>
                </div>
              </div>
              <div className="text-right">
                <p className="text-slate-200 text-sm">{centsToStr(order.buy_price_cents)}</p>
                <p className="text-slate-400 text-xs">{order.status}</p>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

/* ----------------------------- Collection Tab ---------------------------- */
function CollectionTab({ portfolioItems, marketData }) {
  const [searchTerm, setSearchTerm] = useState("");

  const filteredItems = useMemo(() => {
    if (!searchTerm) return portfolioItems;
    return portfolioItems.filter(item => 
      item.item?.toLowerCase().includes(searchTerm.toLowerCase())
    );
  }, [portfolioItems, searchTerm]);

  return (
    <div className="space-y-6">
      {/* Search */}
      <div className={`${card} p-6`}>
        <div className="flex items-center gap-4">
          <div className="flex-1">
            <input
              type="text"
              placeholder="Search your collection..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className={`${inputBase} w-full`}
            />
          </div>
          <div className="text-slate-400 text-sm">
            {filteredItems.length} item{filteredItems.length !== 1 ? 's' : ''}
          </div>
        </div>
      </div>

      {/* Collection Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {filteredItems.map((item, index) => {
          const marketInfo = marketData[item.item];
          const currentMarketValue = marketInfo && marketInfo.loose_price 
            ? Math.round(parseFloat(marketInfo.loose_price) * 100)
            : item.buy_price_cents;
          const profit = currentMarketValue - item.buy_price_cents;
          const profitPercentage = item.buy_price_cents > 0 ? (profit / item.buy_price_cents) * 100 : 0;
          
          return (
            <div key={index} className={`${card} p-4 hover:bg-slate-800/60 transition-colors`}>
              <div className="flex items-start justify-between mb-3">
                <div className="flex-1 min-w-0">
                  <h4 className="text-slate-200 font-medium truncate">{item.item}</h4>
                  {marketInfo && marketInfo.console_name && (
                    <p className="text-slate-400 text-xs truncate">{marketInfo.console_name}</p>
                  )}
                  <p className="text-slate-400 text-sm">Added {item.order_date}</p>
                </div>
                <div className="text-right">
                  <p className="text-slate-200 font-medium">{centsToStr(item.buy_price_cents)}</p>
                  <p className="text-slate-400 text-xs">Cost</p>
                </div>
              </div>
              
              {/* Product image */}
              <div className="w-full h-32 bg-slate-800 rounded-lg mb-3 flex items-center justify-center overflow-hidden">
                {marketInfo && marketInfo.image_url ? (
                  <img 
                    src={marketInfo.image_url} 
                    alt={item.item}
                    className="w-full h-full object-cover"
                    onError={(e) => {
                      e.target.style.display = 'none';
                      e.target.nextSibling.style.display = 'flex';
                    }}
                  />
                ) : null}
                <div className="w-full h-full flex items-center justify-center" style={{ display: marketInfo && marketInfo.image_url ? 'none' : 'flex' }}>
                  <CollectionIcon />
                </div>
              </div>
              
              {/* Market value and profit */}
              <div className="space-y-2">
                <div className="flex justify-between items-center">
                  <span className="text-slate-400 text-sm">Market Value:</span>
                  <span className="text-green-400 text-sm font-medium">
                    {centsToStr(currentMarketValue)}
                  </span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-slate-400 text-sm">Profit:</span>
                  <span className={`text-sm font-medium ${profit >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                    {profit >= 0 ? '+' : ''}{centsToStr(profit)} ({profitPercentage >= 0 ? '+' : ''}{profitPercentage.toFixed(1)}%)
                  </span>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {filteredItems.length === 0 && (
        <div className={`${card} p-8 text-center`}>
          <CollectionIcon />
          <p className="text-slate-400 mt-2">No items found in your collection</p>
        </div>
      )}
    </div>
  );
}

/* ----------------------------- Trends Tab ---------------------------- */
function TrendsTab({ orders }) {
  // Calculate trends over time (placeholder data)
  const trends = useMemo(() => {
    const monthlyData = {};
    
    orders.forEach(order => {
      const month = order.order_date?.substring(0, 7); // YYYY-MM
      if (month) {
        if (!monthlyData[month]) {
          monthlyData[month] = { count: 0, value: 0 };
        }
        monthlyData[month].count++;
        monthlyData[month].value += order.buy_price_cents || 0;
      }
    });

    return Object.entries(monthlyData)
      .sort(([a], [b]) => a.localeCompare(b))
      .slice(-6); // Last 6 months
  }, [orders]);

  return (
    <div className="space-y-6">
      {/* Trends Overview */}
      <div className={`${card} p-6`}>
        <h3 className="text-lg font-semibold text-slate-100 mb-4">Monthly Trends</h3>
        <div className="space-y-4">
          {trends.map(([month, data]) => (
            <div key={month} className="flex items-center justify-between">
              <div>
                <p className="text-slate-200 font-medium">{month}</p>
                <p className="text-slate-400 text-sm">{data.count} items</p>
              </div>
              <div className="text-right">
                <p className="text-slate-200 font-medium">{centsToStr(data.value)}</p>
                <p className="text-slate-400 text-sm">Total value</p>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Top Performing Items */}
      <div className={`${card} p-6`}>
        <h3 className="text-lg font-semibold text-slate-100 mb-4">Top Performing Items</h3>
        <div className="space-y-3">
          {orders.slice(0, 5).map((order) => (
            <div key={order.id} className="flex items-center justify-between">
              <div>
                <p className="text-slate-200 text-sm">{order.item}</p>
                <p className="text-slate-400 text-xs">{order.order_date}</p>
              </div>
              <div className="text-right">
                <p className="text-green-400 text-sm font-medium">+10%</p>
                <p className="text-slate-400 text-xs">Appreciation</p>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

/* ====================== MAIN COMPONENT ====================== */
export default function Portfolio() {
  const location = useLocation();
  const [marketData, setMarketData] = useState({});
  const [isLoadingMarketData, setIsLoadingMarketData] = useState(false);

  // Determine current tab from URL path
  const currentTab = useMemo(() => {
    const path = location.pathname;
    if (path.includes('/collection')) return 'collection';
    if (path.includes('/trends')) return 'trends';
    return 'overview';
  }, [location.pathname]);

  // Determine active sidebar item based on current tab
  const activeSidebarItem = useMemo(() => {
    switch (currentTab) {
      case 'collection': return 'portfolio-collection';
      case 'trends': return 'portfolio-trends';
      default: return 'portfolio-overview';
    }
  }, [currentTab]);

  const { data: orders = [], isLoading: ordersLoading } = useQuery({
    queryKey: ["portfolio-orders"],
    queryFn: getOrders,
  });

  const { data: portfolioItems = [], isLoading: itemsLoading } = useQuery({
    queryKey: ["portfolio-items"],
    queryFn: getPortfolioItems,
  });

  // Fetch market data when portfolio items change
  useEffect(() => {
    if (portfolioItems.length > 0) {
      setIsLoadingMarketData(true);
      const uniqueProductNames = [...new Set(portfolioItems.map(item => item.item))];
      
      getBatchMarketData(uniqueProductNames)
        .then(data => {
          setMarketData(data);
          setIsLoadingMarketData(false);
        })
        .catch(error => {
          console.error('Error fetching market data:', error);
          setIsLoadingMarketData(false);
        });
    }
  }, [portfolioItems]);

  const isLoading = ordersLoading || itemsLoading;

  if (isLoading) {
    return (
      <LayoutWithSidebar active={activeSidebarItem} section="portfolio">
        <PageHeader title="Portfolio" />
        <div className="flex items-center justify-center h-64">
          <div className="text-slate-400">Loading portfolio...</div>
        </div>
      </LayoutWithSidebar>
    );
  }

  return (
    <LayoutWithSidebar active={activeSidebarItem} section="portfolio">
      <PageHeader title="Portfolio" />
      
      {isLoadingMarketData && (
        <div className={`${card} p-6 text-center mb-6`}>
          <div className="text-slate-400">Loading market data...</div>
        </div>
      )}

      <PortfolioContent 
        orders={orders} 
        portfolioItems={portfolioItems} 
        marketData={marketData} 
        currentTab={currentTab} 
      />
    </LayoutWithSidebar>
  );
}
