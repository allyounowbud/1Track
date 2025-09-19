// src/routes/Portfolio.jsx
import { useState, useEffect, useMemo, useRef } from "react";
import { useQuery } from "@tanstack/react-query";
import { useLocation, useNavigate } from "react-router-dom";
import { supabase } from "../lib/supabaseClient";
import LayoutWithSidebar from "../components/LayoutWithSidebar.jsx";
import PageHeader from "../components/PageHeader.jsx";
import { centsToStr, formatNumber } from "../utils/money.js";
import { card, inputBase, rowCard } from "../utils/ui.js";
import { getBatchMarketData, getMarketValueInCents, getProductMarketData } from "../services/marketDataService.js";
import { getBackgroundMarketData, isBackgroundLoadingComplete } from "../services/backgroundMarketDataService.js";
import { getProductImages } from "../services/imageService.js";
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

async function getAllOrders() {
  // Get all orders for order history display
  const { data, error } = await supabase
    .from("orders")
    .select(`
      id, order_date, sale_date, item, profile_name, retailer, 
      buy_price_cents, sale_price_cents, fees_pct, shipping_cents, 
      marketplace, status, market_value_cents
    `)
    .order("order_date", { ascending: false });
  
  if (error) throw error;
  return data || [];
}



/* ----------------------------- Portfolio Chart Component ---------------------------- */
function PortfolioChart({ data }) {
  const svgRef = useRef(null);

  const renderChart = () => {
    if (!svgRef.current || !data || data.length === 0) return;

    try {
      const svg = svgRef.current;
      const containerRect = svg.getBoundingClientRect();
      const width = containerRect.width;
      const height = containerRect.height;
      
      // Mobile-first design - always use minimal padding for full-width chart
      const padding = { top: 20, right: 10, bottom: 50, left: 10 }; // Minimal padding for full-width mobile experience

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

      // Set SVG viewBox to match actual dimensions
      svg.setAttribute('viewBox', `0 0 ${width} ${height}`);

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
      stop1.setAttribute('stop-color', 'rgb(59, 130, 246)'); // Blue instead of yellow
      stop1.setAttribute('stop-opacity', '0.3');
      
      const stop2 = document.createElementNS('http://www.w3.org/2000/svg', 'stop');
      stop2.setAttribute('offset', '100%');
      stop2.setAttribute('stop-color', 'rgb(59, 130, 246)'); // Blue instead of yellow
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
      line.setAttribute('stroke', 'rgb(59, 130, 246)'); // Blue instead of yellow
      line.setAttribute('stroke-width', '2');
      line.setAttribute('stroke-linecap', 'round');
      line.setAttribute('stroke-linejoin', 'round');
      svg.appendChild(line);

      // Removed data points (circles) as requested

      // Skip Y-axis labels for cleaner mobile look - focus on the chart itself

      // Add X-axis labels (months) - optimized for mobile with proper month labels
      const xTicks = Math.min(6, data.length); // Show up to 6 month labels for better readability
      for (let i = 0; i < xTicks; i++) {
        let index, x;
        
        if (xTicks === 1) {
          // Single point - center it
          index = 0;
          x = xScale(data[0].x);
        } else if (i === 0) {
          // First label - move it in from the edge
          index = Math.floor((data.length - 1) * 0.05); // Move to 5% from start
          x = xScale(data[index].x);
        } else if (i === xTicks - 1) {
          // Last label - move it in from the edge
          index = Math.floor((data.length - 1) * 0.95); // Move to 95% from start
          x = xScale(data[index].x);
        } else {
          // Middle labels - evenly distributed
          index = Math.floor((data.length - 1) * (i / (xTicks - 1)));
          x = xScale(data[index].x);
        }
        
        const point = data[index];
        
        const text = document.createElementNS('http://www.w3.org/2000/svg', 'text');
        text.setAttribute('x', x);
        text.setAttribute('y', height - padding.bottom + 20);
        text.setAttribute('text-anchor', 'middle');
        text.setAttribute('fill', 'rgb(107, 114, 128)'); // Better contrast for mobile
        text.setAttribute('font-size', '11'); // Readable font size
        text.setAttribute('font-weight', '500'); // Medium weight for better readability
        text.textContent = new Date(point.x).toLocaleDateString('en-US', { month: 'short' }); // Month only (Aug, Sep, Oct, etc.)
        svg.appendChild(text);
      }

    } catch (error) {
      console.error('Error rendering chart:', error);
    }
  };

  useEffect(() => {
    renderChart();
  }, [data]);

  // Add resize observer to handle container size changes
  useEffect(() => {
    if (!svgRef.current) return;

    const resizeObserver = new ResizeObserver(() => {
      renderChart();
    });

    resizeObserver.observe(svgRef.current);

    return () => {
      resizeObserver.disconnect();
    };
  }, [data]);

  return (
    <svg
      ref={svgRef}
      className="w-full h-full"
      preserveAspectRatio="xMidYMid meet"
    />
  );
}

/* ----------------------------- Recent Activity Row Component ---------------------------- */
function RecentActivityRow({ order, marketData }) {
  const [genreData, setGenreData] = useState(null);
  const [loadingGenre, setLoadingGenre] = useState(false);
  const navigate = useNavigate();

  // Parse item name and set
  const itemParts = order.item.split(' - ');
  const itemName = itemParts[0] || order.item;
  let itemSet = itemParts[1] || '';

  // Fetch genre if no set is available
  useEffect(() => {
    if (!itemSet && !genreData && !loadingGenre) {
      setLoadingGenre(true);
      getProductMarketData(itemName)
        .then(data => {
          if (data && data.console_name) {
            setGenreData(data.console_name);
          }
          setLoadingGenre(false);
        })
        .catch(error => {
          console.error('Error fetching genre for', itemName, ':', error);
          setLoadingGenre(false);
        });
    }
  }, [itemName, itemSet, genreData, loadingGenre]);

  // Determine status and styling
  let statusText, statusColor;
  if (order.status === 'sold') {
    statusText = 'Sold';
    statusColor = 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400';
  } else if (order.status === 'added') {
    statusText = 'Added';
    statusColor = 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400';
  } else {
    statusText = 'Paid';
    statusColor = 'bg-gray-50 text-gray-900 dark:bg-slate-950 dark:text-slate-100';
  }

  const isSale = order.status === 'sold';
  const profitLoss = isSale && order.sell_price_cents ? order.sell_price_cents - order.buy_price_cents : 0;
  const profitLossPercent = order.buy_price_cents > 0 ? (profitLoss / order.buy_price_cents) * 100 : 0;

  // Determine the appropriate date and price for display
  let displayDate, displayPrice, priceColor;
  if (isSale) {
    displayDate = order.sell_date || order.order_date;
    displayPrice = centsToStr(order.sell_price_cents || 0);
    priceColor = 'text-green-600 dark:text-green-400';
  } else if (order.status === 'added') {
    displayDate = order.order_date;
    displayPrice = centsToStr(order.market_value_cents || order.buy_price_cents || 0);
    priceColor = 'text-blue-600 dark:text-blue-400';
  } else {
    displayDate = order.order_date;
    displayPrice = centsToStr(order.buy_price_cents);
    priceColor = 'text-red-600 dark:text-red-400';
  }

  // Use set if available, otherwise use genre
  const displaySubtitle = itemSet || genreData || '';

  return (
    <div 
      className="py-3 border-b border-gray-200 dark:border-gray-700 last:border-b-0 cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
      onClick={() => {
        // Navigate to order book with this specific order highlighted
        const searchParams = new URLSearchParams({
          highlight: order.id,
          item: order.item,
          date: order.order_date || order.sale_date || '',
          status: order.status
        });
        navigate(`/orderbook?${searchParams.toString()}`);
      }}
    >
      {/* Top Row: Title and Status */}
      <div className="flex items-start justify-between mb-1">
        <div>
          <h3 className="font-semibold text-gray-800 dark:text-gray-200 text-sm sm:text-base leading-tight">
            {itemName}
          </h3>
          {displaySubtitle && (
            <p className="text-gray-600 dark:text-gray-300 text-sm leading-tight mt-0">
              {displaySubtitle}
            </p>
          )}
        </div>
        <div className="flex flex-col items-end">
          <span className={`text-xs font-medium px-2 py-1 rounded-full ${statusColor} leading-tight`}>
            {statusText}
          </span>
          <p className={`font-semibold text-sm sm:text-base ${priceColor} leading-tight mt-0`}>
            ${displayPrice}
          </p>
        </div>
      </div>
      
      {/* Data Grid - Only for Sales */}
      {isSale && (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 sm:gap-3 text-xs sm:text-sm">
          <div>
            <p className="text-gray-500 dark:text-gray-400 text-xs uppercase tracking-wide mb-1">Buy Price</p>
            <p className="font-semibold text-red-600 dark:text-red-400 text-sm sm:text-base">
              ${centsToStr(order.buy_price_cents)}
            </p>
          </div>
          <div>
            <p className="text-gray-500 dark:text-gray-400 text-xs uppercase tracking-wide mb-1">Profit/Loss</p>
            <p className={`font-semibold text-sm sm:text-base ${profitLoss >= 0 ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'}`}>
              {profitLoss >= 0 ? '+' : ''}${centsToStr(profitLoss)} ({profitLossPercent >= 0 ? '+' : ''}{profitLossPercent.toFixed(1)}%)
            </p>
          </div>
        </div>
      )}
    </div>
  );
}

/* ----------------------------- Portfolio Content Router ---------------------------- */
function PortfolioContent({ orders, portfolioItems, marketData, manualItems, allOrders, currentTab }) {
  switch (currentTab) {
    case 'collection':
      return <CollectionTab portfolioItems={portfolioItems} marketData={marketData} manualItems={manualItems} allOrders={allOrders} />;
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
  const [selectedTimeframe, setSelectedTimeframe] = useState('All');

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
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
      {/* Native Mobile App Header */}
      <div className="bg-gray-50 dark:bg-gray-900 border-b border-gray-200 dark:border-gray-700 px-4 py-4">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Portfolio</h1>
            <p className="text-sm text-gray-600 dark:text-gray-300">Collection Overview</p>
          </div>
          <div className="text-right">
            <div className="text-2xl font-bold text-gray-900 dark:text-white">
                ${chartData.length > 0 ? chartData[chartData.length - 1].y.toFixed(2) : '0.00'}
              </div>
            <div className={`flex items-center justify-end gap-1 text-xs font-medium ${
                chartMetrics.change >= 0 ? 'text-green-400' : 'text-red-400'
              }`}>
                {chartMetrics.change >= 0 ? <TrendingUpIcon /> : <TrendingDownIcon />}
                {chartMetrics.change >= 0 ? '+' : ''}${chartMetrics.change.toFixed(2)} ({chartMetrics.changePercent >= 0 ? '+' : ''}{chartMetrics.changePercent.toFixed(1)}%)
              </div>
            </div>
          </div>
          
          {/* Time Period Selector */}
        <div className="flex space-x-0.5 bg-gray-100 dark:bg-gray-800/50 p-0.5 rounded-lg overflow-hidden">
            {['1D', '7D', '1M', '3M', 'All'].map((period) => (
              <button
                key={period}
                onClick={() => setSelectedTimeframe(period)}
              className={`flex-1 px-2 py-1.5 rounded text-xs font-medium transition-colors ${
                  selectedTimeframe === period
                    ? 'bg-blue-500/20 text-blue-300'
                  : 'text-gray-600 dark:text-gray-300 hover:text-gray-900 dark:hover:text-gray-200 hover:bg-gray-200 dark:hover:bg-gray-700'
                }`}
              >
                {period}
              </button>
            ))}
          </div>
        </div>
        
      {/* Full-Width Chart Area - Native Mobile Style */}
      <div className="bg-gray-50 dark:bg-gray-900">
        <div className="h-80 w-full overflow-hidden">
                 {chartData && chartData.length > 0 ? (
                   <PortfolioChart data={chartData} />
                 ) : (
            <div className="h-full flex items-center justify-center text-gray-500 dark:text-gray-300">
                     <div className="text-center">
                <div className="flex justify-center">
                       <ChartIcon />
                </div>
                       <p className="mt-2">No data available for selected period</p>
                <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                         {portfolioItems.length === 0 ? 'No portfolio items found' : 'No data available'}
                       </p>
                     </div>
                   </div>
                 )}
               </div>
      </div>

      {/* KPI Cards Grid - Native Mobile Style */}
      <div className="px-4 py-4">
        <div className="grid grid-cols-2 gap-3">
        <div className="rounded-2xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900/50 p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-gray-600 dark:text-gray-300 text-xs">Inventory</p>
              <p className="text-lg font-bold text-gray-900 dark:text-white">{formatNumber(metrics.totalItems)}</p>
            </div>
            <div className="p-2 bg-gray-500/20 rounded-xl">
              <CollectionIcon />
            </div>
          </div>
        </div>

        <div className="rounded-2xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900/50 p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-gray-600 dark:text-gray-300 text-xs">Total Cost</p>
              <p className="text-lg font-bold text-gray-900 dark:text-white">${centsToStr(metrics.totalCost)}</p>
            </div>
            <div className="p-2 bg-gray-500/20 rounded-xl">
              <svg className="w-5 h-5" viewBox="0 0 20 20" fill="currentColor">
                <path d="M8.433 7.418c.155-.103.346-.196.567-.267v1.698a2.305 2.305 0 01-.567-.267C8.07 8.34 8 8.114 8 8c0-.114.07-.34.433-.582zM11 12.849v-1.698c.22.071.412.164.567.267.364.243.433.468.433.582 0 .114-.07.34-.433.582a2.305 2.305 0 01-.567.267z" />
                <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm1-13a1 1 0 10-2 0v.092a4.535 4.535 0 00-1.676.662C6.602 6.234 6 7.009 6 8c0 .99.602 1.765 1.324 2.246.48.32 1.054.545 1.676.662v1.941c-.391-.127-.68-.317-.843-.504a1 1 0 10-1.51 1.31c.562.649 1.413 1.076 2.353 1.253V15a1 1 0 102 0v-.092a4.535 4.535 0 001.676-.662C13.398 13.766 14 12.991 14 12c0-.99-.602-1.765-1.324-2.246A4.535 4.535 0 0011 9.092V7.151c.391.127.68.317.843.504a1 1 0 101.511-1.31c-.563-.649-1.413-1.076-2.354-1.253V5z" clipRule="evenodd" />
              </svg>
            </div>
          </div>
        </div>

        <div className="rounded-2xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900/50 p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-gray-600 dark:text-gray-300 text-xs">Market Value</p>
              <p className="text-lg font-bold text-gray-900 dark:text-white">${centsToStr(metrics.estimatedMarketValue)}</p>
              <p className="text-xs text-gray-500 dark:text-gray-400">
                +0.0%
              </p>
            </div>
            <div className="p-2 bg-gray-500/20 rounded-xl">
              <svg className="w-5 h-5" viewBox="0 0 20 20" fill="currentColor">
                <path fillRule="evenodd" d="M10 2a4 4 0 00-4 4v1H5a1 1 0 00-.994.89l-1 9A1 1 0 004 18h12a1 1 0 00.994-1.11l-1-9A1 1 0 0015 7h-1V6a4 4 0 00-4-4zM8 6a2 2 0 114 0v1H8V6zm4 10a2 2 0 100-4 2 2 0 000 4z" clipRule="evenodd" />
              </svg>
            </div>
          </div>
        </div>

        <div className="rounded-2xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900/50 p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-gray-600 dark:text-gray-300 text-xs">Total Profit</p>
              <p className={`text-lg font-bold ${metrics.totalProfit >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                ${centsToStr(metrics.totalProfit)}
              </p>
              <p className={`text-xs ${metrics.profitPercentage >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                {metrics.profitPercentage >= 0 ? '+' : ''}{metrics.profitPercentage.toFixed(1)}%
              </p>
            </div>
            <div className="p-2 bg-gray-500/20 rounded-xl">
              {metrics.totalProfit >= 0 ? <TrendingUpIcon /> : <TrendingDownIcon />}
            </div>
            </div>
          </div>
        </div>
      </div>

      {/* Recent Activity - Native Mobile Style */}
      <div className="bg-gray-50 dark:bg-gray-900 border-t border-gray-200 dark:border-gray-700">
        <div className="px-4 py-4">
          <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">Recent Activity</h2>
        <div className="space-y-3">
            {orders
              .sort((a, b) => new Date(b.created_at || b.updated_at || b.id) - new Date(a.created_at || a.updated_at || a.id))
              .slice(0, 10)
              .map((order) => (
                <RecentActivityRow key={order.id} order={order} marketData={marketData} />
              ))}
          </div>
        </div>
      </div>
    </div>
  );
}

/* ----------------------------- Collection Tab ---------------------------- */
function CollectionTab({ portfolioItems, marketData, manualItems, allOrders }) {
  const [searchTerm, setSearchTerm] = useState("");
  const [itemType, setItemType] = useState("all"); // "all", "sealed", "singles"
  const [expandedItem, setExpandedItem] = useState(null);
  const [scrollPosition, setScrollPosition] = useState(0); // null or item object
  const [productImages, setProductImages] = useState({});
  const [sortBy, setSortBy] = useState("name"); // "name", "marketValue", "totalCost", "profit", "quantity", "dateAdded", "set"
  const [sortOrder, setSortOrder] = useState("asc"); // "asc", "desc"

  // Get order details for a specific item from all orders
  const getItemOrders = (itemName) => {
    return allOrders.filter(order => order.item === itemName);
  };

  // Handle opening expanded item preview
  const handleOpenPreview = (item) => {
    setScrollPosition(window.scrollY);
    setExpandedItem(item);
  };

  // Handle closing expanded item preview
  const handleClosePreview = () => {
    setExpandedItem(null);
    // Restore scroll position after a brief delay to allow the preview to close
    setTimeout(() => {
      window.scrollTo(0, scrollPosition);
    }, 100);
  };

  // Prevent background scroll when modal is open (mobile only)
  useEffect(() => {
    if (expandedItem) {
      // Only prevent scroll on mobile/small screens
      if (window.innerWidth < 1024) {
        document.body.style.overflow = 'hidden';
        document.body.style.position = 'fixed';
        document.body.style.width = '100%';
      }
    } else {
      document.body.style.overflow = 'unset';
      document.body.style.position = 'unset';
      document.body.style.width = 'unset';
    }
    
    // Cleanup on unmount
    return () => {
      document.body.style.overflow = 'unset';
      document.body.style.position = 'unset';
      document.body.style.width = 'unset';
    };
  }, [expandedItem]);

  // Fetch product images for portfolio items
  useEffect(() => {
    const fetchImages = async () => {
      if (portfolioItems.length === 0) return;
      
      const uniqueItems = [...new Set(portfolioItems.map(item => item.item).filter(Boolean))];
      const imagePromises = uniqueItems.map(async (itemName) => {
        try {
          const images = await getProductImages(itemName);
          return { itemName, images };
        } catch (error) {
          console.error(`Error fetching images for ${itemName}:`, error);
          return { itemName, images: [] };
        }
      });
      
      const results = await Promise.all(imagePromises);
      const imageMap = {};
      results.forEach(({ itemName, images }) => {
        imageMap[itemName] = images;
      });
      
      setProductImages(imageMap);
    };
    
    fetchImages();
  }, [portfolioItems]);

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
    let items = groupedItems;
    
    // Apply search filter
    if (searchTerm) {
      items = items.filter(item => 
        item.name?.toLowerCase().includes(searchTerm.toLowerCase())
      );
    }
    
    // Apply sorting
    items = [...items].sort((a, b) => {
      let aValue, bValue;
      
      switch (sortBy) {
        case "name":
          aValue = a.name?.toLowerCase() || "";
          bValue = b.name?.toLowerCase() || "";
          break;
          
        case "marketValue":
          // Calculate current market value
          const aMarketInfo = a.marketInfo;
          const aManualValue = a.manualValue;
          let aCurrentMarketValue;
          
          if (aMarketInfo && aMarketInfo.loose_price) {
            aCurrentMarketValue = Math.round(parseFloat(aMarketInfo.loose_price) * 100);
          } else if (aManualValue && aManualValue > 0) {
            aCurrentMarketValue = aManualValue;
          } else {
            aCurrentMarketValue = a.totalCost;
          }
          
          const bMarketInfo = b.marketInfo;
          const bManualValue = b.manualValue;
          let bCurrentMarketValue;
          
          if (bMarketInfo && bMarketInfo.loose_price) {
            bCurrentMarketValue = Math.round(parseFloat(bMarketInfo.loose_price) * 100);
          } else if (bManualValue && bManualValue > 0) {
            bCurrentMarketValue = bManualValue;
          } else {
            bCurrentMarketValue = b.totalCost;
          }
          
          aValue = aCurrentMarketValue * a.quantity;
          bValue = bCurrentMarketValue * b.quantity;
          break;
          
        case "totalCost":
          aValue = a.totalCost;
          bValue = b.totalCost;
          break;
          
        case "profit":
          // Calculate profit/loss
          const aMarketInfo2 = a.marketInfo;
          const aManualValue2 = a.manualValue;
          let aCurrentMarketValue2;
          
          if (aMarketInfo2 && aMarketInfo2.loose_price) {
            aCurrentMarketValue2 = Math.round(parseFloat(aMarketInfo2.loose_price) * 100);
          } else if (aManualValue2 && aManualValue2 > 0) {
            aCurrentMarketValue2 = aManualValue2;
          } else {
            aCurrentMarketValue2 = a.totalCost;
          }
          
          const bMarketInfo2 = b.marketInfo;
          const bManualValue2 = b.manualValue;
          let bCurrentMarketValue2;
          
          if (bMarketInfo2 && bMarketInfo2.loose_price) {
            bCurrentMarketValue2 = Math.round(parseFloat(bMarketInfo2.loose_price) * 100);
          } else if (bManualValue2 && bManualValue2 > 0) {
            bCurrentMarketValue2 = bManualValue2;
          } else {
            bCurrentMarketValue2 = b.totalCost;
          }
          
          aValue = (aCurrentMarketValue2 * a.quantity) - a.totalCost;
          bValue = (bCurrentMarketValue2 * b.quantity) - b.totalCost;
          break;
          
        case "quantity":
          aValue = a.quantity;
          bValue = b.quantity;
          break;
          
        case "dateAdded":
          // Use the earliest order date for each item
          const aEarliestDate = a.orderDates.length > 0 ? new Date(Math.min(...a.orderDates.map(d => new Date(d)))) : new Date(0);
          const bEarliestDate = b.orderDates.length > 0 ? new Date(Math.min(...b.orderDates.map(d => new Date(d)))) : new Date(0);
          aValue = aEarliestDate.getTime();
          bValue = bEarliestDate.getTime();
          break;
          
        case "set":
          // Extract set name from item name (after " - ")
          const aSetName = a.name?.split(' - ')[1]?.toLowerCase() || "";
          const bSetName = b.name?.split(' - ')[1]?.toLowerCase() || "";
          aValue = aSetName;
          bValue = bSetName;
          break;
          
        default:
          aValue = a.name?.toLowerCase() || "";
          bValue = b.name?.toLowerCase() || "";
      }
      
      // Handle string comparison
      if (typeof aValue === "string" && typeof bValue === "string") {
        return sortOrder === "asc" ? aValue.localeCompare(bValue) : bValue.localeCompare(aValue);
      }
      
      // Handle numeric comparison
      if (sortOrder === "asc") {
        return aValue - bValue;
      } else {
        return bValue - aValue;
      }
    });
    
    return items;
  }, [groupedItems, searchTerm, sortBy, sortOrder]);

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
      {/* Native Mobile App Header */}
      <div className="bg-gray-50 dark:bg-gray-900 border-b border-gray-200 dark:border-gray-700 px-4 py-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white mb-1">Collection</h1>
          <p className="text-sm text-gray-600 dark:text-gray-300">Browse your inventory</p>
        </div>
      </div>

      {/* Search and Filters - Mobile Optimized */}
      <div className="bg-gray-50 dark:bg-gray-900 border-b border-gray-200 dark:border-gray-700 px-4 py-3">
        {/* Search Bar */}
        <div className="relative mb-3">
          <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
            <svg className="h-4 w-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
          </div>
            <input
              type="text"
            placeholder="Search collection..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-10 pr-4 py-2.5 bg-white dark:bg-gray-900/50 border border-gray-200 dark:border-gray-700 rounded-xl text-sm text-gray-900 dark:text-white placeholder-gray-500 dark:placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
            />
        </div>
        
        {/* Compact Filter Row */}
        <div className="flex items-center justify-between gap-2">
          {/* Item Type Filter - Compact Pills */}
          <div className="flex bg-white dark:bg-gray-900/50 rounded-lg p-0.5 border border-gray-200 dark:border-gray-700">
              <button
                onClick={() => setItemType("all")}
              className={`px-3 py-1.5 text-xs font-medium rounded-md transition-all duration-200 ${
                  itemType === "all" 
                    ? "bg-indigo-500 text-white shadow-sm" 
                  : "text-gray-600 dark:text-gray-300 hover:text-gray-800 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-gray-700"
                }`}
              >
                All
              </button>
              <button
                onClick={() => setItemType("sealed")}
              className={`px-3 py-1.5 text-xs font-medium rounded-md transition-all duration-200 ${
                  itemType === "sealed" 
                    ? "bg-indigo-500 text-white shadow-sm" 
                  : "text-gray-600 dark:text-gray-300 hover:text-gray-800 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-gray-700"
                }`}
              >
                Sealed
              </button>
              <button
                onClick={() => setItemType("singles")}
              className={`px-3 py-1.5 text-xs font-medium rounded-md transition-all duration-200 ${
                  itemType === "singles" 
                    ? "bg-indigo-500 text-white shadow-sm" 
                  : "text-gray-600 dark:text-gray-300 hover:text-gray-800 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-gray-700"
                }`}
              >
                Singles
              </button>
            </div>

          {/* Sort Controls - Compact */}
          <div className="flex items-center gap-1.5">
            {/* Sort By Dropdown */}
            <select
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value)}
              className="bg-white dark:bg-gray-900/50 text-xs text-gray-600 dark:text-gray-300 border border-gray-200 dark:border-gray-700 px-2 py-1.5 h-8 rounded-lg transition-colors focus:outline-none focus:ring-2 focus:ring-indigo-500 cursor-pointer min-w-0"
            >
              <option value="name">Name</option>
              <option value="marketValue">Value</option>
              <option value="totalCost">Cost</option>
              <option value="profit">P/L</option>
              <option value="quantity">Qty</option>
              <option value="dateAdded">Date</option>
              <option value="set">Set</option>
            </select>

            {/* Sort Order Toggle */}
            <div className="flex bg-white dark:bg-gray-900/50 rounded-lg p-0.5 border border-gray-200 dark:border-gray-700">
              <button
                onClick={() => setSortOrder("asc")}
                className={`px-2 py-1 text-xs rounded-md transition-all duration-200 ${
                  sortOrder === "asc" 
                    ? "bg-indigo-500 text-white shadow-sm" 
                    : "text-gray-600 dark:text-gray-300 hover:text-gray-800 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-gray-700"
                }`}
              >
                ↑
              </button>
              <button
                onClick={() => setSortOrder("desc")}
                className={`px-2 py-1 text-xs rounded-md transition-all duration-200 ${
                  sortOrder === "desc" 
                    ? "bg-indigo-500 text-white shadow-sm" 
                    : "text-gray-600 dark:text-gray-300 hover:text-gray-800 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-gray-700"
                }`}
              >
                ↓
              </button>
            </div>
            </div>
          </div>

        {/* Results Count - Subtle */}
        <div className="mt-2 text-xs text-gray-500 dark:text-gray-300">
          {filteredItems.length} item{filteredItems.length !== 1 ? 's' : ''}
        </div>
      </div>

      {/* Collection Grid - Native Mobile Style */}
      <div className="px-4 py-4">
        <div className="grid grid-cols-2 gap-3">
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
            <div 
              key={index} 
              className="bg-white dark:bg-gray-900/50 rounded-2xl border border-gray-200 dark:border-gray-700 p-4 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors cursor-pointer"
              onClick={() => handleOpenPreview(item)}
            >
              <div className="mb-3">
              <div className="flex-1 min-w-0">
                <h4 className="text-gray-800 dark:text-gray-200 font-medium truncate mb-1">{cleanTitle}</h4>
                {marketInfo && marketInfo.console_name && (
                  <p className="text-gray-600 dark:text-gray-300 text-xs truncate mb-1">{marketInfo.console_name}</p>
                )}
              </div>
              </div>
              
              {/* Product Image */}
              <div className="w-full h-32 bg-gradient-to-br from-gray-800 to-gray-900 rounded-lg mb-3 flex items-center justify-center overflow-hidden relative group border border-gray-300 dark:border-gray-700">
                {productImages[item.name] && productImages[item.name].length > 0 ? (
                  <img 
                    src={productImages[item.name][0]} 
                    alt={cleanTitle}
                    className="w-full h-full object-cover"
                    onError={(e) => {
                      e.target.style.display = 'none';
                      e.target.nextSibling.style.display = 'flex';
                    }}
                  />
                ) : null}
                
                {/* Fallback placeholder */}
                <div className={`w-full h-full flex flex-col items-center justify-center ${productImages[item.name] && productImages[item.name].length > 0 ? 'hidden' : 'flex'}`}>
                  {/* Pokemon card icon */}
                  <div className="flex items-center justify-center mb-2">
                    <svg className="w-8 h-8 text-yellow-400" fill="currentColor" viewBox="0 0 24 24">
                      <path d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5"/>
                    </svg>
                  </div>
                  
                  {/* Product type indicator */}
                  <div className="text-center">
                    <div className="text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">
                      {cleanTitle.includes('Elite Trainer Box') ? 'ETB' :
                       cleanTitle.includes('Booster Box') ? 'Booster Box' :
                       cleanTitle.includes('Booster Pack') ? 'Pack' :
                       cleanTitle.includes('Collection') ? 'Collection' :
                       cleanTitle.includes('Premium') ? 'Premium' :
                       'Card'}
                    </div>
                    
                    {/* Set name if available */}
                    {marketInfo && marketInfo.console_name && (
                      <div className="text-xs text-gray-600 dark:text-gray-300 truncate max-w-full px-2">
                        {marketInfo.console_name}
                      </div>
                    )}
                  </div>
                  
                  {/* Decorative elements */}
                  <div className="absolute top-2 right-2 w-2 h-2 bg-yellow-400 rounded-full opacity-60"></div>
                  <div className="absolute bottom-2 left-2 w-1 h-1 bg-blue-400 rounded-full opacity-40"></div>
                  <div className="absolute top-1/2 left-1 w-1 h-1 bg-red-400 rounded-full opacity-30"></div>
                </div>
              </div>
              
              {/* Market value and profit */}
              <div className="space-y-2">
                <div className="flex justify-between items-center">
                  <span className="text-gray-600 dark:text-gray-300 text-sm">On Hand:</span>
                  <span className="text-gray-600 dark:text-gray-300 text-sm font-medium">
                    {item.quantity}
                  </span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-gray-600 dark:text-gray-300 text-sm">Total Cost:</span>
                  <span className="text-red-400 text-sm font-medium">
                    {centsToStr(item.totalCost)} ({centsToStr(Math.round(item.totalCost / item.quantity))})
                  </span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-gray-600 dark:text-gray-300 text-sm">Market Value:</span>
                  <span className="text-blue-400 text-sm font-medium">
                    {centsToStr(totalMarketValue)} ({centsToStr(currentMarketValue)})
                  </span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-gray-600 dark:text-gray-300 text-sm">Profit:</span>
                  <span className={`text-sm font-medium ${profit >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                    {profit >= 0 ? '+' : ''}{centsToStr(profit)} ({profitPercentage >= 0 ? '+' : ''}{profitPercentage.toFixed(1)}%)
                  </span>
                </div>
              </div>
            </div>
          );
        })}
        </div>
      </div>

      {filteredItems.length === 0 && (
        <div className="px-4 py-8">
          <div className="bg-white dark:bg-gray-900/50 rounded-2xl border border-gray-200 dark:border-gray-700 p-8 text-center">
          <CollectionIcon />
            <p className="text-gray-600 dark:text-gray-300 mt-2">No items found in your collection</p>
          </div>
        </div>
      )}

      {/* Full-Page Item Preview */}
      {expandedItem && (
        <div className="fixed inset-0 bg-gray-50 dark:bg-gray-900 z-[100] overflow-y-auto">
          {/* Header */}
          <div className="border-b border-gray-200 dark:border-gray-700 px-4 py-4">
            <div className="flex items-center justify-between mb-4">
              <div>
                <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
                  {expandedItem.name.replace(/\s*-\s*Pokemon\s+.*$/i, '')}
                </h1>
                <p className="text-sm text-gray-600 dark:text-gray-300">Item Details & Performance</p>
              </div>
                  <button
                onClick={handleClosePreview}
                className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors"
                  >
                <svg className="w-6 h-6 text-gray-600 dark:text-gray-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  </button>
                </div>
                    </div>

          {/* Content */}
          <div className="px-4 py-6">
            {/* 14 KPI Pills Grid - Based on Stats Page */}
            <div className="mb-8">
              <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">Performance Analytics</h2>
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-3">
                {(() => {
                  const itemOrders = getItemOrders(expandedItem.name);
                  const soldOrders = itemOrders.filter(order => order.sale_date && order.sale_price_cents > 0);
                  const totalSold = soldOrders.length;
                  const totalBought = expandedItem.quantity;
                  const onHand = totalBought - totalSold;
                  
                  // Calculate values
                  const totalCost = expandedItem.totalCost;
                  const totalRevenue = soldOrders.reduce((sum, order) => sum + (order.sale_price_cents || 0), 0);
                  const totalFees = soldOrders.reduce((sum, order) => {
                    const revenue = order.sale_price_cents || 0;
                    const feesPct = order.fees_pct || 0;
                    return sum + Math.round(revenue * feesPct);
                  }, 0);
                  const totalShipping = soldOrders.reduce((sum, order) => sum + (order.shipping_cents || 0), 0);
                  const soldCost = soldOrders.reduce((sum, order) => sum + (order.buy_price_cents || 0), 0);
                  const realizedPL = totalRevenue - totalFees - totalShipping - soldCost;
                  
                  // Market value calculation
                          const marketInfo = expandedItem.marketInfo;
                          const manualValue = expandedItem.manualValue;
                          let currentMarketValue;
                          if (marketInfo && marketInfo.loose_price) {
                            currentMarketValue = Math.round(parseFloat(marketInfo.loose_price) * 100);
                          } else if (manualValue && manualValue > 0) {
                            currentMarketValue = manualValue;
                          } else {
                    currentMarketValue = Math.round(expandedItem.totalCost / expandedItem.quantity);
                  }
                  
                  const onHandMarketValue = onHand * currentMarketValue;
                  const totalMarketValue = totalBought * currentMarketValue;
                  const unrealizedPL = onHandMarketValue - (totalCost - soldCost);
                  
                  // Calculate ROI and Margin
                  const roi = soldCost > 0 ? realizedPL / soldCost : 0;
                  const margin = totalRevenue > 0 ? realizedPL / totalRevenue : 0;
                  
                  // Calculate average hold time
                  let avgHoldDays = 0;
                  if (soldOrders.length > 0) {
                    const totalHoldDays = soldOrders.reduce((sum, order) => {
                      if (order.order_date && order.sale_date) {
                        const orderDate = new Date(order.order_date);
                        const saleDate = new Date(order.sale_date);
                        const holdDays = Math.round((saleDate - orderDate) / (24 * 60 * 60 * 1000));
                        return sum + (holdDays > 0 ? holdDays : 0);
                      }
                      return sum;
                    }, 0);
                    avgHoldDays = Math.round(totalHoldDays / soldOrders.length);
                  }
                  
                  // Average Sale Price
                  const asp = totalSold > 0 ? Math.round(totalRevenue / totalSold) : 0;
                  
                  return (
                    <>
                      {/* Bought */}
                      <div className="rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900/50 p-3 text-center">
                        <div className="text-xs text-gray-600 dark:text-gray-300">Bought</div>
                        <div className="text-base font-semibold text-gray-900 dark:text-white mt-0.5">{totalBought}</div>
                        <div className="text-[10px] text-gray-600 dark:text-gray-300 mt-0.5">total purchases</div>
                      </div>
                      
                      {/* Sold */}
                      <div className="rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900/50 p-3 text-center">
                        <div className="text-xs text-gray-600 dark:text-gray-300">Sold</div>
                        <div className="text-base font-semibold text-gray-900 dark:text-white mt-0.5">{totalSold}</div>
                        <div className="text-[10px] text-gray-600 dark:text-gray-300 mt-0.5">total sold</div>
                    </div>

                      {/* On Hand */}
                      <div className="rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900/50 p-3 text-center">
                        <div className="text-xs text-gray-600 dark:text-gray-300">On Hand</div>
                        <div className="text-base font-semibold text-gray-900 dark:text-white mt-0.5">{onHand}</div>
                        <div className="text-[10px] text-gray-600 dark:text-gray-300 mt-0.5">total inventory</div>
                      </div>
                      
                      {/* Cost */}
                      <div className="rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900/50 p-3 text-center">
                        <div className="text-xs text-gray-600 dark:text-gray-300">Cost</div>
                        <div className="text-base font-semibold text-gray-900 dark:text-white mt-0.5">${centsToStr(totalCost)}</div>
                        <div className="text-[10px] text-gray-600 dark:text-gray-300 mt-0.5">total amt spent</div>
                      </div>
                      
                      {/* Fees */}
                      <div className="rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900/50 p-3 text-center">
                        <div className="text-xs text-gray-600 dark:text-gray-300">Fees</div>
                        <div className="text-base font-semibold text-gray-900 dark:text-white mt-0.5">${centsToStr(totalFees)}</div>
                        <div className="text-[10px] text-gray-600 dark:text-gray-300 mt-0.5">from marketplace</div>
                      </div>
                      
                      {/* Shipping */}
                      <div className="rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900/50 p-3 text-center">
                        <div className="text-xs text-gray-600 dark:text-gray-300">Shipping</div>
                        <div className="text-base font-semibold text-gray-900 dark:text-white mt-0.5">${centsToStr(totalShipping)}</div>
                        <div className="text-[10px] text-gray-600 dark:text-gray-300 mt-0.5">from sales</div>
                      </div>
                      
                      {/* Revenue */}
                      <div className="rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900/50 p-3 text-center">
                        <div className="text-xs text-gray-600 dark:text-gray-300">Revenue</div>
                        <div className="text-base font-semibold text-gray-900 dark:text-white mt-0.5">${centsToStr(totalRevenue)}</div>
                        <div className="text-[10px] text-gray-600 dark:text-gray-300 mt-0.5">total from sales</div>
                      </div>
                      
                      {/* Realized P/L */}
                      <div className="rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900/50 p-3 text-center">
                        <div className="text-xs text-gray-600 dark:text-gray-300">Realized P/L</div>
                        <div className={`text-base font-semibold mt-0.5 ${realizedPL >= 0 ? 'text-emerald-400' : realizedPL < 0 ? 'text-red-400' : 'text-gray-900 dark:text-white'}`}>
                          ${centsToStr(realizedPL)}
                        </div>
                        <div className="text-[10px] text-gray-600 dark:text-gray-300 mt-0.5">after fees + ship</div>
                      </div>
                      
                      {/* ROI */}
                      <div className="rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900/50 p-3 text-center">
                        <div className="text-xs text-gray-600 dark:text-gray-300">ROI</div>
                        <div className="text-base font-semibold text-gray-900 dark:text-white mt-0.5">
                          {Number.isFinite(roi) ? `${(roi * 100).toFixed(0)}%` : '—'}
                      </div>
                        <div className="text-[10px] text-gray-600 dark:text-gray-300 mt-0.5">profit / cost</div>
                    </div>
                      
                      {/* Margin */}
                      <div className="rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900/50 p-3 text-center">
                        <div className="text-xs text-gray-600 dark:text-gray-300">Margin</div>
                        <div className="text-base font-semibold text-gray-900 dark:text-white mt-0.5">
                          {Number.isFinite(margin) ? `${(margin * 100).toFixed(0)}%` : '—'}
                  </div>
                        <div className="text-[10px] text-gray-600 dark:text-gray-300 mt-0.5">profit / revenue</div>
                </div>

                      {/* Avg Hold */}
                      <div className="rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900/50 p-3 text-center">
                        <div className="text-xs text-gray-600 dark:text-gray-300">Avg Hold</div>
                        <div className="text-base font-semibold text-gray-900 dark:text-white mt-0.5">{avgHoldDays}d</div>
                        <div className="text-[10px] text-gray-600 dark:text-gray-300 mt-0.5">time in days</div>
                      </div>
                      
                      {/* ASP */}
                      <div className="rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900/50 p-3 text-center">
                        <div className="text-xs text-gray-600 dark:text-gray-300">ASP</div>
                        <div className="text-base font-semibold text-gray-900 dark:text-white mt-0.5">${centsToStr(asp)}</div>
                        <div className="text-[10px] text-gray-600 dark:text-gray-300 mt-0.5">average sale price</div>
                  </div>

                      {/* Market Price */}
                      <div className="rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900/50 p-3 text-center">
                        <div className="text-xs text-gray-600 dark:text-gray-300">Market Price</div>
                        <div className="text-base font-semibold text-gray-900 dark:text-white mt-0.5">${centsToStr(currentMarketValue)}</div>
                        <div className="text-[10px] text-gray-600 dark:text-gray-300 mt-0.5">from database</div>
                          </div>
                      
                      {/* Est. Value */}
                      <div className="rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900/50 p-3 text-center">
                        <div className="text-xs text-gray-600 dark:text-gray-300">Est. Value</div>
                        <div className={`text-base font-semibold mt-0.5 ${onHandMarketValue > 0 ? 'text-indigo-400' : 'text-gray-600 dark:text-gray-300'}`}>
                          ${centsToStr(onHandMarketValue)}
                          </div>
                        <div className="text-[10px] text-gray-600 dark:text-gray-300 mt-0.5">based on mkt price</div>
                        </div>
                    </>
                  );
                })()}
                        </div>
                          </div>

            {/* Simplified Order History */}
            <div className="mb-8">
              <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">Transaction History</h3>
              <div className="space-y-2">
                {(() => {
                  const allTransactions = [];
                  const itemOrders = getItemOrders(expandedItem.name);
                  
                  // Add purchase transactions
                  itemOrders.forEach(order => {
                    if (order.order_date) {
                      allTransactions.push({
                        date: order.order_date,
                        type: 'Purchase',
                        price: order.buy_price_cents || 0,
                        sortDate: new Date(order.order_date),
                      });
                    }
                    // Add sale transaction if exists
                    if (order.sale_date && order.sale_price_cents > 0) {
                      allTransactions.push({
                        date: order.sale_date,
                        type: 'Sale',
                        price: order.sale_price_cents,
                        sortDate: new Date(order.sale_date),
                      });
                    }
                  });
                  
                  // Sort by date (newest first)
                  allTransactions.sort((a, b) => b.sortDate - a.sortDate);
                  
                  return allTransactions.length > 0 ? (
                    allTransactions.map((transaction, index) => (
                      <div key={index} className="flex items-center justify-between p-3 bg-white dark:bg-gray-900/50 rounded-lg border border-gray-200 dark:border-gray-700">
                        <div className="flex items-center gap-3">
                          <div className={`w-2 h-2 rounded-full ${transaction.type === 'Purchase' ? 'bg-blue-400' : 'bg-green-400'}`}></div>
                          <div>
                            <div className="text-sm font-medium text-gray-900 dark:text-white">
                              {transaction.type}
                      </div>
                            <div className="text-xs text-gray-600 dark:text-gray-300">
                              {new Date(transaction.date).toLocaleDateString()}
                  </div>
                </div>
              </div>
                        <div className={`text-sm font-medium ${
                          transaction.type === 'Purchase' ? 'text-red-400' : 'text-green-400'
                        }`}>
                          {transaction.type === 'Purchase' ? '-' : '+'}${centsToStr(transaction.price)}
            </div>
          </div>
                    ))
                  ) : (
                    <div className="text-center py-8 text-gray-600 dark:text-gray-300">
                      No transaction history available
                    </div>
                  );
                })()}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}


/* ====================== MAIN COMPONENT ====================== */
export default function Portfolio() {
  const location = useLocation();
  const navigate = useNavigate();
  const [marketData, setMarketData] = useState({});

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

  // Get all orders for order history
  const { data: allOrders = [] } = useQuery({
    queryKey: ["all-orders"],
    queryFn: getAllOrders,
  });

  // Fetch manual database values for fallback from products table
  const { data: manualItems = [] } = useQuery({
    queryKey: ["manual-items"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("products")
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
      } else if (backgroundDataCount > 0) {
        // Some data is available, use it and fetch the rest
        console.log(`Portfolio: ${backgroundDataCount}/${uniqueProductNames.length} products loaded from background cache`);
        setMarketData(backgroundData);
        
        getBatchMarketData(uniqueProductNames)
          .then(data => {
            console.log('Portfolio: Received complete market data:', data);
            setMarketData(data);
          })
          .catch(error => {
            console.error('Error fetching market data:', error);
            setMarketData(backgroundData); // Keep what we have from background
          });
      } else {
        // No background data available, fetch all
        console.log('Portfolio: No background data available, fetching all market data');
        
        getBatchMarketData(uniqueProductNames)
          .then(data => {
            console.log('Portfolio: Received market data:', data);
            setMarketData(data);
          })
          .catch(error => {
            console.error('Error fetching market data:', error);
            setMarketData({});
          });
      }
    } else {
      setMarketData({});
    }
  }, [uniqueProductNames]);

  const isLoading = ordersLoading || itemsLoading;

  if (isLoading) {
    return (
      <LayoutWithSidebar active={activeSidebarItem} section="portfolio">
        <div className="flex items-center justify-center h-64">
          <div className="text-gray-600 dark:text-slate-400">Loading portfolio...</div>
        </div>
      </LayoutWithSidebar>
    );
  }

  return (
    <LayoutWithSidebar active={activeSidebarItem} section="portfolio">
        <PortfolioContent 
          orders={orders} 
          portfolioItems={portfolioItems} 
          marketData={marketData} 
          manualItems={manualItems}
          allOrders={allOrders}
          currentTab={currentTab} 
        />
    </LayoutWithSidebar>
  );
}

/* ----------------------------- Stats Tab ---------------------------- */
function StatsTab({ orders }) {
  return <Stats noLayout={true} />;
}

