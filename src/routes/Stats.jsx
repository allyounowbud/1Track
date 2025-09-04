import { useEffect, useMemo, useState, useRef } from "react";
import { useQuery } from "@tanstack/react-query";
import { NavLink, Link } from 'react-router-dom'
import { supabase } from "../lib/supabaseClient";

/* ----------------------------- UI helpers ----------------------------- */
const tabBase =
  "inline-flex items-center justify-center h-10 px-4 rounded-xl border border-slate-800 bg-slate-900/60 text-slate-200 hover:bg-slate-900 transition";
const tabActive =
  "bg-indigo-600 text-white border-indigo-600 shadow hover:bg-indigo-600";
const card =
  "rounded-2xl border border-slate-800 bg-slate-900/60 backdrop-blur p-4 sm:p-6 shadow-[0_10px_30px_rgba(0,0,0,.35)] overflow-visible";
const inputBase =
  "w-full min-w-0 appearance-none bg-slate-900/60 border border-slate-800 rounded-xl px-4 py-3 text-slate-100 placeholder-slate-400 focus:ring-2 focus:ring-indigo-500";

/* ----------------------------- data helpers ---------------------------- */
const cents = (n) => Math.round(Number(n || 0));
const centsToStr = (c) => (Number(c || 0) / 100).toFixed(2);
const pctStr = (p) => (isFinite(p) ? `${(p * 100).toFixed(2)}%` : "—");
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
    .select("id, name")
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

  /* user (avatar/name) */
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

    const spentC = purchases.reduce((a, o) => a + cents(o.buy_price_cents), 0);
    const revenueC = sales.reduce((a, o) => a + cents(o.sale_price_cents), 0);
    const feesC = sales.reduce(
      (a, o) =>
        a +
        Math.round(cents(o.sale_price_cents) * (Number(o.fees_pct) || 0)),
      0
    );
    const shippingC = sales.reduce((a, o) => a + cents(o.shipping_cents), 0);
    const cogsC = sales.reduce((a, o) => a + cents(o.buy_price_cents), 0);
    const profitC = revenueC - feesC - shippingC - cogsC;
    const netAfterFeeShipC = revenueC - feesC - shippingC;

    const avgBuy = purchases.length ? spentC / purchases.length : 0;
    const avgSale = sales.length ? revenueC / sales.length : 0;

    // hold time
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

    const roi = spentC > 0 ? profitC / spentC : NaN; // profit over cost
    const margin = revenueC > 0 ? profitC / revenueC : NaN;
    const sellThrough =
      purchases.length > 0 ? sales.length / purchases.length : NaN;

    const onHand = filtered.filter((o) => cents(o.sale_price_cents) <= 0)
      .length;

    return {
      bought: purchases.length,
      sold: sales.length,
      onHand,
      spentC,
      revenueC,
      profitC,
      feesC,
      shippingC,
      avgBuy,
      avgSale,
      roi,
      margin,
      avgHold,
      sellThrough,
      netAfterFeeShipC,
    };
  }, [filtered, fromMs, toMs]);

  /* -------------------------------- charts ------------------------------- */
  const [chartType, setChartType] = useState("purchases_month");
  const monthKey = (d) => {
    const dt = new Date(d);
    if (isNaN(dt.getTime())) return null;
    return `${dt.getFullYear()}-${String(dt.getMonth() + 1).padStart(2, "0")}`;
  };

  const chartData = useMemo(() => {
    const purchasesInWindow = filtered.filter(
      (o) => within(o.order_date, fromMs, toMs) || (!fromMs && !toMs)
    );
    const salesInWindow = filtered.filter(
      (o) =>
        cents(o.sale_price_cents) > 0 &&
        (within(o.sale_date, fromMs, toMs) || (!fromMs && !toMs))
    );

    if (chartType === "purchases_month") {
      const m = new Map();
      for (const o of purchasesInWindow) {
        const k = monthKey(o.order_date);
        if (!k) continue;
        m.set(k, (m.get(k) || 0) + cents(o.buy_price_cents));
      }
      return [...m.entries()]
        .sort((a, b) => a[0].localeCompare(b[0]))
        .map(([label, value]) => ({ label, value }));
    }
    if (chartType === "sales_month") {
      const m = new Map();
      for (const o of salesInWindow) {
        const k = monthKey(o.sale_date);
        if (!k) continue;
        m.set(k, (m.get(k) || 0) + cents(o.sale_price_cents));
      }
      return [...m.entries()]
        .sort((a, b) => a[0].localeCompare(b[0]))
        .map(([label, value]) => ({ label, value }));
    }
    if (chartType === "pl_month") {
      const m = new Map();
      for (const o of salesInWindow) {
        const k = monthKey(o.sale_date);
        if (!k) continue;
        const rev = cents(o.sale_price_cents);
        const fee = Math.round(rev * (Number(o.fees_pct) || 0));
        const ship = cents(o.shipping_cents);
        const cost = cents(o.buy_price_cents);
        const pl = rev - fee - ship - cost;
        m.set(k, (m.get(k) || 0) + pl);
      }
      return [...m.entries()]
        .sort((a, b) => a[0].localeCompare(b[0]))
        .map(([label, value]) => ({ label, value }));
    }
    if (chartType === "purchases_retailer") {
      const m = new Map();
      for (const o of purchasesInWindow) {
        const k = o.retailer || "—";
        m.set(k, (m.get(k) || 0) + cents(o.buy_price_cents));
      }
      return [...m.entries()]
        .map(([label, value]) => ({ label, value }))
        .sort((a, b) => b.value - a.value)
        .slice(0, 12);
    }
    // sales_market
    const m = new Map();
    for (const o of salesInWindow) {
      const k = o.marketplace || "—";
      m.set(k, (m.get(k) || 0) + cents(o.sale_price_cents));
    }
    return [...m.entries()]
      .map(([label, value]) => ({ label, value }))
      .sort((a, b) => b.value - a.value)
      .slice(0, 12);
  }, [chartType, filtered, fromMs, toMs]);

  const maxVal = Math.max(1, ...chartData.map((r) => Math.abs(r.value)));

  /* ------------------------------- actions ------------------------------- */
  async function signOut() {
    await supabase.auth.signOut();
    window.location.href = "/login";
  }

  /* -------------------------------- render -------------------------------- */
  return (
    <div className="min-h-screen bg-slate-950 text-slate-100">
      <div className="max-w-6xl mx-auto p-4 sm:p-6">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <h1 className="text-3xl font-bold">OneTrack</h1>
          <div className="flex items-center gap-3">
            {userInfo.avatar_url ? (
              <img
                src={userInfo.avatar_url}
                alt=""
                className="h-8 w-8 rounded-full border border-slate-800 object-cover"
              />
            ) : (
              <div className="h-8 w-8 rounded-full bg-slate-800 grid place-items-center text-slate-300 text-xs">
                {(userInfo.username || "U").slice(0, 1).toUpperCase()}
              </div>
            )}
            <div className="hidden sm:block text-sm text-slate-300 max-w-[160px] truncate">
              {userInfo.username}
            </div>
            <Link
            to="/"className="px-4 h-10 rounded-xl border border-slate-800 bg-slate-900/60 hover:bg-slate-900">Dashboard</Link>
          </div>
        </div>

        {/* Tabs */}
        <div className="flex flex-wrap items-center gap-2 mb-6">
          <NavLink to="/orders"  className={({isActive}) => `${tabBase} ${isActive ? tabActive : ''}`}>Order Book</NavLink>
          <NavLink
            to="/app"
            className={({ isActive }) => `${tabBase} ${isActive ? tabActive : ""}`}
          >
            Quick Add
          </NavLink>
          <NavLink
            to="/sold"
            className={({ isActive }) => `${tabBase} ${isActive ? tabActive : ""}`}
          >
            Mark as Sold
          </NavLink>
          <NavLink
            to="/stats"
            className={({ isActive }) => `${tabBase} ${isActive ? tabActive : ""}`}
          >
            Stats
          </NavLink>
          <button className={tabBase}>Inventory</button>
          <button className={tabBase}>Flex</button>
          <NavLink
            to="/settings"
            className={({ isActive }) => `${tabBase} ${isActive ? tabActive : ""}`}
          >
            Settings
          </NavLink>
        </div>

        {/* Filters */}
        <div className={`${card} relative z-[60]`}>
          <h2 className="text-lg font-semibold mb-4">Date Range</h2>
          <div className="grid grid-cols-1 gap-4 min-w-0">
            {/* Date range dropdown (styled like item selector) */}
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

        {/* KPI grid (compact) */}
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4 mt-6">
          <Kpi
            title="Bought"
            value={`${kpis.bought} items`}
            subtitle={`Spend $${centsToStr(kpis.spentC)}`}
          />
          <Kpi
            title="Sold"
            value={`${kpis.sold} items`}
            subtitle={`Revenue $${centsToStr(kpis.revenueC)}`}
          />
          <Kpi
            title="Profit / Loss"
            value={`$${centsToStr(kpis.profitC)}`}
            subtitle={`Net after fees/ship $${centsToStr(kpis.netAfterFeeShipC)}`}
            tone={kpis.profitC >= 0 ? "pos" : "neg"}
          />
          <Kpi
            title="Fees"
            value={`$${centsToStr(kpis.feesC)}`}
            subtitle={`Avg buy $${centsToStr(kpis.avgBuy)}`}
          />
          <Kpi
            title="Shipping"
            value={`$${centsToStr(kpis.shippingC)}`}
            subtitle={`Avg sale $${centsToStr(kpis.avgSale)}`}
          />
          <Kpi title="On hand" value={`${kpis.onHand}`} subtitle="Unsold items" />
          <Kpi
            title="ROI"
            value={pctStr(kpis.roi)}
            subtitle={`Margin ${pctStr(kpis.margin)}`}
          />
          <Kpi
            title="Avg hold"
            value={`${kpis.avgHold.toFixed(1)} days`}
            subtitle={`STR ${pctStr(kpis.sellThrough)}`}
          />
        </div>

        {/* Chart */}
        <div className={`${card} mt-6`}>
          <div className="flex items-center justify-between gap-3 mb-4">
            <div className="text-lg font-semibold">Chart</div>
            <select
              value={chartType}
              onChange={(e) => setChartType(e.target.value)}
              className="w-[240px] bg-slate-900/60 border border-slate-800 rounded-xl px-3 py-2 text-slate-100"
            >
              <option value="purchases_month">Purchases by month</option>
              <option value="sales_month">Sales by month</option>
              <option value="pl_month">P/L by month</option>
              <option value="purchases_retailer">Purchases by retailer</option>
              <option value="sales_market">Sales by marketplace</option>
            </select>
          </div>

          <div className="space-y-2">
            {chartData.length === 0 && (
              <div className="text-slate-400">No data for this view.</div>
            )}
            {chartData.map((r, i) => (
              <div key={i} className="flex items-center gap-3">
                <div className="w-32 shrink-0 text-sm text-slate-300 truncate">
                  {r.label}
                </div>
                <div className="flex-1 h-3 rounded bg-slate-800 overflow-hidden">
                  <div
                    className="h-full bg-indigo-600"
                    style={{ width: `${(Math.abs(r.value) / maxVal) * 100}%` }}
                  />
                </div>
                <div className="w-28 shrink-0 text-right text-sm text-slate-300">
                  ${centsToStr(r.value)}
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Breakdown by item */}
        <div className={`${card} mt-6`}>
          <h3 className="text-lg font-semibold mb-4">Breakdown by item</h3>
          <div className="overflow-x-auto">
            <table className="min-w-[860px] w-full text-sm">
              <thead className="text-slate-300">
                <tr className="text-left">
                  <th className="py-2 pr-3">Item Name</th>
                  <th className="py-2 pr-3">Bought</th>
                  <th className="py-2 pr-3">Sold</th>
                  <th className="py-2 pr-3">On Hand</th>
                  <th className="py-2 pr-3">Total Cost</th>
                  <th className="py-2 pr-3">Revenue</th>
                  <th className="py-2 pr-3">Fees</th>
                  <th className="py-2 pr-3">Shipping</th>
                  <th className="py-2 pr-3">P/L</th>
                </tr>
              </thead>
              <tbody className="text-slate-200">
                {makeItemBreakdown(filtered).map((r) => (
                  <tr key={r.item} className="border-t border-slate-800">
                    <td className="py-2 pr-3">{r.item}</td>
                    <td className="py-2 pr-3">{r.bought}</td>
                    <td className="py-2 pr-3">{r.sold}</td>
                    <td className="py-2 pr-3">{r.onHand}</td>
                    <td className="py-2 pr-3">${centsToStr(r.costC)}</td>
                    <td className="py-2 pr-3">${centsToStr(r.revenueC)}</td>
                    <td className="py-2 pr-3">${centsToStr(r.feesC)}</td>
                    <td className="py-2 pr-3">${centsToStr(r.shipC)}</td>
                    <td
                      className={`py-2 pr-3 ${
                        r.plC >= 0 ? "text-emerald-400" : "text-rose-400"
                      }`}
                    >
                      ${centsToStr(r.plC)}
                    </td>
                  </tr>
                ))}
                {filtered.length === 0 && (
                  <tr>
                    <td className="py-6 text-slate-400" colSpan={9}>
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

/** Styled dropdown used for Date Range (matches item selector look) */
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

function Kpi({ title, value, subtitle, tone }) {
  const toneClass =
    tone === "pos"
      ? "text-emerald-400"
      : tone === "neg"
      ? "text-rose-400"
      : "text-slate-100";
  return (
    <div className={card}>
      <div className="text-slate-400 text-sm">{title}</div>
      <div className={`text-xl font-semibold mt-2 ${toneClass}`}>{value}</div>
      {subtitle && <div className="text-slate-400 text-sm">{subtitle}</div>}
    </div>
  );
}

function makeItemBreakdown(filtered) {
  const m = new Map();
  for (const o of filtered) {
    const key = o.item || "—";
    if (!m.has(key)) {
      m.set(key, {
        item: key,
        bought: 0,
        sold: 0,
        onHand: 0,
        costC: 0,
        revenueC: 0,
        feesC: 0,
        shipC: 0,
        plC: 0,
      });
    }
    const row = m.get(key);
    row.bought += 1;
    row.costC += cents(o.buy_price_cents);
    if (cents(o.sale_price_cents) > 0) {
      row.sold += 1;
      row.revenueC += cents(o.sale_price_cents);
      const fee = Math.round(
        cents(o.sale_price_cents) * (Number(o.fees_pct) || 0)
      );
      row.feesC += fee;
      row.shipC += cents(o.shipping_cents);
      row.plC +=
        cents(o.sale_price_cents) -
        fee -
        cents(o.shipping_cents) -
        cents(o.buy_price_cents);
    } else {
      row.onHand += 1;
    }
  }
  return [...m.values()]
    .sort((a, b) => b.revenueC - a.revenueC)
    .slice(0, 200);
}