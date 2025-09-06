// src/routes/Stats.jsx
import { useEffect, useMemo, useState, useRef } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "../lib/supabaseClient";
import HeaderWithTabs from "../components/HeaderWithTabs.jsx";

/* ----------------------------- UI tokens ----------------------------- */
const card =
  "rounded-2xl border border-slate-800 bg-slate-900/60 backdrop-blur p-4 sm:p-6 shadow-[0_10px_30px_rgba(0,0,0,.35)]";
const inputBase =
  "w-full min-w-0 appearance-none bg-slate-900/60 border border-slate-800 rounded-xl px-4 py-3 text-slate-100 placeholder-slate-400 focus:ring-2 focus:ring-indigo-500";
const rowCard =
  "rounded-2xl border border-slate-800 bg-slate-900/60 px-4 py-4 sm:px-5 sm:py-5";

/* ----------------------------- data helpers ---------------------------- */
const cents = (n) => Math.round(Number(n || 0));
const centsToStr = (c) => (Number(c || 0) / 100).toFixed(2);
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
  const { data: orders = [] } = useQuery({ queryKey: ["orders"], queryFn: getOrders });
  const { data: items = [] } = useQuery({ queryKey: ["items"], queryFn: getItems });

  // header user (unchanged for tabs)
  const [userInfo, setUserInfo] = useState({ avatar_url: "", username: "" });
  useEffect(() => {
    async function loadUser() {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return setUserInfo({ avatar_url: "", username: "" });
      const m = user.user_metadata || {};
      const username =
        m.user_name || m.preferred_username || m.full_name || m.name || user.email || "Account";
      const avatar_url = m.avatar_url || m.picture || "";
      setUserInfo({ avatar_url, username });
    }
    loadUser();
    const { data: sub } = supabase.auth.onAuthStateChange((_e, session) => {
      const user = session?.user;
      if (!user) return setUserInfo({ avatar_url: "", username: "" });
      const m = user.user_metadata || {};
      const username =
        m.user_name || m.preferred_username || m.full_name || m.name || user.email || "Account";
      const avatar_url = m.avatar_url || m.picture || "";
      setUserInfo({ avatar_url, username });
    });
    return () => sub.subscription.unsubscribe();
  }, []);

  /* --------------------------- filter controls -------------------------- */
  const [range, setRange] = useState("all"); // all | month | 30 | year | custom
  const [fromStr, setFromStr] = useState("");
  const [toStr, setToStr] = useState("");

  const [itemOpen, setItemOpen] = useState(false);
  const [itemInput, setItemInput] = useState("All Items");
  const comboRef = useRef(null);

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
    const uniq = Array.from(new Set(names)).sort((a, b) => a.localeCompare(b));
    return ["All Items", ...uniq];
  }, [items]);

  const filteredItemOptions = useMemo(() => {
    const q = (itemInput || "").toLowerCase();
    if (!q || q === "all items") return itemOptions;
    return itemOptions.filter((n) => n.toLowerCase().includes(q));
  }, [itemOptions, itemInput]);

  // applied snapshot
  const [applied, setApplied] = useState({ range: "all", from: null, to: null, item: "" });

  const isDefaultFilters =
    applied.range === "all" && !applied.from && !applied.to && !applied.item;

  const { fromMs, toMs } = useMemo(() => {
    if (applied.range === "custom") {
      const f = applied.from ? new Date(applied.from).setHours(0,0,0,0) : null;
      const t = applied.to ? new Date(applied.to).setHours(23,59,59,999) : null;
      return { fromMs: f, toMs: t };
    }
    if (applied.range === "month") {
      const now = new Date();
      const f = new Date(now.getFullYear(), now.getMonth(), 1).getTime();
      const t = new Date(now.getFullYear(), now.getMonth()+1, 0, 23,59,59,999).getTime();
      return { fromMs: f, toMs: t };
    }
    if (applied.range === "30") {
      const t = Date.now();
      const f = t - 29 * 24 * 3600 * 1000;
      return { fromMs: f, toMs: t };
    }
    if (applied.range === "year") {
      const now = new Date();
      const f = new Date(now.getFullYear(), 0, 1).getTime();
      const t = new Date(now.getFullYear(), 11, 31, 23,59,59,999).getTime();
      return { fromMs: f, toMs: t };
    }
    return { fromMs: null, toMs: null };
  }, [applied]);

  /* ---------- market value lookup ---------- */
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

  /* ---------- filtered orders by time + item ---------- */
  const filtered = useMemo(() => {
    const item = (applied.item || "").toLowerCase();
    const useItem = !!item;
    return orders.filter((o) => {
      const matchesItem = !useItem || (o.item || "").toLowerCase().includes(item);
      const anyInWindow =
        within(o.order_date, fromMs, toMs) ||
        within(o.sale_date, fromMs, toMs) ||
        (!fromMs && !toMs);
      return matchesItem && anyInWindow;
    });
  }, [orders, applied, fromMs, toMs]);

  /* ------------------------------- KPI (same style as Inventory) ------------------------------- */
  const kpi = useMemo(() => {
    // on-hand snapshot in filtered set
    const onHandRows = filtered.filter((o) => cents(o.sale_price_cents) <= 0);
    const onHandUnits = onHandRows.length;
    const onHandCostC = onHandRows.reduce((a, o) => a + cents(o.buy_price_cents), 0);

    const onHandMarketC = onHandRows.reduce((a, o) => {
      const mv = marketByName.get((o.item || "").toLowerCase()) || 0;
      return a + mv;
    }, 0);

    const unrealized = onHandMarketC - onHandCostC;

    // sales stats
    const soldRows = filtered.filter((o) => cents(o.sale_price_cents) > 0);
    const revenueC = soldRows.reduce((a, o) => a + cents(o.sale_price_cents), 0);
    const feesC = soldRows.reduce(
      (a, o) => a + Math.round(cents(o.sale_price_cents) * (Number(o.fees_pct) || 0)),
      0
    );
    const shipC = soldRows.reduce((a, o) => a + cents(o.shipping_cents), 0);
    const soldCostC = soldRows.reduce((a, o) => a + cents(o.buy_price_cents), 0);
    const realized = revenueC - feesC - shipC - soldCostC;

    // longest hold (unsold)
    const now = Date.now();
    const longestHold = onHandRows.reduce((max, o) => {
      const od = new Date(o.order_date).getTime();
      if (isNaN(od)) return max;
      const d = Math.max(0, Math.round((now - od) / (24 * 3600 * 1000)));
      return Math.max(max, d);
    }, 0);

    // best seller, margin, ROI (per item in filtered)
    const perItem = new Map();
    for (const o of filtered) {
      const key = o.item || "—";
      if (!perItem.has(key))
        perItem.set(key, {
          item: key,
          sold: 0,
          revenueC: 0,
          plC: 0,
          spentC: 0,
        });
      const r = perItem.get(key);
      if (cents(o.sale_price_cents) > 0) {
        const rev = cents(o.sale_price_cents);
        const fee = Math.round(rev * (Number(o.fees_pct) || 0));
        const ship = cents(o.shipping_cents);
        const cost = cents(o.buy_price_cents);
        r.sold += 1;
        r.revenueC += rev;
        r.plC += rev - fee - ship - cost;
        r.spentC += cost;
      }
    }
    let bestSeller = { item: "—", n: 0 };
    let bestMargin = { item: "—", v: NaN };
    let bestROI = { item: "—", v: NaN };
    for (const r of perItem.values()) {
      if (r.sold > bestSeller.n) bestSeller = { item: r.item, n: r.sold };
      const margin = r.revenueC > 0 ? r.plC / r.revenueC : NaN;
      const roi = r.spentC > 0 ? r.plC / r.spentC : NaN;
      if ((Number.isFinite(margin) ? margin : -Infinity) > (Number.isFinite(bestMargin.v) ? bestMargin.v : -Infinity))
        bestMargin = { item: r.item, v: margin };
      if ((Number.isFinite(roi) ? roi : -Infinity) > (Number.isFinite(bestROI.v) ? bestROI.v : -Infinity))
        bestROI = { item: r.item, v: roi };
    }

    return {
      rows: filtered.length,
      onHandUnits,
      onHandCostC,
      onHandMarketC,
      unrealized,
      longestHold,
      bestSeller,
      bestMargin,
      bestROI,
      revenueC,
    };
  }, [filtered, marketByName]);

  /* ------------------------------- CHART DATA ------------------------------- */
  const chartBuckets = useMemo(() => {
    const purchases = filtered.filter(o => within(o.order_date, fromMs, toMs) || (!fromMs && !toMs));
    const sales = filtered.filter(o => cents(o.sale_price_cents) > 0 && (within(o.sale_date, fromMs, toMs) || (!fromMs && !toMs)));

    const months = Array.from(new Set([
      ...purchases.map((o) => monthKey(o.order_date)).filter(Boolean),
      ...sales.map((o) => monthKey(o.sale_date)).filter(Boolean),
    ])).sort((a,b)=>a.localeCompare(b));

    const purCnt = new Map(), salCnt = new Map(), cost = new Map(), revenue = new Map();
    for (const m of months) { purCnt.set(m,0); salCnt.set(m,0); cost.set(m,0); revenue.set(m,0); }
    for (const o of purchases) {
      const k = monthKey(o.order_date); if (!k) continue;
      purCnt.set(k, purCnt.get(k)+1);
      cost.set(k, cost.get(k)+cents(o.buy_price_cents));
    }
    for (const o of sales) {
      const k = monthKey(o.sale_date); if (!k) continue;
      salCnt.set(k, salCnt.get(k)+1);
      revenue.set(k, revenue.get(k)+cents(o.sale_price_cents));
    }

    // Limit buckets for small screens to avoid crowding (actual bars still fill container)
    const isSmall = typeof window !== "undefined" ? window.innerWidth < 640 : false;
    const maxBuckets = isSmall ? 8 : 12;
    const start = Math.max(0, months.length - maxBuckets);
    const slice = months.slice(start);

    return {
      labels: slice,
      purchasesCount: slice.map(m => purCnt.get(m)||0),
      salesCount: slice.map(m => salCnt.get(m)||0),
      costC: slice.map(m => cost.get(m)||0),
      revenueC: slice.map(m => revenue.get(m)||0),
    };
  }, [filtered, fromMs, toMs]);

  /* ------------------------------- chart mode ------------------------------- */
  const [pair, setPair] = useState("units"); // "units" -> Purchases/Sales, "money" -> Cost/Revenue

  const seriesForPair = useMemo(() => {
    if (pair === "units") {
      return {
        title: "Purchases & Sales",
        a: { label: "Purchases", values: chartBuckets.purchasesCount, color: "#6166f5" },
        b: { label: "Sales", values: chartBuckets.salesCount, color: "#8b90ff" },
        money: false,
      };
    }
    return {
      title: "Cost & Revenue",
      a: { label: "Cost", values: chartBuckets.costC, color: "#29d391" },     // muted greens
      b: { label: "Revenue", values: chartBuckets.revenueC, color: "#58e1ae" },
      money: true,
    };
  }, [pair, chartBuckets]);

  /* ------------------------------- expandable item cards (UNCHANGED) ------------------------------- */
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

  /* ------------------------------- render ------------------------------- */
  return (
    <div className="min-h-screen bg-slate-950 text-slate-100">
      <div className="max-w-6xl mx-auto p-4 sm:p-6">
        <HeaderWithTabs active="stats" showTabs />

        {/* Filters */}
        <div className={`${card} relative`}>
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-semibold">Filters</h2>
            <div className="text-slate-400 text-sm">{kpi.rows} rows</div>
          </div>

          <div className="mt-4 grid grid-cols-1 gap-4">
            {/* Date range dropdown */}
            <Select
              value={range}
              onChange={(v) => setRange(v)}
              options={[
                { value: "all", label: "All time" },
                { value: "month", label: "This month" },
                { value: "30", label: "Last 30 days" },
                { value: "year", label: "This year" },
                { value: "custom", label: "Custom…" },
              ]}
              placeholder="All time"
            />

            {range === "custom" && (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <input type="date" value={fromStr} onChange={(e)=>setFromStr(e.target.value)} className={inputBase} />
                <input type="date" value={toStr} onChange={(e)=>setToStr(e.target.value)} className={inputBase} />
              </div>
            )}

            {/* Item filter combobox */}
            <div ref={comboRef} className="relative isolate">
              <input
                value={itemInput}
                onChange={(e) => { setItemInput(e.target.value); setItemOpen(true); }}
                onFocus={() => setItemOpen(true)}
                placeholder="All Items"
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
                <div className="absolute z-[70] left-0 right-0 mt-2 max-h-60 overflow-auto rounded-xl border border-slate-800 bg-slate-900 shadow-xl">
                  {filteredItemOptions.map((name) => (
                    <div
                      key={name}
                      onMouseDown={(e) => e.preventDefault()}
                      onClick={() => { setItemInput(name); setItemOpen(false); }}
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

            {/* Apply / Clear */}
            <div className="flex justify-end gap-3">
              {!isDefaultFilters && (
                <button
                  onClick={() => {
                    setRange("all");
                    setFromStr("");
                    setToStr("");
                    setItemInput("All Items");
                    setApplied({ range: "all", from: null, to: null, item: "" });
                  }}
                  className="px-5 py-3 rounded-2xl border border-slate-800 bg-slate-900/60 hover:bg-slate-900 text-slate-100"
                >
                  Clear
                </button>
              )}
              <button
                onClick={() =>
                  setApplied({
                    range,
                    from: range === "custom" ? fromStr || null : null,
                    to:   range === "custom" ? toStr   || null : null,
                    item: normalizeItemFilter(itemInput),
                  })
                }
                className="px-6 py-3 rounded-2xl bg-indigo-600 hover:bg-indigo-500 text-white"
              >
                Apply
              </button>
            </div>
          </div>
        </div>

        {/* KPI pills (same style as Inventory) */}
        <div className={`${card} mt-6`}>
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
            <Kpi title="Inventory" value={`${kpi.onHandUnits}`} subtitle="units on hand" />
            <Kpi title="Total Cost" value={`$${centsToStr(kpi.onHandCostC)}`} subtitle="on-hand cost" />
            <Kpi title="Est. Value" value={`$${centsToStr(kpi.onHandMarketC)}`} subtitle="on-hand market" tone="blue" />
            <Kpi title="Unrealized P/L" value={`$${centsToStr(kpi.unrealized)}`} subtitle="gain" tone="blue" />
            <Kpi title="Longest Hold" value={`${kpi.longestHold}d`} subtitle="" />
            <Kpi title="Best Seller" value={`${kpi.bestSeller.n}`} subtitle={kpi.bestSeller.item} />
            <Kpi title="Highest Margins" value={pctStr(kpi.bestMargin.v)} subtitle={kpi.bestMargin.item} />
            <Kpi title="Best ROI" value={pctStr(kpi.bestROI.v)} subtitle={kpi.bestROI.item} />
          </div>
        </div>

        {/* Chart (single card with toggle) */}
        <div className={`${card} mt-6`}>
          <div className="flex items-start justify-between gap-3">
            <div>
              <div className="text-lg font-semibold">{seriesForPair.title}</div>
              <div className="text-xs text-slate-400 -mt-0.5">by month</div>
            </div>
            <div className="flex items-center gap-4">
              <SwitchPair
                left="Purchases / Sales"
                right="Cost / Revenue"
                value={pair === "units" ? "left" : "right"}
                onChange={(v) => setPair(v === "left" ? "units" : "money")}
              />
            </div>
          </div>

          <div className="mt-4">
            <BarsDual
              labels={chartBuckets.labels}
              seriesA={seriesForPair.a}
              seriesB={seriesForPair.b}
              money={seriesForPair.money}
            />
          </div>
        </div>

        {/* Item breakdown (UNCHANGED) */}
        <div className="mt-6 space-y-4">
          {itemGroups.map((g) => {
            const open = openSet.has(g.item);
            return (
              <div key={g.item} className={rowCard}>
                <div className="flex items-center justify-between gap-3">
                  <div className="min-w-0">
                    <div className="text-lg font-semibold truncate">{g.item}</div>
                  </div>
                  <button
                    onClick={() => toggleItem(g.item)}
                    className="h-9 w-9 inline-flex items-center justify-center rounded-xl border border-slate-800 bg-slate-900/60 hover:bg-slate-900"
                    aria-label={open ? "Collapse" : "Expand"}
                    title={open ? "Collapse" : "Expand"}
                  >
                    {open ? (
                      <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M18 6L6 18M6 6l12 12" />
                      </svg>
                    ) : (
                      <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <path d="m6 9 6 6 6-6" />
                      </svg>
                    )}
                  </button>
                </div>

                {open && (
                  <div className="mt-4 space-y-4">
                    <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-3">
                      <MiniPill title="Bought" value={`${g.bought}`} num={g.bought} sub="total purchases" />
                      <MiniPill title="Sold" value={`${g.sold}`} num={g.sold} sub="total sold" />
                      <MiniPill title="On Hand" value={`${g.onHand}`} num={g.onHand} sub="total inventory" />
                      <MiniPill title="Cost" value={`$${centsToStr(g.totalCostC)}`} num={g.totalCostC} sub="total amt spent" />
                      <MiniPill title="Fees" value={`$${centsToStr(g.feesC)}`} num={g.feesC} sub="from marketplace" />
                      <MiniPill title="Shipping" value={`$${centsToStr(g.shipC)}`} num={g.shipC} sub="from sales" />
                      <MiniPill title="Revenue" value={`$${centsToStr(g.revenueC)}`} num={g.revenueC} sub="total from sales" />
                      <MiniPill title="Realized P/L" value={`$${centsToStr(g.realizedPlC)}`} num={g.realizedPlC} sub="after fees + ship" tone="realized" />
                      <MiniPill title="ROI" value={pctStr(g.roi)} num={Number.isFinite(g.roi) ? g.roi : 0} sub="profit / cost" />
                      <MiniPill title="Margin" value={pctStr(g.margin)} num={Number.isFinite(g.margin) ? g.margin : 0} sub="profit / revenue" />
                      <MiniPill title="Avg Hold" value={`${g.avgHoldDays.toFixed(0)}d`} num={g.avgHoldDays} sub="time in days" />
                      <MiniPill title="ASP" value={`$${centsToStr(g.aspC)}`} num={g.aspC} sub="average sale price" />
                      <MiniPill title="Market Price" value={`$${centsToStr(g.unitMarketC)}`} num={g.unitMarketC} sub="from database" />
                      <MiniPill title="Est. Value" value={`$${centsToStr(g.onHandMarketC)}`} num={g.onHandMarketC} sub="based on mkt price" tone="unrealized" />
                    </div>
                  </div>
                )}
              </div>
            );
          })}
          {itemGroups.length === 0 && (
            <div className={`${card} text-slate-400`}>No items in this view.</div>
          )}
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
        <div className="absolute left-0 right-0 mt-2 z-[80] rounded-xl border border-slate-800 bg-slate-900/95 backdrop-blur shadow-xl">
          <ul className="max-h-64 overflow-auto py-1">
            {options.map((opt) => (
              <li key={opt.value}>
                <button
                  type="button"
                  onClick={() => { onChange(opt.value); setOpen(false); }}
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

/* little two-position toggle */
function SwitchPair({ left, right, value, onChange }) {
  const leftActive = value === "left";
  return (
    <div className="inline-flex items-center rounded-full border border-slate-800 bg-slate-900/60 p-1">
      <button
        onClick={() => onChange("left")}
        className={`px-3 py-1 rounded-full ${
          leftActive ? "bg-indigo-600 text-white" : "text-slate-200"
        }`}
      >
        {left}
      </button>
      <button
        onClick={() => onChange("right")}
        className={`px-3 py-1 rounded-full ${
          !leftActive ? "bg-indigo-600 text-white" : "text-slate-200"
        }`}
      >
        {right}
      </button>
    </div>
  );
}

/* ------- Nice rounding for axis max (1.5× max, rounded) -------- */
function niceMax(v) {
  const x = Math.max(1, v);
  const raw = x * 1.5;
  const pow10 = Math.pow(10, Math.floor(Math.log10(raw)));
  const n = raw / pow10;
  let step;
  if (n <= 1) step = 1;
  else if (n <= 2) step = 2;
  else if (n <= 5) step = 5;
  else step = 10;
  return step * pow10;
}

/* ------- Dual-series vertical bars, responsive, no scroll -------- */
function BarsDual({ labels = [], seriesA, seriesB, money = false }) {
  const values = [...(seriesA?.values || []), ...(seriesB?.values || [])];
  const maxData = Math.max(0, ...values);
  const ymax = niceMax(maxData);

  const ticks = 4; // 0 + 4 grid lines
  const step = ymax / ticks;
  const tickVals = Array.from({ length: ticks + 1 }, (_, i) => Math.round(i * step));

  // throttle x labels to avoid crowding
  const isSmall = typeof window !== "undefined" ? window.innerWidth < 640 : false;
  const labelEvery = Math.max(1, Math.ceil(labels.length / (isSmall ? 5 : 9)));

  // bar width scales but stays visible
  const groupCount = labels.length || 1;

  return (
    <div className="w-full">
      <div className="relative w-full h-[260px] sm:h-[320px] rounded-xl border border-slate-800 bg-slate-900/40 overflow-hidden">
        {/* Y axis ticks + grid */}
        <div className="absolute inset-0 px-10 sm:px-12">
          <div className="absolute left-0 top-3 bottom-10 right-0">
            {tickVals.map((tv, i) => {
              const pct = i / ticks;
              return (
                <div
                  key={i}
                  className="absolute left-0 right-0 border-t border-slate-800"
                  style={{ bottom: `${pct * 100}%` }}
                />
              );
            })}
            {/* values on the left, bottom-up */}
            <div className="absolute left-0 top-0 bottom-0 -translate-x-2 flex flex-col justify-between text-[10px] text-slate-300">
              {tickVals.map((tv, i) => (
                <div key={i} className="translate-y-1">
                  {money ? `$${centsToStr(tv * 100)}` : tv}
                </div>
              ))}
            </div>

            {/* bar groups */}
            <div className="absolute left-10 sm:left-12 right-3 bottom-8 top-3">
              <div className="flex items-end h-full gap-2">
                {labels.map((_, i) => {
                  const va = seriesA.values[i] || 0;
                  const vb = seriesB.values[i] || 0;
                  const ha = ymax ? (va / ymax) * 100 : 0;
                  const hb = ymax ? (vb / ymax) * 100 : 0;

                  return (
                    <div key={i} className="flex-1 min-w-0 flex items-end justify-center gap-1">
                      <div
                        className="rounded-t-md"
                        style={{ width: "9px", height: `${ha}%`, background: seriesA.color, opacity: 0.9 }}
                        title={`${seriesA.label}: ${money ? `$${centsToStr(va * 100)}` : va}`}
                      />
                      <div
                        className="rounded-t-md"
                        style={{ width: "9px", height: `${hb}%`, background: seriesB.color, opacity: 0.8 }}
                        title={`${seriesB.label}: ${money ? `$${centsToStr(vb * 100)}` : vb}`}
                      />
                    </div>
                  );
                })}
              </div>
            </div>

            {/* X labels */}
            <div className="absolute left-10 sm:left-12 right-3 bottom-0 h-8 flex items-center">
              <div className="flex w-full gap-2">
                {labels.map((l, i) => (
                  <div key={i} className="flex-1 min-w-0 text-center text-[10px] text-slate-400">
                    {(i % labelEvery === 0) ? l : ""}
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>

        {/* legend (stacked, dot on right) */}
        <div className="absolute right-4 top-4 text-xs text-slate-200 space-y-2">
          <div className="flex items-center gap-2">
            <span>{seriesA.label}</span>
            <span className="inline-block w-3 h-3 rounded-full" style={{ background: seriesA.color, opacity: 0.9 }} />
          </div>
          <div className="flex items-center gap-2">
            <span>{seriesB.label}</span>
            <span className="inline-block w-3 h-3 rounded-full" style={{ background: seriesB.color, opacity: 0.8 }} />
          </div>
        </div>
      </div>
    </div>
  );
}

/* -------- per-item aggregation for expandable cards (kept same) -------- */
function makeItemGroups(filtered, marketByName) {
  const m = new Map();
  for (const o of filtered) {
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

/* -------------------------- tiny UI atoms -------------------------- */
function Kpi({ title, value, subtitle, tone }) {
  const toneClass =
    tone === "blue"
      ? "text-indigo-400"
      : "text-slate-100";
  return (
    <div className={card}>
      <div className="text-slate-400 text-sm">{title}</div>
      <div className={`text-xl font-semibold mt-2 ${toneClass}`}>{value}</div>
      {subtitle && <div className="text-slate-400 text-sm">{subtitle}</div>}
    </div>
  );
}

function MiniPill({ title, value, sub, tone = "neutral", num = null }) {
  const n = Number.isFinite(num) ? num : 0;
  const isZero = n === 0;
  let color = "text-slate-100";
  if (tone === "unrealized") color = isZero ? "text-slate-400" : "text-indigo-400";
  if (tone === "realized") color = n > 0 ? "text-emerald-400" : isZero ? "text-slate-400" : "text-slate-100";
  if (tone === "neutral") color = isZero ? "text-slate-400" : "text-slate-100";

  return (
    <div className="rounded-xl border border-slate-800 bg-slate-900/60 px-3 py-3">
      <div className="text-slate-400 text-xs">{title}</div>
      <div className={`text-base font-semibold mt-0.5 ${color}`}>{value}</div>
      {sub && <div className="text-[10px] leading-4 text-slate-400 mt-0.5">{sub}</div>}
    </div>
  );
}
