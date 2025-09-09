// src/routes/Inventory.jsx
import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "../lib/supabaseClient";
import HeaderWithTabs from "../components/HeaderWithTabs.jsx";
import { centsToStr } from "../utils/money.js";
import { pageCard, rowCard, inputSm } from "../utils/ui.js";

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
    const rows = Array.from(byItem.values());

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
    const avgHold =
      rows.reduce((a, r) => a + r.avgHold * (r.holdDays.length > 0 ? 1 : 0), 0) /
      Math.max(1, rows.filter((r) => r.holdDays.length > 0).length);

    return {
      totalUnits,
      totalCost,
      totalEst,
      unrealized: totalEst - totalCost,
      bestSeller,
      bestMargin,
      bestRoi,
      longestHold,
      avgHold: Math.round(avgHold || 0),
    };
  }, [byItem]);

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
    <div className="min-h-screen bg-slate-950 text-slate-100">
      <div className="max-w-6xl mx-auto p-4 sm:p-6">
        <HeaderWithTabs active="inventory" showTabs />

        {/* Search */}
        <div className={`${pageCard} mb-6`}>
          <div className="relative">
            <svg className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
            <input
              list="inv-items-datalist"
              value={itemFilter}
              onChange={(e) => setItemFilter(e.target.value)}
              placeholder="Search inventory..."
              className="w-full pl-10 pr-4 py-3 rounded-xl border border-slate-800 bg-slate-900/60 text-slate-100 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
            />
            <datalist id="inv-items-datalist">
              {onHandNames.map((n) => (
                <option key={n} value={n} />
              ))}
            </datalist>
            {!!itemFilter && (
              <button
                onClick={() => setItemFilter("")}
                className="absolute right-3 top-1/2 transform -translate-y-1/2 text-slate-400 hover:text-slate-200 transition-colors"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            )}
          </div>
        </div>

        {/* KPI pills (8) */}
        <div className={`${pageCard} mb-6`}>
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
            <Kpi label="Inventory" value={kpis.totalUnits} sub="units on hand" />
            <Kpi
              label="Total Cost"
              value={`$${centsToStr(kpis.totalCost)}`}
              sub="on-hand cost"
            />
            <Kpi
              label="Est. Value"
              value={`$${centsToStr(kpis.totalEst)}`}
              sub="on-hand market"
            />
            <Kpi
              label="Unrealized P/L"
              value={`$${centsToStr(kpis.unrealized)}`}
              sub={kpis.unrealized >= 0 ? "gain" : "loss"}
              tone={kpis.unrealized >= 0 ? "good" : "bad"}
            />
          </div>
        </div>

        {/* Table */}
        {isLoading && <div className="text-slate-400">Loading…</div>}
        {error && (
          <div className="text-rose-400">{String(error.message || error)}</div>
        )}

        <div className={`${pageCard} overflow-hidden`}>
          {/* Header */}
          <div className="grid grid-cols-[3fr_1fr_1fr] lg:grid-cols-[2fr_1fr_1fr_1fr_1fr_1fr] gap-4 px-4 py-3 border-b border-slate-800 bg-slate-900/40 text-xs text-slate-400 font-medium">
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
              onClick={() => toggleSort("marketValueCents")}
              className="hidden lg:flex items-center gap-1 text-left hover:text-slate-200 transition-colors"
            >
              Mkt value
              {sortKey === "marketValueCents" && (
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
                className={`grid grid-cols-[3fr_1fr_1fr] lg:grid-cols-[2fr_1fr_1fr_1fr_1fr_1fr] gap-4 px-4 py-3 border-b border-slate-800/50 hover:bg-slate-900/20 transition-colors ${
                  index % 2 === 0 ? "bg-slate-900/10" : "bg-slate-900/5"
                }`}
              >
                <div className="text-slate-100 font-medium truncate pr-2">{r.name}</div>
                <div className="text-slate-200">{r.onHandQty}</div>
                <div className="text-slate-200">${centsToStr(r.onHandAvgCostCents)}</div>
                <div className="hidden lg:block text-slate-200">${centsToStr(r.onHandCostCents)}</div>
                <div className="hidden lg:block text-slate-200">${centsToStr(r.marketValueCents)}</div>
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
      </div>
    </div>
  );
}

/* ---------- little UI bits ---------- */
function Kpi({ label, value, sub, tone = "neutral" }) {
  const toneCls =
    tone === "good"
      ? "text-emerald-300"
      : tone === "bad"
      ? "text-rose-300"
      : "text-slate-100";
  return (
    <div className="rounded-xl border border-slate-800 bg-slate-900/60 p-3">
      <div className="text-xs text-slate-400">{label}</div>
      <div className={`text-xl font-semibold ${toneCls}`}>{value}</div>
      <div className="text-[11px] text-slate-400 truncate">{sub || " "}</div>
    </div>
  );
}