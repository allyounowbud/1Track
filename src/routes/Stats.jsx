// src/routes/Stats.jsx
import { useEffect, useMemo, useRef, useState } from "react";
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
  const isDefaultApplied = applied.range === "all" && !applied.item && !applied.from && !applied.to;

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

  /* ------------------------------- KPIs -------------------------------- */
  const kpis = useMemo(() => makeKpis(filtered, marketByName), [filtered, marketByName]);

  /* ------------------------------- CHART DATA ------------------------------- */
  const series = useMemo(() => {
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

    return {
      months,
      purchasesCount: months.map(m => purCnt.get(m)||0),
      salesCount: months.map(m => salCnt.get(m)||0),
      costC: months.map(m => cost.get(m)||0),
      revenueC: months.map(m => revenue.get(m)||0),
    };
  }, [filtered, fromMs, toMs]);

  /* ------------------------------- Chart toggle ------------------------------- */
  const [chartMode, setChartMode] = useState("PS"); // PS | CR
  const usingPS = chartMode === "PS";
  const chartTitle = usingPS ? "Purchases & Sales" : "Cost & Revenue";
  const chartSubtitle = "by month";

  const psSeries = [
    { name: "Purchases", values: series.purchasesCount, color: "#6c72ff" }, // deeper indigo
    { name: "Sales", values: series.salesCount, color: "#8b90ff" },         // lighter indigo
  ];
  const crSeries = [
    { name: "Cost", values: series.costC, color: "#10b981" },     // emerald 500
    { name: "Revenue", values: series.revenueC, color: "#34d399" } // emerald 400
  ];

  const money = !usingPS;
  const chart = { labels: series.months, series: usingPS ? psSeries : crSeries, money };

  /* -------------------- Expandable item cards (unchanged) -------------------- */
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
    <div className="min-h-screen bg-slate-950 text-slate-100">
      <div className="max-w-6xl mx-auto p-4 sm:p-6">
        <HeaderWithTabs active="stats" showTabs />

        {/* -------------------- Filters -------------------- */}
        <div className={`${card} relative z-[60]`}>
          <div className="flex items-center justify-between gap-3 mb-4">
            <h2 className="text-lg font-semibold">Filters</h2>
            <div className="text-slate-400 text-sm">{filtered.length} rows</div>
          </div>

          <div className="grid grid-cols-1 gap-4">
            {/* Date range dropdown */}
            <Select
              value={range}
              onChange={setRange}
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

            {/* Item filter combobox */}
            <div ref={comboRef} className="relative isolate">
              <label className="sr-only">Item filter</label>
              <input
                value={itemInput}
                onChange={(e) => { setItemInput(e.target.value); setItemOpen(true); }}
                onFocus={() => setItemOpen(true)}
                placeholder="All Items"
                className={`${inputBase} pr-10`}
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
                <div className="absolute z-[80] left-0 right-0 mt-2 max-h-60 overflow-auto rounded-xl border border-slate-800 bg-slate-900 shadow-xl">
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

            {/* Buttons */}
            <div className="flex items-center justify-end gap-3">
              {!isDefaultApplied && (
                <button
                  onClick={() => {
                    setRange("all");
                    setFromStr(""); setToStr("");
                    setItemInput("All Items");
                    setApplied({ range: "all", from: null, to: null, item: "" });
                  }}
                  className="px-5 py-2.5 rounded-2xl border border-slate-800 bg-slate-900/60 hover:bg-slate-900 text-slate-100"
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

        {/* -------------------- KPI (Inventory-style) -------------------- */}
        <div className={`${card} mt-6`}>
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
            <Kpi title="Inventory" value={`${kpis.onHand}`} hint="units on hand" />
            <Kpi title="Total Cost" value={`$${centsToStr(kpis.onHandCostC)}`} hint="on-hand cost" />
            <Kpi title="Est. Value" value={`$${centsToStr(kpis.onHandMktC)}`} hint="on-hand market" tone="blue" />
            <Kpi title="Unrealized P/L" value={`$${centsToStr(kpis.unrealizedC)}`} hint="gain" tone="blue" />
            <Kpi title="Longest Hold" value={`${kpis.longestHoldDays}d`} hint={kpis.longestHoldName} />
            <Kpi title="Best Seller" value={`${kpis.bestSellerCount}`} hint={kpis.bestSellerName} />
            <Kpi title="Highest Margins" value={pctStr(kpis.bestMarginPct)} hint={kpis.bestMarginName} />
            <Kpi title="Best ROI" value={pctStr(kpis.bestRoiPct)} hint={kpis.bestRoiName} />
          </div>
        </div>

        {/* -------------------- Chart -------------------- */}
        <div className={`${card} mt-6`}>
          <div className="flex items-start justify-between gap-3 mb-2">
            <div>
              <div className="text-lg font-semibold">{chartTitle}</div>
              <div className="text-slate-400 text-xs -mt-0.5">{chartSubtitle}</div>
            </div>
            <TogglePSCR value={chartMode} onChange={setChartMode} />
          </div>

          <BarsGrouped
            labels={chart.labels}
            series={chart.series}
            money={chart.money}
          />
        </div>

        {/* -------------------- Expandable item cards (unchanged visuals) -------------------- */}
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

function TogglePSCR({ value, onChange }) {
  const leftActive = value === "PS";
  return (
    <div className="flex items-center gap-3">
      <div className="text-slate-400 text-xs text-right leading-none">
        {/* label under the switch */}
        <div className="hidden sm:block h-4" />
      </div>
      <div className="rounded-full bg-slate-900/60 border border-slate-800 p-1 inline-flex">
        <button
          onClick={() => onChange("PS")}
          className={`px-3 py-1.5 rounded-full text-sm ${
            leftActive ? "bg-indigo-600 text-white" : "text-slate-100 hover:bg-slate-800"
          }`}
        >
          Purchases / Sales
        </button>
        <button
          onClick={() => onChange("CR")}
          className={`px-3 py-1.5 rounded-full text-sm ${
            !leftActive ? "bg-indigo-600 text-white" : "text-slate-100 hover:bg-slate-800"
          }`}
        >
          Cost / Revenue
        </button>
      </div>
      <div className="text-slate-400 text-xs leading-none -mt-0.5">{leftActive ? "Purchases & Sales" : "Cost & Revenue"}</div>
    </div>
  );
}

/* --------------------- Responsive grouped bar chart --------------------- */
function useContainerSize() {
  const ref = useRef(null);
  const [w, setW] = useState(0);
  useEffect(() => {
    if (!ref.current) return;
    const ro = new ResizeObserver((entries) => {
      for (const e of entries) setW(e.contentRect.width);
    });
    ro.observe(ref.current);
    return () => ro.disconnect();
  }, []);
  return [ref, w];
}

function BarsGrouped({ labels = [], series = [], money = false }) {
  const [wrapRef, width] = useContainerSize();

  // nothing to show
  const allVals = series.flatMap((s) => s.values);
  if (!allVals.length || allVals.every((v) => !v)) {
    return <div ref={wrapRef} className="text-slate-400">No data in this view.</div>;
  }

  // responsive geometry
  const H = width < 520 ? 220 : 260;
  const M = { l: 56, r: 18, t: 12, b: 36 }; // generous left for y labels
  const W = Math.max(260, width); // minimum width safety
  const innerW = W - M.l - M.r;
  const innerH = H - M.t - M.b;

  const groups = labels.length;
  const yMaxRaw = Math.max(1, ...allVals);
  const yMax = roundNice(yMaxRaw * 1.5); // ~1.5× headroom
  const yTicks = 4;
  const tickEvery = Math.max(1, Math.ceil(labels.length / (width < 420 ? 4 : 8)));

  // bar sizing
  const groupW = innerW / Math.max(1, groups);
  const barGap = Math.min(10, Math.max(4, groupW * 0.2));
  const barW = Math.max(6, Math.min(22, (groupW - barGap) / 2));

  const scaleY = (v) => innerH - (v / yMax) * innerH;

  // legend stacked, dot on right
  return (
    <div ref={wrapRef} className="w-full">
      <div className="flex justify-end gap-3 mb-2">
        {series.map((s) => (
          <div key={s.name} className="flex items-center gap-2 text-slate-300 text-xs">
            <span>{s.name}</span>
            <span className="inline-block w-2.5 h-2.5 rounded-full" style={{ background: s.color }} />
          </div>
        ))}
      </div>

      <svg width="100%" height={H} viewBox={`0 0 ${W} ${H}`} className="rounded-xl border border-slate-800 bg-slate-900/40">
        {/* grid */}
        {[...Array(yTicks + 1)].map((_, i) => {
          const y = M.t + (innerH / yTicks) * i;
          const val = yMax - (yMax / yTicks) * i;
          return (
            <g key={i}>
              <line x1={M.l} x2={W - M.r} y1={y} y2={y} stroke="#1f2937" strokeWidth="1" />
              <text x={M.l - 6} y={y + 4} textAnchor="end" fontSize="10" fill="#9ca3af">
                {money ? `$${centsToStr(val * 100)}` : `${Math.round(val)}`}
              </text>
            </g>
          );
        })}

        {/* bars */}
        {labels.map((lab, idx) => {
          const x0 = M.l + groupW * idx + (groupW - (barW * 2 + barGap)) / 2;
          const [s0, s1] = series;
          const v0 = s0?.values[idx] ?? 0;
          const v1 = s1?.values[idx] ?? 0;
          const h0 = innerH - scaleY(v0);
          const h1 = innerH - scaleY(v1);

          return (
            <g key={idx}>
              {/* purchases/cost */}
              <rect x={x0} y={M.t + scaleY(v0)} width={barW} height={h0} rx="4" fill={s0.color} opacity="0.9" />
              {/* sales/revenue */}
              <rect x={x0 + barW + barGap} y={M.t + scaleY(v1)} width={barW} height={h1} rx="4" fill={s1.color} opacity="0.9" />
              {/* x labels (sparse) */}
              {idx % tickEvery === 0 && (
                <text x={M.l + groupW * idx + groupW / 2} y={H - 10} textAnchor="middle" fontSize="10" fill="#9ca3af">
                  {lab}
                </text>
              )}
            </g>
          );
        })}
      </svg>
    </div>
  );
}

function roundNice(n) {
  // rounds up to a "nice" number for axis (1,2,5 * 10^k)
  const p = Math.pow(10, Math.floor(Math.log10(n)));
  const d = n / p;
  const mult = d <= 1 ? 1 : d <= 2 ? 2 : d <= 5 ? 5 : 10;
  return mult * p;
}

/* ----------------------------- KPIs (inventory style) ----------------------------- */
function Kpi({ title, value, hint, tone }) {
  const toneClass =
    tone === "blue" ? "text-indigo-400" : "text-slate-100";
  return (
    <div className="rounded-2xl border border-slate-800 bg-slate-900/60 p-4">
      <div className="text-slate-400 text-sm">{title}</div>
      <div className={`text-xl font-semibold mt-1 ${toneClass}`}>{value}</div>
      {hint && <div className="text-slate-400 text-xs mt-1 truncate">{hint}</div>}
    </div>
  );
}

/* --------------------- Aggregate KPIs for the top card --------------------- */
function makeKpis(filtered, marketByName) {
  let onHand = 0, onHandCostC = 0, onHandMktC = 0, unrealizedC = 0;
  let longestHoldDays = 0, longestHoldName = "—";
  const byItem = new Map();

  const today = Date.now();

  for (const o of filtered) {
    const name = o.item || "—";
    if (!byItem.has(name)) byItem.set(name, {
      sold: 0, soldRevC: 0, soldCostC: 0, profitC: 0,
    });
    const row = byItem.get(name);

    const costC = cents(o.buy_price_cents);
    const sold = cents(o.sale_price_cents) > 0;
    if (sold) {
      const revC = cents(o.sale_price_cents);
      const feeC = Math.round(revC * (Number(o.fees_pct) || 0));
      const shipC = cents(o.shipping_cents);
      row.sold += 1;
      row.soldRevC += revC;
      row.soldCostC += costC;
      row.profitC += revC - feeC - shipC - costC;
    } else {
      onHand += 1;
      onHandCostC += costC;
      const mv = marketByName.get(name.toLowerCase()) || 0;
      onHandMktC += mv;
      const od = new Date(o.order_date).getTime();
      if (!isNaN(od)) {
        const days = Math.max(0, Math.round((today - od) / (24*3600*1000)));
        if (days > longestHoldDays) { longestHoldDays = days; longestHoldName = name; }
      }
    }
  }
  unrealizedC = onHandMktC - onHandCostC;

  // bests
  let bestSellerName = "—", bestSellerCount = 0;
  let bestMarginName = "—", bestMarginPct = NaN;
  let bestRoiName = "—", bestRoiPct = NaN;

  for (const [name, v] of byItem.entries()) {
    if (v.sold > bestSellerCount) { bestSellerCount = v.sold; bestSellerName = name; }
    const margin = v.soldRevC > 0 ? v.profitC / v.soldRevC : NaN;
    if ((Number.isFinite(margin) ? margin : -Infinity) > (Number.isFinite(bestMarginPct) ? bestMarginPct : -Infinity)) {
      bestMarginPct = margin; bestMarginName = name;
    }
    const roi = v.soldCostC > 0 ? v.profitC / v.soldCostC : NaN;
    if ((Number.isFinite(roi) ? roi : -Infinity) > (Number.isFinite(bestRoiPct) ? bestRoiPct : -Infinity)) {
      bestRoiPct = roi; bestRoiName = name;
    }
  }

  return {
    onHand, onHandCostC, onHandMktC, unrealizedC,
    longestHoldDays, longestHoldName,
    bestSellerName, bestSellerCount,
    bestMarginName, bestMarginPct,
    bestRoiName, bestRoiPct,
  };
}

/* -------------------------- per-item aggregation -------------------------- */
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
      row.unitMarketC = mv; // unit market value snapshot
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
    <div className="rounded-xl border border-slate-800 bg-slate-900/60 px-3 py-3">
      <div className="text-slate-400 text-xs">{title}</div>
      <div className={`text-base font-semibold mt-0.5 ${color}`}>{value}</div>
      {sub && <div className="text-[10px] leading-4 text-slate-400 mt-0.5">{sub}</div>}
    </div>
  );
}
