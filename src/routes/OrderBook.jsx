// src/routes/OrderBook.jsx
import { useEffect, useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "../lib/supabaseClient";
import HeaderWithTabs from "../components/HeaderWithTabs.jsx";

/* ---------- UI tokens ---------- */
const pageCard =
  "rounded-2xl border border-slate-800 bg-slate-900/60 backdrop-blur p-4 sm:p-6 shadow-[0_10px_30px_rgba(0,0,0,.35)]";
const rowCard =
  "rounded-xl border border-slate-800 bg-slate-900/60 p-3 overflow-hidden";
const inputSm =
  "h-10 text-sm w-full min-w-0 bg-slate-900/60 border border-slate-800 rounded-xl px-3 py-2 text-slate-100 placeholder-slate-400 focus:ring-2 focus:ring-indigo-500";

/* ---------- helpers ---------- */
const parseMoney = (v) => {
  const n = Number(String(v ?? "").replace(/[^0-9.\-]/g, ""));
  return isNaN(n) ? 0 : n;
};
const moneyToCents = (v) => Math.round(parseMoney(v) * 100);
const centsToStr = (c) => (Number(c || 0) / 100).toFixed(2);
const parsePct = (v) => {
  if (v === "" || v == null) return 0;
  const n = Number(String(v).replace("%", ""));
  if (isNaN(n)) return 0;
  return n > 1 ? n / 100 : n;
};
const fmtNiceDate = (yyyyMmDd) => {
  if (!yyyyMmDd) return "Unknown date";
  const [y, m, d] = yyyyMmDd.split("-").map((n) => Number(n));
  const dt = new Date(y, (m || 1) - 1, d || 1);
  return dt.toLocaleDateString(undefined, {
    month: "long",
    day: "numeric",
    year: "numeric",
  });
};

/* Build a fat keyword string for a yyyy-mm-dd to allow matches like
   "april", "apr 17", "april 2025", "04/17", "4/17/2025", etc. */
function dateKeywords(yyyyMmDd) {
  if (!yyyyMmDd) return "";
  const [yStr, mStr, dStr] = yyyyMmDd.split("-");
  const y = Number(yStr), m = Number(mStr), d = Number(dStr);
  const monthLong = [
    "january","february","march","april","may","june",
    "july","august","september","october","november","december"
  ][(m || 1) - 1];
  const monthShort = monthLong.slice(0,3);

  const m1 = String(m);
  const m2 = m.toString().padStart(2,"0");
  const d1 = String(d);
  const d2 = d.toString().padStart(2,"0");

  return [
    // plain month/day/year permutations
    `${m1}/${d1}`, `${m2}/${d2}`, `${m1}/${d1}/${y}`, `${m2}/${d2}/${y}`,
    // month names
    `${monthLong}`, `${monthShort}`,
    `${monthLong} ${d1}`, `${monthLong} ${d2}`,
    `${monthShort} ${d1}`, `${monthShort} ${d2}`,
    `${monthLong} ${y}`, `${monthShort} ${y}`,
    `${monthLong} ${d1} ${y}`, `${monthLong} ${d2} ${y}`,
    `${monthShort} ${d1} ${y}`, `${monthShort} ${d2} ${y}`,
    // iso
    `${yStr}-${mStr}-${dStr}`,
  ].join(" ").toLowerCase();
}

/* ---------- queries ---------- */
async function getOrders(limit = 500) {
  const { data, error } = await supabase
    .from("orders")
    .select(
      "id, order_date, item, profile_name, retailer, marketplace, buy_price_cents, sale_price_cents, sale_date, fees_pct, shipping_cents, status"
    )
    .order("order_date", { ascending: false })
    .limit(limit);
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
async function getRetailers() {
  const { data, error } = await supabase
    .from("retailers")
    .select("id, name")
    .order("name", { ascending: true });
  if (error) throw error;
  return data ?? [];
}
async function getMarkets() {
  const { data, error } = await supabase
    .from("marketplaces")
    .select("id, name, default_fees_pct")
    .order("name", { ascending: true });
  if (error) throw error;
  return data ?? [];
}

/* ====================== PAGE ====================== */
export default function OrderBook() {
  const { data: orders = [], isLoading, error, refetch } = useQuery({
    queryKey: ["orders", 500],
    queryFn: () => getOrders(500),
  });
  const { data: items = [] } = useQuery({ queryKey: ["items"], queryFn: getItems });
  const { data: retailers = [] } = useQuery({
    queryKey: ["retailers"],
    queryFn: getRetailers,
  });
  const { data: markets = [] } = useQuery({
    queryKey: ["markets"],
    queryFn: getMarkets,
  });

  // Normalize native date input rendering
  useEffect(() => {
    const tag = document.createElement("style");
    tag.innerHTML = `
      .tw-date { -webkit-appearance:none; appearance:none; height:2.5rem; padding:0 .75rem; background:transparent; }
      .tw-date::-webkit-datetime-edit, .tw-date::-webkit-datetime-edit-fields-wrapper { padding:0; line-height:1.25rem; }
      .tw-date::-webkit-calendar-picker-indicator { opacity:.9; }
    `;
    document.head.appendChild(tag);
    return () => document.head.removeChild(tag);
  }, []);

  /* single fuzzy search bar */
  const [q, setQ] = useState("");

  const filtered = useMemo(() => {
    const query = (q || "").trim().toLowerCase();
    if (!query) return orders;

    // Token-based AND search (order of tokens doesn't matter)
    const tokens = query.split(/\s+/).filter(Boolean);

    return orders.filter((o) => {
      const haystack =
        [
          o.item || "",
          o.retailer || "",
          o.marketplace || "",
          o.profile_name || "",
          // Add very permissive date keywords for both dates
          dateKeywords(o.order_date || ""),
          dateKeywords(o.sale_date || ""),
        ]
          .join(" ")
          .toLowerCase();

      // every token must be present somewhere
      return tokens.every((t) => haystack.includes(t));
    });
  }, [orders, q]);

  /* group by order_date */
  const grouped = useMemo(() => {
    const map = new Map();
    for (const o of filtered) {
      const key = o.order_date || "__unknown__";
      if (!map.has(key)) map.set(key, []);
      map.get(key).push(o);
    }
    const keys = Array.from(map.keys()).sort((a, b) => {
      if (a === "__unknown__") return 1;
      if (b === "__unknown__") return -1;
      return a < b ? 1 : a > b ? -1 : 0;
    });
    return keys.map((k) => ({
      key: k,
      nice: k === "__unknown__" ? "Unknown date" : fmtNiceDate(k),
      rows: map.get(k),
    }));
  }, [filtered]);

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100">
      <div className="max-w-6xl mx-auto p-4 sm:p-6">
        <HeaderWithTabs />

        {/* Search + meta */}
        <div className={`${pageCard} mb-6`}>
          <div className="grid grid-cols-1 gap-3 items-end">
            <div>
              <label className="text-slate-300 mb-1 block text-sm">Search</label>
              <input
                value={q}
                onChange={(e) => setQ(e.target.value)}
                placeholder="item / retailer / marketplace / profile / date (e.g., April, Jun 17, 04/17/2025)…"
                className={inputSm}
              />
            </div>

            <div className="flex items-center gap-4">
              <div className="text-slate-400 text-sm">Rows</div>
              <div className="text-xl font-semibold">{filtered.length}</div>
              {!!q && (
                <button
                  onClick={() => setQ("")}
                  className="ml-auto h-9 px-4 rounded-xl border border-slate-800 bg-slate-900/60 hover:bg-slate-900 text-slate-100"
                >
                  Clear search
                </button>
              )}
            </div>
          </div>
        </div>

        {/* Day cards */}
        {isLoading && <div className="text-slate-400">Loading…</div>}
        {error && <div className="text-rose-400">{String(error.message || error)}</div>}

        <div className="space-y-5">
          {grouped.map((g, idx) => (
            <DayCard
              key={g.key}
              title={g.nice}
              dateKey={g.key}
              count={g.rows.length}
              defaultOpen={idx === 0}
              rows={g.rows}
              items={items}
              retailers={retailers}
              markets={markets}
              onSaved={refetch}
              onDeleted={refetch}
            />
          ))}
          {!grouped.length && (
            <div className={`${pageCard} text-slate-400`}>No orders found.</div>
          )}
        </div>
      </div>
    </div>
  );
}

/* ============== Day Card ============== */
function DayCard({
  title,
  dateKey, // YYYY-MM-DD or "__unknown__"
  count,
  rows,
  items,
  retailers,
  markets,
  onSaved,
  onDeleted,
  defaultOpen = false,
}) {
  const [open, setOpen] = useState(defaultOpen);
  const [adding, setAdding] = useState(false);

  async function addNewForDay() {
    if (!dateKey || dateKey === "__unknown__") return;
    setAdding(true);
    try {
      const base = {
        order_date: dateKey,
        item: null,
        profile_name: null,
        retailer: null,
        marketplace: null,
        sale_date: null,
        buy_price_cents: 0,
        sale_price_cents: 0,
        shipping_cents: 0,
        fees_pct: 0,
        status: "ordered",
      };
      const { error } = await supabase.from("orders").insert(base);
      if (error) throw error;
      onSaved && onSaved();
      setOpen(true);
    } catch (e) {
      alert(e.message || String(e));
    } finally {
      setAdding(false);
    }
  }

  return (
    <div className={pageCard}>
      {/* header */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h3 className="text-lg font-semibold">{title}</h3>
          <p className="text-xs text-slate-400">{count} order{count !== 1 ? "s" : ""}</p>
        </div>

        <div className="flex items-center gap-2">
          {/* Only show Add when expanded */}
          {open && (
            <button
              onClick={addNewForDay}
              disabled={!dateKey || dateKey === "__unknown__" || adding}
              className={`h-9 px-4 rounded-xl border border-slate-800 ${
                adding
                  ? "bg-slate-800 text-slate-300 cursor-not-allowed"
                  : "bg-slate-900/60 hover:bg-slate-900 text-slate-100"
              }`}
              title={dateKey === "__unknown__" ? "Unknown date" : `Add order on ${title}`}
            >
              {adding ? "Adding…" : "Add Order"}
            </button>
          )}

          <button
            onClick={() => setOpen((v) => !v)}
            className="h-9 px-4 rounded-xl border border-slate-800 bg-slate-900/60 hover:bg-slate-900 text-slate-100"
          >
            {open ? "Collapse" : "Expand"}
          </button>
        </div>
      </div>

      {/* content */}
      {open && (
        <div className="pt-5">
          {/* Header labels per group (desktop) */}
          <div className="hidden lg:flex text-xs text-slate-400 px-1 mb-1 gap-2">
            <div className="w-40">Order date</div>
            <div className="min-w-[200px] flex-1">Item</div>
            <div className="w-24">Profile</div>
            <div className="w-30">Retailer</div>
            <div className="w-22">Buy $</div>
            <div className="w-22">Sale $</div>
            <div className="w-36">Sale date</div>
            <div className="w-32">Marketplace</div>
            <div className="w-20">Ship $</div>
            <div className="w-20 text-right">Actions</div>
          </div>

          <div className="space-y-3">
            {rows.map((o) => (
              <OrderRow
                key={o.id}
                order={o}
                items={items}
                retailers={retailers}
                markets={markets}
                onSaved={onSaved}
                onDeleted={onDeleted}
              />
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

/* ============== Row component ============== */
function OrderRow({ order, items, retailers, markets, onSaved, onDeleted }) {
  const [order_date, setOrderDate] = useState(order.order_date || "");
  const [item, setItem] = useState(order.item || "");
  const [profile_name, setProfile] = useState(order.profile_name || "");
  const [retailer, setRetailer] = useState(order.retailer || "");
  const [buyPrice, setBuyPrice] = useState(centsToStr(order.buy_price_cents));
  const [salePrice, setSalePrice] = useState(centsToStr(order.sale_price_cents));
  const [sale_date, setSaleDate] = useState(order.sale_date || "");
  const [marketplace, setMarketplace] = useState(order.marketplace || "");
  const [feesPct, setFeesPct] = useState(((order.fees_pct ?? 0) * 100).toString());
  const [shipping, setShipping] = useState(centsToStr(order.shipping_cents));

  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState("");

  function handleMarketplaceChange(name) {
    setMarketplace(name);
    const mk = markets.find((m) => m.name === name);
    const current = Number(String(feesPct).replace("%", "")) || 0;
    if (mk && (!current || current === 0)) {
      setFeesPct(((mk.default_fees_pct ?? 0) * 100).toString());
    }
  }

  async function save() {
    setBusy(true);
    setMsg("");
    try {
      const statusValue = moneyToCents(salePrice) > 0 ? "sold" : "ordered";
      const payload = {
        order_date: order_date || null,
        item: item || null,
        profile_name: profile_name || null,
        retailer: retailer || null,
        marketplace: marketplace || null,
        buy_price_cents: moneyToCents(buyPrice),
        sale_price_cents: moneyToCents(salePrice),
        sale_date: sale_date || null,
        fees_pct: parsePct(feesPct),
        shipping_cents: moneyToCents(shipping),
        status: statusValue,
      };
      const { error } = await supabase
        .from("orders")
        .update(payload)
        .eq("id", order.id);
      if (error) throw error;
      setMsg("Saved ✓");
      onSaved && onSaved();
      setTimeout(() => setMsg(""), 1500);
    } catch (err) {
      setMsg(String(err.message || err));
    } finally {
      setBusy(false);
    }
  }

  async function del() {
    if (!confirm("Delete this order?")) return;
    const { error } = await supabase.from("orders").delete().eq("id", order.id);
    if (error) alert(error.message);
    else onDeleted && onDeleted();
  }

  return (
    <div className={rowCard}>
      <div className="flex flex-wrap lg:flex-nowrap items-center gap-2">
        {/* order date */}
        <input
          type="date"
          value={order_date || ""}
          onChange={(e) => setOrderDate(e.target.value)}
          className={`tw-date ${inputSm} w-36`}
        />

        {/* item */}
        <select
          value={item || ""}
          onChange={(e) => setItem(e.target.value)}
          className={`${inputSm} min-w-[240px] flex-1`}
        >
          <option value=""></option>
          {items.map((it) => (
            <option key={it.id} value={it.name}>
              {it.name}
            </option>
          ))}
        </select>

        {/* profile */}
        <input
          value={profile_name}
          onChange={(e) => setProfile(e.target.value)}
          placeholder="Profile"
          className={`${inputSm} w-28`}
        />

        {/* retailer */}
        <select
          value={retailer || ""}
          onChange={(e) => setRetailer(e.target.value)}
          className={`${inputSm} w-28`}
        >
          <option value=""></option>
          {retailers.map((r) => (
            <option key={r.id} value={r.name}>
              {r.name}
            </option>
          ))}
        </select>

        {/* buy / sale */}
        <input
          value={buyPrice}
          onChange={(e) => setBuyPrice(e.target.value)}
          placeholder="Buy"
          className={`${inputSm} w-24`}
        />
        <input
          value={salePrice}
          onChange={(e) => setSalePrice(e.target.value)}
          placeholder="Sale"
          className={`${inputSm} w-24`}
        />

        {/* sale date */}
        <input
          type="date"
          value={sale_date || ""}
          onChange={(e) => setSaleDate(e.target.value)}
          className={`tw-date ${inputSm} w-36`}
        />

        {/* marketplace */}
        <select
          value={marketplace || ""}
          onChange={(e) => handleMarketplaceChange(e.target.value)}
          className={`${inputSm} w-32`}
        >
          <option value=""></option>
          {markets.map((m) => (
            <option key={m.id} value={m.name}>
              {m.name}
            </option>
          ))}
        </select>

        {/* ship */}
        <input
          value={shipping}
          onChange={(e) => setShipping(e.target.value)}
          placeholder="Ship"
          className={`${inputSm} w-24`}
        />

        {/* actions — pinned bottom-right on mobile, fixed column on desktop */}
        <div
          className="
            order-2 w-full flex justify-end gap-2 mt-2
            lg:order-none lg:w-20 lg:mt-0 lg:shrink-0
          "
        >
          {/* Save */}
          <button
            type="button"
            onClick={save}
            disabled={busy}
            aria-label={busy ? "Saving…" : "Save"}
            title={busy ? "Saving…" : "Save"}
            className={`inline-flex items-center justify-center h-9 w-9 rounded-lg
                ${busy ? "bg-slate-700 text-slate-300 cursor-not-allowed" : "bg-slate-800 hover:bg-slate-700 text-slate-100"}
                border border-slate-800 focus:outline-none focus:ring-2 focus:ring-indigo-500`}
          >
            <svg
              viewBox="0 0 24 24"
              className="h-5 w-5"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <path d="M20 6L9 17l-5-5" />
            </svg>
          </button>

          {/* Delete */}
          <button
            type="button"
            onClick={del}
            aria-label="Delete"
            title="Delete"
            className="inline-flex items-center justify-center h-9 w-9 rounded-lg
               bg-rose-600 hover:bg-rose-500 text-white border border-rose-700
               focus:outline-none focus:ring-2 focus:ring-rose-500"
          >
            <svg
              viewBox="0 0 24 24"
              className="h-5 w-5"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <path d="M3 6h18" />
              <path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6" />
              <path d="M10 11v6M14 11v6" />
              <path d="M9 6V4a2 2 0 0 1 2-2h2a2 2 0 0 1 2 2v2" />
            </svg>
          </button>
        </div>
      </div>

      {msg && (
        <div
          className={`text-right text-sm mt-1 ${
            msg.startsWith("Saved") ? "text-emerald-400" : "text-rose-400"
          }`}
        >
          {msg}
        </div>
      )}
    </div>
  );
}
