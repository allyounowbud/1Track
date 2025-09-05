// src/routes/OrderBook.jsx
import { useEffect, useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "../lib/supabaseClient";
import HeaderWithTabs from "../components/HeaderWithTabs.jsx";

/* ---------------- UI tokens ---------------- */
const card =
  "rounded-2xl border border-slate-800 bg-slate-900/60 backdrop-blur p-4 sm:p-6 shadow-[0_10px_30px_rgba(0,0,0,.35)]";
const inputBase =
  "h-9 text-sm w-full min-w-0 bg-transparent border border-transparent rounded-md px-2 text-slate-100 placeholder-slate-400 focus:border-slate-600 focus:bg-slate-900/40";
const iconBtn =
  "inline-flex items-center justify-center h-8 w-8 rounded-md border focus:outline-none";

const GRID = "84px minmax(240px,1fr) 92px 120px 84px 92px 136px 160px 84px 72px";

/* ---------------- helpers ---------------- */
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

/* --------------- queries --------------- */
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

  /* date input polish (centering & iOS/Safari quirk fixes) */
  useEffect(() => {
    const style = document.createElement("style");
    style.innerHTML = `
      .tw-date {
        -webkit-appearance: none;
           -moz-appearance: none;
                appearance: none;
        height: 2.25rem; /* match h-9 */
        padding: 0 .5rem;
        background: transparent;
      }
      .tw-date::-webkit-datetime-edit,
      .tw-date::-webkit-datetime-edit-fields-wrapper {
        padding: 0;
        line-height: 1.25rem;
      }
      .tw-date::-webkit-calendar-picker-indicator { opacity: .85; }
    `;
    document.head.appendChild(style);
    return () => document.head.removeChild(style);
  }, []);

  /* search */
  const [q, setQ] = useState("");
  const filtered = useMemo(() => {
    const t = (q || "").trim().toLowerCase();
    if (!t) return orders;
    return orders.filter(
      (o) =>
        (o.item || "").toLowerCase().includes(t) ||
        (o.retailer || "").toLowerCase().includes(t) ||
        (o.marketplace || "").toLowerCase().includes(t) ||
        (o.profile_name || "").toLowerCase().includes(t)
    );
  }, [orders, q]);

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100">
      <div className="max-w-6xl mx-auto p-4 sm:p-6">
        <HeaderWithTabs />

        {/* Search + meta */}
        <div className={`${card} mb-6`}>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 items-end">
            <div className="sm:col-span-2">
              <label className="text-slate-300 mb-1 block text-sm">Search</label>
              <input
                value={q}
                onChange={(e) => setQ(e.target.value)}
                placeholder="item / retailer / marketplace / profile..."
                className="h-10 text-sm w-full min-w-0 bg-slate-900/60 border border-slate-800 rounded-xl px-3 py-2 text-slate-100 placeholder-slate-400 focus:ring-2 focus:ring-indigo-500"
              />
            </div>
            <div>
              <div className="text-slate-400 text-sm">Rows</div>
              <div className="text-xl font-semibold">{filtered.length}</div>
            </div>
          </div>
        </div>

        {/* Spreadsheet header (desktop) */}
        <div className="hidden lg:grid text-xs text-slate-400 px-1 mb-2"
             style={{ gridTemplateColumns: GRID }}>
          <div>Order date</div>
          <div>Item</div>
          <div>Profile</div>
          <div>Retailer</div>
          <div>Buy $</div>
          <div>Sale $</div>
          <div>Sale date</div>
          <div>Marketplace</div>
          <div>Ship $</div>
          <div className="text-right">Actions</div>
        </div>

        {/* Rows */}
        {isLoading && <div className="text-slate-400">Loading…</div>}
        {error && <div className="text-rose-400">{String(error.message || error)}</div>}

        <div className="divide-y divide-slate-800">
          {filtered.map((o) => (
            <Row
              key={o.id}
              order={o}
              items={items}
              retailers={retailers}
              markets={markets}
              onSaved={refetch}
              onDeleted={refetch}
            />
          ))}
          {filtered.length === 0 && (
            <div className="text-slate-400 py-8">No orders found.</div>
          )}
        </div>
      </div>
    </div>
  );
}

/* ============== Row (desktop grid + mobile stack) ============== */
function Row({ order, items, retailers, markets, onSaved, onDeleted }) {
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
      const { error } = await supabase.from("orders").update(payload).eq("id", order.id);
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

  const Ghost = ({ show, text }) =>
    show ? (
      <span className="lg:hidden absolute left-2 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none select-none text-sm">
        {text}
      </span>
    ) : null;

  /* Desktop: single-row grid (no cards) */
  const Desktop = (
    <div
      className="hidden lg:grid items-center gap-2 py-2 px-1"
      style={{ gridTemplateColumns: GRID }}
    >
      {/* order date */}
      <input
        type="date"
        value={order_date || ""}
        onChange={(e) => setOrderDate(e.target.value)}
        className={`tw-date ${inputBase} text-left`}
      />

      {/* item */}
      <select
        value={item || ""}
        onChange={(e) => setItem(e.target.value)}
        className={inputBase}
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
        className={inputBase}
        placeholder="Profile"
      />

      {/* retailer */}
      <select
        value={retailer || ""}
        onChange={(e) => setRetailer(e.target.value)}
        className={inputBase}
      >
        <option value=""></option>
        {retailers.map((r) => (
          <option key={r.id} value={r.name}>
            {r.name}
          </option>
        ))}
      </select>

      {/* buy */}
      <input
        value={buyPrice}
        onChange={(e) => setBuyPrice(e.target.value)}
        className={inputBase}
        placeholder="Buy $"
      />

      {/* sale */}
      <input
        value={salePrice}
        onChange={(e) => setSalePrice(e.target.value)}
        className={inputBase}
        placeholder="Sale $"
      />

      {/* sale date (no extra ghost on desktop) */}
      <input
        type="date"
        value={sale_date || ""}
        onChange={(e) => setSaleDate(e.target.value)}
        className={`tw-date ${inputBase} text-left`}
      />

      {/* marketplace */}
      <select
        value={marketplace || ""}
        onChange={(e) => handleMarketplaceChange(e.target.value)}
        className={inputBase}
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
        className={inputBase}
        placeholder="Ship $"
      />

      {/* actions */}
      <div className="flex items-center justify-end gap-2">
        <button
          type="button"
          onClick={save}
          disabled={busy}
          aria-label={busy ? "Saving…" : "Save"}
          title={busy ? "Saving…" : "Save"}
          className={`${iconBtn} ${
            busy
              ? "bg-slate-700 text-slate-300 cursor-not-allowed border-slate-700"
              : "bg-slate-800 hover:bg-slate-700 text-slate-100 border-slate-700"
          }`}
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
        <button
          type="button"
          onClick={del}
          aria-label="Delete"
          title="Delete"
          className={`${iconBtn} bg-rose-600 hover:bg-rose-500 text-white border border-rose-700`}
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
  );

  /* Mobile: simple stacked fields with thin separators (also no cards) */
  const Mobile = (
    <div className="lg:hidden py-3 px-1 space-y-2">
      <div className="grid gap-2">
        <div className="relative">
          <Ghost show={!order_date} text="Order date" />
          <input
            type="date"
            value={order_date || ""}
            onChange={(e) => setOrderDate(e.target.value)}
            className={`tw-date ${inputBase}`}
          />
        </div>

        <select
          value={item || ""}
          onChange={(e) => setItem(e.target.value)}
          className={inputBase}
        >
          <option value="">{/* empty */}</option>
          {items.map((it) => (
            <option key={it.id} value={it.name}>
              {it.name}
            </option>
          ))}
        </select>

        <div className="relative">
          <Ghost show={!profile_name} text="Profile" />
          <input
            value={profile_name}
            onChange={(e) => setProfile(e.target.value)}
            className={inputBase}
          />
        </div>

        <select
          value={retailer || ""}
          onChange={(e) => setRetailer(e.target.value)}
          className={inputBase}
        >
          <option value=""></option>
          {retailers.map((r) => (
            <option key={r.id} value={r.name}>
              {r.name}
            </option>
          ))}
        </select>

        <div className="relative">
          <Ghost show={!buyPrice} text="Buy $" />
          <input
            value={buyPrice}
            onChange={(e) => setBuyPrice(e.target.value)}
            className={inputBase}
          />
        </div>

        <div className="relative">
          <Ghost show={!salePrice} text="Sale $" />
          <input
            value={salePrice}
            onChange={(e) => setSalePrice(e.target.value)}
            className={inputBase}
          />
        </div>

        <div className="relative">
          <Ghost show={!sale_date} text="Sale date" />
          <input
            type="date"
            value={sale_date || ""}
            onChange={(e) => setSaleDate(e.target.value)}
            className={`tw-date ${inputBase}`}
          />
        </div>

        <div className="relative">
          <Ghost show={!marketplace} text="Marketplace" />
          <select
            value={marketplace || ""}
            onChange={(e) => handleMarketplaceChange(e.target.value)}
            className={inputBase}
          >
            <option value=""></option>
            {markets.map((m) => (
              <option key={m.id} value={m.name}>
                {m.name}
              </option>
            ))}
          </select>
        </div>

        <div className="relative">
          <Ghost show={!shipping} text="Ship $" />
          <input
            value={shipping}
            onChange={(e) => setShipping(e.target.value)}
            className={inputBase}
          />
        </div>

        <div className="flex items-center justify-end gap-2 pt-1">
          <button
            type="button"
            onClick={save}
            disabled={busy}
            aria-label={busy ? "Saving…" : "Save"}
            title={busy ? "Saving…" : "Save"}
            className={`${iconBtn} ${
              busy
                ? "bg-slate-700 text-slate-300 cursor-not-allowed border-slate-700"
                : "bg-slate-800 hover:bg-slate-700 text-slate-100 border-slate-700"
            }`}
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
          <button
            type="button"
            onClick={del}
            aria-label="Delete"
            title="Delete"
            className={`${iconBtn} bg-rose-600 hover:bg-rose-500 text-white border border-rose-700`}
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

  return (
    <>
      {Desktop}
      {Mobile}
    </>
  );
}
