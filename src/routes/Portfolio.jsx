// src/routes/Portfolio.jsx
import { useState, useEffect, useMemo, useRef } from "react";
import { useQuery } from "@tanstack/react-query";
import { useLocation } from "react-router-dom";
import { supabase } from "../lib/supabaseClient";
import LayoutWithSidebar from "../components/LayoutWithSidebar.jsx";
import PageHeader from "../components/PageHeader.jsx";
import { centsToStr, formatNumber } from "../utils/money.js";
import { card, inputBase, rowCard } from "../utils/ui.js";
import { getBatchMarketData, getMarketValueInCents } from "../services/marketDataService.js";
import { getBackgroundMarketData, isBackgroundLoadingComplete } from "../services/backgroundMarketDataService.js";
import SearchPage from "../components/SearchPage.jsx";
import Stats from "./Stats.jsx";

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



/* ----------------------------- Portfolio Chart Component ---------------------------- */
function PortfolioChart({ data }) {
  const svgRef = useRef(null);

  useEffect(() => {
    if (!svgRef.current || !data || data.length === 0) return;

    try {
      const svg = svgRef.current;
      const width = svg.clientWidth || 800;
      const height = svg.clientHeight || 256;
      const padding = { top: 20, right: 20, bottom: 40, left: 60 };

      // Clear previous content
      svg.innerHTML = '';

      // Validate data
      if (data.length === 0) return;

      // Calculate scales
      const xMin = Math.min(...data.map(d => d.x));
      const xMax = Math.max(...data.map(d => d.x));
      const yMin = Math.min(...data.map(d => d.y));
      const yMax = Math.max(...data.map(d => d.y));
      
      // Handle edge case where all values are the same
      const xRange = xMax - xMin || 1;
      const yRange = yMax - yMin || 1;

      const xScale = (x) => (x - xMin) / xRange * (width - padding.left - padding.right) + padding.left;
      const yScale = (y) => height - padding.bottom - ((y - yMin) / yRange) * (height - padding.top - padding.bottom);

    // Create gradient for the area under the line
    const gradient = document.createElementNS('http://www.w3.org/2000/svg', 'defs');
    const linearGradient = document.createElementNS('http://www.w3.org/2000/svg', 'linearGradient');
    linearGradient.setAttribute('id', 'portfolio-gradient');
    linearGradient.setAttribute('x1', '0%');
    linearGradient.setAttribute('y1', '0%');
    linearGradient.setAttribute('x2', '0%');
    linearGradient.setAttribute('y2', '100%');
    
    const stop1 = document.createElementNS('http://www.w3.org/2000/svg', 'stop');
    stop1.setAttribute('offset', '0%');
    stop1.setAttribute('stop-color', 'rgb(234, 179, 8)');
    stop1.setAttribute('stop-opacity', '0.3');
    
    const stop2 = document.createElementNS('http://www.w3.org/2000/svg', 'stop');
    stop2.setAttribute('offset', '100%');
    stop2.setAttribute('stop-color', 'rgb(234, 179, 8)');
    stop2.setAttribute('stop-opacity', '0');
    
    linearGradient.appendChild(stop1);
    linearGradient.appendChild(stop2);
    gradient.appendChild(linearGradient);
    svg.appendChild(gradient);

    // Create area path
    const areaPath = data.map((point, index) => {
      const x = xScale(point.x);
      const y = yScale(point.y);
      return `${index === 0 ? 'M' : 'L'} ${x} ${y}`;
    }).join(' ');

    const area = document.createElementNS('http://www.w3.org/2000/svg', 'path');
    area.setAttribute('d', `${areaPath} L ${xScale(data[data.length - 1].x)} ${height - padding.bottom} L ${xScale(data[0].x)} ${height - padding.bottom} Z`);
    area.setAttribute('fill', 'url(#portfolio-gradient)');
    svg.appendChild(area);

    // Create line path
    const linePath = data.map((point, index) => {
      const x = xScale(point.x);
      const y = yScale(point.y);
      return `${index === 0 ? 'M' : 'L'} ${x} ${y}`;
    }).join(' ');

    const line = document.createElementNS('http://www.w3.org/2000/svg', 'path');
    line.setAttribute('d', linePath);
    line.setAttribute('fill', 'none');
    line.setAttribute('stroke', 'rgb(234, 179, 8)');
    line.setAttribute('stroke-width', '2');
    line.setAttribute('stroke-linecap', 'round');
    line.setAttribute('stroke-linejoin', 'round');
    svg.appendChild(line);

    // Add data points
    data.forEach((point, index) => {
      const circle = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
      circle.setAttribute('cx', xScale(point.x));
      circle.setAttribute('cy', yScale(point.y));
      circle.setAttribute('r', '3');
      circle.setAttribute('fill', 'rgb(234, 179, 8)');
      circle.setAttribute('stroke', 'rgb(15, 23, 42)');
      circle.setAttribute('stroke-width', '2');
      svg.appendChild(circle);
    });

    // Add Y-axis labels
    const yTicks = 5;
    for (let i = 0; i <= yTicks; i++) {
      const value = yMin + (yMax - yMin) * (i / yTicks);
      const y = yScale(value);
      
      const text = document.createElementNS('http://www.w3.org/2000/svg', 'text');
      text.setAttribute('x', padding.left - 10);
      text.setAttribute('y', y + 4);
      text.setAttribute('text-anchor', 'end');
      text.setAttribute('fill', 'rgb(148, 163, 184)');
      text.setAttribute('font-size', '12');
      text.textContent = `$${value.toFixed(0)}`;
      svg.appendChild(text);
    }

    // Add X-axis labels (dates)
    const xTicks = Math.min(5, data.length);
    for (let i = 0; i < xTicks; i++) {
      const index = data.length === 1 ? 0 : Math.floor((data.length - 1) * (i / (xTicks - 1)));
      const point = data[index];
      const x = xScale(point.x);
      
      const text = document.createElementNS('http://www.w3.org/2000/svg', 'text');
      text.setAttribute('x', x);
      text.setAttribute('y', height - padding.bottom + 20);
      text.setAttribute('text-anchor', 'middle');
      text.setAttribute('fill', 'rgb(148, 163, 184)');
      text.setAttribute('font-size', '12');
      text.textContent = new Date(point.x).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
      svg.appendChild(text);
    }

    } catch (error) {
      console.error('Error rendering chart:', error);
    }

  }, [data]);

  return (
    <svg
      ref={svgRef}
      className="w-full h-full"
      viewBox="0 0 800 256"
      preserveAspectRatio="none"
    />
  );
}

/* ----------------------------- Portfolio Content Router ---------------------------- */
function PortfolioContent({ orders, portfolioItems, marketData, manualItems, currentTab }) {
  switch (currentTab) {
    case 'collection':
      return <CollectionTab portfolioItems={portfolioItems} marketData={marketData} manualItems={manualItems} />;
    case 'search':
      return <SearchPage />;
    case 'stats':
      return <StatsTab orders={orders} />;
    case 'overview':
    default:
      return <OverviewTab orders={orders} portfolioItems={portfolioItems} marketData={marketData} />;
  }
}

/* ----------------------------- Overview Tab ---------------------------- */
function OverviewTab({ orders, portfolioItems, marketData }) {
  const [selectedTimeframe, setSelectedTimeframe] = useState('1M');

  // Calculate portfolio metrics
  const metrics = useMemo(() => {
    const totalItems = portfolioItems.length;
    const totalCost = portfolioItems.reduce((sum, item) => sum + (item.buy_price_cents || 0), 0);
    
    // Calculate current market value using real API data
    let estimatedMarketValue = 0;
    let itemsWithMarketData = 0;
    let itemsWithoutMarketData = 0;
    
    portfolioItems.forEach(item => {
      // Try to find market data by exact match first
      let marketInfo = marketData[item.item];
      
      // If no exact match, try to find by extracting the base product name
      if (!marketInfo) {
        // Extract the base product name (before the " - " separator)
        const baseProductName = item.item.split(' - ')[0];
        marketInfo = marketData[baseProductName];
      }
      
      if (marketInfo && marketInfo.loose_price) {
        // Use loose price as market value (convert to cents)
        estimatedMarketValue += Math.round(parseFloat(marketInfo.loose_price) * 100);
        itemsWithMarketData++;
      } else {
        // Fallback to cost if no market data available
        estimatedMarketValue += item.buy_price_cents || 0;
        itemsWithoutMarketData++;
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
      itemsWithMarketData,
      itemsWithoutMarketData,
      marketDataCoverage: totalItems > 0 ? (itemsWithMarketData / totalItems) * 100 : 0,
    };
  }, [portfolioItems, marketData]);

  // Calculate portfolio value over time for the chart
  const portfolioHistory = useMemo(() => {
    if (!orders.length) return [];

    // Get date range based on selected timeframe
    const now = new Date();
    let startDate = new Date();
    
    switch (selectedTimeframe) {
      case '1D':
        startDate.setDate(now.getDate() - 1);
        break;
      case '7D':
        startDate.setDate(now.getDate() - 7);
        break;
      case '1M':
        startDate.setMonth(now.getMonth() - 1);
        break;
      case '3M':
        startDate.setMonth(now.getMonth() - 3);
        break;
      case '6M':
        startDate.setMonth(now.getMonth() - 6);
        break;
      case 'All':
        startDate = new Date(Math.min(...orders.map(o => new Date(o.order_date).getTime())));
        break;
    }

    // Group orders by date and calculate cumulative portfolio value
    const dailyData = {};
    const sortedOrders = orders
      .filter(order => new Date(order.order_date) >= startDate)
      .sort((a, b) => new Date(a.order_date) - new Date(b.order_date));

    let cumulativeCost = 0;
    let cumulativeMarketValue = 0;

    sortedOrders.forEach(order => {
      const date = order.order_date;
      if (!dailyData[date]) {
        dailyData[date] = { date, cost: 0, marketValue: 0, orders: 0 };
      }
      
      dailyData[date].cost += order.buy_price_cents || 0;
      dailyData[date].orders += 1;
      
      // Calculate market value for this order
      const marketInfo = marketData[order.item];
      if (marketInfo && marketInfo.loose_price) {
        dailyData[date].marketValue += Math.round(parseFloat(marketInfo.loose_price) * 100);
      } else {
        dailyData[date].marketValue += order.buy_price_cents || 0;
      }
    });

    // Convert to cumulative values
    const result = [];
    Object.values(dailyData).forEach(day => {
      cumulativeCost += day.cost;
      cumulativeMarketValue += day.marketValue;
      result.push({
        date: day.date,
        cost: cumulativeCost,
        marketValue: cumulativeMarketValue,
        orders: day.orders
      });
    });

    return result;
  }, [orders, marketData, selectedTimeframe]);

  // Get chart data points
  const chartData = useMemo(() => {
    if (portfolioHistory.length === 0) return [];
    
    return portfolioHistory.map(point => ({
      x: new Date(point.date).getTime(),
      y: point.marketValue / 100, // Convert cents to dollars
      cost: point.cost / 100,
      orders: point.orders
    }));
  }, [portfolioHistory]);

  // Calculate chart metrics
  const chartMetrics = useMemo(() => {
    if (chartData.length === 0) return { change: 0, changePercent: 0 };
    
    const firstValue = chartData[0].y;
    const lastValue = chartData[chartData.length - 1].y;
    const change = lastValue - firstValue;
    const changePercent = firstValue > 0 ? (change / firstValue) * 100 : 0;
    
    return { change, changePercent };
  }, [chartData]);

  return (
    <div className="space-y-6">
      {/* Portfolio Value Chart */}
      <div className={`${card} p-6`}>
        <div className="flex items-center justify-between mb-6">
          <div>
            <h3 className="text-lg font-semibold text-slate-100">Portfolio Value</h3>
            <div className="flex items-center gap-4 mt-2">
              <div className="text-2xl font-bold text-slate-100">
                ${chartData.length > 0 ? chartData[chartData.length - 1].y.toFixed(2) : '0.00'}
              </div>
              <div className={`flex items-center gap-1 text-sm font-medium ${
                chartMetrics.change >= 0 ? 'text-green-400' : 'text-red-400'
              }`}>
                {chartMetrics.change >= 0 ? <TrendingUpIcon /> : <TrendingDownIcon />}
                {chartMetrics.change >= 0 ? '+' : ''}${chartMetrics.change.toFixed(2)} ({chartMetrics.changePercent >= 0 ? '+' : ''}{chartMetrics.changePercent.toFixed(1)}%)
              </div>
            </div>
          </div>
          
          {/* Time Period Selector */}
          <div className="flex space-x-1 bg-slate-800/50 p-1 rounded-lg">
            {['1D', '7D', '1M', '3M', '6M', 'All'].map((period) => (
              <button
                key={period}
                onClick={() => setSelectedTimeframe(period)}
                className={`px-3 py-1 rounded text-sm font-medium transition-colors ${
                  selectedTimeframe === period
                    ? 'bg-yellow-500/20 text-yellow-300'
                    : 'text-slate-400 hover:text-slate-200 hover:bg-slate-700/50'
                }`}
              >
                {period}
              </button>
            ))}
          </div>
        </div>
        
               {/* Chart Area */}
               <div className="h-64 w-full">
                 {chartData && chartData.length > 0 ? (
                   <PortfolioChart data={chartData} />
                 ) : (
                   <div className="h-full flex items-center justify-center text-slate-400">
                     <div className="text-center">
                       <ChartIcon />
                       <p className="mt-2">No data available for selected period</p>
                       <p className="text-xs text-slate-500 mt-1">
                         {portfolioItems.length === 0 ? 'No portfolio items found' : 'Loading market data...'}
                       </p>
                     </div>
                   </div>
                 )}
               </div>
      </div>

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

      {/* Market Data Coverage */}
      {metrics.totalItems > 0 && (
        <div className={`${card} p-6`}>
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-semibold text-slate-100">Market Data Coverage</h3>
            <div className="text-sm text-slate-400">
              {metrics.itemsWithMarketData} of {metrics.totalItems} items
            </div>
          </div>
          
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-slate-300">Items with market data</span>
              <span className="text-green-400 font-medium">{metrics.itemsWithMarketData}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-slate-300">Items without market data</span>
              <span className="text-yellow-400 font-medium">{metrics.itemsWithoutMarketData}</span>
            </div>
            <div className="w-full bg-slate-800 rounded-full h-2">
              <div 
                className="bg-green-500 h-2 rounded-full transition-all duration-300" 
                style={{ width: `${metrics.marketDataCoverage}%` }}
              ></div>
            </div>
            <div className="text-center text-sm text-slate-400">
              {metrics.marketDataCoverage.toFixed(1)}% coverage
            </div>
          </div>
          
          {metrics.itemsWithoutMarketData > 0 && (
            <div className="mt-4 p-3 bg-yellow-500/10 border border-yellow-500/20 rounded-lg">
              <p className="text-yellow-300 text-sm">
                {metrics.itemsWithoutMarketData} item{metrics.itemsWithoutMarketData !== 1 ? 's' : ''} 
                {' '}are using cost price as market value. Consider updating product names to match API data for more accurate valuations.
              </p>
            </div>
          )}
        </div>
      )}

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
function CollectionTab({ portfolioItems, marketData, manualItems }) {
  const [searchTerm, setSearchTerm] = useState("");
  const [itemType, setItemType] = useState("all"); // "all", "sealed", "singles"

  // Group items by name and calculate totals
  const groupedItems = useMemo(() => {
    const groups = {};
    
    portfolioItems.forEach(item => {
      const itemName = item.item;
      if (!itemName) return;
      
      // Filter by item type
      if (itemType === "sealed") {
        // Sealed products typically contain keywords like: box, bundle, pack, case, booster, elite, premium
        const sealedKeywords = ['box', 'bundle', 'pack', 'case', 'booster', 'elite', 'premium', 'collection', 'tin', 'display'];
        const isSealed = sealedKeywords.some(keyword => itemName.toLowerCase().includes(keyword));
        if (!isSealed) return;
      } else if (itemType === "singles") {
        // Singles are typically individual cards or items without sealed keywords
        const sealedKeywords = ['box', 'bundle', 'pack', 'case', 'booster', 'elite', 'premium', 'collection', 'tin', 'display'];
        const isSealed = sealedKeywords.some(keyword => itemName.toLowerCase().includes(keyword));
        if (isSealed) return;
      }
      
      if (!groups[itemName]) {
        // Try to find market data by exact match first (API data)
        let marketInfo = marketData[itemName];
        let manualValue = null;
        
        // If no exact API match, try to find by extracting the base product name
        if (!marketInfo) {
          // Extract the base product name (before the " - " separator)
          const baseProductName = itemName.split(' - ')[0];
          marketInfo = marketData[baseProductName];
        }
        
        // If still no API data, look for manual database value
        if (!marketInfo) {
          // Try exact match first
          const exactMatch = manualItems.find(item => 
            item.name && item.name.toLowerCase() === itemName.toLowerCase()
          );
          
          if (exactMatch && exactMatch.market_value_cents > 0) {
            manualValue = exactMatch.market_value_cents;
          } else {
            // Try base product name match
            const baseProductName = itemName.split(' - ')[0];
            const baseMatch = manualItems.find(item => 
              item.name && item.name.toLowerCase() === baseProductName.toLowerCase()
            );
            
            if (baseMatch && baseMatch.market_value_cents > 0) {
              manualValue = baseMatch.market_value_cents;
            }
          }
        }
        
        groups[itemName] = {
          name: itemName,
          quantity: 0,
          totalCost: 0,
          orderDates: [],
          marketInfo: marketInfo || null,
          manualValue: manualValue
        };
      }
      
      groups[itemName].quantity += 1;
      groups[itemName].totalCost += item.buy_price_cents || 0;
      groups[itemName].orderDates.push(item.order_date);
    });
    
    return Object.values(groups);
  }, [portfolioItems, marketData, manualItems, itemType]);

  const filteredItems = useMemo(() => {
    if (!searchTerm) return groupedItems;
    return groupedItems.filter(item => 
      item.name?.toLowerCase().includes(searchTerm.toLowerCase())
    );
  }, [groupedItems, searchTerm]);

  return (
    <div className="space-y-6">
      {/* Search and Filters */}
      <div className={`${card} p-6`}>
        <div className="flex items-center gap-4 mb-4">
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
        
        {/* Item Type Toggle */}
        <div className="flex items-center gap-2">
          <span className="text-sm text-slate-400">Filter:</span>
          <div className="flex bg-slate-800 rounded-lg p-1">
            <button
              onClick={() => setItemType("all")}
              className={`px-3 py-1 text-xs rounded-md transition-colors ${
                itemType === "all" 
                  ? "bg-indigo-500 text-white" 
                  : "text-slate-400 hover:text-slate-200"
              }`}
            >
              All Items
            </button>
            <button
              onClick={() => setItemType("sealed")}
              className={`px-3 py-1 text-xs rounded-md transition-colors ${
                itemType === "sealed" 
                  ? "bg-indigo-500 text-white" 
                  : "text-slate-400 hover:text-slate-200"
              }`}
            >
              Sealed
            </button>
            <button
              onClick={() => setItemType("singles")}
              className={`px-3 py-1 text-xs rounded-md transition-colors ${
                itemType === "singles" 
                  ? "bg-indigo-500 text-white" 
                  : "text-slate-400 hover:text-slate-200"
              }`}
            >
              Singles
            </button>
          </div>
        </div>
        
        {/* Legend */}
        <div className="mt-4 flex items-center gap-6 text-xs text-slate-400">
          <div className="flex items-center gap-2">
            <div className="w-2 h-2 bg-green-400 rounded-full"></div>
            <span>API market data</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-2 h-2 bg-blue-400 rounded-full"></div>
            <span>Manual database value</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-2 h-2 bg-yellow-400 rounded-full"></div>
            <span>Using cost price</span>
          </div>
        </div>
      </div>

      {/* Collection Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {filteredItems.map((item, index) => {
          const marketInfo = item.marketInfo;
          const manualValue = item.manualValue;
          
          // Prioritize API data, then manual database value, then cost price
          let currentMarketValue;
          let dataSource;
          
          if (marketInfo && marketInfo.loose_price) {
            currentMarketValue = Math.round(parseFloat(marketInfo.loose_price) * 100);
            dataSource = 'api';
          } else if (manualValue && manualValue > 0) {
            currentMarketValue = manualValue;
            dataSource = 'manual';
          } else {
            currentMarketValue = item.totalCost;
            dataSource = 'cost';
          }
          
          const totalMarketValue = currentMarketValue * item.quantity;
          const profit = totalMarketValue - item.totalCost;
          const profitPercentage = item.totalCost > 0 ? (profit / item.totalCost) * 100 : 0;
          
          // Clean up the title by removing "- Pokemon [Set Name]" if it exists
          const cleanTitle = item.name.replace(/\s*-\s*Pokemon\s+.*$/i, '');
          
          return (
            <div key={index} className={`${card} p-4 hover:bg-slate-800/60 transition-colors`}>
              <div className="flex items-start justify-between mb-3">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <h4 className="text-slate-200 font-medium truncate">{cleanTitle}</h4>
                    <div className="flex items-center gap-1">
                      {dataSource === 'api' && (
                        <div className="flex-shrink-0 w-2 h-2 bg-green-400 rounded-full" title="API market data"></div>
                      )}
                      {dataSource === 'manual' && (
                        <div className="flex-shrink-0 w-2 h-2 bg-blue-400 rounded-full" title="Manual database value"></div>
                      )}
                      {dataSource === 'cost' && (
                        <div className="flex-shrink-0 w-2 h-2 bg-yellow-400 rounded-full" title="Using cost price"></div>
                      )}
                    </div>
                  </div>
                  {marketInfo && marketInfo.console_name && (
                    <p className="text-slate-400 text-xs truncate">{marketInfo.console_name}</p>
                  )}
                  <p className="text-slate-400 text-sm">
                    {item.quantity} item{item.quantity !== 1 ? 's' : ''} • Added {item.orderDates[0]}
                    {item.quantity > 1 && ` (+${item.quantity - 1} more)`}
                  </p>
                </div>
                <div className="text-right">
                  <p className="text-slate-200 font-medium">{centsToStr(item.totalCost)}</p>
                  <p className="text-slate-400 text-xs">Total Cost</p>
                </div>
              </div>
              
              {/* Product placeholder */}
              <div className="w-full h-32 bg-gradient-to-br from-slate-800 to-slate-900 rounded-lg mb-3 flex flex-col items-center justify-center overflow-hidden relative group border border-slate-700">
                {/* Pokemon card icon */}
                <div className="flex items-center justify-center mb-2">
                  <svg className="w-8 h-8 text-yellow-400" fill="currentColor" viewBox="0 0 24 24">
                    <path d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5"/>
                  </svg>
                </div>
                
                {/* Product type indicator */}
                <div className="text-center">
                  <div className="text-xs font-medium text-slate-300 mb-1">
                    {cleanTitle.includes('Elite Trainer Box') ? 'ETB' :
                     cleanTitle.includes('Booster Box') ? 'Booster Box' :
                     cleanTitle.includes('Booster Pack') ? 'Pack' :
                     cleanTitle.includes('Collection') ? 'Collection' :
                     cleanTitle.includes('Premium') ? 'Premium' :
                     'Card'}
                  </div>
                  
                  {/* Set name if available */}
                  {marketInfo && marketInfo.console_name && (
                    <div className="text-xs text-slate-400 truncate max-w-full px-2">
                      {marketInfo.console_name}
                    </div>
                  )}
                </div>
                
                {/* Decorative elements */}
                <div className="absolute top-2 right-2 w-2 h-2 bg-yellow-400 rounded-full opacity-60"></div>
                <div className="absolute bottom-2 left-2 w-1 h-1 bg-blue-400 rounded-full opacity-40"></div>
                <div className="absolute top-1/2 left-1 w-1 h-1 bg-red-400 rounded-full opacity-30"></div>
              </div>
              
              {/* Market value and profit */}
              <div className="space-y-2">
                <div className="flex justify-between items-center">
                  <span className="text-slate-400 text-sm">Market Value:</span>
                  <span className="text-green-400 text-sm font-medium">
                    {centsToStr(totalMarketValue)}
                  </span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-slate-400 text-sm">Profit:</span>
                  <span className={`text-sm font-medium ${profit >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                    {profit >= 0 ? '+' : ''}{centsToStr(profit)} ({profitPercentage >= 0 ? '+' : ''}{profitPercentage.toFixed(1)}%)
                  </span>
                </div>
                {item.quantity > 1 && (
                  <div className="flex justify-between items-center text-xs">
                    <span className="text-slate-500">Per item:</span>
                    <span className="text-slate-400">
                      {centsToStr(Math.round(item.totalCost / item.quantity))} cost • {centsToStr(currentMarketValue)} market
                    </span>
                  </div>
                )}
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


/* ====================== MAIN COMPONENT ====================== */
export default function Portfolio() {
  const location = useLocation();
  const [marketData, setMarketData] = useState({});
  const [isLoadingMarketData, setIsLoadingMarketData] = useState(false);

  // Determine current tab from URL path
  const currentTab = useMemo(() => {
    const path = location.pathname;
    if (path.includes('/collection')) return 'collection';
    if (path.includes('/search')) return 'search';
    if (path.includes('/stats')) return 'stats';
    return 'overview';
  }, [location.pathname]);

  // Determine active sidebar item based on current tab
  const activeSidebarItem = useMemo(() => {
    switch (currentTab) {
      case 'collection': return 'portfolio-collection';
      case 'search': return 'portfolio-search';
      case 'stats': return 'portfolio-stats';
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

  // Fetch manual database values for fallback
  const { data: manualItems = [] } = useQuery({
    queryKey: ["manual-items"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("items")
        .select("name, market_value_cents")
        .order("name", { ascending: true });
      if (error) throw error;
      return data || [];
    },
  });

  // Create stable dependency for market data fetching
  const uniqueProductNames = useMemo(() => {
    if (portfolioItems.length === 0) return [];
    const names = new Set();
    
    portfolioItems.forEach(item => {
      if (item.item) {
        // Add the full display name
        names.add(item.item);
        
        // Also add the base product name (before " - ")
        const baseProductName = item.item.split(' - ')[0];
        if (baseProductName !== item.item) {
          names.add(baseProductName);
        }
      }
    });
    
    return Array.from(names).sort(); // Sort to ensure consistent order
  }, [portfolioItems.length, portfolioItems.map(item => item.item).join(',')]);

  // Fetch market data when portfolio items change
  useEffect(() => {
    if (uniqueProductNames.length > 0) {
      console.log('Portfolio: Checking for market data for product names:', uniqueProductNames);
      
      // First, try to get data from background cache
      const backgroundData = getBackgroundMarketData(uniqueProductNames);
      const backgroundDataCount = Object.keys(backgroundData).length;
      
      if (backgroundDataCount === uniqueProductNames.length) {
        // All data is available from background cache
        console.log('Portfolio: All market data loaded from background cache');
        setMarketData(backgroundData);
        setIsLoadingMarketData(false);
      } else if (backgroundDataCount > 0) {
        // Some data is available, use it and fetch the rest
        console.log(`Portfolio: ${backgroundDataCount}/${uniqueProductNames.length} products loaded from background cache`);
        setMarketData(backgroundData);
        setIsLoadingMarketData(true);
        
        getBatchMarketData(uniqueProductNames)
          .then(data => {
            console.log('Portfolio: Received complete market data:', data);
            setMarketData(data);
            setIsLoadingMarketData(false);
          })
          .catch(error => {
            console.error('Error fetching market data:', error);
            setMarketData(backgroundData); // Keep what we have from background
            setIsLoadingMarketData(false);
          });
      } else {
        // No background data available, fetch all
        console.log('Portfolio: No background data available, fetching all market data');
        setIsLoadingMarketData(true);
        
        getBatchMarketData(uniqueProductNames)
          .then(data => {
            console.log('Portfolio: Received market data:', data);
            setMarketData(data);
            setIsLoadingMarketData(false);
          })
          .catch(error => {
            console.error('Error fetching market data:', error);
            setMarketData({});
            setIsLoadingMarketData(false);
          });
      }
    } else {
      setMarketData({});
      setIsLoadingMarketData(false);
    }
  }, [uniqueProductNames]);

  const isLoading = ordersLoading || itemsLoading;

  if (isLoading) {
    return (
      <LayoutWithSidebar active={activeSidebarItem} section="portfolio">
        {currentTab !== 'search' && <PageHeader title="Portfolio" />}
        <div className="flex items-center justify-center h-64">
          <div className="text-slate-400">Loading portfolio...</div>
        </div>
      </LayoutWithSidebar>
    );
  }

  return (
    <LayoutWithSidebar active={activeSidebarItem} section="portfolio">
      {currentTab !== 'search' && <PageHeader title="Portfolio" />}
      
      {isLoadingMarketData && (
        <div className={`${card} p-6 text-center mb-6`}>
          <div className="text-slate-400">Loading market data...</div>
        </div>
      )}

        <PortfolioContent 
          orders={orders} 
          portfolioItems={portfolioItems} 
          marketData={marketData} 
          manualItems={manualItems}
          currentTab={currentTab} 
        />
    </LayoutWithSidebar>
  );
}

/* ----------------------------- Stats Tab ---------------------------- */
function StatsTab({ orders }) {
  return <Stats noLayout={true} />;
}
