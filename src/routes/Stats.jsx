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

/* ----------------------------- window size hook ----------------------------- */
function useMonthsToShow() {
  const [n, setN] = useState(() => {
    const w = typeof window !== "undefined" ? window.innerWidth : 1280;
    if (w < 640) return 6;     // mobile
    if (w < 1024) return 9;    // tablet/sm desktop
    return 12;                 // desktop
  });
  useEffect(() => {
    function onResize() {
      const w = window.innerWidth;
      setN(w < 640 ? 6 : w < 1024 ? 9 : 12);
    }
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, []);
  return n;
}

/* --------------------------------- page --------------------------------- */
export default function Stats() {
  const { data: orders = [] } = useQuery({ queryKey: ["orders"], queryFn: getOrders });
  const { data: items = [] } = useQuery({ queryKey: ["items"], queryFn: getItems });

  // header user (unchanged)
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
  const monthsToShow = useMonthsToShow();
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

    // Trim to last N buckets for current screen width
    const takeLast = (arr) => arr.slice(Math.max(0, arr.length - monthsToShow));
    const M = takeLast(months);
    return {
      months: M,
      purchasesCount: takeLast(M.map(m => purCnt.get(m)||0)),
      salesCount:     takeLast(M.map(m => salCnt.get(m)||0)),
      costC:          takeLast(M.map(m => cost.get(m)||0)),
      revenueC:       takeLast(M.map(m => revenue.get(m)||0)),
    };
  }, [filtered, fromMs, toMs, monthsToShow]);

  /* ------------------------- item groups for cards ------------------------- */
  const itemGroups = useMemo(() => makeItemGroups(filtered, marketByName), [filtered, marketByName]);

  // If a specific item is selected, only show that card
  const shownGroups = useMemo(() => {
    if (!applied.item) return itemGroups;
    const target = applied.item.toLowerCase();
    return itemGroups.filter((g) => g.item.toLowerCase() === target);
  }, [itemGroups, applied.item]);

  const [openSet, setOpenSet] = useState(() => new Set());
  const toggleItem = (key) => {
    setOpenSet((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  };

  /* which combined chart is visible */
  const [chartTab, setChartTab] = useState("units"); // 'units' | 'money'

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100">
      <div className="max-w-6xl mx-auto p-4 sm:p-6">
        <HeaderWithTabs active="stats" showTabs />

        {/* ------------------------- Filters (top) ------------------------- */}
        <div className={`${card} relative z-[120]`}>
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-semibold">Filters</h2>
            <div className="text-slate-400 text-sm">{filtered.length} rows</div>
          </div>

          {/* quick range chips */}
          <div className="mt-4 flex flex-wrap gap-2">
            {[
              ["all","All time"],
              ["month","This month"],
              ["30","Last 30 days"],
              ["year","This year"],
              ["custom","Custom…"],
            ].map(([v, label]) => (
              <button
                key={v}
                onClick={() => setRange(v)}
                className={`px-4 py-2 rounded-full border transition
                  ${range===v ? "bg-indigo-600 border-indigo-500 text-white" : "border-slate-800 bg-slate-900/60 hover:bg-slate-900 text-slate-100"}`}
              >
                {label}
              </button>
            ))}
          </div>

          {/* custom dates */}
          {range === "custom" && (
            <div className="mt-4 grid grid-cols-1 sm:grid-cols-2 gap-4">
              <input type="date" value={fromStr} onChange={(e)=>setFromStr(e.target.value)} className={inputBase} placeholder="Start date"/>
              <input type="date" value={toStr} onChange={(e)=>setToStr(e.target.value)} className={inputBase} placeholder="End date"/>
            </div>
          )}

          {/* item dropdown */}
          <div ref={comboRef} className="relative isolate mt-4">
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
              aria-label="Toggle items">
              ▾
            </button>

            {itemOpen && (
              <div className="absolute z-[200] left-0 right-0 mt-2 max-h-60 overflow-auto rounded-xl border border-slate-800 bg-slate-900 shadow-xl">
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

          {/* apply */}
          <div className="mt-4 flex items-center gap-3">
            <button
              onClick={() =>
                setApplied({
                  range,
                  from: range === "custom" ? fromStr || null : null,
                  to:   range === "custom" ? toStr   || null : null,
                  item: normalizeItemFilter(itemInput),
                })
              }
              className="px-6 py-3 rounded-2xl bg-indigo-600 hover:bg-indigo-500 text-white">
              Apply
            </button>
            <button
              onClick={() => {
                setRange("all"); setFromStr(""); setToStr("");
                setItemInput("All Items"); setApplied({range:"all",from:null,to:null,item:""});
              }}
              className="px-4 py-3 rounded-2xl border border-slate-800 bg-slate-900/60 hover:bg-slate-900">
              Reset
            </button>
          </div>
        </div>

        {/* --------------------- Single chart with tabs --------------------- */}
        <div className={`${card} mt-6 relative z-[0]`}>
          <div className="flex items-start justify-between gap-4">
            <div>
              <div className="text-lg font-semibold">
                {chartTab === "units" ? "Purchases & Sales" : "Cost & Revenue"}
              </div>
              <div className="text-xs text-slate-400">by month</div>
            </div>

            <div className="flex gap-2">
              <ChartChip active={chartTab==="units"} onClick={()=>setChartTab("units")}>Units</ChartChip>
              <ChartChip active={chartTab==="money"} onClick={()=>setChartTab("money")}>Money</ChartChip>
            </div>
          </div>

          <div className="mt-4">
            {chartTab === "units" ? (
              <>
                <LegendStack className="mb-2">
                  <LegendDot className="bg-indigo-400" label="Purchases" />
                  <LegendDot className="bg-indigo-300" label="Sales" />
                </LegendStack>
                <GroupedBarsNoScroll
                  labels={chartSeries.months}
                  aValues={chartSeries.purchasesCount}
                  bValues={chartSeries.salesCount}
                  aColor="bg-indigo-400"
                  bColor="bg-indigo-300"
                  valueFmt={(v) => v}
                  money={false}
                />
              </>
            ) : (
              <>
                <LegendStack className="mb-2">
                  <LegendDot className="bg-teal-400" label="Cost" />
                  <LegendDot className="bg-teal-300" label="Revenue" />
                </LegendStack>
                <GroupedBarsNoScroll
                  labels={chartSeries.months}
                  aValues={chartSeries.costC}
                  bValues={chartSeries.revenueC}
                  aColor="bg-teal-400"
                  bColor="bg-teal-300"
                  valueFmt={(v) => `$${centsToStr(v)}`}
                  money
                />
              </>
            )}
          </div>
        </div>

        {/* ------------------ Item breakdown as cards ------------------ */}
        <div className="mt-6 space-y-4">
          {shownGroups.map((g) => {
            const open = openSet.has(g.item);
            return (
              <div key={g.item} className={rowCard}>
                {/* header (unchanged) */}
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
                      // X icon
                      <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M18 6L6 18M6 6l12 12" />
                      </svg>
                    ) : (
                      // chevron-down
                      <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <path d="m6 9 6 6 6-6" />
                      </svg>
                    )}
                  </button>
                </div>

                {/* body (keep exactly as you liked) */}
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
          {shownGroups.length === 0 && (
            <div className={`${card} text-slate-400`}>No items in this view.</div>
          )}
        </div>
      </div>
    </div>
  );
}

/* --------------------------- small components --------------------------- */

function ChartChip({ active, onClick, children }) {
  return (
    <button
      onClick={onClick}
      className={`px-3 py-1.5 rounded-full border ${
        active
          ? "bg-indigo-600 border-indigo-500 text-white"
          : "border-slate-800 bg-slate-900/60 hover:bg-slate-900 text-slate-100"
      }`}
    >
      {children}
    </button>
  );
}

function LegendStack({ children, className = "" }) {
  return <div className={`flex flex-col items-end gap-1 ${className}`}>{children}</div>;
}
function LegendDot({ className = "", label }) {
  return (
    <div className="flex items-center gap-2">
      <span className={`inline-block w-3 h-3 rounded ${className}`} />
      <span className="text-xs text-slate-300">{label}</span>
    </div>
  );
}

/* -------- No-scroll grouped bar chart with left Y axis ---------- */
function GroupedBarsNoScroll({
  labels = [],
  aValues = [],
  bValues = [],
  aColor = "bg-indigo-400",
  bColor = "bg-indigo-300",
  valueFmt = (v) => v,
  money = false,
}) {
  const N = labels.length;
  const hasData =
    N > 0 && (aValues.some((v) => v) || bValues.some((v) => v));
  if (!hasData) return <div className="text-slate-400">No data in this view.</div>;

  const max = Math.max(
    1,
    ...aValues.map((v) => Math.abs(v)),
    ...bValues.map((v) => Math.abs(v))
  );

  // Y ticks: 0, 25%, 50%, 75%, 100%
  const ticks = [0, 0.25, 0.5, 0.75, 1].map((p) => p * max);
  const fmt = money ? (v) => `$${centsToStr(v)}` : (v) => `${Math.round(v)}`;

  return (
    <div className="w-full">
      <div className="grid grid-cols-[60px_1fr] gap-2 items-stretch rounded-xl border border-slate-800 bg-slate-900/40 p-3">
        {/* y-axis */}
        <div className="relative">
          <div className="flex flex-col justify-between h-[240px]">
            {ticks.map((t, i) => (
              <div key={i} className="text-[11px] text-slate-400 tabular-nums">
                {fmt(t)}
              </div>
            ))}
          </div>
        </div>

        {/* plot area */}
        <div className="relative h-[240px]">
          {/* grid lines */}
          <div className="absolute inset-0 pointer-events-none">
            <div className="flex flex-col justify-between h-full">
              {ticks.map((_, i) => (
                <div key={i} className={`h-px w-full ${i===ticks.length-1 ? "opacity-0" : ""} bg-slate-800`} />
              ))}
            </div>
          </div>

          {/* bars */}
          <div className="absolute inset-0 flex items-end gap-3">
            {labels.map((_, i) => {
              const a = aValues[i] || 0;
              const b = bValues[i] || 0;
              const hA = (Math.abs(a) / max) * 100;
              const hB = (Math.abs(b) / max) * 100;
              return (
                <div key={i} className="flex-1 min-w-0 flex items-end justify-center gap-1">
                  <div className={`w-3 sm:w-4 rounded-t ${aColor}`} style={{ height: `${hA}%` }} />
                  <div className={`w-3 sm:w-4 rounded-t ${bColor}`} style={{ height: `${hB}%` }} />
                </div>
              );
            })}
          </div>

          {/* x-axis labels */}
          <div className="absolute left-0 right-0 bottom-[-18px]">
            <div className="flex justify-between text-[11px] text-slate-400">
              {labels.map((l, i) => (
                <div key={i} className="flex-1 text-center truncate">{l}</div>
              ))}
            </div>
          </div>
        </div>
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

  // order: revenue then on-hand market
  out.sort((a, b) => (b.revenueC - a.revenueC) || (b.onHandMarketC - a.onHandMarketC));
  return out.slice(0, 400);
}

/* -------------------------- tiny UI atoms -------------------------- */
function MiniPill({ title, value, sub, tone = "neutral", num = null }) {
  const n = Number.isFinite(num) ? num : 0;
  const isZero = n === 0;

  // Default white for everything; only colored:
  // - Est. Value (tone="unrealized") -> blue when >0, else dim
  // - Realized P/L (tone="realized") -> green when >0, else dim
  let color = "text-slate-100";
  if (tone === "unrealized") color = isZero ? "text-slate-400" : "text-indigo-400";
  if (tone === "realized") color = isZero ? "text-slate-400" : "text-emerald-400";
  if (tone === "neutral") color = isZero ? "text-slate-400" : "text-slate-100";

  return (
    <div className="rounded-xl border border-slate-800 bg-slate-900/60 px-3 py-3">
      <div className="text-slate-400 text-xs">{title}</div>
      <div className={`text-base font-semibold mt-0.5 ${color}`}>{value}</div>
      {sub && <div className="text-[10px] leading-4 text-slate-400 mt-0.5">{sub}</div>}
    </div>
  );
}
