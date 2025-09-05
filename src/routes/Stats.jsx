import { useEffect, useMemo, useState, useRef } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "../lib/supabaseClient";
import HeaderWithTabs from "../components/HeaderWithTabs.jsx";

/* ----------------------------- UI helpers ----------------------------- */
const card =
  "rounded-2xl border border-slate-800 bg-slate-900/60 backdrop-blur p-4 sm:p-6 shadow-[0_10px_30px_rgba(0,0,0,.35)] overflow-visible";

/* smaller pill style used inside the KPIs wrapper card */
const pill =
  "rounded-xl border border-slate-800 bg-slate-900/60 p-4";

/* inputs */
const inputBase =
  "w-full min-w-0 appearance-none bg-slate-900/60 border border-slate-800 rounded-xl px-4 py-3 text-slate-100 placeholder-slate-400 focus:ring-2 focus:ring-indigo-500";

/* ----------------------------- data helpers ---------------------------- */
const cents = (n) => Math.round(Number(n || 0));
const centsToStr = (c) => (Number(c || 0) / 100).toFixed(2);
const pctStr = (p) => (isFinite(p) ? `${(p * 100).toFixed(0)}%` : "—");
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

const median = (arr) => {
  if (!arr.length) return 0;
  const a = [...arr].sort((x, y) => x - y);
  const m = Math.floor(a.length / 2);
  return a.length % 2 ? a[m] : (a[m - 1] + a[m]) / 2;
};

const monthKey = (d) => {
  const dt = new Date(d);
  if (isNaN(dt.getTime())) return null;
  return `${dt.getFullYear()}-${String(dt.getMonth() + 1).padStart(2, "0")}`;
};

/* -------------------------------- queries ------------------------------- */
async function getOrders() {
  const { data, error } = await supabase
    .from("orders")
    .select(
      "id, order_date, sale_date, item, retailer, marketplace, buy_price_cents, sale_price_cents, fees_pct, shipping_cents, status"
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

/* --------------------------------- page --------------------------------- */
export default function Stats() {
  const { data: orders = [] } = useQuery({
    queryKey: ["orders"],
    queryFn: getOrders,
  });
  const { data: items = [] } = useQuery({
    queryKey: ["items"],
    queryFn: getItems,
  });

  /* user (avatar/name) — header uses this */
  const [userInfo, setUserInfo] = useState({ avatar_url: "", username: "" });
  useEffect(() => {
    async function loadUser() {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) return setUserInfo({ avatar_url: "", username: "" });
      const m = user.user_metadata || {};
      const username =
        m.user_name ||
        m.preferred_username ||
        m.full_name ||
        m.name ||
        user.email ||
        "Account";
      const avatar_url = m.avatar_url || m.picture || "";
      setUserInfo({ avatar_url, username });
    }
    loadUser();
    const { data: sub } = supabase.auth.onAuthStateChange((_e, session) => {
      const user = session?.user;
      if (!user) return setUserInfo({ avatar_url: "", username: "" });
      const m = user.user_metadata || {};
      const username =
        m.user_name ||
        m.preferred_username ||
        m.full_name ||
        m.name ||
        user.email ||
        "Account";
      const avatar_url = m.avatar_url || m.picture || "";
      setUserInfo({ avatar_url, username });
    });
    return () => sub.subscription.unsubscribe();
  }, []);

  /* --------------------------- filter controls -------------------------- */
  const [range, setRange] = useState("all"); // all | month | 30 | custom
  const [fromStr, setFromStr] = useState("");
  const [toStr, setToStr] = useState("");

  // Searchable Item combobox
  const [itemOpen, setItemOpen] = useState(false);
  const [itemInput, setItemInput] = useState("All Items");
  const comboRef = useRef(null);

  // close dropdown on outside click
  useEffect(() => {
    function onDocClick(e) {
      if (!comboRef.current) return;
      if (!comboRef.current.contains(e.target)) setItemOpen(false);
    }
    document.addEventListener("mousedown", onDocClick);
    return () => document.removeEventListener("mousedown", onDocClick);
  }, []);

  const itemOptions = useMemo(() => {
    const names = items.map((i) => i.name).filter(Boolean);
    const uniq = Array.from(new Set(names)).sort((a, b) =>
      a.localeCompare(b)
    );
    return ["All Items", ...uniq];
  }, [items]);

  const filteredItemOptions = useMemo(() => {
    const q = (itemInput || "").toLowerCase();
    if (!q || q === "all items") return itemOptions;
    return itemOptions.filter((n) => n.toLowerCase().includes(q));
  }, [itemOptions, itemInput]);

  // applied filter snapshot (on Apply)
  const [applied, setApplied] = useState({
    range: "all",
    from: null,
    to: null,
    item: "",
  });

  const { fromMs, toMs } = useMemo(() => {
    if (applied.range === "custom") {
      const f = applied.from
        ? new Date(applied.from).setHours(0, 0, 0, 0)
        : null;
      const t = applied.to
        ? new Date(applied.to).setHours(23, 59, 59, 999)
        : null;
      return { fromMs: f, toMs: t };
    }
    if (applied.range === "month") {
      const now = new Date();
      const f = new Date(now.getFullYear(), now.getMonth(), 1).getTime();
      const t = new Date(
        now.getFullYear(),
        now.getMonth() + 1,
        0,
        23,
        59,
        59,
        999
      ).getTime();
      return { fromMs: f, toMs: t };
    }
    if (applied.range === "30") {
      const t = Date.now();
      const f = t - 29 * 24 * 3600 * 1000;
      return { fromMs: f, toMs: t };
    }
    return { fromMs: null, toMs: null }; // all time
  }, [applied]);

  // market values (by item name) for MTM
  const marketByName = useMemo(() => {
    const m = new Map();
    for (const it of items) {
      const k = (it.name || "").toLowerCase();
      const v = cents(it.market_value_cents);
      if (!m.has(k)) m.set(k, v);
      else m.set(k, Math.max(m.get(k), v));
    }
    return m;
  }, [items]);

  // filter by date window + item (contains match)
  const filtered = useMemo(() => {
    const item = (applied.item || "").toLowerCase();
    const useItem = !!item;
    return orders.filter((o) => {
      const matchesItem =
        !useItem || (o.item || "").toLowerCase().includes(item);
      const anyInWindow =
        within(o.order_date, fromMs, toMs) ||
        within(o.sale_date, fromMs, toMs) ||
        (!fromMs && !toMs);
      return matchesItem && anyInWindow;
    });
  }, [orders, applied, fromMs, toMs]);

  /* ------------------------------- KPIs -------------------------------- */
  const kpis = useMemo(() => {
    const purchases = filtered.filter(
      (o) => within(o.order_date, fromMs, toMs) || (!fromMs && !toMs)
    );
    const sales = filtered.filter(
      (o) =>
        cents(o.sale_price_cents) > 0 &&
        (within(o.sale_date, fromMs, toMs) || (!fromMs && !toMs))
    );
    const unsold = filtered.filter((o) => cents(o.sale_price_cents) <= 0);

    const spentC = purchases.reduce((a, o) => a + cents(o.buy_price_cents), 0);
    const revenueC = sales.reduce((a, o) => a + cents(o.sale_price_cents), 0);
    const feesC = sales.reduce((a, o) => {
      const rev = cents(o.sale_price_cents);
      const fee = Math.round(rev * (Number(o.fees_pct) || 0));
      return a + fee;
    }, 0);
    const shipOutC = sales.reduce((a, o) => a + cents(o.shipping_cents), 0);
    const cogsC = sales.reduce((a, o) => a + cents(o.buy_price_cents), 0);

    const realizedPlC = revenueC - feesC - shipOutC - cogsC;
    const netAfterFeeShipC = revenueC - feesC - shipOutC;

    const onHandCount = unsold.length;
    const onHandCostC = unsold.reduce((a, o) => a + cents(o.buy_price_cents), 0);
    const onHandMarketC = unsold.reduce((a, o) => {
      const mv = marketByName.get((o.item || "").toLowerCase()) || 0;
      return a + mv;
    }, 0);
    const unrealizedPlC = onHandMarketC - onHandCostC;

    const cashFlowC = revenueC - feesC - shipOutC - spentC;

    const avgBuy = purchases.length ? spentC / purchases.length : 0;
    const avgSale = sales.length ? revenueC / sales.length : 0;
    const asp = avgSale;

    // hold time (days)
    const holdDays = sales
      .map((o) => {
        const od = new Date(o.order_date).getTime();
        const sd = new Date(o.sale_date).getTime();
        if (isNaN(od) || isNaN(sd)) return null;
        return Math.max(0, Math.round((sd - od) / (24 * 3600 * 1000)));
      })
      .filter((x) => x != null);
    const avgHold = holdDays.length
      ? holdDays.reduce((a, b) => a + b, 0) / holdDays.length
      : 0;
    const medianHold = holdDays.length ? median(holdDays) : 0;

    const purchasesCount = purchases.length;
    const salesCount = sales.length;
    const sellThrough = purchasesCount > 0 ? salesCount / purchasesCount : NaN;

    const winRate =
      salesCount > 0
        ? sales.filter((o) => {
            const rev = cents(o.sale_price_cents);
            const fee = Math.round(rev * (Number(o.fees_pct) || 0));
            const ship = cents(o.shipping_cents);
            const pl = rev - fee - ship - cents(o.buy_price_cents);
            return pl > 0;
          }).length / salesCount
        : NaN;

    const avgFeeRate = revenueC > 0 ? feesC / revenueC : NaN;
    const margin = revenueC > 0 ? realizedPlC / revenueC : NaN;
    const roiSold = cogsC > 0 ? realizedPlC / cogsC : NaN;

    return {
      purchasesCount,
      salesCount,
      onHandCount,
      spentC,
      revenueC,
      feesC,
      shipOutC,
      cogsC,
      realizedPlC,
      netAfterFeeShipC,
      onHandCostC,
      onHandMarketC,
      unrealizedPlC,
      totalPlMtmC: realizedPlC + unrealizedPlC,
      cashFlowC,
      avgBuy,
      asp,
      avgHold,
      medianHold,
      sellThrough,
      winRate,
      avgFeeRate,
      margin,
      roiSold,
    };
  }, [filtered, fromMs, toMs, marketByName]);

  /* ------------------------------- charts ------------------------------- */
  const monthSeries = useMemo(() => {
    // build monthly series from filtered (respects time & item)
    const sales = filtered.filter(
      (o) => cents(o.sale_price_cents) > 0 && (within(o.sale_date, fromMs, toMs) || (!fromMs && !toMs))
    );
    const purchases = filtered.filter(
      (o) => within(o.order_date, fromMs, toMs) || (!fromMs && !toMs)
    );

    const monthsSet = new Set();
    for (const o of purchases) {
      const k = monthKey(o.order_date);
      if (k) monthsSet.add(k);
    }
    for (const o of sales) {
      const k = monthKey(o.sale_date);
      if (k) monthsSet.add(k);
    }
    const months = [...monthsSet].sort((a, b) => a.localeCompare(b));

    const realizedPL = new Map();
    const cashFlow = new Map();
    const asp = new Map();
    const aspCount = new Map();
    const stPurch = new Map();
    const stSales = new Map();

    for (const m of months) {
      realizedPL.set(m, 0);
      cashFlow.set(m, 0);
      asp.set(m, 0);
      aspCount.set(m, 0);
      stPurch.set(m, 0);
      stSales.set(m, 0);
    }

    for (const o of purchases) {
      const k = monthKey(o.order_date);
      if (!k) continue;
      stPurch.set(k, stPurch.get(k) + 1);
      cashFlow.set(k, cashFlow.get(k) - cents(o.buy_price_cents)); // cash out
    }
    for (const o of sales) {
      const k = monthKey(o.sale_date);
      if (!k) continue;
      const rev = cents(o.sale_price_cents);
      const fee = Math.round(rev * (Number(o.fees_pct) || 0));
      const ship = cents(o.shipping_cents);
      const cost = cents(o.buy_price_cents);

      realizedPL.set(k, realizedPL.get(k) + (rev - fee - ship - cost));
      cashFlow.set(k, cashFlow.get(k) + (rev - fee - ship)); // cash in
      asp.set(k, asp.get(k) + rev);
      aspCount.set(k, aspCount.get(k) + 1);
      stSales.set(k, stSales.get(k) + 1);
    }

    const sellThroughPct = new Map();
    for (const m of months) {
      const p = stPurch.get(m) || 0;
      const s = stSales.get(m) || 0;
      sellThroughPct.set(m, p > 0 ? s / p : NaN);
    }

    const aspAvg = new Map();
    for (const m of months) {
      const c = aspCount.get(m) || 0;
      aspAvg.set(m, c > 0 ? Math.round(asp.get(m) / c) : 0);
    }

    return {
      months,
      realizedPL,
      cashFlow,
      sellThroughPct,
      aspAvg,
    };
  }, [filtered, fromMs, toMs]);

  /* -------------------------------- render -------------------------------- */
  return (
    <div className="min-h-screen bg-slate-950 text-slate-100">
      <div className="max-w-6xl mx-auto p-4 sm:p-6">
        <HeaderWithTabs active="stats" showTabs />

        {/* Filters */}
        <div className={`${card} relative z-[60]`}>
          <h2 className="text-lg font-semibold mb-4">Date Range</h2>
          <div className="grid grid-cols-1 gap-4 min-w-0">
            {/* Date range dropdown */}
            <div className="relative isolate">
              <Select
                value={range}
                onChange={setRange}
                options={[
                  { value: "all", label: "All time" },
                  { value: "month", label: "This month" },
                  { value: "30", label: "Last 30 days" },
                  { value: "custom", label: "Custom…" },
                ]}
                placeholder="All time"
              />
            </div>

            {range === "custom" && (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 min-w-0">
                <input
                  type="date"
                  value={fromStr}
                  onChange={(e) => setFromStr(e.target.value)}
                  className={inputBase}
                />
                <input
                  type="date"
                  value={toStr}
                  onChange={(e) => setToStr(e.target.value)}
                  className={inputBase}
                />
              </div>
            )}

            {/* Item filter (custom searchable combobox) */}
            <div ref={comboRef} className="relative isolate">
              <label className="sr-only">Item filter</label>
              <input
                value={itemInput}
                onChange={(e) => {
                  setItemInput(e.target.value);
                  setItemOpen(true);
                }}
                onFocus={() => setItemOpen(true)}
                placeholder="Type to filter by item name…"
                className={inputBase}
              />
              <button
                type="button"
                onClick={() => setItemOpen((v) => !v)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400"
                aria-label="Toggle items"
              >
                ▾
              </button>

              {itemOpen && (
                <div className="absolute z-50 left-0 right-0 mt-2 max-h-60 overflow-auto rounded-xl border border-slate-800 bg-slate-900 shadow-xl">
                  {filteredItemOptions.map((name) => (
                    <div
                      key={name}
                      onMouseDown={(e) => e.preventDefault()}
                      onClick={() => {
                        setItemInput(name);
                        setItemOpen(false);
                      }}
                      className="px-3 py-2 hover:bg-slate-800 cursor-pointer text-slate-100"
                    >
                      {name}
                    </div>
                  ))}
                  {filteredItemOptions.length === 0 && (
                    <div className="px-3 py-2 text-slate-400">No matches</div>
                  )}
                </div>
              )}
            </div>

            <div className="flex items-center gap-4">
              <button
                onClick={() =>
                  setApplied({
                    range,
                    from: range === "custom" ? fromStr || null : null,
                    to: range === "custom" ? toStr || null : null,
                    item: normalizeItemFilter(itemInput),
                  })
                }
                className="px-6 py-3 rounded-2xl bg-indigo-600 hover:bg-indigo-500 text-white"
              >
                Apply
              </button>
              <div className="text-slate-400 text-sm">
                {filtered.length ? "" : "Stats unavailable."}
              </div>
            </div>
          </div>
        </div>

        {/* KPI wrapper card (like Inventory) */}
        <div className={`${card} mt-6`}>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <KpiPill title="Bought" value={`${kpis.purchasesCount} items`} sub={`Spend $${centsToStr(kpis.spentC)}`} />
            <KpiPill title="Inventory" value={`${kpis.onHandCount} on hand`} sub={`Cost $${centsToStr(kpis.onHandCostC)}`} />
            <KpiPill title="Est. Value" value={`$${centsToStr(kpis.onHandMarketC)}`} sub="on-hand market" tone="unrealized" />
            <KpiPill title="Unrealized P/L" value={`$${centsToStr(kpis.unrealizedPlC)}`} sub="mark-to-market" tone="unrealized" />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mt-4">
            <KpiPill title="Sold" value={`${kpis.salesCount} items`} sub={`Revenue $${centsToStr(kpis.revenueC)}`} />
            <KpiPill
              title="Realized P/L"
              value={`$${centsToStr(kpis.realizedPlC)}`}
              sub={`Net after fees/ship $${centsToStr(kpis.netAfterFeeShipC)}`}
              tone={kpis.realizedPlC > 0 ? "realized-pos" : kpis.realizedPlC < 0 ? "realized-neg" : "neutral"}
            />
            <KpiPill title="Cash Flow" value={`$${centsToStr(kpis.cashFlowC)}`} sub="Net cash this window" />
            <KpiPill title="ASP" value={`$${centsToStr(kpis.asp)}`} sub={`Avg Fee ${pctStr(kpis.avgFeeRate)}`} />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mt-4">
            <KpiPill title="Sell-Through" value={pctStr(kpis.sellThrough)} sub={`Win Rate ${pctStr(kpis.winRate)}`} />
            <KpiPill title="Hold Time" value={`${kpis.avgHold.toFixed(1)} d`} sub={`Median ${kpis.medianHold.toFixed(0)} d`} />
            <KpiPill title="Margin" value={pctStr(kpis.margin)} sub={`ROI (sold) ${pctStr(kpis.roiSold)}`} />
            <KpiPill title="Fees + Ship" value={`$${centsToStr(kpis.feesC + kpis.shipOutC)}`} sub={`Fees $${centsToStr(kpis.feesC)} • Ship $${centsToStr(kpis.shipOutC)}`} />
          </div>
        </div>

        {/* Charts grid — all charts are filter-aware */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 mt-6">
          <ChartCard title="Realized P/L by month">
            <BarsVertical
              labels={monthSeries.months}
              values={monthSeries.months.map((m) => monthSeries.realizedPL.get(m) || 0)}
            />
          </ChartCard>

          <ChartCard title="Cash flow by month">
            <Sparkline
              values={monthSeries.months.map((m) => monthSeries.cashFlow.get(m) || 0)}
              labels={monthSeries.months}
            />
          </ChartCard>

          <ChartCard title="Sell-Through by month">
            <PercentBars
              labels={monthSeries.months}
              values={monthSeries.months.map((m) => monthSeries.sellThroughPct.get(m))}
            />
          </ChartCard>

          <ChartCard title="ASP (Average Sale Price) by month">
            <Sparkline
              values={monthSeries.months.map((m) => monthSeries.aspAvg.get(m) || 0)}
              labels={monthSeries.months}
            />
          </ChartCard>
        </div>

        {/* Breakdown by item */}
        <div className={`${card} mt-6`}>
          <h3 className="text-lg font-semibold mb-4">Breakdown by item</h3>
          <div className="overflow-x-auto">
            <table className="min-w-[1200px] w-full text-sm">
              <thead className="text-slate-300">
                <tr className="text-left">
                  <th className="py-2 pr-3">Item Name</th>
                  <th className="py-2 pr-3">Bought</th>
                  <th className="py-2 pr-3">Sold</th>
                  <th className="py-2 pr-3">On Hand</th>
                  <th className="py-2 pr-3">COGS (sold)</th>
                  <th className="py-2 pr-3">Revenue</th>
                  <th className="py-2 pr-3">Fees</th>
                  <th className="py-2 pr-3">Shipping</th>
                  <th className="py-2 pr-3">Realized P/L</th>
                  <th className="py-2 pr-3">On-hand Cost</th>
                  <th className="py-2 pr-3">On-hand Mkt</th>
                  <th className="py-2 pr-3">Unrealized P/L</th>
                  <th className="py-2 pr-3">Total P/L (MTM)</th>
                </tr>
              </thead>
              <tbody className="text-slate-200">
                {makeItemBreakdown(filtered, marketByName).map((r) => (
                  <tr key={r.item} className="border-t border-slate-800">
                    <td className="py-2 pr-3">{r.item}</td>
                    <td className="py-2 pr-3">{r.bought}</td>
                    <td className="py-2 pr-3">{r.sold}</td>
                    <td className="py-2 pr-3">{r.onHand}</td>
                    <td className="py-2 pr-3">${centsToStr(r.cogsC)}</td>
                    <td className="py-2 pr-3">${centsToStr(r.revenueC)}</td>
                    <td className="py-2 pr-3">${centsToStr(r.feesC)}</td>
                    <td className="py-2 pr-3">${centsToStr(r.shipC)}</td>
                    <td className={`py-2 pr-3 ${
                      r.realizedPlC > 0 ? "text-emerald-400" : r.realizedPlC < 0 ? "text-rose-400" : "text-slate-200"
                    }`}>
                      ${centsToStr(r.realizedPlC)}
                    </td>
                    <td className="py-2 pr-3">${centsToStr(r.onHandCostC)}</td>
                    <td className="py-2 pr-3 text-indigo-400">${centsToStr(r.onHandMarketC)}</td>
                    <td className="py-2 pr-3 text-indigo-400">${centsToStr(r.unrealizedPlC)}</td>
                    <td className={`py-2 pr-3 ${
                      r.totalPlMtmC > 0 ? "text-emerald-400/70" : r.totalPlMtmC < 0 ? "text-rose-400" : "text-slate-200"
                    }`}>
                      ${centsToStr(r.totalPlMtmC)}
                    </td>
                  </tr>
                ))}
                {filtered.length === 0 && (
                  <tr>
                    <td className="py-6 text-slate-400" colSpan={13}>
                      No data in this range.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}

/* --------------------------- small components --------------------------- */

function Select({ value, onChange, options, placeholder = "Select…" }) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef(null);

  useEffect(() => {
    function onDoc(e) {
      if (!rootRef.current?.contains(e.target)) setOpen(false);
    }
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, []);

  const current = options.find((o) => o.value === value);

  return (
    <div ref={rootRef} className="relative w-full">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className={`${inputBase} flex items-center justify-between`}
      >
        <span className={current ? "" : "text-slate-400"}>
          {current ? current.label : placeholder}
        </span>
        <svg className="w-4 h-4 opacity-70" viewBox="0 0 20 20" fill="currentColor">
          <path d="M5.23 7.21a.75.75 0 011.06.02L10 10.94l3.71-3.71a.75.75 0 111.06 1.06l-4.24 4.24a.75.75 0 01-1.06 0L5.21 8.29a.75.75 0 01.02-1.08z" />
        </svg>
      </button>

      {open && (
        <div className="absolute left-0 right-0 mt-2 z-50 rounded-xl border border-slate-800 bg-slate-900/95 backdrop-blur shadow-xl">
          <ul className="max-h-64 overflow-auto py-1">
            {options.map((opt) => (
              <li key={opt.value}>
                <button
                  type="button"
                  onClick={() => {
                    onChange(opt.value);
                    setOpen(false);
                  }}
                  className={`w-full text-left px-3 py-2 hover:bg-slate-800 ${
                    opt.value === value ? "text-white" : "text-slate-200"
                  }`}
                >
                  {opt.label}
                </button>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}

/* KPI pill — ONLY realized positive shows green; unrealized uses blue */
function KpiPill({ title, value, sub, tone = "neutral" }) {
  let valueClass = "text-slate-100";
  if (tone === "unrealized") valueClass = "text-indigo-400";
  if (tone === "realized-pos") valueClass = "text-emerald-400";
  if (tone === "realized-neg") valueClass = "text-rose-400";

  return (
    <div className={pill}>
      <div className="text-slate-400 text-sm">{title}</div>
      <div className={`text-xl font-semibold mt-1 ${valueClass}`}>{value}</div>
      {sub && <div className="text-slate-400 text-sm mt-0.5">{sub}</div>}
    </div>
  );
}

/* Chart wrapper */
function ChartCard({ title, children }) {
  return (
    <div className={card}>
      <div className="text-lg font-semibold mb-4">{title}</div>
      {children}
    </div>
  );
}

/* Vertical bar chart with sign colors (green/red) */
function BarsVertical({ labels, values }) {
  const max = Math.max(1, ...values.map((v) => Math.abs(v)));
  return (
    <div className="flex items-end gap-2 h-40">
      {values.map((v, i) => {
        const h = (Math.abs(v) / max) * 100;
        const pos = v > 0;
        const neg = v < 0;
        const color = pos ? "bg-emerald-500" : neg ? "bg-rose-500" : "bg-slate-600";
        return (
          <div key={i} className="flex-1 flex flex-col items-center">
            <div className={`w-full rounded-t ${color}`} style={{ height: `${h}%` }} />
            <div className="mt-2 text-[10px] text-slate-400 truncate">{labels[i]}</div>
          </div>
        );
      })}
    </div>
  );
}

/* Sparkline (SVG) — neutral indigo line */
function Sparkline({ values, labels }) {
  const w = 560; // container width (approx)
  const h = 140;
  const pad = 8;

  const n = values.length || 1;
  const xs = (i) => (n === 1 ? pad : pad + (i * (w - pad * 2)) / (n - 1));

  const max = Math.max(1, ...values.map((v) => Math.abs(v)));
  const ys = (v) => h / 2 - (v / max) * (h / 2 - pad);

  const points = values.map((v, i) => `${xs(i)},${ys(v)}`).join(" ");

  return (
    <div className="w-full overflow-hidden">
      <svg viewBox={`0 0 ${w} ${h}`} className="w-full h-36">
        {/* midline */}
        <line x1="0" y1={h / 2} x2={w} y2={h / 2} className="stroke-slate-700" strokeWidth="1" />
        {/* line */}
        <polyline points={points} fill="none" className="stroke-indigo-400" strokeWidth="2" />
        {/* last point dot */}
        {values.length > 0 && (
          <circle cx={xs(values.length - 1)} cy={ys(values[values.length - 1])} r="3" className="fill-indigo-400" />
        )}
      </svg>
      <div className="mt-1 grid grid-cols-6 gap-2 text-[10px] text-slate-400">
        {labels.map((l, i) => (
          <div key={i} className="truncate">{l}</div>
        ))}
      </div>
    </div>
  );
}

/* Percentage bars (0–100%) for sell-through */
function PercentBars({ labels, values }) {
  return (
    <div className="space-y-2">
      {labels.map((l, i) => {
        const p = values[i];
        const pct = isFinite(p) ? Math.max(0, Math.min(1, p)) : 0;
        return (
          <div key={i} className="flex items-center gap-3">
            <div className="w-28 shrink-0 text-xs text-slate-300 truncate">{l}</div>
            <div className="flex-1 h-3 rounded bg-slate-800 overflow-hidden">
              <div className="h-full bg-indigo-500" style={{ width: `${pct * 100}%` }} />
            </div>
            <div className="w-10 shrink-0 text-right text-xs text-slate-300">
              {pctStr(pct)}
            </div>
          </div>
        );
      })}
      {labels.length === 0 && <div className="text-slate-400">No data for this view.</div>}
    </div>
  );
}

/** Item breakdown with realized & MTM metrics */
function makeItemBreakdown(filtered, marketByName) {
  const m = new Map();
  for (const o of filtered) {
    const key = o.item || "—";
    if (!m.has(key)) {
      m.set(key, {
        item: key,
        bought: 0,
        sold: 0,
        onHand: 0,
        cogsC: 0,
        revenueC: 0,
        feesC: 0,
        shipC: 0,
        realizedPlC: 0,
        onHandCostC: 0,
        onHandMarketC: 0,
        unrealizedPlC: 0,
        totalPlMtmC: 0,
      });
    }
    const row = m.get(key);
    row.bought += 1;

    if (cents(o.sale_price_cents) > 0) {
      // Sold
      row.sold += 1;
      const rev = cents(o.sale_price_cents);
      const fee = Math.round(rev * (Number(o.fees_pct) || 0));
      const ship = cents(o.shipping_cents);
      const cost = cents(o.buy_price_cents);
      row.cogsC += cost;
      row.revenueC += rev;
      row.feesC += fee;
      row.shipC += ship;
      row.realizedPlC += rev - fee - ship - cost;
    } else {
      // Unsold
      row.onHand += 1;
      const cost = cents(o.buy_price_cents);
      row.onHandCostC += cost;
      const mv = marketByName.get((o.item || "").toLowerCase()) || 0;
      row.onHandMarketC += mv;
    }
  }

  for (const row of m.values()) {
    row.unrealizedPlC = row.onHandMarketC - row.onHandCostC;
    row.totalPlMtmC = row.realizedPlC + row.unrealizedPlC;
  }

  return [...m.values()]
    .sort((a, b) => b.revenueC - a.revenueC)
    .slice(0, 400);
}
