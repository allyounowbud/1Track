import { useEffect, useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { NavLink } from "react-router-dom";
import { supabase } from "../lib/supabaseClient";

/* ----------------------------- helpers ----------------------------- */

const tabBase =
  "inline-flex items-center justify-center h-10 px-4 rounded-xl border border-slate-800 bg-slate-900/60 text-slate-200 hover:bg-slate-900 transition";
const tabActive =
  "bg-indigo-600 text-white border-indigo-600 shadow hover:bg-indigo-600";

const card = "rounded-2xl border border-slate-800 bg-slate-900/60 backdrop-blur p-4 sm:p-6 shadow-[0_10px_30px_rgba(0,0,0,.35)]";

const parseMoney = (v) => {
  const n = Number(String(v ?? "").replace(/[^0-9.\-]/g, ""));
  return isNaN(n) ? 0 : n;
};
const cents = (n) => Math.round(Number(n || 0));
const moneyToCents = (v) => cents(parseMoney(v) * 100);
const centsToStr = (c) => (Number(c || 0) / 100).toFixed(2);
const pctStr = (p) =>
  isFinite(p) ? `${(p * 100).toFixed(2)}%` : "—";

const within = (d, from, to) => {
  if (!d) return false;
  const x = new Date(d).getTime();
  if (isNaN(x)) return false;
  if (from && x < from) return false;
  if (to && x > to) return false;
  return true;
};

// group helpers
const groupMap = (arr, keyFn, valFn = (x) => x) => {
  const m = new Map();
  for (const it of arr) {
    const k = keyFn(it);
    if (!m.has(k)) m.set(k, []);
    m.get(k).push(valFn(it));
  }
  return m;
};
const sum = (arr) => arr.reduce((a, b) => a + (b || 0), 0);

// normalize “All Items” -> blank filter
const normalizeItemFilter = (v) =>
  !v || v.trim().toLowerCase() === "all items" ? "" : v.trim();

/* ------------------------------ queries ------------------------------ */

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

/* ------------------------------- page ------------------------------- */

export default function Stats() {
  // data
  const { data: orders = [] } = useQuery({ queryKey: ["orders"], queryFn: getOrders });
  const { data: items = [] } = useQuery({ queryKey: ["items"], queryFn: getItems });

  // user (for avatar/name)
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

  // filters (UI controls)
  const [range, setRange] = useState("all"); // all | month | 30 | custom
  const [fromStr, setFromStr] = useState("");
  const [toStr, setToStr] = useState("");
  const [itemInput, setItemInput] = useState("All Items");

  // applied filters (after clicking Apply)
  const [applied, setApplied] = useState({
    range: "all",
    from: null,
    to: null,
    item: "",
  });

  // compute date window from applied
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
    return { fromMs: null, toMs: null }; // all time
  }, [applied]);

  // filter orders by date + item
  const filtered = useMemo(() => {
    const item = (applied.item || "").toLowerCase();
    const itemFiltering = !!item;
    return orders.filter((o) => {
      const matchesItem = !itemFiltering || (o.item || "").toLowerCase().includes(item);
      // include both purchases (order_date) and sales (sale_date) in the window
      // for KPIs we’ll pick the appropriate side later
      const anyInWindow =
        within(o.order_date, fromMs, toMs) || within(o.sale_date, fromMs, toMs) || (!fromMs && !toMs);
      return matchesItem && anyInWindow;
    });
  }, [orders, applied, fromMs, toMs]);

  /* ---------------------------- aggregates ---------------------------- */

  const kpis = useMemo(() => {
    // purchases in window (by order_date)
    const purchases = filtered.filter((o) => within(o.order_date, fromMs, toMs) || (!fromMs && !toMs));
    const spentC = sum(purchases.map((o) => cents(o.buy_price_cents)));
    const itemsBought = purchases.length;

    // sales in window (by sale_date)
    const sales = filtered.filter(
      (o) =>
        cents(o.sale_price_cents) > 0 &&
        (within(o.sale_date, fromMs, toMs) || (!fromMs && !toMs))
    );
    const revenueC = sum(sales.map((o) => cents(o.sale_price_cents)));
    const feesC = sum(sales.map((o) => Math.round(cents(o.sale_price_cents) * (Number(o.fees_pct) || 0))));
    const shippingC = sum(sales.map((o) => cents(o.shipping_cents)));
    const cogC = sum(sales.map((o) => cents(o.buy_price_cents))); // COGS from sold rows
    const profitC = revenueC - feesC - shippingC - cogC;

    const avgSale = revenueC && sales.length ? revenueC / sales.length : 0;
    const avgBuy = spentC && purchases.length ? spentC / purchases.length : 0;

    // avg hold time (sold only)
    const holdDays = sales
      .map((o) => {
        const od = new Date(o.order_date).getTime();
        const sd = new Date(o.sale_date).getTime();
        if (isNaN(od) || isNaN(sd)) return null;
        return Math.max(0, Math.round((sd - od) / (24 * 3600 * 1000)));
      })
      .filter((x) => x != null);
    const avgHold = holdDays.length ? holdDays.reduce((a, b) => a + b, 0) / holdDays.length : 0;

    const roi = spentC > 0 ? profitC / spentC : NaN; // profit over cost
    const margin = revenueC > 0 ? profitC / revenueC : NaN;
    const sellThrough =
      purchases.length > 0 ? sales.length / purchases.length : NaN;

    // on hand = “unsold” among filtered purchases
    const onHand = filtered.filter((o) => cents(o.sale_price_cents) <= 0).length;

    return {
      itemsBought,
      spentC,
      salesCount: sales.length,
      revenueC,
      feesC,
      shippingC,
      profitC,
      avgSale,
      avgBuy,
      avgHold,
      roi,
      margin,
      sellThrough,
      onHand,
    };
  }, [filtered, fromMs, toMs]);

  /* ------------------------------ charts ------------------------------ */

  const [chartType, setChartType] = useState("purchases_month"); // default

  // helper to month key
  const monthKey = (d) => {
    const dt = new Date(d);
    if (isNaN(dt.getTime())) return null;
    return `${dt.getFullYear()}-${String(dt.getMonth() + 1).padStart(2, "0")}`;
  };

  const chartData = useMemo(() => {
    const purchasesInWindow = filtered.filter((o) => within(o.order_date, fromMs, toMs) || (!fromMs && !toMs));
    const salesInWindow = filtered.filter((o) =>
      cents(o.sale_price_cents) > 0 &&
      (within(o.sale_date, fromMs, toMs) || (!fromMs && !toMs))
    );

    if (chartType === "purchases_month") {
      const g = groupMap(purchasesInWindow, (o) => monthKey(o.order_date), (o) => cents(o.buy_price_cents));
      const rows = [...g.entries()]
        .filter(([k]) => !!k)
        .sort((a, b) => a[0].localeCompare(b[0]))
        .map(([k, vals]) => ({ label: k, value: sum(vals) }));
      return rows;
    }

    if (chartType === "sales_month") {
      const g = groupMap(salesInWindow, (o) => monthKey(o.sale_date), (o) => cents(o.sale_price_cents));
      const rows = [...g.entries()]
        .filter(([k]) => !!k)
        .sort((a, b) => a[0].localeCompare(b[0]))
        .map(([k, vals]) => ({ label: k, value: sum(vals) }));
      return rows;
    }

    if (chartType === "pl_month") {
      const g = new Map();
      for (const o of salesInWindow) {
        const k = monthKey(o.sale_date);
        if (!k) continue;
        const revenue = cents(o.sale_price_cents);
        const fees = Math.round(revenue * (Number(o.fees_pct) || 0));
        const ship = cents(o.shipping_cents);
        const cost = cents(o.buy_price_cents);
        const pl = revenue - fees - ship - cost;
        g.set(k, (g.get(k) || 0) + pl);
      }
      const rows = [...g.entries()]
        .sort((a, b) => a[0].localeCompare(b[0]))
        .map(([k, v]) => ({ label: k, value: v }));
      return rows;
    }

    if (chartType === "purchases_retailer") {
      const g = groupMap(
        purchasesInWindow,
        (o) => o.retailer || "—",
        (o) => cents(o.buy_price_cents)
      );
      const rows = [...g.entries()]
        .map(([k, vals]) => ({ label: k, value: sum(vals) }))
        .sort((a, b) => b.value - a.value)
        .slice(0, 12);
      return rows;
    }

    // sales by marketplace
    const g = groupMap(
      salesInWindow,
      (o) => o.marketplace || "—",
      (o) => cents(o.sale_price_cents)
    );
    const rows = [...g.entries()]
      .map(([k, vals]) => ({ label: k, value: sum(vals) }))
      .sort((a, b) => b.value - a.value)
      .slice(0, 12);
    return rows;
  }, [chartType, filtered, fromMs, toMs]);

  const maxVal = Math.max(1, ...chartData.map((r) => Math.abs(r.value)));

  /* -------------------------- breakdown by item -------------------------- */

  const itemBreakdown = useMemo(() => {
    // group by item name (filtered set already applied)
    const g = new Map();
    for (const o of filtered) {
      const key = o.item || "—";
      if (!g.has(key)) {
        g.set(key, {
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
      const row = g.get(key);
      row.bought += 1;
      row.costC += cents(o.buy_price_cents);
      if (cents(o.sale_price_cents) > 0) {
        row.sold += 1;
        row.revenueC += cents(o.sale_price_cents);
        const fee = Math.round(cents(o.sale_price_cents) * (Number(o.fees_pct) || 0));
        row.feesC += fee;
        row.shipC += cents(o.shipping_cents);
        row.plC += cents(o.sale_price_cents) - fee - cents(o.shipping_cents) - cents(o.buy_price_cents);
      } else {
        row.onHand += 1;
      }
    }
    return [...g.values()].sort((a, b) => b.revenueC - a.revenueC).slice(0, 100);
  }, [filtered]);

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
            <button
              onClick={signOut}
              className="px-4 h-10 rounded-xl border border-slate-800 bg-slate-900/60 hover:bg-slate-900"
            >
              Sign out
            </button>
          </div>
        </div>

        {/* Tabs */}
        <div className="flex flex-wrap items-center gap-2 mb-6">
          <NavLink to="/app" className={({ isActive }) => `${tabBase} ${isActive ? tabActive : ""}`}>
            Quick Add
          </NavLink>
          <NavLink to="/sold" className={({ isActive }) => `${tabBase} ${isActive ? tabActive : ""}`}>
            Mark as Sold
          </NavLink>
          <NavLink to="/stats" className={({ isActive }) => `${tabBase} ${isActive ? tabActive : ""}`}>
            Stats
          </NavLink>
          <button className={tabBase}>Inventory</button>
          <button className={tabBase}>Flex</button>
          <NavLink to="/settings" className={({ isActive }) => `${tabBase} ${isActive ? tabActive : ""}`}>
            Settings
          </NavLink>
        </div>

        {/* Filters */}
        <div className={card}>
          <h2 className="text-lg font-semibold mb-4">Date Range</h2>

          <div className="grid grid-cols-1 gap-4 min-w-0">
            {/* range */}
            <select
              value={range}
              onChange={(e) => setRange(e.target.value)}
              className="w-full min-w-0 appearance-none bg-slate-900/60 border border-slate-800 rounded-xl px-4 py-3 text-slate-100"
            >
              <option value="all">All time</option>
              <option value="month">This month</option>
              <option value="30">Last 30 days</option>
              <option value="custom">Custom…</option>
            </select>

            {/* custom dates */}
            {range === "custom" && (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 min-w-0">
                <input
                  type="date"
                  value={fromStr}
                  onChange={(e) => setFromStr(e.target.value)}
                  className="w-full min-w-0 appearance-none bg-slate-900/60 border border-slate-800 rounded-xl px-4 py-3 text-slate-100"
                />
                <input
                  type="date"
                  value={toStr}
                  onChange={(e) => setToStr(e.target.value)}
                  className="w-full min-w-0 appearance-none bg-slate-900/60 border border-slate-800 rounded-xl px-4 py-3 text-slate-100"
                />
              </div>
            )}

            {/* item filter (searchable) */}
            <div>
              <label className="block text-slate-300 text-sm mb-1">Item filter</label>
              <input
                list="stats-items-list"
                value={itemInput}
                onChange={(e) => setItemInput(e.target.value)}
                onBlur={(e) => {
                  if (!e.target.value.trim()) setItemInput("All Items");
                }}
                placeholder="Type to filter by item name…"
                className="w-full min-w-0 bg-slate-900/60 border border-slate-800 rounded-xl px-4 py-3 text-slate-100"
              />
              <datalist id="stats-items-list">
                <option value="All Items" />
                {items.map((it) => (
                  <option key={it.id} value={it.name} />
                ))}
              </datalist>
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
                {filtered.length ? null : "Stats unavailable."}
              </div>
            </div>
          </div>
        </div>

        {/* KPI Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mt-6">
          <div className={card}>
            <div className="text-slate-400 text-sm">Purchases</div>
            <div className="text-2xl font-semibold mt-2">{kpis.itemsBought} items</div>
            <div className="text-slate-400 text-sm">Spend ${centsToStr(kpis.spentC)}</div>
          </div>

          <div className={card}>
            <div className="text-slate-400 text-sm">Sales</div>
            <div className="text-2xl font-semibold mt-2">{kpis.salesCount} items</div>
            <div className="text-slate-400 text-sm">Revenue ${centsToStr(kpis.revenueC)}</div>
          </div>

          <div className={card}>
            <div className="text-slate-400 text-sm">Profit / Loss</div>
            <div className="text-2xl font-semibold mt-2">
              ${centsToStr(kpis.profitC)}
            </div>
            <div className="text-slate-400 text-sm">
              Avg sale ${centsToStr(kpis.avgSale)}
            </div>
          </div>

          <div className={card}>
            <div className="text-slate-400 text-sm">Fees</div>
            <div className="text-2xl font-semibold mt-2">${centsToStr(kpis.feesC)}</div>
            <div className="text-slate-400 text-sm">Avg buy ${centsToStr(kpis.avgBuy)}</div>
          </div>

          <div className={card}>
            <div className="text-slate-400 text-sm">Shipping</div>
            <div className="text-2xl font-semibold mt-2">${centsToStr(kpis.shippingC)}</div>
            <div className="text-slate-400 text-sm">On hand {kpis.onHand}</div>
          </div>

          <div className={card}>
            <div className="text-slate-400 text-sm">ROI & Margin</div>
            <div className="text-lg font-semibold mt-2">
              ROI {pctStr(kpis.roi)} • Margin {pctStr(kpis.margin)}
            </div>
            <div className="text-slate-400 text-sm">Avg hold {kpis.avgHold.toFixed(1)} days • STR {pctStr(kpis.sellThrough)}</div>
          </div>
        </div>

        {/* Chart */}
        <div className={`${card} mt-6`}>
          <div className="flex items-center justify-between gap-3 mb-4">
            <div className="text-lg font-semibold">Chart</div>
            <select
              value={chartType}
              onChange={(e) => setChartType(e.target.value)}
              className="w-[220px] bg-slate-900/60 border border-slate-800 rounded-xl px-3 py-2 text-slate-100"
            >
              <option value="purchases_month">Purchases by month</option>
              <option value="sales_month">Sales by month</option>
              <option value="pl_month">P/L by month</option>
              <option value="purchases_retailer">Purchases by retailer</option>
              <option value="sales_market">Sales by marketplace</option>
            </select>
          </div>

          {/* simple bar chart (CSS) */}
          <div className="space-y-2">
            {chartData.length === 0 && (
              <div className="text-slate-400">No data for this view.</div>
            )}
            {chartData.map((r, i) => (
              <div key={i} className="flex items-center gap-3">
                <div className="w-32 shrink-0 text-sm text-slate-300 truncate">{r.label}</div>
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
            <table className="min-w-[720px] w-full text-sm">
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
                {itemBreakdown.map((r) => (
                  <tr key={r.item} className="border-t border-slate-800">
                    <td className="py-2 pr-3">{r.item}</td>
                    <td className="py-2 pr-3">{r.bought}</td>
                    <td className="py-2 pr-3">{r.sold}</td>
                    <td className="py-2 pr-3">{r.onHand}</td>
                    <td className="py-2 pr-3">${centsToStr(r.costC)}</td>
                    <td className="py-2 pr-3">${centsToStr(r.revenueC)}</td>
                    <td className="py-2 pr-3">${centsToStr(r.feesC)}</td>
                    <td className="py-2 pr-3">${centsToStr(r.shipC)}</td>
                    <td className="py-2 pr-3">${centsToStr(r.plC)}</td>
                  </tr>
                ))}
                {itemBreakdown.length === 0 && (
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