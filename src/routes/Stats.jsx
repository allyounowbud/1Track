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

  /* ------------------------------- CHART DATA ------------------------------- */
  const chartSeries = useMemo(() => {
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

  /* ------------------------------ CHART MODE ------------------------------ */
  const [chartMode, setChartMode] = useState("ps"); // ps = Purchases/Sales, cr = Cost/Revenue

  /* ------------------------- EXPANDABLE ITEM CARDS ------------------------ */
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
        <div className={`${card} relative z-[70]`}>
          <div className="flex items-center justify-between gap-3 mb-4">
            <h2 className="text-lg font-semibold">Filters</h2>
            <div className="text-slate-400 text-sm">{filtered.length} rows</div>
          </div>

          <div className="grid grid-cols-1 gap-4">
            {/* Date range as dropdown */}
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
              placeholder="Select range…"
            />

            {range === "custom" && (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <input type="date" value={fromStr} onChange={(e)=>setFromStr(e.target.value)} className={inputBase} placeholder="Start date" />
                <input type="date" value={toStr} onChange={(e)=>setToStr(e.target.value)} className={inputBase} placeholder="End date" />
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
            </div>
          </div>
        </div>

        {/* Chart */}
        <div className={`${card} mt-6`}>
          <div className="flex items-start justify-between gap-3 mb-3">
            <div>
              <div className="text-lg font-semibold">
                {chartMode === "ps" ? "Purchases & Sales" : "Cost & Revenue"}
              </div>
              <div className="text-slate-400 text-xs -mt-0.5">by month</div>
            </div>

            {/* segment control */}
            <div className="flex gap-2">
              <SegmentTab active={chartMode === "ps"} onClick={() => setChartMode("ps")} label={["Purchases","/","Sales"]} />
              <SegmentTab active={chartMode === "cr"} onClick={() => setChartMode("cr")} label={["Cost","/","Revenue"]} />
            </div>
          </div>

          <ResponsiveBarsDual
            labels={chartSeries.months}
            aName={chartMode === "ps" ? "Purchases" : "Cost"}
            bName={chartMode === "ps" ? "Sales" : "Revenue"}
            aValues={chartMode === "ps" ? chartSeries.purchasesCount : chartSeries.costC}
            bValues={chartMode === "ps" ? chartSeries.salesCount : chartSeries.revenueC}
            money={chartMode === "cr"}
            palette={chartMode === "ps"
              ? { base: "#6366f1", light: "#94a3ff" }   // muted indigo
              : { base: "#14b8a6", light: "#5eead4" }   // muted teal
            }
          />
        </div>

        {/* Item breakdown (LEAVE AS IS) */}
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
        <div className="absolute left-0 right-0 mt-2 z-[90] rounded-xl border border-slate-800 bg-slate-900/95 backdrop-blur shadow-xl">
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

function SegmentTab({ active, onClick, label }) {
  return (
    <button
      onClick={onClick}
      className={`px-4 py-2 rounded-full border transition ${
        active
          ? "bg-indigo-600 border-indigo-500 text-white"
          : "border-slate-800 bg-slate-900/60 hover:bg-slate-900 text-slate-100"
      }`}
    >
      {Array.isArray(label) ? label.join(" ") : label}
    </button>
  );
}

/* ------------------ Responsive dual-series bars (SVG) ------------------ */
function ResponsiveBarsDual({
  labels = [],
  aName = "A",
  bName = "B",
  aValues = [],
  bValues = [],
  money = false,
  palette = { base: "#6366f1", light: "#94a3ff" },
}) {
  const wrapRef = useRef(null);
  const [size, setSize] = useState({ w: 0 });

  useEffect(() => {
    if (!wrapRef.current) return;
    const ro = new ResizeObserver((entries) => {
      const cr = entries[0].contentRect;
      setSize({ w: Math.max(0, Math.round(cr.width)) });
    });
    ro.observe(wrapRef.current);
    return () => ro.disconnect();
  }, []);

  const w = Math.max(300, size.w);                      // ensure usable width
  const h = Math.max(220, Math.min(420, Math.round(w * 0.45))); // responsive height

  // inner plot padding
  const padL = 56, padR = 16, padT = 16, padB = 32;
  const pw = w - padL - padR;
  const ph = h - padT - padB;

  // limit to last 12 buckets; on tiny width skip every other label
  const MAX_BUCKETS = 12;
  const start = Math.max(0, labels.length - MAX_BUCKETS);
  const L = labels.slice(start);
  const A = aValues.slice(start);
  const B = bValues.slice(start);

  const maxV = Math.max(1, ...A, ...B);
  const yMaxTarget = maxV * 1.5; // requested 1.5x headroom
  const yMax = niceCeil(yMaxTarget);
  const ticks = 4; // 4 horizontal grid lines
  const step = yMax / ticks;

  // bar sizing
  const groups = L.length || 1;
  const groupW = pw / groups;
  const barW = Math.max(8, Math.min(26, Math.floor(groupW * 0.35)));
  const gap = (groupW - barW * 2) / 2;

  // label skip on very tight layouts
  const skipEvery = w < 420 ? 2 : 1;

  const yScale = (v) => ph - (v / yMax) * ph;

  return (
    <div ref={wrapRef} className="w-full">
      {(!A.length && !B.length) ? (
        <div className="text-slate-400">No data in this view.</div>
      ) : (
        <div className="relative w-full rounded-xl border border-slate-800 bg-slate-900/40 overflow-hidden">
          <svg width="100%" height={h} viewBox={`0 0 ${w} ${h}`} preserveAspectRatio="none">
            {/* grid lines + y labels */}
            {[...Array(ticks + 1)].map((_, i) => {
              const y = padT + (ph / ticks) * i;
              const val = yMax - step * i;
              return (
                <g key={i}>
                  <line x1={padL} y1={y} x2={w - padR} y2={y} stroke="#0f172a" strokeWidth="1" />
                  <text x={padL - 8} y={y + 3} textAnchor="end" fontSize="10" fill="#94a3b8">
                    {money ? `$${centsToStr(val)}` : `${val % 1 === 0 ? val.toFixed(0) : val.toFixed(1)}`}
                  </text>
                </g>
              );
            })}

            {/* bars */}
            {L.map((_, i) => {
              const gx = padL + groupW * i + gap;
              const aH = ph - yScale(A[i] || 0);
              const bH = ph - yScale(B[i] || 0);
              return (
                <g key={i}>
                  <rect x={gx} y={padT + yScale(A[i] || 0)} width={barW} height={aH} fill={palette.base} rx="4" />
                  <rect x={gx + barW + Math.max(2, gap/2)} y={padT + yScale(B[i] || 0)} width={barW} height={bH} fill={palette.light} rx="4" />
                </g>
              );
            })}

            {/* x labels */}
            {L.map((lab, i) => {
              if (skipEvery > 1 && i % skipEvery !== 0) return null;
              const x = padL + groupW * i + groupW / 2;
              return (
                <text key={lab + i} x={x} y={h - 10} textAnchor="middle" fontSize="10" fill="#94a3b8">
                  {lab}
                </text>
              );
            })}
          </svg>

          {/* legend (stacked, dot on the RIGHT of label) */}
          <div className="absolute right-3 top-3 text-xs text-slate-200">
            <div className="flex flex-col items-end gap-1">
              <div className="flex items-center gap-2">
                <span>{aName}</span>
                <span className="inline-block w-3 h-3 rounded-full" style={{ background: palette.base }} />
              </div>
              <div className="flex items-center gap-2">
                <span>{bName}</span>
                <span className="inline-block w-3 h-3 rounded-full" style={{ background: palette.light }} />
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// nice ceiling to a "round" number for axis
function niceCeil(v) {
  if (v <= 0) return 1;
  const pow = Math.pow(10, Math.floor(Math.log10(v)));
  const unit = pow / 2; // finer rounding than pure pow
  return Math.ceil(v / unit) * unit;
}

/* -------- per-item aggregation for expandable cards (unchanged) -------- */
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
