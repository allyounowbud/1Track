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

  // user (header)
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
  // quick range: all | month | 30 | year | custom
  const [range, setRange] = useState("all");
  const [fromStr, setFromStr] = useState("");
  const [toStr, setToStr] = useState("");

  // searchable item combobox
  const [itemOpen, setItemOpen] = useState(false);
  const [itemInput, setItemInput] = useState("All Items");
  const [itemIsExact, setItemIsExact] = useState(false); // exact match when chosen from list
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

  // applied snapshot (drives everything)
  const [applied, setApplied] = useState({
    range: "all",
    from: null,
    to: null,
    item: "",
    itemIsExact: false,
  });

  const { fromMs, toMs } = useMemo(() => {
    if (applied.range === "custom") {
      const f = applied.from ? new Date(applied.from).setHours(0, 0, 0, 0) : null;
      const t = applied.to ? new Date(applied.to).setHours(23, 59, 59, 999) : null;
      return { fromMs: f, toMs: t };
    }
    if (applied.range === "month") {
      const now = new Date();
      const f = new Date(now.getFullYear(), now.getMonth(), 1).getTime();
      const t = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59, 999).getTime();
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
      const t = new Date(now.getFullYear(), 11, 31, 23, 59, 59, 999).getTime();
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
    const q = (applied.item || "").toLowerCase();
    const exact = applied.itemIsExact && q;
    return orders.filter((o) => {
      const name = (o.item || "").toLowerCase();
      const matchesItem = !q || (exact ? name === q : name.includes(q));
      const anyInWindow =
        within(o.order_date, fromMs, toMs) ||
        within(o.sale_date, fromMs, toMs) ||
        (!fromMs && !toMs);
      return matchesItem && anyInWindow;
    });
  }, [orders, applied, fromMs, toMs]);

  /* ------------------------------- CHART DATA ------------------------------- */
  const chartSeries = useMemo(() => {
    const purchases = filtered.filter(
      (o) => within(o.order_date, fromMs, toMs) || (!fromMs && !toMs)
    );
    const sales = filtered.filter(
      (o) => cents(o.sale_price_cents) > 0 && (within(o.sale_date, fromMs, toMs) || (!fromMs && !toMs))
    );

    const months = Array.from(
      new Set([
        ...purchases.map((o) => monthKey(o.order_date)).filter(Boolean),
        ...sales.map((o) => monthKey(o.sale_date)).filter(Boolean),
      ])
    ).sort((a, b) => a.localeCompare(b));

    const purCnt = new Map(),
      salCnt = new Map(),
      cost = new Map(),
      revenue = new Map();
    for (const m of months) {
      purCnt.set(m, 0);
      salCnt.set(m, 0);
      cost.set(m, 0);
      revenue.set(m, 0);
    }
    for (const o of purchases) {
      const k = monthKey(o.order_date);
      if (!k) continue;
      purCnt.set(k, purCnt.get(k) + 1);
      cost.set(k, cost.get(k) + cents(o.buy_price_cents));
    }
    for (const o of sales) {
      const k = monthKey(o.sale_date);
      if (!k) continue;
      salCnt.set(k, salCnt.get(k) + 1);
      revenue.set(k, revenue.get(k) + cents(o.sale_price_cents));
    }

    return {
      months,
      purchasesCount: months.map((m) => purCnt.get(m) || 0),
      salesCount: months.map((m) => salCnt.get(m) || 0),
      costC: months.map((m) => cost.get(m) || 0),
      revenueC: months.map((m) => revenue.get(m) || 0),
    };
  }, [filtered, fromMs, toMs]);

  /* -------------------------------- render -------------------------------- */
  const [chartKind, setChartKind] = useState("purchases"); // purchases | sales | cost | revenue
  const chartMap = {
    purchases: {
      title: "Purchases by month",
      labels: chartSeries.months,
      values: chartSeries.purchasesCount,
      money: false,
      accent: "bg-indigo-500",
    },
    sales: {
      title: "Sales by month",
      labels: chartSeries.months,
      values: chartSeries.salesCount,
      money: false,
      accent: "bg-emerald-500",
    },
    cost: {
      title: "Cost by month",
      labels: chartSeries.months,
      values: chartSeries.costC,
      money: true,
      accent: "bg-rose-500",
    },
    revenue: {
      title: "Revenue by month",
      labels: chartSeries.months,
      values: chartSeries.revenueC,
      money: true,
      accent: "bg-sky-500",
    },
  };
  const currentChart = chartMap[chartKind];

  const itemGroups = useMemo(
    () => makeItemGroups(filtered, marketByName),
    [filtered, marketByName]
  );

  const [openSet, setOpenSet] = useState(() => new Set());
  const toggleItem = (key) =>
    setOpenSet((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100">
      <div className="max-w-6xl mx-auto p-4 sm:p-6">
        <HeaderWithTabs active="stats" showTabs />

        {/* ----------------------- Filters (new look) ----------------------- */}
        <div className={`${card} relative`}>
          <div className="flex items-center justify-between flex-wrap gap-3">
            <h2 className="text-lg font-semibold">Filters</h2>
            <div className="text-slate-400 text-sm">
              {filtered.length ? `${filtered.length} rows` : "No rows"}
            </div>
          </div>

          {/* Quick range pills */}
          <div className="mt-3 flex flex-wrap gap-2">
            {[
              ["all", "All time"],
              ["month", "This month"],
              ["30", "Last 30 days"],
              ["year", "This year"],
              ["custom", "Custom…"],
            ].map(([val, label]) => (
              <button
                key={val}
                onClick={() => setRange(val)}
                className={`px-3 py-1.5 rounded-full border ${
                  range === val
                    ? "bg-indigo-600 border-indigo-500 text-white"
                    : "border-slate-800 bg-slate-900/60 hover:bg-slate-900 text-slate-100"
                }`}
              >
                {label}
              </button>
            ))}
          </div>

          {/* Dates + Item */}
          <div className="mt-4 grid grid-cols-1 sm:grid-cols-2 gap-4">
            {range === "custom" ? (
              <>
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
              </>
            ) : (
              <>
                <div className="opacity-60 pointer-events-none select-none">
                  <input className={inputBase} placeholder="Start date" disabled />
                </div>
                <div className="opacity-60 pointer-events-none select-none">
                  <input className={inputBase} placeholder="End date" disabled />
                </div>
              </>
            )}

            {/* Item combobox */}
            <div ref={comboRef} className="sm:col-span-2 relative isolate">
              <label className="sr-only">Item filter</label>
              <input
                value={itemInput}
                onChange={(e) => {
                  setItemInput(e.target.value);
                  setItemIsExact(false);
                  setItemOpen(true);
                }}
                onFocus={() => setItemOpen(true)}
                placeholder="Search item (type to filter, then pick to apply exactly)…"
                className={inputBase}
              />
              <button
                type="button"
                onClick={() => {
                  setItemInput("All Items");
                  setItemIsExact(false);
                }}
                className="absolute right-10 top-1/2 -translate-y-1/2 text-slate-400"
                aria-label="Clear item"
                title="Clear item"
              >
                ×
              </button>
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
                        setItemIsExact(name !== "All Items");
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
          </div>

          {/* Apply / Reset */}
          <div className="mt-4 flex items-center gap-3">
            <button
              onClick={() =>
                setApplied({
                  range,
                  from: range === "custom" ? fromStr || null : null,
                  to: range === "custom" ? toStr || null : null,
                  item:
                    itemInput && itemInput.toLowerCase() !== "all items"
                      ? itemInput.trim()
                      : "",
                  itemIsExact: itemIsExact && itemInput.toLowerCase() !== "all items",
                })
              }
              className="px-6 py-3 rounded-2xl bg-indigo-600 hover:bg-indigo-500 text-white"
            >
              Apply
            </button>
            <button
              onClick={() => {
                setRange("all");
                setFromStr("");
                setToStr("");
                setItemInput("All Items");
                setItemIsExact(false);
                setApplied({ range: "all", from: null, to: null, item: "", itemIsExact: false });
              }}
              className="px-4 py-3 rounded-2xl border border-slate-800 bg-slate-900/60 hover:bg-slate-900 text-slate-100"
            >
              Reset
            </button>
          </div>
        </div>

        {/* --------------------------- Charts panel --------------------------- */}
        <div className={`${card} mt-6`}>
          <div className="flex flex-wrap items-center justify-between gap-3 mb-3">
            <div className="text-lg font-semibold">{currentChart.title}</div>
            <div className="flex gap-2">
              {Object.entries({
                purchases: "Purchases",
                sales: "Sales",
                cost: "Cost",
                revenue: "Revenue",
              }).map(([val, label]) => (
                <button
                  key={val}
                  onClick={() => setChartKind(val)}
                  className={`px-3 py-1.5 rounded-full border ${
                    chartKind === val
                      ? "bg-indigo-600 border-indigo-500 text-white"
                      : "border-slate-800 bg-slate-900/60 hover:bg-slate-900 text-slate-100"
                  }`}
                >
                  {label}
                </button>
              ))}
            </div>
          </div>

          <BarsVertical
            labels={currentChart.labels}
            values={currentChart.values}
            money={currentChart.money}
            accentClass={currentChart.accent}
            emptyLabel="No data in this view."
          />
        </div>

        {/* --------------------- Expandable item cards (unchanged) --------------------- */}
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

                {/* body */}
                {open && (
                  <div className="mt-4 space-y-4">
                    {/* your pills grid kept intact */}
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
function BarsVertical({ labels = [], values = [], money = false, accentClass = "bg-indigo-500", emptyLabel = "No data." }) {
  if (!values.length || values.every((v) => !v)) {
    return <div className="text-slate-400">{emptyLabel}</div>;
  }

  // last 12 buckets max
  const start = Math.max(0, values.length - 12);
  const L = labels.slice(start);
  const V = values.slice(start);
  const max = Math.max(1, ...V.map((v) => Math.abs(v)));
  const H = 200; // px

  return (
    <div className="w-full">
      <div className="relative w-full h-[240px] rounded-xl border border-slate-800 bg-slate-900/40 overflow-hidden">
        {/* gridlines */}
        <div className="absolute inset-0">
          {[0.25, 0.5, 0.75].map((p) => (
            <div key={p} className="absolute left-0 right-0" style={{ top: `${p * 100}%` }}>
              <div className="h-px bg-slate-800/80" />
            </div>
          ))}
        </div>

        {/* bars */}
        <div className="absolute inset-x-0 bottom-10 px-3 sm:px-4 flex items-end gap-4 sm:gap-6">
          {V.map((v, i) => {
            const hpx = Math.max(2, Math.round((Math.abs(v) / max) * H)); // min height 2 for visibility
            return (
              <div key={i} className="flex-1 min-w-[18px] flex flex-col items-center justify-end">
                <div
                  className={`w-4 sm:w-6 rounded-t ${accentClass}`}
                  style={{ height: `${hpx}px`, transition: "height .25s ease" }}
                  aria-hidden
                />
                <div className="mt-1 text-[10px] text-slate-200">
                  {money ? `$${centsToStr(v)}` : v}
                </div>
              </div>
            );
          })}
        </div>

        {/* baseline */}
        <div className="absolute left-0 right-0 bottom-9 h-px bg-slate-800" />
      </div>

      {/* month labels */}
      <div className="mt-2 grid grid-cols-6 gap-2 text-[10px] text-slate-400">
        {L.map((l, i) => (
          <div key={i} className="truncate">{l}</div>
        ))}
      </div>
    </div>
  );
}

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
