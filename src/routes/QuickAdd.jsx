// src/routes/QuickAdd.jsx
import { useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
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
  const { data, error } = await supabase.from("retailers").select("id, name");
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
async function getMarketplaces() {
  const { data, error } = await supabase
    .from("marketplaces")
    .select("id, name, default_fees_pct")
    .order("name", { ascending: true });
  if (error) throw error;
  return data || [];
}

/* ===================== COMBOBOX (with create + portal panel) ===================== */
function useViewportLock() {
  // Prevent pinch-zoom while this route is mounted; restore afterwards
  useEffect(() => {
    const meta = document.querySelector('meta[name="viewport"]');
    if (!meta) return;
    const prev = meta.getAttribute("content") || "width=device-width, initial-scale=1";
    const cleaned = prev
      .replace(/user-scalable\s*=\s*[^,]+,?\s*/gi, "")
      .replace(/maximum-scale\s*=\s*[^,]+,?\s*/gi, "")
      .trim();
    meta.setAttribute("content", `${cleaned}, maximum-scale=1, user-scalable=no`);
    return () => meta.setAttribute("content", prev);
  }, []);
}

function useFixedPanelPos(anchorRef, open, gap = 8) {
  const [rect, setRect] = useState(null);
  useEffect(() => {
    if (!open) return;
    function measure() {
      const el = anchorRef.current;
      if (!el) return;
      const r = el.getBoundingClientRect();
      setRect({
        left: r.left + window.scrollX,
        top: r.bottom + window.scrollY + gap,
        width: r.width,
      });
    }
    measure();
    const onScroll = () => measure();
    const onResize = () => measure();
    window.addEventListener("scroll", onScroll, true);
    window.addEventListener("resize", onResize);
    return () => {
      window.removeEventListener("scroll", onScroll, true);
      window.removeEventListener("resize", onResize);
    };
  }, [anchorRef, open, gap]);
  return rect;
}

function Combo({
  label,
  placeholder = "Type or pick…",
  value, // string (selected name)
  onChange, // set selected string (or '')
  options, // [{id?, name}]
  onCreate, // async (name) => createdRow | throws
  disabled = false,
}) {
  const rootRef = useRef(null);
  const inputRef = useRef(null);
  const anchorRef = useRef(null);

  const [open, setOpen] = useState(false);
  const [q, setQ] = useState("");
  const rect = useFixedPanelPos(anchorRef, open, 6);

  // Build filtered list
  const names = useMemo(() => options.map((o) => o.name), [options]);
  const filtered = useMemo(() => {
    const needle = (q || "").trim().toLowerCase();
    if (!needle) return names.slice(0, 100);
    return names.filter((n) => n.toLowerCase().includes(needle)).slice(0, 100);
  }, [names, q]);

  // close on outside click
  useEffect(() => {
    function onDoc(e) {
      if (!rootRef.current) return;
      if (!rootRef.current.contains(e.target)) setOpen(false);
    }
    document.addEventListener("mousedown", onDoc, true);
    return () => document.removeEventListener("mousedown", onDoc, true);
  }, []);

  const showCreate = q.trim().length > 0 && !names.some((n) => n.toLowerCase() === q.trim().toLowerCase());

  return (
    <div ref={rootRef} className="min-w-0">
      {label && <label className="text-slate-300 mb-1 block text-sm">{label}</label>}

      <div ref={anchorRef} className="relative">
        <input
          ref={inputRef}
          value={open ? q : value}
          onChange={(e) => {
            setQ(e.target.value);
            setOpen(true);
          }}
          onFocus={() => {
            setQ(value || "");
            setOpen(true);
          }}
          placeholder={placeholder}
          disabled={disabled}
          className={`w-full min-w-0 bg-slate-900/60 border border-slate-800 rounded-xl px-4 py-3 pr-12 text-slate-100 placeholder-slate-400 focus:ring-2 focus:ring-indigo-500 ${
            disabled ? "opacity-60 cursor-not-allowed" : ""
          }`}
        />

        {/* Clear & caret buttons */}
        <div className="absolute right-2 top-1/2 -translate-y-1/2 flex items-center gap-1">
          {!!(value && !disabled) && (
            <button
              type="button"
              aria-label="Clear"
              onMouseDown={(e) => e.preventDefault()}
              onClick={() => {
                onChange("");
                setQ("");
                setOpen(true);
                inputRef.current?.focus();
              }}
              className="h-6 w-6 rounded-md border border-slate-700 bg-slate-800/80 text-slate-200 hover:bg-slate-700"
            >
              ×
            </button>
          )}
          <button
            type="button"
            onMouseDown={(e) => e.preventDefault()}
            onClick={() => {
              setQ(value || "");
              setOpen((v) => !v);
              inputRef.current?.focus();
            }}
            className="h-6 w-6 rounded-md border border-slate-700 bg-slate-800/80 text-slate-200 hover:bg-slate-700"
            aria-label="Toggle options"
          >
            ▾
          </button>
        </div>
      </div>

      {/* Floating panel rendered to body — always above everything */}
      {open &&
        rect &&
        createPortal(
          <div
            className="z-[9999] fixed rounded-xl border border-slate-800 bg-slate-900/95 backdrop-blur shadow-2xl overflow-auto"
            style={{ left: rect.left, top: rect.top, width: rect.width, maxHeight: 280 }}
          >
            <div className="py-1">
              {filtered.map((n) => (
                <button
                  key={n}
                  type="button"
                  onMouseDown={(e) => e.preventDefault()}
                  onClick={() => {
                    onChange(n);
                    setQ(n);
                    setOpen(false);
                  }}
                  className={`w-full text-left px-3 py-2 hover:bg-slate-800 ${
                    n === value ? "text-white" : "text-slate-200"
                  }`}
                >
                  {n}
                </button>
              ))}

              {filtered.length === 0 && !showCreate && (
                <div className="px-3 py-3 text-slate-400">No matches</div>
              )}

              {showCreate && (
                <>
                  <div className="px-3 pt-2 pb-1 text-xs uppercase tracking-wide text-slate-500">Actions</div>
                  <button
                    type="button"
                    onMouseDown={(e) => e.preventDefault()}
                    onClick={async () => {
                      if (!onCreate) return;
                      const created = await onCreate(q.trim());
                      onChange(created?.name || q.trim());
                      setOpen(false);
                    }}
                    className="w-full text-left px-3 py-2 hover:bg-slate-800 text-indigo-300"
                  >
                    + Add “{q.trim()}”
                  </button>
                </>
              )}
            </div>
          </div>,
          document.body
        )}
    </div>
  );
}

/* ================================ PAGE ================================= */
export default function QuickAdd() {
  useViewportLock();

  const { data: orders = [], isLoading, error, refetch } = useQuery({
    queryKey: ["orders"],
    queryFn: getOrders,
  });
  const { data: retailersQ = [] } = useQuery({ queryKey: ["retailers"], queryFn: getRetailers });
  const { data: itemsQ = [] } = useQuery({ queryKey: ["items"], queryFn: getItems });
  const { data: marketsQ = [] } = useQuery({ queryKey: ["markets"], queryFn: getMarketplaces });

  // Local option lists so new rows appear instantly
  const [itemOpts, setItemOpts] = useState(itemsQ);
  const [retailerOpts, setRetailerOpts] = useState(retailersQ);
  const [marketOpts, setMarketOpts] = useState(marketsQ);
  useEffect(() => setItemOpts(itemsQ), [itemsQ]);
  useEffect(() => setRetailerOpts(retailersQ), [retailersQ]);
  useEffect(() => setMarketOpts(marketsQ), [marketsQ]);

  // user (header uses this)
  const [userInfo, setUserInfo] = useState({ avatar_url: "", username: "" });
  useEffect(() => {
    async function loadUser() {
      const {
        data: { user },
      } = await supabase.auth.getUser();
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

  /* ---- form state ---- */
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

  /* ---------- create handlers for combos ---------- */
  async function createItemByName(name) {
    const { data, error } = await supabase.from("items").insert({ name }).select().single();
    if (error) throw error;
    setItemOpts((prev) => [...prev, data]);
    return data;
  }
  async function createRetailerByName(name) {
    const { data, error } = await supabase.from("retailers").insert({ name }).select().single();
    if (error) throw error;
    setRetailerOpts((prev) => [...prev, data]);
    return data;
  }
  async function createMarketByName(name) {
    const { data, error } = await supabase
      .from("marketplaces")
      .insert({ name, default_fees_pct: 0 })
      .select()
      .single();
    if (error) throw error;
    setMarketOpts((prev) => [...prev, data]);
    return data;
  }

  // auto-lock fees when a known marketplace is selected
  useEffect(() => {
    const m = marketOpts.find((x) => x.name === marketName);
    if (m) {
      setFeesPct(((m.default_fees_pct ?? 0) * 100).toString());
      setFeesLocked(true);
    } else {
      setFeesLocked(false);
    }
  }, [marketName, marketOpts]);

  /* ---------- save ---------- */
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

      // reset (keep order date)
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
    } catch (err) {
      setMsg(String(err.message || err));
    } finally {
      setSaving(false);
    }
  }

  /* ---------- UI tokens ---------- */
  const card =
    "rounded-2xl border border-slate-800 bg-slate-900/60 backdrop-blur p-4 sm:p-6 shadow-[0_10px_30px_rgba(0,0,0,.35)]";
  const input =
    "w-full min-w-0 appearance-none bg-slate-900/60 border border-slate-800 rounded-xl px-4 py-3 text-slate-100 placeholder-slate-400 focus:ring-2 focus:ring-indigo-500";

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100">
      <div className="max-w-6xl mx-auto p-4 sm:p-6">
        <HeaderWithTabs active="add" showTabs />

        <form onSubmit={saveOrder} className="space-y-6">
          {/* ORDER + SALE (single card, no overflow clipping so panels can float) */}
          <div className={`${card} overflow-visible`}>
            <h2 className="text-lg font-semibold mb-4">Order details</h2>

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
                onCreate={createItemByName}
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
                onCreate={createRetailerByName}
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
                <p className="text-xs text-slate-500 mt-1">We’ll insert that many rows and split totals equally.</p>
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

            {/* SALE SECTION HEADER + TOGGLE */}
            <div className="mt-6 mb-2 flex items-center justify-between gap-3">
              <h3 className="text-lg font-semibold">
                Sale details <span className="text-slate-400 text-sm">(optional – if sold)</span>
              </h3>

              {/* Pretty switch */}
              <label className="inline-flex items-center gap-2 cursor-pointer select-none">
                <span className="text-sm text-slate-300">Sold</span>
                <span
                  className={`relative h-6 w-11 rounded-full transition-colors ${
                    sold ? "bg-emerald-500/80" : "bg-slate-700"
                  }`}
                >
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

            {/* SALE FIELDS */}
            <div className={`grid grid-cols-1 md:grid-cols-2 gap-4 min-w-0`}>
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
                onCreate={createMarketByName}
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
                  className={`${input} ${
                    saleDisabled || feesLocked ? "opacity-60 cursor-not-allowed" : ""
                  }`}
                />
                {feesLocked && <p className="text-xs text-slate-500 mt-1">Locked from marketplace default.</p>}
              </div>

              <div className="min-w-0">
                <label className="text-slate-300 mb-1 block text-sm">Shipping (total)</label>
                <input
                  value={shipping}
                  onChange={(e) => setShipping(e.target.value)}
                  disabled={saleDisabled}
                  className={`${input} ${saleDisabled ? "opacity-60 cursor-not-allowed" : ""}`}
                />
                <p className="text-xs text-slate-500 mt-1">If qty &gt; 1 we’ll split shipping across rows.</p>
              </div>
            </div>

            <div className="mt-6 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div className={`text-sm ${msg.startsWith("Saved") ? "text-emerald-400" : "text-rose-400"}`}>{msg}</div>
              <button className="px-6 py-3 rounded-2xl bg-indigo-600 hover:bg-indigo-500 text-white" disabled={saving}>
                {saving ? "Saving…" : "Save"}
              </button>
            </div>
          </div>
        </form>

        {/* Recent orders */}
        <div className="mt-10">
          <h2 className="text-xl font-semibold mb-4">Your recent orders</h2>
          {isLoading && <div className="text-slate-400">Loading…</div>}
          {error && <div className="text-rose-400">{String(error)}</div>}

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
                  {o.fees_pct ? ` • Fees ${(Number(o.fees_pct) * 100).toFixed(2)}%` : ""} • {o.marketplace || "—"} •{" "}
                  {o.status}
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
