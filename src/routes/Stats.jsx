// src/routes/Stats.jsx
import { useEffect, useMemo, useRef, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "../lib/supabaseClient";
import LayoutWithSidebar from "../components/LayoutWithSidebar.jsx";
import PageHeader from "../components/PageHeader.jsx";
import { centsToStr, formatNumber } from "../utils/money.js";
import { card, inputBase, rowCard } from "../utils/ui.js";
import { Select } from "../components/Select.jsx";

// Icons
const CalendarIcon = () => (
  <svg className="w-4 h-4" viewBox="0 0 20 20" fill="currentColor">
    <path fillRule="evenodd" d="M5.75 2a.75.75 0 01.75.75V4h7V2.75a.75.75 0 011.5 0V4h.25A2.75 2.75 0 0118 6.75v8.5A2.75 2.75 0 0115.25 18H4.75A2.75 2.75 0 012 15.25v-8.5A2.75 2.75 0 014.75 4H5V2.75A.75.75 0 015.75 2zm-1 5.5c-.69 0-1.25.56-1.25 1.25v6.5c0 .69.56 1.25 1.25 1.25h10.5c.69 0 1.25-.56 1.25-1.25v-6.5c0-.69-.56-1.25-1.25-1.25H4.75z" clipRule="evenodd" />
  </svg>
);

const ProductIcon = () => (
  <svg className="w-4 h-4" viewBox="0 0 20 20" fill="currentColor">
    <path fillRule="evenodd" d="M17.707 9.293a1 1 0 010 1.414l-7 7a1 1 0 01-1.414 0l-7-7A.997.997 0 012 10V5a3 3 0 013-3h5c.256 0 .512.098.707.293l7 7zM5 6a1 1 0 100-2 1 1 0 000 2z" clipRule="evenodd" />
  </svg>
);

/* ----------------------------- data helpers ---------------------------- */
const cents = (n) => Math.round(Number(n || 0));
const pctStr = (p) => (Number.isFinite(p) ? `${(p * 100).toFixed(0)}%` : "—");
const within = (d, from, to) => {
  if (!d) return false;
  const x = new Date(d).getTime();
  if (isNaN(x)) return false;
  if (from && x < from) return false;
  if (to && x > to) return false;
  return true;
};
const normalizeItemFilter = (v) =>
  !v || v.trim().toLowerCase() === "all items" ? "" : v.trim();


/* -------------------------------- queries ------------------------------- */
async function getOrders() {
  const { data, error } = await supabase
    .from("orders")
    .select(
      "id, created_at, order_date, sale_date, item, retailer, marketplace, buy_price_cents, sale_price_cents, fees_pct, shipping_cents, status"
    )
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

async function getPriceChartingProducts() {
  const { data, error } = await supabase
    .from("price_charting_products")
    .select("product_name, console_name, loose_price")
    .order("product_name", { ascending: true });
  if (error) throw error;
  return data || [];
}

// Category-specific queries for inventory data
async function getTCGSealed() {
  const { data, error } = await supabase
    .from("tcg_sealed")
    .select("id, name, market_value_cents, price_source, api_product_id, api_last_updated, api_price_cents, manual_override")
    .order("name", { ascending: true });
  if (error) throw error;
  return data || [];
}

async function getTCGSingles() {
  const { data, error } = await supabase
    .from("tcg_singles")
    .select("id, name, market_value_cents, price_source, api_product_id, api_last_updated, api_price_cents, manual_override")
    .order("name", { ascending: true });
  if (error) throw error;
  return data || [];
}

async function getVideoGames() {
  const { data, error } = await supabase
    .from("video_games")
    .select("id, name, market_value_cents, price_source, api_product_id, api_last_updated, api_price_cents, manual_override")
    .order("name", { ascending: true });
  if (error) throw error;
  return data || [];
}

/* --------------------------------- page --------------------------------- */
export default function Stats() {
  const { data: orders = [], isLoading: ordersLoading } = useQuery({ queryKey: ["orders"], queryFn: getOrders });
  const { data: items = [] } = useQuery({ queryKey: ["items"], queryFn: getItems });
  const { data: priceChartingProducts = [] } = useQuery({ queryKey: ["price_charting_products"], queryFn: getPriceChartingProducts });
  const { data: tcgSealed = [] } = useQuery({ queryKey: ["tcg_sealed"], queryFn: getTCGSealed });
  const { data: tcgSingles = [] } = useQuery({ queryKey: ["tcg_singles"], queryFn: getTCGSingles });
  const { data: videoGames = [] } = useQuery({ queryKey: ["video_games"], queryFn: getVideoGames });


  /* --------------------------- filter controls -------------------------- */
  const [timeFilter, setTimeFilter] = useState(""); // all | 30 | 7 | today | custom
  const [fromStr, setFromStr] = useState("");
  const [toStr, setToStr] = useState("");
  const [itemSearchQuery, setItemSearchQuery] = useState("");
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);

  const itemOptions = useMemo(() => {
    const names = items.map((i) => i.name).filter(Boolean);
    const uniq = Array.from(new Set(names)).sort((a, b) => a.localeCompare(b));
    return uniq;
  }, [items]);

  // Filter dropdown items based on current search
  const filteredDropdownItems = useMemo(() => {
    const t = itemSearchQuery.trim().toLowerCase();
    if (!t) return itemOptions; // Show all items when no search
    
    const filtered = itemOptions.filter(name => name.toLowerCase().includes(t));
    // Only limit if we have many results to avoid overwhelming the dropdown
    return filtered.length > 50 ? filtered.slice(0, 50) : filtered;
  }, [itemOptions, itemSearchQuery]);

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (!event.target.closest('[data-dropdown-container]')) {
        setIsDropdownOpen(false);
      }
    };
    
    if (isDropdownOpen) {
      document.addEventListener('mousedown', handleClickOutside);
      return () => document.removeEventListener('mousedown', handleClickOutside);
    }
  }, [isDropdownOpen]);

  // Live filtering - update applied state automatically
  const applied = useMemo(() => ({
    timeFilter,
    from: timeFilter === "custom" ? fromStr || null : null,
    to: timeFilter === "custom" ? toStr || null : null,
    item: itemSearchQuery.trim(),
  }), [timeFilter, fromStr, toStr, itemSearchQuery]);

  const { fromMs, toMs } = useMemo(() => {
    if (applied.timeFilter === "custom") {
      const f = applied.from ? new Date(applied.from).setHours(0,0,0,0) : null;
      const t = applied.to ? new Date(applied.to).setHours(23,59,59,999) : null;
      return { fromMs: f, toMs: t };
    }
    if (applied.timeFilter === "today") {
      const now = new Date();
      const f = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
      const t = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23,59,59,999).getTime();
      return { fromMs: f, toMs: t };
    }
    if (applied.timeFilter === "7") {
      const t = Date.now();
      const f = t - 6 * 24 * 3600 * 1000;
      return { fromMs: f, toMs: t };
    }
    if (applied.timeFilter === "30") {
      const t = Date.now();
      const f = t - 29 * 24 * 3600 * 1000;
      return { fromMs: f, toMs: t };
    }
    // Empty string or "all" - no time filtering
    return { fromMs: null, toMs: null };
  }, [applied]);

  /* ---------- market value lookup ---------- */
  const marketByName = useMemo(() => {
    const m = new Map();
    
    // Helper function to search products using the same logic as the search API
    const searchProducts = (query) => {
      if (!query || query.trim().length < 2) return [];
      
      const cleanQuery = query.trim().toLowerCase();
      const results = [];
      
      // Strategy 1: Contains match (most likely to find results)
      for (const product of priceChartingProducts) {
        if (product.loose_price && product.loose_price > 0) {
          const productLower = (product.product_name || "").toLowerCase();
          if (productLower.includes(cleanQuery)) {
            results.push({
              ...product,
              similarity_score: 1.0
            });
          }
        }
      }
      
      if (results.length > 0) return results;
      
      // Strategy 2: First word only
      const firstWord = cleanQuery.split(' ')[0];
      if (firstWord.length > 2) {
        for (const product of priceChartingProducts) {
          if (product.loose_price && product.loose_price > 0) {
            const productLower = (product.product_name || "").toLowerCase();
            if (productLower.includes(firstWord)) {
              results.push({
                ...product,
                similarity_score: 0.8
              });
            }
          }
        }
      }
      
      if (results.length > 0) return results;
      
      // Strategy 3: Without numbers
      const withoutNumbers = cleanQuery.replace(/\d+/g, '').trim();
      if (withoutNumbers.length > 2) {
        for (const product of priceChartingProducts) {
          if (product.loose_price && product.loose_price > 0) {
            const productLower = (product.product_name || "").toLowerCase();
            if (productLower.includes(withoutNumbers)) {
              results.push({
                ...product,
                similarity_score: 0.7
              });
            }
          }
        }
      }
      
      if (results.length > 0) return results;
      
      // Strategy 4: Individual words
      const words = cleanQuery.split(' ').filter(word => word.length > 2);
      for (const word of words) {
        for (const product of priceChartingProducts) {
          if (product.loose_price && product.loose_price > 0) {
            const productLower = (product.product_name || "").toLowerCase();
            if (productLower.includes(word)) {
              results.push({
                ...product,
                similarity_score: 0.6
              });
            }
          }
        }
      }
      
      // Remove duplicates and sort by similarity
      const uniqueResults = results.filter((result, index, self) => 
        index === self.findIndex(r => r.product_name === result.product_name)
      );
      
      return uniqueResults.sort((a, b) => b.similarity_score - a.similarity_score);
    };
    
    // Helper function to find best match for an item name
    const findBestMatch = (itemName) => {
      if (!itemName) return null;
      
      const searchResults = searchProducts(itemName);
      if (searchResults.length > 0) {
        // Return the price of the best match
        return Math.round(searchResults[0].loose_price * 100);
      }
      
      return null;
    };
    
    // Build map from all possible item names (orders + category tables + manual items)
    const allItemNames = new Set();
    
    // Add item names from orders
    for (const order of orders) {
      if (order.item) allItemNames.add(order.item);
    }
    
    // Add item names from category tables
    const allCategoryItems = [...tcgSealed, ...tcgSingles, ...videoGames];
    for (const item of allCategoryItems) {
      if (item.name) allItemNames.add(item.name);
    }
    
    // Add item names from manual items
    for (const item of items) {
      if (item.name) allItemNames.add(item.name);
    }
    
    // For each unique item name, find the best market value using search logic
    for (const itemName of allItemNames) {
      const apiValue = findBestMatch(itemName);
      if (apiValue) {
        m.set(itemName.toLowerCase(), apiValue);
      }
    }
    
    // Add manual database values as fallback (only if not already present)
    for (const it of items) {
      const k = (it.name || "").toLowerCase();
      const v = cents(it.market_value_cents);
      if (v > 0 && !m.has(k)) {
        m.set(k, v);
      }
    }
    
    return m;
  }, [items, priceChartingProducts, orders, tcgSealed, tcgSingles, videoGames]);

  /* ---------- filtered orders by time + item ---------- */
  const filtered = useMemo(() => {
    const itemQuery = applied.item ? applied.item.toLowerCase() : "";
    const useItem = applied.item && applied.item.trim() !== ""; // Only filter if there's actual text
    const ordersArray = Array.isArray(orders) ? orders : [];
    
    const result = ordersArray.filter((o) => {
      const matchesItem = !useItem || (o.item || "").toLowerCase().includes(itemQuery);
      const anyInWindow =
        within(o.order_date, fromMs, toMs) ||
        within(o.sale_date, fromMs, toMs) ||
        (!fromMs && !toMs);
      return matchesItem && anyInWindow;
    });
    
    return result;
  }, [orders, applied, fromMs, toMs]);

  /* ------------------------------- KPIs -------------------------------- */
  const kpis = useMemo(() => makeTopKpis(filtered), [filtered]);



  /* -------------------- Expandable item cards -------------------- */
  const itemGroups = useMemo(() => makeItemGroups(filtered, marketByName), [filtered, marketByName]);
  const [openSet, setOpenSet] = useState(() => new Set());
  
  const toggleItem = (key) => {
    setOpenSet((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  };

  return (
    <LayoutWithSidebar active="stats" section="orderbook">
      <PageHeader title="Stats" />

        {/* -------------------- Performance Analytics with Filters -------------------- */}
        <div className={`${card} relative z-[60]`}>
          <div className="mb-6">
            <div className="text-lg font-semibold">Performance Analytics</div>
            <div className="text-slate-400 text-xs -mt-0.5">Monthly trends and insights</div>
          </div>

          {/* Filters */}
          <div className="space-y-4 mb-8">
            {/* Time filter dropdown */}
            <Select
              value={timeFilter}
              onChange={setTimeFilter}
              options={[
                { value: "all", label: "All time" },
                { value: "30", label: "Last 30 days" },
                { value: "7", label: "Last 7 days" },
                { value: "today", label: "Today" },
                { value: "custom", label: "Custom range" },
              ]}
              placeholder="All time"
              icon={<CalendarIcon />}
            />

            {/* Custom date range */}
            {timeFilter === "custom" && (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <input
                  type="date"
                  value={fromStr}
                  onChange={(e) => setFromStr(e.target.value)}
                  className={inputBase}
                  placeholder="Start date"
                />
                <input
                  type="date"
                  value={toStr}
                  onChange={(e) => setToStr(e.target.value)}
                  className={inputBase}
                  placeholder="End date"
                />
              </div>
            )}

            {/* Item search */}
            <div className="relative" data-dropdown-container>
              <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                <ProductIcon />
              </div>
              <input
                type="text"
                value={itemSearchQuery}
                onChange={(e) => setItemSearchQuery(e.target.value)}
                onFocus={() => setIsDropdownOpen(true)}
                onClick={() => setIsDropdownOpen(true)}
                onKeyDown={(e) => {
                  if (e.key === 'Escape') {
                    setIsDropdownOpen(false);
                  }
                }}
                placeholder="All products"
                className="w-full min-w-0 appearance-none bg-slate-900/60 border border-slate-800 rounded-xl pl-10 pr-3 py-2 sm:pl-12 sm:pr-4 sm:py-3 text-sm sm:text-base text-slate-100 placeholder-slate-400 outline-none focus:border-indigo-500 cursor-text"
              />
              
              {/* Clear button */}
              {itemSearchQuery && (
                <button
                  type="button"
                  onClick={() => setItemSearchQuery("")}
                  className="absolute right-3 sm:right-4 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-200 transition-colors"
                  title="Clear search"
                >
                  ×
                </button>
              )}
              
              {/* Dropdown list */}
              {isDropdownOpen && (
                <div className="absolute top-full left-0 right-0 mt-1 bg-slate-900 border border-slate-800 rounded-lg shadow-2xl z-50 max-h-48 overflow-y-auto">
                  {filteredDropdownItems.length > 0 ? (
                    <>
                      <div className="px-3 py-2 text-xs text-slate-400 border-b border-slate-800">
                        {itemSearchQuery.trim() 
                          ? `${filteredDropdownItems.length} of ${itemOptions.length} products`
                          : `${itemOptions.length} total products`
                        }
                      </div>
                      {filteredDropdownItems.map((item) => (
                        <button
                          key={item}
                          type="button"
                          onClick={() => {
                            setItemSearchQuery(item);
                            setIsDropdownOpen(false);
                          }}
                          className="w-full text-left px-3 py-2 text-sm text-slate-100 hover:bg-slate-700 focus:bg-slate-700 focus:outline-none transition-colors duration-150"
                        >
                          {item}
                        </button>
                      ))}
                    </>
                  ) : (
                    <div className="px-3 py-2 text-sm text-slate-400">No products found</div>
                  )}
                </div>
              )}
            </div>
            </div>

          {/* KPI Cards - Hide for single item */}
          {itemGroups.length !== 1 && (
            <div className="grid grid-cols-2 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4 mb-8">
            <Kpi title="Total Revenue" value={`$${centsToStr(kpis.revenueC)}`} />
            <Kpi title="Total Cost" value={`$${centsToStr(kpis.spentC)}`} />
            <Kpi title="Total Sales" value={`${kpis.sold}`} />
            <Kpi title="Realized P/L" value={`$${centsToStr(kpis.realizedPlC)}`} tone="green" />

            <Kpi title="Longest Hold" value={`${kpis.longestHoldDays}d`} hint={kpis.longestHoldName} />
            <Kpi title="Best Seller" value={`${kpis.bestSellerCount}`} hint={kpis.bestSellerName} />
            <Kpi title="Highest Margins" value={pctStr(kpis.bestMarginPct)} hint={kpis.bestMarginName} />
            <Kpi title="Best ROI" value={pctStr(kpis.bestRoiPct)} hint={kpis.bestRoiName} />
          </div>
          )}

          {/* Analytics Dashboard */}
          <div className="mb-6">
            <div className="mb-4">
              <h3 className="text-md font-medium text-slate-200 mb-1">Analytics Dashboard</h3>
              <p className="text-sm text-slate-400">Comprehensive insights and performance metrics</p>
            </div>
            <DynamicCharts itemGroups={itemGroups} filteredOrders={filtered} />
        </div>

          {/* Summary Cards - Hide for single item */}
          {itemGroups.length !== 1 && (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <div className="bg-slate-900/40 rounded-xl p-4 border border-slate-800">
              <h4 className="text-sm font-medium text-slate-300 mb-3">Top Performing Items</h4>
              <div className="space-y-2">
                {itemGroups.slice(0, 3).map((item, idx) => (
                  <div key={item.item} className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <div className="w-2 h-2 rounded-full bg-indigo-500"></div>
                      <span className="text-sm text-slate-300 truncate">{item.item}</span>
            </div>
                    <div className="text-right">
                      <div className="text-sm font-medium text-slate-100">${centsToStr(item.revenueC)}</div>
                      <div className="text-xs text-slate-400">{formatNumber(item.sold)} sold</div>
                    </div>
                  </div>
                ))}
              </div>
          </div>

            <div className="bg-slate-900/40 rounded-xl p-4 border border-slate-800">
              <h4 className="text-sm font-medium text-slate-300 mb-3">Quick Stats</h4>
              <div className="space-y-3">
                <div className="flex justify-between">
                  <span className="text-sm text-slate-400">Total Items</span>
                  <span className="text-sm font-medium text-slate-100">{formatNumber(itemGroups.length)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-sm text-slate-400">Items Bought</span>
                  <span className="text-sm font-medium text-slate-100">{formatNumber(itemGroups.reduce((sum, item) => sum + item.bought, 0))}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-sm text-slate-400">Items Sold</span>
                  <span className="text-sm font-medium text-slate-100">{formatNumber(itemGroups.reduce((sum, item) => sum + item.sold, 0))}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-sm text-slate-400">Items On Hand</span>
                  <span className="text-sm font-medium text-slate-100">{formatNumber(itemGroups.reduce((sum, item) => sum + item.onHand, 0))}</span>
                </div>
              </div>
            </div>
          </div>
          )}
        </div>

        {/* -------------------- Results -------------------- */}
        <div className={`${card} mt-6`}>
          <div className="flex items-center justify-between gap-3 mb-4">
            <h2 className="text-lg font-semibold">Results</h2>
            <div className="text-slate-400 text-sm">{itemGroups.length} items</div>
          </div>

          <div className="space-y-2">
          {itemGroups.map((g) => {
            const open = openSet.has(g.item);
              
              // Calculate last purchase and last sale dates
              const itemOrders = filtered.filter(o => o.item === g.item);
              const lastPurchase = itemOrders
                .filter(o => o.order_date)
                .sort((a, b) => new Date(b.order_date) - new Date(a.order_date))[0];
              const lastSale = itemOrders
                .filter(o => o.sale_date && cents(o.sale_price_cents) > 0)
                .sort((a, b) => new Date(b.sale_date) - new Date(a.sale_date))[0];
              
              const lastPurchaseText = lastPurchase 
                ? new Date(lastPurchase.order_date).toLocaleDateString()
                : "—";
              const lastSaleText = lastSale 
                ? new Date(lastSale.sale_date).toLocaleDateString()
                : "—";

            return (
                <div key={g.item} className="border border-slate-800 rounded-xl bg-slate-900/60">
                  <div 
                    className="flex items-center justify-between gap-3 p-4 cursor-pointer transition"
                    onClick={() => toggleItem(g.item)}
                  >
                    <div className="min-w-0 flex-1">
                      <div className="text-lg font-semibold truncate">{g.item}</div>
                      <div className="text-sm text-slate-400 mt-1">
                        Last purchase: {lastPurchaseText} • Last sold: {lastSaleText}
                      </div>
                    </div>
                    {!open && (
                      <div className="text-right">
                        <div className={`text-lg font-semibold ${g.realizedPlC > 0 ? 'text-emerald-400' : g.realizedPlC < 0 ? 'text-red-400' : 'text-slate-100'}`}>
                          ${centsToStr(g.realizedPlC)}
                        </div>
                        <div className="text-sm text-slate-400">Realized P/L</div>
                      </div>
                    )}
                    <ChevronDown className={`h-5 w-5 text-slate-400 transition-transform ${open ? "rotate-180" : ""}`} />
                </div>

                  <div className={`transition-all duration-300 ease-in-out overflow-hidden`} style={{ maxHeight: open ? 'none' : 0 }}>
                    <div className="px-4 pb-4">
                      <div className="grid grid-cols-2 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-3">
                        <MiniPill title="Bought" value={formatNumber(g.bought)} num={g.bought} sub="total purchases" />
                        <MiniPill title="Sold" value={formatNumber(g.sold)} num={g.sold} sub="total sold" />
                        <MiniPill title="On Hand" value={formatNumber(g.onHand)} num={g.onHand} sub="total inventory" />
                      <MiniPill title="Cost" value={`$${centsToStr(g.totalCostC)}`} num={g.totalCostC} sub="total amt spent" />
                      <MiniPill title="Fees" value={`$${centsToStr(g.feesC)}`} num={g.feesC} sub="from marketplace" />
                      <MiniPill title="Shipping" value={`$${centsToStr(g.shipC)}`} num={g.shipC} sub="from sales" />
                      <MiniPill title="Revenue" value={`$${centsToStr(g.revenueC)}`} num={g.revenueC} sub="total from sales" />
                      <MiniPill title="Realized P/L" value={`$${centsToStr(g.realizedPlC)}`} num={g.realizedPlC} sub="after fees + ship" tone="realized" />
                      <MiniPill title="ROI" value={pctStr(g.roi)} num={Number.isFinite(g.roi) ? g.roi : 0} sub="profit / cost" />
                      <MiniPill title="Margin" value={pctStr(g.margin)} num={Number.isFinite(g.margin) ? g.margin : 0} sub="profit / revenue" />
                        <MiniPill title="Avg Hold" value={`${formatNumber(g.avgHoldDays.toFixed(0))}d`} num={g.avgHoldDays} sub="time in days" />
                      <MiniPill title="ASP" value={`$${centsToStr(g.aspC)}`} num={g.aspC} sub="average sale price" />
                      <MiniPill title="Market Price" value={`$${centsToStr(g.unitMarketC)}`} num={g.unitMarketC} sub="from database" />
                      <MiniPill title="Est. Value" value={`$${centsToStr(g.onHandMarketC)}`} num={g.onHandMarketC} sub="based on mkt price" tone="unrealized" />
                    </div>
                  </div>
                  </div>
              </div>
            );
          })}
          </div>

          {itemGroups.length === 0 && (
            <div className="text-slate-400 text-center py-8">No items in this view.</div>
          )}
        </div>
    </LayoutWithSidebar>
  );
}

/* --------------------------- small components --------------------------- */



/* --------------------- Dynamic Charts Component --------------------- */

// Dynamic Charts - Changes based on number of filtered items
function DynamicCharts({ itemGroups = [], filteredOrders = [] }) {
  const itemCount = itemGroups.length;
  
  if (itemCount === 0) {
    return (
      <div className="bg-slate-900/40 rounded-xl p-8 border border-slate-800 text-center">
        <div className="text-slate-400 text-lg mb-2">📊</div>
        <div className="text-slate-400">No data available for the selected filters</div>
    </div>
  );
}

  if (itemCount === 1) {
    // Single item - Show comprehensive single chart
  return (
      <div className="bg-slate-900/40 rounded-xl p-6 border border-slate-800">
        <h4 className="text-sm font-medium text-slate-300 mb-6 flex items-center gap-2">
          <span className="text-indigo-400">📊</span>
          change{itemGroups[0].item}
        </h4>
        <SingleItemChart item={itemGroups[0]} filteredOrders={filteredOrders} />
    </div>
  );
}
  
  // Multiple items - Show 2 comparison charts
  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
      {/* Revenue Chart */}
      <div className="bg-slate-900/40 rounded-xl p-4 border border-slate-800">
        <h4 className="text-sm font-medium text-slate-300 mb-4 flex items-center gap-2">
          <span className="text-emerald-400">💰</span>
          Top Revenue Items
        </h4>
        <div className="h-64">
          <RevenueChart itemGroups={itemGroups.slice(0, 8)} />
        </div>
      </div>

      {/* Profit Chart */}
      <div className="bg-slate-900/40 rounded-xl p-4 border border-slate-800">
        <h4 className="text-sm font-medium text-slate-300 mb-4 flex items-center gap-2">
          <span className="text-blue-400">📈</span>
          Most Profitable Items
        </h4>
        <div className="h-64">
          <ProfitChart itemGroups={itemGroups.slice(0, 8)} />
        </div>
      </div>
    </div>
  );
}

// Single Item Comprehensive Chart
function SingleItemChart({ item, filteredOrders }) {
  // Use the already filtered orders data instead of making a new query
  const ordersArray = Array.isArray(filteredOrders) ? filteredOrders : [];
  const itemOrders = ordersArray.filter(order => order.item === item.item);
  const totalRevenue = itemOrders.filter(o => cents(o.sale_price_cents) > 0).reduce((sum, o) => sum + cents(o.sale_price_cents), 0);
  const totalCogs = itemOrders.reduce((sum, o) => sum + cents(o.buy_price_cents), 0);
  const totalSold = itemOrders.filter(o => cents(o.sale_price_cents) > 0).length;
  const totalBought = itemOrders.length;
  const onHand = itemOrders.filter(o => cents(o.sale_price_cents) === 0).length;
  
  // Get market value from item data (same as shown in expanded card)
  const marketValue = item.unitMarketC || 0;
  const totalMarketValue = onHand * marketValue;
  
  // Calculate realized and unrealized P/L
  const soldOrders = itemOrders.filter(o => cents(o.sale_price_cents) > 0);
  const realizedPl = totalRevenue - soldOrders.reduce((sum, o) => sum + cents(o.buy_price_cents), 0);
  const onHandOrders = itemOrders.filter(o => cents(o.sale_price_cents) === 0);
  const unrealizedPl = totalMarketValue - onHandOrders.reduce((sum, o) => sum + cents(o.buy_price_cents), 0);
  
  return (
    <div className="space-y-6">
      {/* KPI Pills */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-slate-800/50 rounded-xl p-4 text-center">
          <div className="text-sm text-slate-400 mb-1">Total Revenue</div>
          <div className="text-2xl font-bold text-white mb-1">${centsToStr(totalRevenue)}</div>
          <div className="text-sm text-slate-400">{totalSold} sales</div>
        </div>
        
        <div className="bg-slate-800/50 rounded-xl p-4 text-center">
          <div className="text-sm text-slate-400 mb-1">Total COGS</div>
          <div className="text-2xl font-bold text-white mb-1">${centsToStr(totalCogs)}</div>
          <div className="text-sm text-slate-400">{totalBought} bought</div>
        </div>
        
        <div className="bg-slate-800/50 rounded-xl p-4 text-center">
          <div className="text-sm text-slate-400 mb-1">On Hand</div>
          <div className="text-2xl font-bold text-white mb-1">{onHand}</div>
          <div className="text-sm text-slate-400">${centsToStr(totalMarketValue)} market value</div>
        </div>
        
        <div className="bg-slate-800/50 rounded-xl p-4 text-center">
          <div className="text-sm text-slate-400 mb-1">Realized P/L</div>
          <div className="text-2xl font-bold text-green-400 mb-1">${centsToStr(realizedPl)}</div>
          <div className="text-sm text-slate-400">${centsToStr(unrealizedPl)} unrealized</div>
        </div>
      </div>
      
      {/* Combined Performance Metrics */}
      <div className="bg-slate-800/50 rounded-xl p-6">
        <h5 className="text-lg font-medium text-slate-300 mb-6 text-center">Performance Overview</h5>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
          {/* ROI Section */}
          <div className="text-center">
            <div className="text-sm text-slate-400 mb-2">Return on Investment</div>
            <div className="text-4xl font-bold mb-4">
              <span className={item.roi > 0 ? 'text-emerald-400' : 'text-red-400'}>
                {pctStr(item.roi)}
              </span>
            </div>
            <div className="w-full bg-slate-700 rounded-full h-4 mb-2">
              <div 
                className={`h-4 rounded-full transition-all duration-700 ${
                  item.roi > 0 ? 'bg-emerald-500' : 'bg-red-500'
                }`}
                style={{ width: `${Math.min(Math.abs(item.roi) * 2 + 20, 100)}%` }}
              />
            </div>
            <div className="text-xs text-slate-400">
              {item.roi > 0 ? 'Profitable' : 'Loss'}
            </div>
          </div>
          
          {/* Margin Section */}
          <div className="text-center">
            <div className="text-sm text-slate-400 mb-2">Profit Margin</div>
            <div className="text-4xl font-bold mb-4">
              <span className={item.margin > 0 ? 'text-emerald-400' : 'text-red-400'}>
                {pctStr(item.margin)}
              </span>
            </div>
            <div className="w-full bg-slate-700 rounded-full h-4 mb-2">
              <div 
                className={`h-4 rounded-full transition-all duration-700 ${
                  item.margin > 0 ? 'bg-emerald-500' : 'bg-red-500'
                }`}
                style={{ width: `${Math.min(Math.abs(item.margin) * 2 + 20, 100)}%` }}
              />
            </div>
            <div className="text-xs text-slate-400">
              {item.margin > 0 ? 'Positive margin' : 'Negative margin'}
            </div>
          </div>
        </div>
      </div>
      
    </div>
  );
}


/* --------------------- Analytics Chart Components --------------------- */

// Revenue Chart - Clean horizontal bars with better mobile layout
function RevenueChart({ itemGroups = [] }) {
  if (!itemGroups.length) {
          return (
      <div className="w-full h-full flex items-center justify-center">
        <div className="text-center">
          <div className="text-slate-400 text-lg mb-2">💰</div>
          <div className="text-slate-400 text-sm">No revenue data</div>
        </div>
      </div>
    );
  }

  const maxRevenue = Math.max(...itemGroups.map(item => item.revenueC));

  return (
    <div className="w-full h-full space-y-3">
      {itemGroups.map((item, index) => {
        const width = maxRevenue > 0 ? (item.revenueC / maxRevenue) * 100 : 0;
        
        return (
          <div key={index} className="space-y-1">
            <div className="flex justify-between items-center">
              <div className="text-xs text-slate-300 truncate flex-1 mr-2" title={item.item}>
                {item.item}
              </div>
              <div className="text-xs font-medium text-emerald-400">
                ${centsToStr(item.revenueC)}
              </div>
            </div>
            <div className="w-full bg-slate-800 rounded-full h-2">
              <div 
                className="h-2 bg-emerald-500 rounded-full transition-all duration-500"
                style={{ width: `${width}%` }}
              />
            </div>
          </div>
          );
        })}
    </div>
  );
}

// Profit Chart - Shows profit/loss with better visual design
function ProfitChart({ itemGroups = [] }) {
  if (!itemGroups.length) {
    return (
      <div className="w-full h-full flex items-center justify-center">
        <div className="text-center">
          <div className="text-slate-400 text-lg mb-2">📈</div>
          <div className="text-slate-400 text-sm">No profit data</div>
        </div>
      </div>
    );
  }

  const maxValue = Math.max(...itemGroups.map(item => Math.abs(item.realizedPlC)));

  return (
    <div className="w-full h-full space-y-3">
      {itemGroups.map((item, index) => {
        const width = maxValue > 0 ? (Math.abs(item.realizedPlC) / maxValue) * 100 : 0;
        const isPositive = item.realizedPlC > 0;
        
        return (
          <div key={index} className="space-y-1">
            <div className="flex justify-between items-center">
              <div className="text-xs text-slate-300 truncate flex-1 mr-2" title={item.item}>
                {item.item}
              </div>
              <div className={`text-xs font-medium ${isPositive ? 'text-emerald-400' : 'text-red-400'}`}>
                {isPositive ? '+' : ''}${centsToStr(item.realizedPlC)}
              </div>
            </div>
            <div className="w-full bg-slate-800 rounded-full h-2">
              <div 
                className={`h-2 rounded-full transition-all duration-500 ${
                  isPositive ? 'bg-emerald-500' : 'bg-red-500'
                }`}
                style={{ width: `${width}%` }}
              />
            </div>
          </div>
        );
      })}
    </div>
  );
}

// Sales Activity Chart - Vertical bars with better mobile layout
function SalesActivityChart({ itemGroups = [] }) {
  if (!itemGroups.length) {
    return (
      <div className="w-full h-full flex items-center justify-center">
        <div className="text-center">
          <div className="text-slate-400 text-lg mb-2">🛒</div>
          <div className="text-slate-400 text-sm">No sales data</div>
        </div>
      </div>
    );
  }

  const maxSales = Math.max(...itemGroups.map(item => item.sold));

  return (
    <div className="w-full h-full flex items-end justify-between px-2">
      {itemGroups.map((item, index) => {
        const height = maxSales > 0 ? (item.sold / maxSales) * 100 : 0;
        
        return (
          <div key={index} className="flex flex-col items-center gap-2 flex-1">
            <div className="text-xs text-slate-300 font-medium">{item.sold}</div>
            <div 
              className="w-full bg-purple-500 rounded-t transition-all duration-500"
              style={{ height: `${height}%`, minHeight: '4px' }}
            />
            <div className="text-xs text-slate-400 text-center leading-tight" title={item.item}>
              {item.item.length > 8 ? item.item.substring(0, 8) + "..." : item.item}
            </div>
          </div>
        );
      })}
    </div>
  );
}


/* ----------------------------- KPIs (inventory style) ----------------------------- */
function Kpi({ title, value, hint, tone }) {
  const toneClass =
    tone === "green" ? "text-emerald-400"
      : tone === "blue" ? "text-indigo-400"
      : "text-slate-100";
  return (
    <div className="rounded-2xl border border-slate-800 bg-slate-900/60 p-4 text-center">
      <div className="text-slate-400 text-sm">{title}</div>
      <div className={`text-xl font-semibold mt-1 ${toneClass}`}>{value}</div>
      {hint && <div className="text-slate-400 text-xs mt-1 truncate">{hint}</div>}
    </div>
  );
}

/* --------------------- Aggregate KPIs for the top card --------------------- */
function makeTopKpis(filtered) {
  const filteredArray = Array.isArray(filtered) ? filtered : [];
  const purchases = filteredArray.filter(o => o.order_date && (!o.sale_date || true)); // all purchases counted via order_date presence
  const sales = filteredArray.filter(o => cents(o.sale_price_cents) > 0);

  const spentC = purchases.reduce((a, o) => a + cents(o.buy_price_cents), 0);
  const revenueC = sales.reduce((a, o) => a + cents(o.sale_price_cents), 0);
  const feesC = sales.reduce((a, o) => a + Math.round(cents(o.sale_price_cents) * (Number(o.fees_pct) || 0)), 0);
  const shipC = sales.reduce((a, o) => a + cents(o.shipping_cents), 0);
  const soldCostC = sales.reduce((a, o) => a + cents(o.buy_price_cents), 0);
  const realizedPlC = revenueC - feesC - shipC - soldCostC;
  const sold = sales.length;

  // longest hold among unsold
  let longestHoldDays = 0, longestHoldName = "—";
  const today = Date.now();
  for (const o of filtered) {
    if (cents(o.sale_price_cents) > 0) continue;
    const od = new Date(o.order_date).getTime();
    if (isNaN(od)) continue;
    const d = Math.max(0, Math.round((today - od) / (24*3600*1000)));
    if (d > longestHoldDays) { longestHoldDays = d; longestHoldName = o.item || "—"; }
  }

  // per-item bests
  const byItem = new Map();
  for (const o of sales) {
    const k = o.item || "—";
    if (!byItem.has(k)) byItem.set(k, { sold:0, rev:0, cost:0, profit:0 });
    const r = byItem.get(k);
    const rev = cents(o.sale_price_cents);
    const cost = cents(o.buy_price_cents);
    const fee = Math.round(rev * (Number(o.fees_pct) || 0));
    const ship = cents(o.shipping_cents);
    r.sold += 1; r.rev += rev; r.cost += cost; r.profit += (rev - fee - ship - cost);
  }
  let bestSellerName="—", bestSellerCount=0, bestMarginName="—", bestMarginPct=NaN, bestRoiName="—", bestRoiPct=NaN;
  for (const [name, v] of byItem.entries()) {
    if (v.sold > bestSellerCount) { bestSellerCount=v.sold; bestSellerName=name; }
    const margin = v.rev>0 ? v.profit/v.rev : NaN;
    const roi = v.cost>0 ? v.profit/v.cost : NaN;
    if ((Number.isFinite(margin)?margin:-Infinity) > (Number.isFinite(bestMarginPct)?bestMarginPct:-Infinity)) {
      bestMarginPct = margin; bestMarginName=name;
    }
    if ((Number.isFinite(roi)?roi:-Infinity) > (Number.isFinite(bestRoiPct)?bestRoiPct:-Infinity)) {
      bestRoiPct = roi; bestRoiName=name;
    }
  }

  return {
    spentC, revenueC, realizedPlC, sold,
    longestHoldDays, longestHoldName,
    bestSellerName, bestSellerCount,
    bestMarginName, bestMarginPct,
    bestRoiName, bestRoiPct,
  };
}

/* -------------------------- per-item aggregation (cards) -------------------------- */
function makeItemGroups(filtered, marketByName) {
  const m = new Map();
  const filteredArray = Array.isArray(filtered) ? filtered : [];
  for (const o of filteredArray) {
    const key = o.item || "—";
    if (!m.has(key)) {
      m.set(key, {
        item: key,
        bought: 0,
        sold: 0,
        onHand: 0,
        totalCostC: 0,
        revenueC: 0,
        feesC: 0,
        shipC: 0,
        realizedPlC: 0,
        soldCostC: 0,
        holdDaysTotal: 0,
        holdSamples: 0,
        onHandMarketC: 0,
        unitMarketC: 0,
      });
    }
    const row = m.get(key);
    row.bought += 1;
    row.totalCostC += cents(o.buy_price_cents);

    if (cents(o.sale_price_cents) > 0) {
      const rev = cents(o.sale_price_cents);
      const fee = Math.round(rev * (Number(o.fees_pct) || 0));
      const ship = cents(o.shipping_cents);
      const cost = cents(o.buy_price_cents);
      row.sold += 1;
      row.revenueC += rev;
      row.feesC += fee;
      row.shipC += ship;
      row.realizedPlC += rev - fee - ship - cost;
      row.soldCostC += cost;

      const od = new Date(o.order_date).getTime();
      const sd = new Date(o.sale_date).getTime();
      if (!isNaN(od) && !isNaN(sd) && sd >= od) {
        row.holdDaysTotal += Math.round((sd - od) / (24 * 3600 * 1000));
        row.holdSamples += 1;
      }
    } else {
      row.onHand += 1;
      const mv = marketByName.get((o.item || "").toLowerCase()) || 0;
      row.onHandMarketC += mv;
      row.unitMarketC = mv;
    }
  }

  const out = [...m.values()].map((r) => {
    const margin = r.revenueC > 0 ? r.realizedPlC / r.revenueC : NaN;
    const roi = r.soldCostC > 0 ? r.realizedPlC / r.soldCostC : NaN;
    const avgHoldDays = r.holdSamples > 0 ? r.holdDaysTotal / r.holdSamples : 0;
    const aspC = r.sold > 0 ? Math.round(r.revenueC / r.sold) : 0;
    return { ...r, margin, roi, avgHoldDays, aspC };
  });

  out.sort((a, b) => (b.revenueC - a.revenueC) || (b.onHandMarketC - a.onHandMarketC));
  return out.slice(0, 400);
}

/* -------------------------- tiny UI atoms for pills -------------------------- */
function MiniPill({ title, value, sub, tone = "neutral", num = null }) {
  const n = Number.isFinite(num) ? num : 0;
  const isZero = n === 0;

  let color = "text-slate-100";
  if (tone === "unrealized") color = isZero ? "text-slate-400" : "text-indigo-400";
  if (tone === "realized") color = n > 0 ? "text-emerald-400" : isZero ? "text-slate-400" : "text-slate-100";
  if (tone === "neutral") color = isZero ? "text-slate-400" : "text-slate-100";

  return (
    <div className="rounded-xl border border-slate-800 bg-slate-900/60 px-3 py-3 text-center">
      <div className="text-slate-400 text-xs">{title}</div>
      <div className={`text-base font-semibold mt-0.5 ${color}`}>{value}</div>
      {sub && <div className="text-[10px] leading-4 text-slate-400 mt-0.5">{sub}</div>}
    </div>
  );
}

function ChevronDown({ className = "h-5 w-5" }) {
  return (
    <svg viewBox="0 0 24 24" className={className} fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M6 9l6 6 6-6" />
    </svg>
  );
}
