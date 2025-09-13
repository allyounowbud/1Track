// src/routes/Inventory.jsx
import { useMemo, useState, useRef, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "../lib/supabaseClient";
import LayoutWithSidebar from "../components/LayoutWithSidebar.jsx";
import PageHeader from "../components/PageHeader.jsx";
import { centsToStr, formatNumber } from "../utils/money.js";
import { pageCard, rowCard, inputSm } from "../utils/ui.js";
import { SearchDropdown } from "../components/SearchDropdown.jsx";

/* ---------- data ---------- */
async function getOrders(limit = 2000) {
  const { data, error } = await supabase
    .from("orders")
    .select(
      "id, item, order_date, sale_date, status, buy_price_cents, sale_price_cents, shipping_cents, fees_pct"
    )
    .order("order_date", { ascending: false })
    .limit(limit);
  if (error) throw error;
  return data ?? [];
}
async function getItems() {
  const { data, error } = await supabase
    .from("items")
    .select("id, name, market_value_cents")
    .order("name", { ascending: true });
  if (error) throw error;
  return data ?? [];
}

/* ========================================================= */
export default function Inventory() {
  const { data: orders = [], isLoading, error } = useQuery({
    queryKey: ["inv_orders"],
    queryFn: () => getOrders(2000),
  });
  const { data: items = [] } = useQuery({
    queryKey: ["inv_items"],
    queryFn: getItems,
  });

  // Market value lookup by name
  const mvByName = useMemo(() => {
    const m = new Map();
    for (const it of items) m.set(it.name, Number(it.market_value_cents || 0));
    return m;
  }, [items]);

  // Aggregate orders into inventory rows by item
  const byItem = useMemo(() => {
    const map = new Map();

    const ensure = (name) => {
      if (!map.has(name))
        map.set(name, {
          name,
          onHandQty: 0,
          onHandCostCents: 0,
          onHandAvgCostCents: 0,

          soldQty: 0,
          totalProfitCents: 0,
          totalCostSoldCents: 0,
          totalSalesCents: 0,
          holdDays: [],
          maxHold: 0,

          marketValueCents: Number(mvByName.get(name) || 0),
          estValueCents: 0,
        });
      return map.get(name);
    };

    for (const o of orders) {
      const name = o.item || "(Unnamed)";
      const r = ensure(name);

      const buy = Number(o.buy_price_cents || 0);
      const ship = Number(o.shipping_cents || 0);
      const baseCost = buy + ship;

      const sold =
        o.status === "sold" || Number(o.sale_price_cents || 0) > 0 ? true : false;

      if (sold) {
        r.soldQty += 1;
        const sale = Number(o.sale_price_cents || 0);
        const fee = Math.round(sale * Number(o.fees_pct || 0));
        const profit = sale - baseCost - fee;
        r.totalProfitCents += profit;
        r.totalCostSoldCents += baseCost;
        r.totalSalesCents += sale;

        const od = o.order_date ? new Date(o.order_date) : null;
        const sd = o.sale_date ? new Date(o.sale_date) : null;
        if (od && sd) {
          const days = Math.max(
            0,
            Math.round((sd - od) / (1000 * 60 * 60 * 24))
          );
          r.holdDays.push(days);
          r.maxHold = Math.max(r.maxHold, days);
        }
      } else if (o.status !== "cancelled") {
        r.onHandQty += 1;
        r.onHandCostCents += baseCost;
      }
    }

    // finalize
    for (const r of map.values()) {
      r.onHandAvgCostCents =
        r.onHandQty > 0 ? Math.round(r.onHandCostCents / r.onHandQty) : 0;
      r.estValueCents = r.marketValueCents * r.onHandQty;
      r.avgProfitCents =
        r.soldQty > 0 ? Math.round(r.totalProfitCents / r.soldQty) : 0;
      r.roi =
        r.totalCostSoldCents > 0
          ? r.totalProfitCents / r.totalCostSoldCents
          : 0; // profit / cost
      r.margin =
        r.totalSalesCents > 0
          ? r.totalProfitCents / r.totalSalesCents
          : 0; // profit / sales
      r.avgHold =
        r.holdDays.length > 0
          ? Math.round(
              r.holdDays.reduce((a, b) => a + b, 0) / r.holdDays.length
            )
          : 0;
    }
    return map;
  }, [orders, mvByName]);

  /* ---------------- Filter: searchable dropdown ---------------- */
  // Only suggest items that currently have inventory on hand
  const onHandNames = useMemo(
    () =>
      Array.from(byItem.values())
        .filter((r) => r.onHandQty > 0)
        .map((r) => r.name)
        .sort((a, b) => a.localeCompare(b)),
    [byItem]
  );

  const [itemFilter, setItemFilter] = useState(""); // text OR exact match

  // rows to show (by text contains OR exact match)
  const filteredRows = useMemo(() => {
    const t = itemFilter.trim().toLowerCase();
    const rows = Array.from(byItem.values());

    // If exact match to a suggested item -> show that one only
    const exact = onHandNames.find(
      (n) => n.toLowerCase() === t && t.length > 0
    );
    let list = exact
      ? rows.filter((r) => r.name.toLowerCase() === t)
      : t
      ? rows.filter((r) => r.name.toLowerCase().includes(t))
      : rows;

    // default: hide zero on-hand unless user is typing
    if (!t) list = list.filter((r) => r.onHandQty > 0);

    // Sorting handled below; just return list
    return list;
  }, [byItem, itemFilter, onHandNames]);

  /* ---------------- KPIs ---------------- */
  const kpis = useMemo(() => {
    const rows = filteredRows; // Use filtered results instead of all items

    const totalUnits = rows.reduce((s, r) => s + r.onHandQty, 0);
    const totalCost = rows.reduce((s, r) => s + r.onHandCostCents, 0);
    const totalEst = rows.reduce((s, r) => s + r.estValueCents, 0);

    const bestSeller =
      rows.filter((r) => r.soldQty > 0).sort((a, b) => b.soldQty - a.soldQty)[0] ||
      null;
    const bestMargin =
      rows.filter((r) => r.margin > 0).sort((a, b) => b.margin - a.margin)[0] ||
      null; // margin = profit/sales
    const bestRoi =
      rows.filter((r) => r.roi > 0).sort((a, b) => b.roi - a.roi)[0] || null;
    const longestHold =
      rows.filter((r) => r.maxHold > 0).sort((a, b) => b.maxHold - a.maxHold)[0] ||
      null;
    // Calculate average hold time (including unsold items)
    const allHoldDays = [];
    rows.forEach(r => {
      // Add sold items' hold days
      allHoldDays.push(...r.holdDays);
      // Add unsold items' current hold days
      if (r.onHandQty > 0) {
        const unsoldOrders = orders.filter(o => 
          o.item === r.name && 
          o.status !== 'cancelled' && 
          !o.sale_date
        );
        unsoldOrders.forEach(order => {
          const daysSincePurchase = Math.floor((new Date() - new Date(order.order_date)) / (1000 * 60 * 60 * 24));
          allHoldDays.push(daysSincePurchase);
        });
      }
    });
    const avgHold = allHoldDays.length > 0 ? 
      Math.round(allHoldDays.reduce((a, b) => a + b, 0) / allHoldDays.length) : null;

    // Calculate longest hold time (unsold items only)
    let longestHoldDays = 0;
    rows.forEach(r => {
      if (r.onHandQty > 0) {
        const unsoldOrders = orders.filter(o => 
          o.item === r.name && 
          o.status !== 'cancelled' && 
          !o.sale_date
        );
        unsoldOrders.forEach(order => {
          const daysSincePurchase = Math.floor((new Date() - new Date(order.order_date)) / (1000 * 60 * 60 * 24));
          longestHoldDays = Math.max(longestHoldDays, daysSincePurchase);
        });
      }
    });

    // Calculate last purchase (most recent on-hand order)
    const today = new Date();
    let lastPurchaseDays = null;
    if (rows.length > 0) {
      const onHandOrders = orders.filter(o => 
        rows.some(r => r.name === o.item) && 
        o.status !== 'cancelled' && 
        !o.sale_date
      );
      if (onHandOrders.length > 0) {
        const mostRecentOrder = onHandOrders.sort((a, b) => new Date(b.order_date) - new Date(a.order_date))[0];
        lastPurchaseDays = Math.floor((today - new Date(mostRecentOrder.order_date)) / (1000 * 60 * 60 * 24));
      }
    }

    // Calculate last sale (most recent sold order)
    let lastSaleDays = null; // null means no sales found
    if (rows.length > 0) {
      // For filtered results, only look at items in the current filter
      // For all items (no filter), look at all orders
      const soldOrders = itemFilter.trim() ? 
        orders.filter(o => 
          rows.some(r => r.name === o.item) && 
          o.sale_date
        ) :
        orders.filter(o => o.sale_date);
        
      if (soldOrders.length > 0) {
        const mostRecentSale = soldOrders.sort((a, b) => new Date(b.sale_date) - new Date(a.sale_date))[0];
        lastSaleDays = Math.floor((today - new Date(mostRecentSale.sale_date)) / (1000 * 60 * 60 * 24));
      }
    }

    // Calculate average price per item
    const avgPricePerItem = totalUnits > 0 ? Math.round(totalCost / totalUnits) : 0;

    return {
      totalUnits,
      totalCost,
      totalEst,
      unrealized: totalEst - totalCost,
      bestSeller,
      bestMargin,
      bestRoi,
      longestHold,
      avgHold,
      longestHoldDays,
      lastPurchaseDays,
      lastSaleDays,
      avgPricePerItem,
    };
  }, [filteredRows, orders, itemFilter]);

  /* ---------------- Sorting ---------------- */
  const [sortKey, setSortKey] = useState("name");
  const [sortDir, setSortDir] = useState("asc"); // 'asc' | 'desc'

  function toggleSort(key) {
    if (key === sortKey) setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    else {
      setSortKey(key);
      setSortDir("desc");
    }
  }

  const sortedRows = useMemo(() => {
    const arr = [...filteredRows];
    arr.sort((a, b) => {
      const va =
        typeof a[sortKey] === "string" ? a[sortKey].toLowerCase() : a[sortKey];
      const vb =
        typeof b[sortKey] === "string" ? b[sortKey].toLowerCase() : b[sortKey];
      if (va < vb) return sortDir === "asc" ? -1 : 1;
      if (va > vb) return sortDir === "asc" ? 1 : -1;
      return 0;
    });
    return arr;
  }, [filteredRows, sortKey, sortDir]);

  return (
    <LayoutWithSidebar active="inventory" section="orderbook">
      <PageHeader title="Inventory" />

        {/* KPI pills (9 total: 3x3 on 550px+, 2x4 on small) */}
        <div className={`${pageCard} mb-6`}>
          <div className="grid grid-cols-2 min-[550px]:grid-cols-3 gap-3">
            {/* 1. Inventory */}
            <Kpi label="Inventory" value={formatNumber(kpis.totalUnits)} sub="on hand" className="order-1 min-[550px]:order-1" />
            {/* 2. Average Price */}
            <Kpi
              label="Avg Price"
              value={`$${centsToStr(kpis.avgPricePerItem)}`}
              sub="per item"
              className="order-2 min-[550px]:order-2"
            />
            {/* 3. Total Cost */}
            <Kpi
              label="Total Cost"
              value={`$${centsToStr(kpis.totalCost)}`}
              sub="on-hand cost"
              className="order-3 min-[550px]:order-3"
            />
            {/* 4. Est Value */}
            <Kpi
              label="Est. Value"
              value={`$${centsToStr(kpis.totalEst)}`}
              sub="market value"
              className="order-4 min-[550px]:order-6"
            />
            {/* 5. Last Purchase */}
            <Kpi
              label="Last Purchase"
              value={kpis.lastPurchaseDays !== null ? formatNumber(kpis.lastPurchaseDays) : "-"}
              sub="days ago"
              tone={kpis.lastPurchaseDays === null ? "muted" : undefined}
              className="order-5 min-[550px]:order-4"
            />
            {/* 6. Last Sale */}
            <Kpi
              label="Last Sale"
              value={kpis.lastSaleDays !== null ? formatNumber(kpis.lastSaleDays) : "-"}
              sub="days ago"
              tone={kpis.lastSaleDays === null ? "muted" : undefined}
              className="order-6 min-[550px]:order-5"
            />
            {/* 7. Avg Hold */}
            <Kpi
              label="Avg Hold"
              value={kpis.avgHold !== null ? formatNumber(kpis.avgHold) : "-"}
              sub="in days"
              tone={kpis.avgHold === null ? "muted" : undefined}
              className="order-7 min-[550px]:order-7"
            />
            {/* 8. Unrealized P/L */}
            <Kpi
              label="Unrealized P/L"
              value={`$${centsToStr(kpis.unrealized)}`}
              sub={kpis.unrealized >= 0 ? "unrealized profit" : "unrealized loss"}
              tone={kpis.unrealized >= 0 ? "blue" : "bad"}
              className="order-8 min-[550px]:order-9"
            />
            {/* 9. Longest Hold - only visible on 550px+ screens */}
            <Kpi
              label="Longest Hold"
              value={formatNumber(kpis.longestHoldDays)}
              sub="in days"
              className="hidden min-[550px]:block min-[550px]:order-8"
            />
          </div>
        </div>

        {/* Table */}
        {isLoading && <div className="text-slate-400">Loading…</div>}
        {error && (
          <div className="text-rose-400">{String(error.message || error)}</div>
        )}

        <div className={`${pageCard} overflow-hidden`}>
          {/* Search Bar */}
          <div className="px-4 py-3 pb-5 border-b border-slate-800">
            <SearchDropdown
              value={itemFilter}
              onChange={setItemFilter}
              options={onHandNames.map(name => ({ value: name, label: name }))}
              placeholder="Search inventory…"
              label=""
              getOptionLabel={(option) => option.label || option}
              getOptionValue={(option) => option.value || option}
              filterOptions={(options, search) => {
                if (!search.trim()) return options.slice(0, 20);
                return options.filter(option => 
                  (option.label || option).toLowerCase().includes(search.toLowerCase())
                ).slice(0, 20);
              }}
            />
          </div>

          {/* Header */}
          <div className="grid grid-cols-[3fr_1fr_1fr] lg:grid-cols-[3fr_0.7fr_0.7fr_0.7fr_0.7fr] gap-4 px-4 py-3 border-b border-slate-800 text-xs text-slate-400 font-medium">
            <button
              onClick={() => toggleSort("name")}
              className="flex items-center gap-1 text-left hover:text-slate-200 transition-colors"
            >
              Item
              {sortKey === "name" && (
                <svg className="w-3 h-3" viewBox="0 0 20 20" fill="currentColor">
                  {sortDir === "asc" ? (
                    <path d="M10 6l-5 6h10L10 6z" />
                  ) : (
                    <path d="M10 14l5-6H5l5 6z" />
                  )}
                </svg>
              )}
            </button>
            <button
              onClick={() => toggleSort("onHandQty")}
              className="flex items-center gap-1 text-left hover:text-slate-200 transition-colors"
            >
              On hand
              {sortKey === "onHandQty" && (
                <svg className="w-3 h-3" viewBox="0 0 20 20" fill="currentColor">
                  {sortDir === "asc" ? (
                    <path d="M10 6l-5 6h10L10 6z" />
                  ) : (
                    <path d="M10 14l5-6H5l5 6z" />
                  )}
                </svg>
              )}
            </button>
            <button
              onClick={() => toggleSort("onHandAvgCostCents")}
              className="flex items-center gap-1 text-left hover:text-slate-200 transition-colors"
            >
              Avg cost
              {sortKey === "onHandAvgCostCents" && (
                <svg className="w-3 h-3" viewBox="0 0 20 20" fill="currentColor">
                  {sortDir === "asc" ? (
                    <path d="M10 6l-5 6h10L10 6z" />
                  ) : (
                    <path d="M10 14l5-6H5l5 6z" />
                  )}
                </svg>
              )}
            </button>
            <button
              onClick={() => toggleSort("onHandCostCents")}
              className="hidden lg:flex items-center gap-1 text-left hover:text-slate-200 transition-colors"
            >
              Total cost
              {sortKey === "onHandCostCents" && (
                <svg className="w-3 h-3" viewBox="0 0 20 20" fill="currentColor">
                  {sortDir === "asc" ? (
                    <path d="M10 6l-5 6h10L10 6z" />
                  ) : (
                    <path d="M10 14l5-6H5l5 6z" />
                  )}
                </svg>
              )}
            </button>
            <button
              onClick={() => toggleSort("estValueCents")}
              className="hidden lg:flex items-center gap-1 text-left hover:text-slate-200 transition-colors"
            >
              Est. value
              {sortKey === "estValueCents" && (
                <svg className="w-3 h-3" viewBox="0 0 20 20" fill="currentColor">
                  {sortDir === "asc" ? (
                    <path d="M10 6l-5 6h10L10 6z" />
                  ) : (
                    <path d="M10 14l5-6H5l5 6z" />
                  )}
                </svg>
              )}
            </button>
          </div>

          {/* Rows */}
          <div>
            {sortedRows.map((r, index) => (
              <div
                key={r.name}
                className={`grid grid-cols-[3fr_1fr_1fr] lg:grid-cols-[3fr_0.7fr_0.7fr_0.7fr_0.7fr] gap-4 px-4 py-3 border-b border-slate-800/50 hover:bg-slate-900/20 transition-colors ${
                  index % 2 === 0 ? "bg-slate-900/10" : "bg-slate-900/5"
                }`}
              >
                <div className="text-slate-100 font-medium truncate pr-2">{r.name}</div>
                <div className="text-slate-200">{formatNumber(r.onHandQty)}</div>
                <div className="text-slate-200">${centsToStr(r.onHandAvgCostCents)}</div>
                <div className="hidden lg:block text-slate-200">${centsToStr(r.onHandCostCents)}</div>
                <div className="hidden lg:block text-slate-100 font-semibold">${centsToStr(r.estValueCents)}</div>
              </div>
            ))}

            {!isLoading && sortedRows.length === 0 && (
              <div className="px-4 py-8 text-center text-slate-400">
                No matching items.
              </div>
            )}
          </div>
        </div>
    </LayoutWithSidebar>
  );
}

/* ---------- little UI bits ---------- */
function Kpi({ label, value, sub, tone = "neutral", className = "" }) {
  const toneCls =
    tone === "good"
      ? "text-emerald-300"
      : tone === "bad"
      ? "text-rose-300"
      : tone === "blue"
      ? "text-blue-300"
      : "text-slate-100";
  return (
    <div className={`rounded-xl border border-slate-800 bg-slate-900/60 p-3 text-center ${className}`}>
      <div className="text-xs text-slate-400">{label}</div>
      <div className={`text-xl font-semibold ${toneCls}`}>{value}</div>
      <div className="text-[11px] text-slate-400/60 truncate">{sub || " "}</div>
    </div>
  );
}