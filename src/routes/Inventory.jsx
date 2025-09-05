// src/routes/Inventory.jsx
import { useEffect, useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "../lib/supabaseClient";
import HeaderWithTabs from "../components/HeaderWithTabs.jsx";

/* ---------- UI tokens (match the app) ---------- */
const pageCard =
  "rounded-2xl border border-slate-800 bg-slate-900/60 backdrop-blur p-4 sm:p-6 shadow-[0_10px_30px_rgba(0,0,0,.35)]";
const rowCard =
  "rounded-xl border border-slate-800 bg-slate-900/60 p-3 overflow-hidden";
const inputSm =
  "h-10 text-sm w-full min-w-0 bg-slate-900/60 border border-slate-800 rounded-xl px-3 py-2 text-slate-100 placeholder-slate-400 focus:ring-2 focus:ring-indigo-500";

/* ---------- helpers ---------- */
const parseMoney = (v) => {
  const n = Number(String(v ?? "").replace(/[^0-9.\-]/g, ""));
  return isNaN(n) ? 0 : n;
};
const moneyToCents = (v) => Math.round(parseMoney(v) * 100);
const centsToStr = (c) => (Number(c || 0) / 100).toFixed(2);

/* ---------- queries ---------- */
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

/* ---------------- PAGE ---------------- */
export default function Inventory() {
  const { data: orders = [], isLoading, error } = useQuery({
    queryKey: ["inv_orders"],
    queryFn: () => getOrders(2000),
  });
  const { data: items = [] } = useQuery({
    queryKey: ["inv_items"],
    queryFn: getItems,
  });

  // quick index: item name -> market value cents
  const mvByName = useMemo(() => {
    const map = new Map();
    for (const it of items) map.set(it.name, Number(it.market_value_cents || 0));
    return map;
  }, [items]);

  // search/filter (token AND search over item name)
  const [q, setQ] = useState("");

  // aggregate by item
  const byItem = useMemo(() => {
    const acc = new Map();

    const push = (name) => {
      if (!acc.has(name))
        acc.set(name, {
          name,
          onHandQty: 0,
          onHandCostCents: 0,
          onHandAvgCostCents: 0,

          // for KPIs from sold history
          soldQty: 0,
          totalProfitCents: 0,
          totalCostSoldCents: 0,
          totalSalesCents: 0,
          holdDays: [], // each sold order's hold time
        });
      return acc.get(name);
    };

    for (const o of orders) {
      const name = o.item || "(Unnamed)";
      const row = push(name);

      const buy = Number(o.buy_price_cents || 0);
      const ship = Number(o.shipping_cents || 0);
      const baseCost = buy + ship;

      if (o.status === "sold" || Number(o.sale_price_cents || 0) > 0) {
        row.soldQty += 1;
        const sale = Number(o.sale_price_cents || 0);
        const fee = Math.round(sale * Number(o.fees_pct || 0));
        const profit = sale - baseCost - fee;
        row.totalProfitCents += profit;
        row.totalCostSoldCents += baseCost;
        row.totalSalesCents += sale;

        const od = o.order_date ? new Date(o.order_date) : null;
        const sd = o.sale_date ? new Date(o.sale_date) : null;
        if (od && sd) {
          const days = Math.max(0, Math.round((sd - od) / (1000 * 60 * 60 * 24)));
          row.holdDays.push(days);
        }
      } else if (o.status !== "cancelled") {
        // treat anything not cancelled & not sold as on-hand
        row.onHandQty += 1;
        row.onHandCostCents += baseCost;
      }
    }

    // finalize averages
    for (const v of acc.values()) {
      v.onHandAvgCostCents =
        v.onHandQty > 0 ? Math.round(v.onHandCostCents / v.onHandQty) : 0;
      const mv = Number(mvByName.get(v.name) || 0);
      v.marketValueCents = mv;
      v.estValueCents = mv * v.onHandQty;

      // sold metrics
      v.avgProfitCents =
        v.soldQty > 0 ? Math.round(v.totalProfitCents / v.soldQty) : 0;
      v.avgRoi =
        v.soldQty > 0 && v.totalCostSoldCents > 0
          ? v.totalProfitCents / v.totalCostSoldCents
          : 0;
      v.avgHold =
        v.holdDays.length > 0
          ? Math.round(v.holdDays.reduce((a, b) => a + b, 0) / v.holdDays.length)
          : 0;
      v.maxHold = v.holdDays.length > 0 ? Math.max(...v.holdDays) : 0;
    }

    return acc;
  }, [orders, mvByName]);

  // filtered list (only items with on hand > 0 unless searching)
  const filteredRows = useMemo(() => {
    const tokens = (q || "").toLowerCase().split(/\s+/).filter(Boolean);
    const list = Array.from(byItem.values());

    const byTokens = tokens.length
      ? list.filter((r) => tokens.every((t) => r.name.toLowerCase().includes(t)))
      : list;

    // default show only items with stock unless there is a query
    const scoped =
      tokens.length === 0
        ? byTokens.filter((r) => r.onHandQty > 0)
        : byTokens;

    // sort by est value desc
    return scoped.sort((a, b) => b.estValueCents - a.estValueCents);
  }, [byItem, q]);

  // KPIs
  const kpis = useMemo(() => {
    const rows = Array.from(byItem.values());

    const totalUnits = rows.reduce((s, r) => s + r.onHandQty, 0);
    const totalCost = rows.reduce((s, r) => s + r.onHandCostCents, 0);
    const totalEst = rows.reduce((s, r) => s + r.estValueCents, 0);

    // best seller: highest soldQty
    const bestSeller =
      rows.filter((r) => r.soldQty > 0).sort((a, b) => b.soldQty - a.soldQty)[0] ||
      null;

    // best margin: highest avg profit (absolute $)
    const bestMargin =
      rows
        .filter((r) => r.avgProfitCents > 0)
        .sort((a, b) => b.avgProfitCents - a.avgProfitCents)[0] || null;

    // best ROI: highest avgRoi
    const bestRoi =
      rows.filter((r) => r.avgRoi > 0).sort((a, b) => b.avgRoi - a.avgRoi)[0] ||
      null;

    // longest hold (max across single orders)
    const longestHold =
      rows.filter((r) => r.maxHold > 0).sort((a, b) => b.maxHold - a.maxHold)[0] ||
      null;

    // avg hold across all sold
    const allHolds = rows.flatMap((r) => r.holdDays);
    const avgHold =
      allHolds.length > 0
        ? Math.round(allHolds.reduce((a, b) => a + b, 0) / allHolds.length)
        : 0;

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
    };
  }, [byItem]);

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100">
      <div className="max-w-6xl mx-auto p-4 sm:p-6">
        <HeaderWithTabs active="inventory" showTabs />

        {/* Filter */}
        <div className={`${pageCard} mb-6`}>
          <div className="grid grid-cols-1 sm:grid-cols-[1fr_auto] gap-3 items-end">
            <div>
              <label className="text-slate-300 mb-1 block text-sm">Filter</label>
              <input
                value={q}
                onChange={(e) => setQ(e.target.value)}
                placeholder="item / keyword (e.g., pokemon, sports, tin)"
                className={inputSm}
              />
            </div>
            <div className="flex items-center gap-4 sm:justify-end">
              <div className="text-slate-400 text-sm">Rows</div>
              <div className="text-xl font-semibold">{filteredRows.length}</div>
              {!!q && (
                <button
                  onClick={() => setQ("")}
                  className="h-9 px-4 rounded-xl border border-slate-800 bg-slate-900/60 hover:bg-slate-900 text-slate-100"
                >
                  Clear
                </button>
              )}
            </div>
          </div>
        </div>

        {/* KPIs */}
        <div className={`${pageCard} mb-6`}>
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-3">
            <Kpi
              label="Total inventory"
              value={kpis.totalUnits}
              sub="units on hand"
            />
            <Kpi
              label="Total cost"
              value={`$${centsToStr(kpis.totalCost)}`}
              sub="on-hand cost"
            />
            <Kpi
              label="Est. value"
              value={`$${centsToStr(kpis.totalEst)}`}
              sub="on-hand @ mkt"
            />
            <Kpi
              label="Unrealized P/L"
              value={`$${centsToStr(kpis.unrealized)}`}
              sub={kpis.unrealized >= 0 ? "gain" : "loss"}
              tone={kpis.unrealized >= 0 ? "good" : "bad"}
            />
            <Kpi
              label="Best seller"
              value={kpis.bestSeller ? kpis.bestSeller.soldQty : 0}
              sub={kpis.bestSeller ? kpis.bestSeller.name : "—"}
            />
            <Kpi
              label="Best margins"
              value={
                kpis.bestMargin ? `$${centsToStr(kpis.bestMargin.avgProfitCents)}` : "—"
              }
              sub={kpis.bestMargin ? kpis.bestMargin.name : "—"}
            />
            <Kpi
              label="Best ROI"
              value={kpis.bestRoi ? `${(kpis.bestRoi.avgRoi * 100).toFixed(0)}%` : "—"}
              sub={kpis.bestRoi ? kpis.bestRoi.name : "—"}
            />
            <Kpi
              label="Longest hold"
              value={kpis.longestHold ? `${kpis.longestHold.maxHold}d` : "—"}
              sub={kpis.longestHold ? kpis.longestHold.name : "—"}
            />
            <Kpi label="Avg hold time" value={`${kpis.avgHold}d`} sub="sold items" />
          </div>
        </div>

        {/* Table */}
        {isLoading && <div className="text-slate-400">Loading…</div>}
        {error && (
          <div className="text-rose-400">{String(error.message || error)}</div>
        )}

        <div className="space-y-3">
          {/* header (desktop) */}
          <div className="hidden lg:flex text-xs text-slate-400 px-1">
            <div className="min-w-[220px] flex-1">Item</div>
            <div className="w-24">On hand</div>
            <div className="w-28">Avg cost</div>
            <div className="w-32">Total cost</div>
            <div className="w-28">Mkt value</div>
            <div className="w-32 text-right">Est. value</div>
          </div>

          {filteredRows.map((r) => (
            <div key={r.name} className={rowCard}>
              <div className="flex flex-wrap lg:flex-nowrap items-center gap-2">
                <div className="min-w-[220px] flex-1 truncate">{r.name}</div>
                <div className="w-24">{r.onHandQty}</div>
                <div className="w-28">${centsToStr(r.onHandAvgCostCents)}</div>
                <div className="w-32">${centsToStr(r.onHandCostCents)}</div>
                <div className="w-28">
                  ${centsToStr(r.marketValueCents || 0)}
                </div>
                <div className="w-32 text-right font-medium">
                  ${centsToStr(r.estValueCents || 0)}
                </div>
              </div>

              {/* mobile labels */}
              <div className="mt-2 grid grid-cols-2 gap-x-4 gap-y-1 text-xs text-slate-400 lg:hidden">
                <div>Avg cost</div>
                <div className="text-right text-slate-200">
                  ${centsToStr(r.onHandAvgCostCents)}
                </div>
                <div>Total cost</div>
                <div className="text-right text-slate-200">
                  ${centsToStr(r.onHandCostCents)}
                </div>
                <div>Mkt value</div>
                <div className="text-right text-slate-200">
                  ${centsToStr(r.marketValueCents || 0)}
                </div>
                <div>Est. value</div>
                <div className="text-right text-slate-200">
                  ${centsToStr(r.estValueCents || 0)}
                </div>
              </div>
            </div>
          ))}

          {!isLoading && filteredRows.length === 0 && (
            <div className={`${pageCard} text-slate-400`}>No matching items.</div>
          )}
        </div>
      </div>
    </div>
  );
}

/* ---------- KPI pill ---------- */
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
      <div className="text-[11px] text-slate-400 truncate">{sub}</div>
    </div>
  );
}
