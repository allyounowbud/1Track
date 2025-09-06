// src/routes/QuickAdd.jsx
import { useEffect, useMemo, useRef, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "../lib/supabaseClient";
import HeaderWithTabs from "../components/HeaderWithTabs.jsx";

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

/* ---------- queries ---------- */
async function getOrders() {
  const { data, error } = await supabase
    .from("orders")
    .select(
      "id, order_date, item, profile_name, retailer, marketplace, buy_price_cents, sale_price_cents, sale_date, fees_pct, shipping_cents, pl_cents, status"
    )
    .order("order_date", { ascending: false })
    .limit(25);
  if (error) throw error;
  return data || [];
}
async function getRetailers() {
  const { data, error } = await supabase.from("retailers").select("id, name").order("name");
  if (error) throw error;
  return data || [];
}
async function getItems() {
  const { data, error } = await supabase.from("items").select("id, name").order("name");
  if (error) throw error;
  return data || [];
}
async function getMarketplaces() {
  const { data, error } = await supabase
    .from("marketplaces")
    .select("id, name, default_fees_pct")
    .order("name");
  if (error) throw error;
  return data || [];
}

/* ---------- Combobox (MarkSold-style, +Add support) ---------- */
function Combo({
  label,
  placeholder = "Type to search…",
  value,
  onChange,
  options = [], // [{id?, name}]
  onCreate, // async (name) => newRow
  disabled = false,
}) {
  const boxRef = useRef(null);
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState("");

  const names = useMemo(() => options.map((o) => o.name), [options]);
  const filtered = useMemo(() => {
    const needle = (q || "").trim().toLowerCase();
    if (!needle) return names.slice(0, 100);
    return names.filter((n) => n.toLowerCase().includes(needle)).slice(0, 100);
  }, [names, q]);

  const canCreate =
    !!onCreate &&
    (q || "").trim().length > 0 &&
    !names.some((n) => n.toLowerCase() === (q || "").trim().toLowerCase());

  useEffect(() => {
    const onClick = (e) => {
      if (!boxRef.current) return;
      if (!boxRef.current.contains(e.target)) setOpen(false);
    };
    window.addEventListener("click", onClick, { passive: true });
    return () => window.removeEventListener("click", onClick);
  }, []);

  return (
    <div className="min-w-0">
      {label && <label className="text-slate-300 mb-1 block text-sm">{label}</label>}
      <div ref={boxRef} className="relative">
        <input
          value={open ? q : value}
          onChange={(e) => {
            if (disabled) return;
            setQ(e.target.value);
            setOpen(true);
          }}
          onFocus={() => {
            if (disabled) return;
            setQ(value || "");
            setOpen(true);
          }}
          disabled={disabled}
          placeholder={placeholder}
          className={`w-full min-w-0 appearance-none bg-slate-900/60 border border-slate-800 rounded-xl px-4 py-3 pr-12 text-slate-100 placeholder-slate-400 outline-none focus:ring-2 focus:ring-indigo-500 ${
            disabled ? "opacity-60 cursor-not-allowed" : ""
          }`}
        />

        {/* right-side controls (clear + caret) */}
        <div className="absolute right-2 top-1/2 -translate-y-1/2 flex items-center gap-1">
          {!!value && !disabled && (
            <button
              type="button"
              aria-label="Clear"
              onMouseDown={(e) => e.preventDefault()}
              onClick={() => {
                onChange("");
                setQ("");
                setOpen(true);
              }}
              className="h-6 w-6 rounded-md border border-slate-700 bg-slate-800/80 text-slate-200 hover:bg-slate-700"
            >
              ×
            </button>
          )}
          <button
            type="button"
            aria-label="Toggle"
            onMouseDown={(e) => e.preventDefault()}
            onClick={() => {
              if (disabled) return;
              setQ(value || "");
              setOpen((v) => !v);
            }}
            className={`h-6 w-6 rounded-md border border-slate-700 bg-slate-800/80 text-slate-200 ${
              disabled ? "opacity-50 pointer-events-none" : "hover:bg-slate-700"
            }`}
          >
            ▾
          </button>
        </div>

        {open && (
          <div className="absolute left-0 right-0 z-40 mt-2 max-h-64 overflow-auto overscroll-contain rounded-xl border border-slate-800 bg-slate-900/90 backdrop-blur shadow-xl">
            {filtered.length === 0 && !canCreate && (
              <div className="px-3 py-2 text-slate-400 text-sm">No matches.</div>
            )}
            {filtered.map((name) => (
              <button
                key={name}
                type="button"
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => {
                  onChange(name);
                  setQ(name);
                  setOpen(false);
                }}
                className={`w-full text-left px-3 py-2 hover:bg-slate-800/70 ${
                  name === value ? "text-white" : "text-slate-200"
                }`}
              >
                {name}
              </button>
            ))}

            {canCreate && (
              <>
                <div className="px-3 pt-2 pb-1 text-xs uppercase tracking-wide text-slate-500">
                  Actions
                </div>
                <button
                  type="button"
                  onMouseDown={(e) => e.preventDefault()}
                  onClick={async () => {
                    const name = q.trim();
                    const row = await onCreate?.(name);
                    onChange(row?.name || name);
                    setOpen(false);
                  }}
                  className="w-full text-left px-3 py-2 hover:bg-slate-800/70 text-indigo-300"
                >
                  + Add “{q.trim()}”
                </button>
              </>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

/* ---------- page ---------- */
export default function QuickAdd() {
  const { data: orders = [], refetch } = useQuery({ queryKey: ["orders"], queryFn: getOrders });
  const { data: retailers = [] } = useQuery({ queryKey: ["retailers"], queryFn: getRetailers });
  const { data: items = [] } = useQuery({ queryKey: ["items"], queryFn: getItems });
  const { data: markets = [] } = useQuery({ queryKey: ["markets"], queryFn: getMarketplaces });

  // Local copies so +Add feels instant
  const [itemOpts, setItemOpts] = useState(items);
  const [retailerOpts, setRetailerOpts] = useState(retailers);
  const [marketOpts, setMarketOpts] = useState(markets);
  useEffect(() => setItemOpts(items), [items]);
  useEffect(() => setRetailerOpts(retailers), [retailers]);
  useEffect(() => setMarketOpts(markets), [markets]);

  // ---- form state (MarkSold layout) ----
  const today = new Date().toISOString().slice(0, 10);
  const [orderDate, setOrderDate] = useState(today);
  const [itemName, setItemName] = useState("");
  const [profileName, setProfile] = useState("");
  const [retailerName, setRetailerName] = useState("");

  const [qty, setQty] = useState(1);
  const [buyPrice, setBuyPrice] = useState("");

  const [sold, setSold] = useState(false);
  const saleDisabled = !sold;

  const [saleDate, setSaleDate] = useState("");
  const [marketName, setMarketName] = useState("");
  const [feesPct, setFeesPct] = useState("0");
  const [feesLocked, setFeesLocked] = useState(false);
  const [salePrice, setSalePrice] = useState("");
  const [shipping, setShipping] = useState("0");

  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState("");

  // Marketplace -> auto-lock fee
  useEffect(() => {
    const m = marketOpts.find((x) => x.name === marketName);
    if (m) {
      setFeesPct(((m.default_fees_pct ?? 0) * 100).toString());
      setFeesLocked(true);
    } else {
      setFeesLocked(false);
    }
  }, [marketName, marketOpts]);

  /* ---------- Add-new handlers ---------- */
  async function createItem(name) {
    const { data, error } = await supabase.from("items").insert({ name }).select().single();
    if (error) throw error;
    setItemOpts((prev) => [...prev, data]);
    return data;
  }
  async function createRetailer(name) {
    const { data, error } = await supabase.from("retailers").insert({ name }).select().single();
    if (error) throw error;
    setRetailerOpts((prev) => [...prev, data]);
    return data;
  }
  async function createMarket(name) {
    const { data, error } = await supabase
      .from("marketplaces")
      .insert({ name, default_fees_pct: 0 })
      .select()
      .single();
    if (error) throw error;
    setMarketOpts((prev) => [...prev, data]);
    return data;
  }

  /* ---------- Save (split across qty) ---------- */
  async function saveOrder(e) {
    e.preventDefault();
    setSaving(true);
    setMsg("");
    try {
      const n = Math.max(1, parseInt(qty || "1", 10));
      const buyTotal = Math.abs(moneyToCents(buyPrice));
      const saleTotal = sold ? moneyToCents(salePrice) : 0;
      const shipTotal = sold ? moneyToCents(shipping) : 0;

      const perBuy = Math.round(buyTotal / n);
      const perSale = Math.round(saleTotal / n);
      const perShip = Math.round(shipTotal / n);

      const status = perSale > 0 ? "sold" : "ordered";
      const fee = sold ? parsePct(feesPct) : 0;

      const base = {
        order_date: orderDate,
        item: itemName || null,
        profile_name: profileName || null,
        retailer: retailerName || null,
        marketplace: sold ? marketName || null : null,
        sale_date: sold ? saleDate || null : null,
        fees_pct: fee,
        status,
      };

      const rows = Array.from({ length: n }, () => ({
        ...base,
        buy_price_cents: perBuy,
        sale_price_cents: perSale,
        shipping_cents: perShip,
      }));

      const { error } = await supabase.from("orders").insert(rows);
      if (error) throw error;

      setMsg(`Saved ✔ (${n} row${n > 1 ? "s" : ""})`);

      // reset (keep date)
      setItemName("");
      setProfile("");
      setRetailerName("");
      setQty(1);
      setBuyPrice("");
      setSold(false);
      setSaleDate("");
      setMarketName("");
      setFeesPct("0");
      setFeesLocked(false);
      setSalePrice("");
      setShipping("0");

      await refetch();
      setTimeout(() => setMsg(""), 1800);
    } catch (err) {
      setMsg(String(err.message || err));
    } finally {
      setSaving(false);
    }
  }

  /* ---------- styles (copied from MarkSold) ---------- */
  const card =
    "relative z-0 rounded-2xl border border-slate-800 bg-slate-900/60 backdrop-blur p-4 sm:p-6 shadow-[0_10px_30px_rgba(0,0,0,.35)] overflow-hidden space-y-5";
  const input =
    "w-full min-w-0 bg-slate-900/60 border border-slate-800 rounded-xl px-4 py-3 text-slate-100 placeholder-slate-400 outline-none focus:ring-2 focus:ring-indigo-500";

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100">
      <div className="max-w-6xl mx-auto p-4 sm:p-6">
        {/* Shared header/tabs */}
        <HeaderWithTabs active="add" showTabs />

        {/* ===== Card (same bones as MarkSold) ===== */}
        <form onSubmit={saveOrder} className={card}>
          {/* Order details */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 min-w-0">
            <div className="min-w-0">
              <label className="text-slate-300 mb-1 block text-sm">Order Date</label>
              <input type="date" value={orderDate} onChange={(e) => setOrderDate(e.target.value)} className={input} />
            </div>

            <Combo
              label="Item"
              placeholder="Type or pick an item..."
              value={itemName}
              onChange={setItemName}
              options={itemOpts}
              onCreate={createItem}
            />

            <div className="min-w-0">
              <label className="text-slate-300 mb-1 block text-sm">Profile name (optional)</label>
              <input
                value={profileName}
                onChange={(e) => setProfile(e.target.value)}
                placeholder="name / Testing 1"
                className={input}
              />
            </div>

            <Combo
              label="Retailer"
              placeholder="Type or pick a retailer..."
              value={retailerName}
              onChange={setRetailerName}
              options={retailerOpts}
              onCreate={createRetailer}
            />

            <div className="min-w-0">
              <label className="text-slate-300 mb-1 block text-sm">Quantity</label>
              <input
                type="number"
                min={1}
                value={qty}
                onChange={(e) => setQty(parseInt(e.target.value || "1", 10))}
                className={input}
              />
              <p className="text-xs text-slate-500 mt-1">
                We’ll insert that many rows and split totals equally.
              </p>
            </div>

            <div className="min-w-0">
              <label className="text-slate-300 mb-1 block text-sm">Buy Price (total)</label>
              <input
                value={buyPrice}
                onChange={(e) => setBuyPrice(e.target.value)}
                placeholder="e.g. 67.70"
                className={input}
              />
            </div>
          </div>

          {/* Sale header + toggle */}
          <div className="mt-2 flex items-center justify-between gap-3">
            <h3 className="text-lg font-semibold">
              Sale details <span className="text-slate-400 text-sm">(optional – if sold)</span>
            </h3>

            <label className="inline-flex items-center gap-2 cursor-pointer select-none">
              <span className="text-sm text-slate-300">Sold</span>
              <span className={`relative h-6 w-11 rounded-full transition-colors ${sold ? "bg-emerald-500/80" : "bg-slate-700"}`}>
                <input
                  type="checkbox"
                  checked={sold}
                  onChange={(e) => setSold(e.target.checked)}
                  className="sr-only"
                  aria-label="Sold toggle"
                />
                <span
                  className={`absolute top-1/2 -translate-y-1/2 h-5 w-5 rounded-full bg-white shadow transition-all ${
                    sold ? "left-[22px]" : "left-[2px]"
                  }`}
                />
              </span>
            </label>
          </div>

          {/* Sale details grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 min-w-0">
            <div className="min-w-0">
              <label className="text-slate-300 mb-1 block text-sm">Sale Date</label>
              <input
                type="date"
                value={saleDate}
                onChange={(e) => setSaleDate(e.target.value)}
                disabled={saleDisabled}
                className={`${input} ${saleDisabled ? "opacity-60 cursor-not-allowed" : ""}`}
              />
            </div>

            <Combo
              label="Marketplace"
              placeholder="Type or pick a marketplace..."
              value={marketName}
              onChange={setMarketName}
              options={marketOpts}
              onCreate={createMarket}
              disabled={saleDisabled}
            />

            <div className="min-w-0">
              <label className="text-slate-300 mb-1 block text-sm">Sell Price (total)</label>
              <input
                value={salePrice}
                onChange={(e) => setSalePrice(e.target.value)}
                placeholder="0 = unsold"
                disabled={saleDisabled}
                className={`${input} ${saleDisabled ? "opacity-60 cursor-not-allowed" : ""}`}
              />
              <p className="text-xs text-slate-500 mt-1">If qty &gt; 1 we’ll split this total across rows.</p>
            </div>

            <div className="min-w-0">
              <label className="text-slate-300 mb-1 block text-sm">Fees (%)</label>
              <input
                value={feesPct}
                onChange={(e) => !feesLocked && setFeesPct(e.target.value)}
                placeholder="e.g. 9 or 9%"
                disabled={saleDisabled || feesLocked}
                className={`${input} ${saleDisabled || feesLocked ? "opacity-60 cursor-not-allowed" : ""}`}
              />
              {feesLocked && <p className="text-xs text-slate-500 mt-1">Locked from marketplace default.</p>}
            </div>

            <div className="min-w-0 md:col-span-2">
              <label className="text-slate-300 mb-1 block text-sm">Shipping (total)</label>
              <input
                value={shipping}
                onChange={(e) => setShipping(e.target.value)}
                disabled={saleDisabled}
                className={`${input} ${saleDisabled ? "opacity-60 cursor-not-allowed" : ""}`}
                placeholder="0"
              />
              <p className="text-xs text-slate-500 mt-1">If qty &gt; 1 we’ll split shipping across rows.</p>
            </div>
          </div>

          {/* Submit (same look/feel as MarkSold) */}
          <div className="pt-2">
            <button
              type="submit"
              disabled={saving}
              className="w-full h-12 rounded-2xl bg-indigo-600 hover:bg-indigo-500 text-white font-medium"
            >
              {saving ? "Saving…" : "Save"}
            </button>
            {msg && (
              <div className={`mt-2 text-sm ${msg.startsWith("Saved") ? "text-emerald-400" : "text-rose-400"}`}>
                {msg}
              </div>
            )}
          </div>
        </form>

        {/* Recent orders (kept the compact list) */}
        <div className="mt-10">
          <h2 className="text-xl font-semibold mb-4">Your recent orders</h2>
          <div className="grid gap-3">
            {orders.map((o) => (
              <div key={o.id} className="rounded-xl border border-slate-800 bg-slate-900/60 p-4">
                <div className="flex items-center justify-between gap-3">
                  <div className="font-semibold truncate">
                    {o.order_date} • {o.item ?? "—"} {o.retailer ? `@ ${o.retailer}` : ""}
                  </div>
                  <div
                    className={`text-sm font-semibold shrink-0 ${
                      Number(o.pl_cents) >= 0 ? "text-emerald-400" : "text-rose-400"
                    }`}
                  >
                    P/L ${centsToStr(o.pl_cents)}
                  </div>
                </div>
                <div className="text-sm text-slate-300">
                  Buy ${centsToStr(o.buy_price_cents)} • Sell ${centsToStr(o.sale_price_cents)} • Ship $
                  {centsToStr(o.shipping_cents)}
                  {o.fees_pct ? ` • Fees ${(Number(o.fees_pct) * 100).toFixed(2)}%` : ""} •{" "}
                  {o.marketplace || "—"} • {o.status}
                </div>
              </div>
            ))}
            {orders.length === 0 && <div className="text-slate-400">No orders yet.</div>}
          </div>
        </div>
      </div>
    </div>
  );
}

