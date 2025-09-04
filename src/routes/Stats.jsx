// src/routes/Stats.jsx
import { useEffect, useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { NavLink } from "react-router-dom";
import { supabase } from "../lib/supabaseClient";

/* ---------- helpers ---------- */
const cents = (n) => Number(n || 0);
const fmt = (n) =>
  (Number(n || 0) / 100).toLocaleString(undefined, {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });

const tabBase =
  "inline-flex items-center justify-center h-10 px-4 rounded-xl border border-slate-800 bg-slate-900/60 text-slate-200 hover:bg-slate-900 transition";
const tabActive =
  "bg-indigo-600 text-white border-indigo-600 shadow hover:bg-indigo-600";

/* ---------- queries ---------- */
async function getOrders(itemFilter) {
  let q = supabase
    .from("orders")
    .select(
      "id, item, order_date, sale_date, status, buy_price_cents, sale_price_cents, shipping_cents, fees_pct, marketplace"
    )
    .order("order_date", { ascending: false });

  if (itemFilter?.trim()) q = q.ilike("item", `%${itemFilter.trim()}%`);

  const { data, error } = await q;
  if (error) throw error;
  return data ?? [];
}

async function getItems() {
  const { data, error } = await supabase
    .from("items")
    .select("id, name")
    .order("name", { ascending: true });
  if (error) throw error;
  return data ?? [];
}

export default function Stats() {
  // --- current user (Discord avatar/name like other pages) ---
  const [userInfo, setUserInfo] = useState({ avatar_url: "", username: "" });
  useEffect(() => {
    async function loadUser() {
      const { data: { user } } = await supabase.auth.getUser();
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

  /* ---------- filters ---------- */
  const [range, setRange] = useState("all"); // all | last30 | month | ytd | custom
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [itemFilterInput, setItemFilterInput] = useState("");

  // “Apply” locks values into the query key
  const [applied, setApplied] = useState({
    range: "all",
    from: "",
    to: "",
    item: "",
  });

  const { data: rows = [], isLoading } = useQuery({
    queryKey: ["stats-orders", applied.item],
    queryFn: () => getOrders(applied.item),
  });

  const { data: items = [] } = useQuery({
    queryKey: ["stats-items"],
    queryFn: getItems,
  });

  /* ---------- compute date bounds ---------- */
  const bounds = useMemo(() => {
    if (applied.range === "custom") {
      return { from: applied.from || null, to: applied.to || null };
    }
    const now = new Date();
    if (applied.range === "last30") {
      const f = new Date();
      f.setDate(f.getDate() - 30);
      return { from: f.toISOString().slice(0, 10), to: null };
    }
    if (applied.range === "month") {
      const start = new Date(now.getFullYear(), now.getMonth(), 1);
      return { from: start.toISOString().slice(0, 10), to: null };
    }
    if (applied.range === "ytd") {
      const start = new Date(now.getFullYear(), 0, 1);
      return { from: start.toISOString().slice(0, 10), to: null };
    }
    return { from: null, to: null }; // all time
  }, [applied]);

  /* ---------- aggregate ---------- */
  const { kpis, breakdown, monthly } = useMemo(() => {
    const inRange = (d) => {
      const dt = d ? String(d).slice(0, 10) : null;
      if (!dt) return false;
      if (bounds.from && dt < bounds.from) return false;
      if (bounds.to && dt > bounds.to) return false;
      return true;
    };

    let purchasesCount = 0;
    let purchasesCost = 0;
    let salesCount = 0;
    let revenue = 0;
    let fees = 0;
    let shipping = 0;
    let profit = 0;

    const byItem = new Map();
    const monthBuckets = new Map();

    const addMonth = (iso, key, centsVal) => {
      if (!iso) return;
      const ym = iso.slice(0, 7);
      if (!monthBuckets.has(ym)) monthBuckets.set(ym, { buy: 0, sell: 0, pl: 0 });
      monthBuckets.get(ym)[key] += cents(centsVal);
    };

    for (const r of rows) {
      const buy = cents(r.buy_price_cents);
      const sell = cents(r.sale_price_cents);
      const ship = cents(r.shipping_cents);
      const feeCents = Math.round(sell * Number(r.fees_pct || 0));

      // Purchases
      if (inRange(r.order_date)) {
        purchasesCount += 1;
        purchasesCost += buy;
        addMonth(String(r.order_date), "buy", buy);
      }

      // Sales
      if (sell > 0 && inRange(r.sale_date)) {
        salesCount += 1;
        revenue += sell;
        fees += feeCents;
        shipping += ship;
        profit += sell - feeCents - ship - buy;
        addMonth(String(r.sale_date), "sell", sell);
        addMonth(String(r.sale_date), "pl", sell - feeCents - ship - buy);
      }

      // Breakdown
      const name = r.item || "—";
      if (!byItem.has(name))
        byItem.set(name, {
          item: name,
          bought: 0,
          sold: 0,
          onHand: 0,
          cost: 0,
          revenue: 0,
          fees: 0,
          shipping: 0,
          pl: 0,
        });

      const bi = byItem.get(name);
      if (inRange(r.order_date)) {
        bi.bought += 1;
        bi.cost += buy;
      }
      if (sell > 0 && inRange(r.sale_date)) {
        bi.sold += 1;
        bi.revenue += sell;
        bi.fees += feeCents;
        bi.shipping += ship;
        bi.pl += sell - feeCents - ship - buy;
      }
      if (!(sell > 0)) bi.onHand += 1;
    }

    const kpis = {
      purchasesCount,
      purchasesCost,
      salesCount,
      revenue,
      fees,
      shipping,
      profit,
      avgPL: salesCount ? Math.round(profit / salesCount) : 0,
    };

    const breakdown = [...byItem.values()].sort((a, b) =>
      a.item.localeCompare(b.item)
    );

    const monthly = [...monthBuckets.entries()]
      .sort(([a], [b]) => (a < b ? -1 : 1))
      .map(([month, v]) => ({ month, ...v }));

    return { kpis, breakdown, monthly };
  }, [rows, bounds]);

  /* ---------- UI ---------- */
  return (
    <div className="min-h-screen bg-slate-950 text-slate-100">
      <div className="max-w-6xl mx-auto p-4 sm:p-6">
        {/* Header (same as Dashboard/Settings) */}
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
              onClick={async () => {
                await supabase.auth.signOut();
                window.location.href = "/login";
              }}
              className="px-4 h-10 rounded-xl border border-slate-800 bg-slate-900/60 hover:bg-slate-900"
            >
              Sign out
            </button>
          </div>
        </div>

        {/* Tabs */}
        <div className="flex flex-wrap items-center gap-2 mb-6">
          <NavLink to="/app"   className={({isActive}) => `${tabBase} ${isActive ? tabActive : ""}`}>Quick Add</NavLink>
          <NavLink to="/sold"  className={({isActive}) => `${tabBase} ${isActive ? tabActive : ""}`}>Mark as Sold</NavLink>
          <NavLink to="/stats" className={({isActive}) => `${tabBase} ${isActive ? tabActive : ""}`}>Stats</NavLink>
          <button className={tabBase}>Inventory</button>
          <button className={tabBase}>Flex</button>
          <NavLink to="/settings" className={({isActive}) => `${tabBase} ${isActive ? tabActive : ""}`}>Settings</NavLink>
        </div>

        {/* Filters (all full-width, mobile-safe) */}
        <div className="rounded-2xl border border-slate-800 bg-slate-900/60 backdrop-blur p-4 sm:p-6 shadow-[0_10px_30px_rgba(0,0,0,.35)] overflow-hidden mb-6">
          <h2 className="text-lg font-semibold mb-4">Date Range</h2>

          <div className="space-y-4 min-w-0">
            {/* Date range select: full width */}
            <div className="min-w-0">
              <select
                value={range}
                onChange={(e) => setRange(e.target.value)}
                className="w-full min-w-0 appearance-none bg-slate-900/60 border border-slate-800 rounded-xl px-4 py-3 text-slate-100"
              >
                <option value="all">All time</option>
                <option value="last30">Last 30 days</option>
                <option value="month">This month</option>
                <option value="ytd">Year to date</option>
                <option value="custom">Custom range…</option>
              </select>
            </div>

            {/* Custom dates appear only when selected */}
            {range === "custom" && (
              <>
                <input
                  type="date"
                  value={from}
                  onChange={(e) => setFrom(e.target.value)}
                  className="w-full min-w-0 appearance-none bg-slate-900/60 border border-slate-800 rounded-xl px-4 py-3 text-slate-100"
                  placeholder="From"
                />
                <input
                  type="date"
                  value={to}
                  onChange={(e) => setTo(e.target.value)}
                  className="w-full min-w-0 appearance-none bg-slate-900/60 border border-slate-800 rounded-xl px-4 py-3 text-slate-100"
                  placeholder="To"
                />
              </>
            )}

            {/* Searchable item dropdown (datalist) */}
            <div className="min-w-0">
              <label className="text-slate-300 mb-1 block text-sm">Item filter</label>
              <input
                list="stats-items-list"
                value={itemFilterInput}
                onChange={(e) => setItemFilterInput(e.target.value)}
                className="w-full min-w-0 bg-slate-900/60 border border-slate-800 rounded-xl px-4 py-3 text-slate-100"
                placeholder="Search or pick an item…"
              />
              <datalist id="stats-items-list">
                {items.map((it) => (
                  <option key={it.id} value={it.name} />
                ))}
              </datalist>
            </div>

            <div className="flex items-center justify-between gap-4">
              <button
                onClick={() =>
                  setApplied({
                    range,
                    from,
                    to,
                    item: itemFilterInput,
                  })
                }
                className="px-6 py-3 rounded-2xl bg-indigo-600 hover:bg-indigo-500 text-white"
              >
                Apply
              </button>
              <div className="text-slate-400 text-sm">
                {isLoading ? "Loading…" : rows.length ? "" : "Stats unavailable."}
              </div>
            </div>
          </div>
        </div>

        {/* KPI cards */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 mb-6">
          <KPI title="Purchases" value={`${kpis.purchasesCount} items`} sub={`Spend $${fmt(kpis.purchasesCost)}`} />
          <KPI title="Sales" value={`${kpis.salesCount} items`} sub={`Revenue $${fmt(kpis.revenue)}`} />
          <KPI title="Profit / Loss" value={`$${fmt(kpis.profit)}`} sub={`Avg / sale $${fmt(kpis.avgPL)}`} />
          <KPI title="Fees" value={`$${fmt(kpis.fees)}`} />
          <KPI title="Shipping" value={`$${fmt(kpis.shipping)}`} />
          <KPI title="Net after fees & ship" value={`$${fmt(kpis.revenue - kpis.fees - kpis.shipping)}`} />
        </div>

        {/* Monthly bars */}
        <div className="rounded-2xl border border-slate-800 bg-slate-900/60 p-4 sm:p-6 shadow-[0_10px_30px_rgba(0,0,0,.35)] overflow-hidden mb-6">
          <h2 className="text-lg font-semibold mb-4">Chart:</h2>
          {monthly.length === 0 ? (
            <div className="text-slate-400">No data in range.</div>
          ) : (
            <div className="space-y-3">
              {monthly.map((m) => {
                const max = Math.max(m.buy, m.sell, Math.abs(m.pl), 1);
                const wBuy = (m.buy / max) * 100;
                const wSell = (m.sell / max) * 100;
                const wPL = (Math.abs(m.pl) / max) * 100;
                return (
                  <div key={m.month} className="min-w-0">
                    <div className="text-xs text-slate-400 mb-1">{m.month}</div>
                    <Bar label="Purchases" width={wBuy} />
                    <Bar label="Sales" width={wSell} />
                    <Bar label="P/L" width={wPL} negative={m.pl < 0} />
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Breakdown by item */}
        <div className="rounded-2xl border border-slate-800 bg-slate-900/60 p-4 sm:p-6 shadow-[0_10px_30px_rgba(0,0,0,.35)] overflow-hidden">
          <h2 className="text-lg font-semibold mb-4">Breakdown by item</h2>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-slate-400">
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
              <tbody>
                {breakdown.map((r) => (
                  <tr key={r.item} className="border-t border-slate-800">
                    <td className="py-2 pr-3">{r.item}</td>
                    <td className="py-2 pr-3">{r.bought}</td>
                    <td className="py-2 pr-3">{r.sold}</td>
                    <td className="py-2 pr-3">{r.onHand}</td>
                    <td className="py-2 pr-3">${fmt(r.cost)}</td>
                    <td className="py-2 pr-3">${fmt(r.revenue)}</td>
                    <td className="py-2 pr-3">${fmt(r.fees)}</td>
                    <td className="py-2 pr-3">${fmt(r.shipping)}</td>
                    <td className={`py-2 pr-3 ${r.pl >= 0 ? "text-emerald-400" : "text-rose-400"}`}>${fmt(r.pl)}</td>
                  </tr>
                ))}
                {breakdown.length === 0 && (
                  <tr>
                    <td colSpan={9} className="py-4 text-slate-400">
                      No rows in range.
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

/* ---------- presentational bits ---------- */
function KPI({ title, value, sub }) {
  return (
    <div className="rounded-2xl border border-slate-800 bg-slate-900/60 p-4 shadow-[0_10px_30px_rgba(0,0,0,.35)]">
      <div className="text-slate-400 text-xs">{title}</div>
      <div className="text-xl font-semibold">{value}</div>
      {!!sub && <div className="text-slate-400 text-xs mt-1">{sub}</div>}
    </div>
  );
}

function Bar({ label, width, negative = false }) {
  return (
    <div className="mb-2">
      <div className="text-xs text-slate-400 mb-1">{label}</div>
      <div className="h-2 rounded-full bg-slate-800 overflow-hidden">
        <div
          className={`h-2 ${negative ? "bg-rose-500" : "bg-indigo-500"}`}
          style={{ width: `${Math.min(100, Math.max(0, width))}%` }}
        />
      </div>
    </div>
  );
}