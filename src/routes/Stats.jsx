import { useEffect, useMemo, useState, useRef } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "../lib/supabaseClient";
import HeaderWithTabs from "../components/HeaderWithTabs.jsx";

/* ----------------------------- UI tokens ----------------------------- */
const card =
  "rounded-2xl border border-slate-800 bg-slate-900/60 backdrop-blur p-4 sm:p-6 shadow-[0_10px_30px_rgba(0,0,0,.35)]";
const inputBase =
  "w-full min-w-0 appearance-none bg-slate-900/60 border border-slate-800 rounded-xl px-4 py-3 text-slate-100 placeholder-slate-400 focus:ring-2 focus:ring-indigo-500";
const pill =
  "rounded-xl border border-slate-800 bg-slate-900/60 p-4";
const rowCard =
  "rounded-2xl border border-slate-800 bg-slate-900/60 px-4 py-4 sm:px-5 sm:py-5";

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

  /* user (avatar/name) for header */
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
  const [range, setRange] = useState("all"); // all | month | 30 | custom
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

  // snapshot of applied filters
  const [applied, setApplied] = useState({ range: "all", from: null, to: null, item: "" });

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

  /* ------------------------------- KPIs ------------------------------- */
  const kpis = useMemo(() => {
    const purchases = filtered.filter(o => within(o.order_date, fromMs, toMs) || (!fromMs && !toMs));
    const sales = filtered.filter(o => cents(o.sale_price_cents) > 0 && (within(o.sale_date, fromMs, toMs) || (!fromMs && !toMs)));
    const unsold = filtered.filter(o => cents(o.sale_price_cents) <= 0);

    const spentC = purchases.reduce((a,o)=>a+cents(o.buy_price_cents),0);
    const revenueC = sales.reduce((a,o)=>a+cents(o.sale_price_cents),0);
    const feesC = sales.reduce((a,o)=>a+Math.round(cents(o.sale_price_cents)*(Number(o.fees_pct)||0)),0);
    const shipOutC = sales.reduce((a,o)=>a+cents(o.shipping_cents),0);
    const cogsC = sales.reduce((a,o)=>a+cents(o.buy_price_cents),0);

    const realizedPlC = revenueC - feesC - shipOutC - cogsC;
    const netAfterFeeShipC = revenueC - feesC - shipOutC;

    const onHandCount = unsold.length;
    const onHandCostC = unsold.reduce((a,o)=>a+cents(o.buy_price_cents),0);
    const onHandMarketC = unsold.reduce((a,o)=>a+(marketByName.get((o.item||"").toLowerCase())||0),0);
    const unrealizedPlC = onHandMarketC - onHandCostC;

    return {
      purchasesCount: purchases.length,
      salesCount: sales.length,
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
      asp: sales.length ? revenueC / sales.length : 0,
      avgFeeRate: revenueC > 0 ? feesC / revenueC : NaN,
    };
  }, [filtered, fromMs, toMs, marketByName]);

  /* ------------------------------- CHART DATA ------------------------------- */
  const chartSeries = useMemo(() => {
    const purchases = filtered.filter(o => within(o.order_date, fromMs, toMs) || (!fromMs && !toMs));
    const sales = filtered.filter(o => cents(o.sale_price_cents) > 0 && (within(o.sale_date, fromMs, toMs) || (!fromMs && !toMs)));

    const mset = new Set();
    for (const o of purchases) { const k = monthKey(o.order_date); if (k) mset.add(k); }
    for (const o of sales) { const k = monthKey(o.sale_date); if (k) mset.add(k); }
    const months = [...mset].sort((a,b)=>a.localeCompare(b));

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

  /* -------------------------------- render -------------------------------- */
  const [chartKind, setChartKind] = useState("purchases"); // purchases | sales | cost | revenue
  const chartMap = {
    purchases: { title: "Purchases by month", labels: chartSeries.months, values: chartSeries.purchasesCount, money: false },
    sales:     { title: "Sales by month",     labels: chartSeries.months, values: chartSeries.salesCount,     money: false },
    cost:      { title: "Cost (buy) by month",labels: chartSeries.months, values: chartSeries.costC,          money: true  },
    revenue:   { title: "Revenue by month",   labels: chartSeries.months, values: chartSeries.revenueC,       money: true  },
  };
  const currentChart = chartMap[chartKind];

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

        {/* Filters */}
        <div className={`${card} relative z-[60]`}>
          <h2 className="text-lg font-semibold mb-4">Date Range</h2>
          <div className="grid grid-cols-1 gap-4 min-w-0">
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
                <input type="date" value={fromStr} onChange={(e)=>setFromStr(e.target.value)} className={inputBase} />
                <input type="date" value={toStr} onChange={(e)=>setToStr(e.target.value)} className={inputBase} />
              </div>
            )}

            {/* Item filter combobox */}
            <div ref={comboRef} className="relative isolate">
              <label className="sr-only">Item filter</label>
              <input
                value={itemInput}
                onChange={(e) => { setItemInput(e.target.value); setItemOpen(true); }}
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

            <div className="flex items-center gap-4">
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
              <div className="text-slate-400 text-sm">
                {filtered.length ? "" : "Stats unavailable."}
              </div>
            </div>
          </div>
        </div>

        {/* KPI wrapper like Inventory: two columns on mobile */}
        <div className={`${card} mt-6`}>
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
            <KpiPill title="Bought" value={`${kpis.purchasesCount} items`} sub={`Spend $${centsToStr(kpis.spentC)}`} />
            <KpiPill title="Sold" value={`${kpis.salesCount} items`} sub={`Revenue $${centsToStr(kpis.revenueC)}`} />
            <KpiPill title="Inventory" value={`${kpis.onHandCount} on hand`} sub={`Cost $${centsToStr(kpis.onHandCostC)}`} />
            <KpiPill title="Est. Value" value={`$${centsToStr(kpis.onHandMarketC)}`} sub="on-hand market" tone="unrealized" />
          </div>
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4 mt-4">
            <KpiPill
              title="Realized P/L"
              value={`$${centsToStr(kpis.realizedPlC)}`}
              sub={`Net after fees/ship $${centsToStr(kpis.netAfterFeeShipC)}`}
              tone={kpis.realizedPlC > 0 ? "realized-pos" : kpis.realizedPlC < 0 ? "realized-neg" : "neutral"}
            />
            <KpiPill title="Fees" value={`$${centsToStr(kpis.feesC)}`} sub={`Avg Fee ${pctStr(kpis.avgFeeRate)}`} tone="cost" />
            <KpiPill title="Shipping" value={`$${centsToStr(kpis.shipOutC)}`} tone="cost" />
            <KpiPill title="ASP" value={`$${centsToStr(kpis.asp)}`} />
          </div>
        </div>

        {/* Charts - visible bars now */}
        <div className={`${card} mt-6`}>
          <div className="flex flex-wrap items-center justify-between gap-3 mb-3">
            <div className="text-lg font-semibold">{currentChart.title}</div>
            <div className="flex gap-2">
              <ChartTab value="purchases" label="Purchases" cur={chartKind} setCur={setChartKind} />
              <ChartTab value="sales" label="Sales" cur={chartKind} setCur={setChartKind} />
              <ChartTab value="cost" label="Cost" cur={chartKind} setCur={setChartKind} />
              <ChartTab value="revenue" label="Revenue" cur={chartKind} setCur={setChartKind} />
            </div>
          </div>
          <BarsVertical
            labels={currentChart.labels}
            values={currentChart.values}
            money={currentChart.money}
            emptyLabel="No data in this view."
          />
        </div>

        {/* Item breakdown as expandable cards */}
        <div className="mt-6 space-y-4">
          {itemGroups.map((g) => {
            const open = openSet.has(g.item);
            return (
              <div key={g.item} className={rowCard}>
                {/* header */}
                <div className="flex items-center justify-between gap-3">
                  <div className="min-w-0">
                    <div className="text-lg font-semibold truncate">{g.item}</div>
                  </div>
                  <button onClick={() => toggleItem(g.item)} className="px-5 py-2 rounded-xl border border-slate-800 bg-slate-900/60 hover:bg-slate-900">
                    {open ? "Collapse" : "Expand"}
                  </button>
                </div>

                {/* body */}
                {open && (
                  <div className="mt-4 space-y-4">
                    {/* pills in your specified order */}
                    <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                      <MiniPill title="Bought" value={`${g.bought}`} />
                      <MiniPill title="Sold" value={`${g.sold}`} />
                      <MiniPill title="On Hand" value={`${g.onHand}`} />
                      <MiniPill title="Total Cost" value={`$${centsToStr(g.totalCostC)}`} tone="cost" />
                      <MiniPill title="Total Revenue" value={`$${centsToStr(g.revenueC)}`} />
                      <MiniPill title="Fees" value={`$${centsToStr(g.feesC)}`} tone="cost" />
                      <MiniPill title="Shipping" value={`$${centsToStr(g.shipC)}`} tone="cost" />
                      <MiniPill
                        title="Realized P/L"
                        value={`$${centsToStr(g.realizedPlC)}`}
                        tone={g.realizedPlC > 0 ? "realized-pos" : g.realizedPlC < 0 ? "realized-neg" : "neutral"}
                      />
                      <MiniPill title="Market Price" value={`$${centsToStr(g.unitMarketC)}`} />
                      <MiniPill title="Est. Value" value={`$${centsToStr(g.onHandMarketC)}`} tone="unrealized" />
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
        <div className="absolute left-0 right-0 mt-2 z-50 rounded-xl border border-slate-800 bg-slate-900/95 backdrop-blur shadow-xl">
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

function KpiPill({ title, value, sub, tone = "neutral" }) {
  let valueClass = "text-slate-100";
  if (tone === "unrealized") valueClass = "text-indigo-400";
  if (tone === "realized-pos") valueClass = "text-emerald-400";
  if (tone === "realized-neg") valueClass = "text-rose-400";
  if (tone === "cost") valueClass = "text-rose-400";

  return (
    <div className={pill}>
      <div className="text-slate-400 text-sm">{title}</div>
      <div className={`text-xl font-semibold mt-1 ${valueClass}`}>{value}</div>
      {sub && <div className="text-slate-400 text-sm mt-0.5">{sub}</div>}
    </div>
  );
}

function MiniPill({ title, value, tone = "neutral" }) {
  let cls = "text-slate-100";
  if (tone === "cost") cls = "text-rose-400";
  if (tone === "unrealized") cls = "text-indigo-400";
  if (tone === "realized-pos") cls = "text-emerald-400";
  if (tone === "realized-neg") cls = "text-rose-400";
  return (
    <div className="rounded-xl border border-slate-800 bg-slate-900/60 px-3 py-3">
      <div className="text-slate-400 text-xs">{title}</div>
      <div className={`text-base font-semibold mt-0.5 ${cls}`}>{value}</div>
    </div>
  );
}

function ChartTab({ value, label, cur, setCur }) {
  const active = cur === value;
  return (
    <button
      onClick={() => setCur(value)}
      className={`px-3 py-1.5 rounded-full border ${active ? "bg-indigo-600 border-indigo-500 text-white" : "border-slate-800 bg-slate-900/60 hover:bg-slate-900 text-slate-100"}`}
    >
      {label}
    </button>
  );
}

/* Visible vertical bar chart */
function BarsVertical({ labels = [], values = [], money = false, emptyLabel = "No data." }) {
  if (!values.length || values.every(v => !v)) return <div className="text-slate-400">{emptyLabel}</div>;

  // limit to last 12 buckets for readability on mobile
  const start = Math.max(0, values.length - 12);
  const L = labels.slice(start);
  const V = values.slice(start);
  const max = Math.max(1, ...V.map((v) => Math.abs(v)));

  return (
    <div className="w-full">
      <div className="relative h-48">
        {/* faint grid */}
        <div className="absolute inset-0">
          <div className="absolute left-0 right-0 top-1/4 border-t border-slate-800/70" />
          <div className="absolute left-0 right-0 top-1/2 border-t border-slate-800/70" />
          <div className="absolute left-0 right-0 top-3/4 border-t border-slate-800/70" />
        </div>

        <div className="absolute inset-x-0 bottom-0 flex items-end" style={{ gap: "10px" }}>
          {V.map((v, i) => {
            const hPct = (Math.abs(v) / max) * 100;
            return (
              <div key={i} className="flex-1 min-w-[16px] flex flex-col items-center">
                <div className="w-full rounded-t bg-indigo-500" style={{ height: `${hPct}%` }} />
                <div className="mt-1 text-[10px] text-slate-300">
                  {money ? `$${centsToStr(v)}` : v}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* bottom labels */}
      <div className="mt-2 grid grid-cols-6 gap-2 text-[10px] text-slate-400">
        {L.map((l, i) => (
          <div key={i} className="truncate">{l}</div>
        ))}
      </div>
    </div>
  );
}

/* -------- per-item aggregation for expandable cards -------- */
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
    } else {
      row.onHand += 1;
      const mv = marketByName.get((o.item || "").toLowerCase()) || 0;
      row.onHandMarketC += mv;
      row.unitMarketC = mv; // unit market price from items table
    }
  }
  const out = [...m.values()];
  // order by revenue then on-hand market
  out.sort((a, b) => (b.revenueC - a.revenueC) || (b.onHandMarketC - a.onHandMarketC));
  return out.slice(0, 400);
}
