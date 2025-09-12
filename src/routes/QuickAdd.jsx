// src/routes/QuickAdd.jsx
import { useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "../lib/supabaseClient";
import LayoutWithSidebar from "../components/LayoutWithSidebar.jsx";
import PageHeader from "../components/PageHeader.jsx";
import { moneyToCents, parsePct, formatNumber } from "../utils/money.js";
import { card, inputBase, dateFix, disabledInput } from "../utils/ui.js";

/* ------------------------------ queries ----------------------------- */
async function getItems() {
  const { data, error } = await supabase
    .from("items")
    .select("id, name")
    .order("name", { ascending: true });
  if (error) throw error;
  return data || [];
}
async function getRetailers() {
  const { data, error } = await supabase
    .from("retailers")
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

/* --------------------- anchored-menu positioning hook --------------------- */
function useAnchoredRect(ref, open, offsetY = 8) {
  const [rect, setRect] = useState({ top: 0, left: 0, width: 0 });
  useEffect(() => {
    if (!open) return;
    const recalc = () => {
      const r = ref.current?.getBoundingClientRect();
      if (!r) return;
      setRect({ top: r.bottom + offsetY, left: r.left, width: r.width });
    };
    recalc();
    window.addEventListener("scroll", recalc, { passive: true });
    window.addEventListener("resize", recalc);
    return () => {
      window.removeEventListener("scroll", recalc);
      window.removeEventListener("resize", recalc);
    };
  }, [ref, open, offsetY]);
  return rect;
}

/* ------------------------- Reusable Combo (single) ------------------------- */
function Combo({
  placeholder = "Type…",
  value,
  setValue,
  options = [], // array of strings
  onCreate,     // async (name) => createdName | null
  disabled = false,
  label,
}) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const inputRef = useRef(null);
  const boxRef = useRef(null);
  const menuRef = useRef(null);
  const rect = useAnchoredRect(boxRef, open);

  // close on outside click (but ignore clicks inside the PORTALED menu)
  useEffect(() => {
    const onDocClick = (e) => {
      if (!open) return;
      const t = e.target;
      if (boxRef.current?.contains(t)) return;
      if (menuRef.current?.contains(t)) return;
      setOpen(false);
    };
    window.addEventListener("click", onDocClick); // use 'click' so option onClick fires first
    return () => window.removeEventListener("click", onDocClick);
  }, [open]);

  const text = value || query;
  const normalized = text.trim().toLowerCase();
  const filtered = useMemo(() => {
    if (!normalized) return options.slice(0, 200);
    return options.filter((n) => n.toLowerCase().includes(normalized)).slice(0, 200);
  }, [options, normalized]);

  const existsExact =
    normalized && options.some((n) => n.toLowerCase() === normalized);

  return (
    <div className="min-w-0">
      {label && <label className="text-slate-300 mb-1 block text-sm">{label}</label>}
      <div ref={boxRef} className="relative min-w-0">
        <input
          ref={inputRef}
          value={text}
          disabled={disabled}
          onChange={(e) => {
            setValue("");     // typing switches to search mode
            setQuery(e.target.value);
            if (!disabled) setOpen(true);
          }}
          onFocus={() => !disabled && setOpen(true)}
          placeholder={placeholder}
          className={`${inputBase} ${disabled ? disabledInput : ""}`}
        />
        {/* clear button inside input */}
        {text && !disabled && (
          <button
            type="button"
            onMouseDown={(e) => e.preventDefault()} // keep focus
            onClick={() => {
              setValue("");
              setQuery("");
              setOpen(true);
              inputRef.current?.focus();
            }}
            aria-label="Clear"
            className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-200"
          >
            ×
          </button>
        )}

        {/* floating menu via portal */}
        {open &&
          createPortal(
            <div
              ref={menuRef}
              className="fixed z-[200] max-h-64 overflow-auto overscroll-contain rounded-xl border border-slate-800 bg-slate-900/95 backdrop-blur shadow-xl"
              style={{ top: rect.top, left: rect.left, width: rect.width }}
            >
              {/* Clear row */}
              {value && (
                <button
                  type="button"
                  onClick={() => {
                    setValue("");
                    setQuery("");
                    inputRef.current?.focus();
                  }}
                  className="w-full text-left px-3 py-2 text-slate-300 hover:bg-slate-800/70"
                >
                  Clear selection
                </button>
              )}

              {/* Add row */}
              {!existsExact && normalized && (
                <button
                  type="button"
                  onClick={async () => {
                    if (!onCreate) return;
                    const createdName = await onCreate(text.trim());
                    if (createdName) {
                      setValue(createdName);
                      setQuery("");
                      setOpen(false);
                    }
                  }}
                  className="w-full text-left px-3 py-2 text-indigo-300 hover:bg-slate-800/70"
                >
                  + Add “{text.trim()}”
                </button>
              )}

              {/* Options */}
              {filtered.length === 0 && (
                <div className="px-3 py-2 text-slate-400 text-sm">No matches.</div>
              )}
              {filtered.map((opt) => (
                <button
                  type="button"
                  key={opt}
                  onClick={() => {
                    setValue(opt);
                    setQuery("");
                    setOpen(false);
                  }}
                  className="w-full text-left px-3 py-2 hover:bg-slate-800/70"
                >
                  {opt}
                </button>
              ))}
            </div>,
            document.body
          )}
      </div>
    </div>
  );
}

/* ------------------------- Smooth Collapse container ------------------------ */
function Collapse({ open, children, duration = 280 }) {
  const innerRef = useRef(null);
  const [height, setHeight] = useState(0);

  // measure content height
  useEffect(() => {
    const el = innerRef.current;
    if (!el) return;
    const measure = () => setHeight(el.scrollHeight);
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    return () => ro.disconnect();
  }, [children]);

  return (
    <div
      className="overflow-hidden will-change-[height,opacity,transform]"
      style={{
        height: open ? height : 0,
        opacity: open ? 1 : 0,
        transform: open ? "translateY(0px)" : "translateY(-4px)",
        transition: `height ${duration}ms ease, opacity ${duration}ms ease, transform ${duration}ms ease`,
        pointerEvents: open ? "auto" : "none",
      }}
      aria-hidden={!open}
    >
      <div ref={innerRef}>{children}</div>
    </div>
  );
}

/* --------------------------------- page --------------------------------- */
export default function QuickAdd() {
  const { data: items = [], refetch: refetchItems } = useQuery({
    queryKey: ["items-combo"],
    queryFn: getItems,
  });
  const { data: retailers = [], refetch: refetchRetailers } = useQuery({
    queryKey: ["retailers-combo"],
    queryFn: getRetailers,
  });
  const { data: markets = [], refetch: refetchMarkets } = useQuery({
    queryKey: ["markets-combo"],
    queryFn: getMarketplaces,
  });


  /* ------------------------------ form state ------------------------------ */
  const today = new Date().toISOString().slice(0, 10);

  // order fields
  const [orderDate, setOrderDate] = useState(today);
  const [itemName, setItemName] = useState("");
  const [profileName, setProfile] = useState("");
  const [retailerName, setRetailerName] = useState("");
  const [qtyStr, setQtyStr] = useState(""); // <-- string input for easy backspace/edit
  const [buyPrice, setBuyPrice] = useState("");

  // sale fields
  const [sold, setSold] = useState(false);
  const [saleDate, setSaleDate] = useState("");
  const [marketName, setMarketName] = useState("");
  const [salePrice, setSalePrice] = useState("");
  const [feesPct, setFeesPct] = useState("0");
  const [feesLocked, setFeesLocked] = useState(false);
  const [shipping, setShipping] = useState("0");

  // ui
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState("");

  /* -------------------------- derived lists (names) ------------------------- */
  const itemNames = useMemo(() => items.map((i) => i.name).filter(Boolean), [items]);
  const retailerNames = useMemo(() => retailers.map((r) => r.name).filter(Boolean), [retailers]);
  const marketNames = useMemo(() => markets.map((m) => m.name).filter(Boolean), [markets]);

  /* ------------------------------- creators -------------------------------- */
  async function createItem(name) {
    const trimmed = name.trim();
    if (!trimmed) return null;
    const { error } = await supabase.from("items").insert([{ name: trimmed }]);
    if (error) {
      setMsg(error.message);
      return null;
    }
    await refetchItems();
    return trimmed;
  }
  async function createRetailer(name) {
    const trimmed = name.trim();
    if (!trimmed) return null;
    const { error } = await supabase.from("retailers").insert([{ name: trimmed }]);
    if (error) {
      setMsg(error.message);
      return null;
    }
    await refetchRetailers();
    return trimmed;
  }
  async function createMarket(name) {
    const trimmed = name.trim();
    if (!trimmed) return null;
    const { error } = await supabase
      .from("marketplaces")
      .insert([{ name: trimmed, default_fees_pct: 0 }]);
    if (error) {
      setMsg(error.message);
      return null;
    }
    await refetchMarkets();
    return trimmed;
  }

  /* -------------------- marketplace -> autofill default fee ------------------- */
  useEffect(() => {
    if (!marketName) {
      setFeesLocked(false);
      return;
    }
    const m = markets.find((x) => x.name === marketName);
    if (m && typeof m.default_fees_pct === "number") {
      setFeesPct(String((m.default_fees_pct || 0) * 100));
      setFeesLocked(true);
    } else {
      setFeesLocked(false);
    }
  }, [marketName, markets]);

  // If user toggles off "sold", ensure fee field becomes unlocked/neutral
  useEffect(() => {
    if (!sold) setFeesLocked(false);
  }, [sold]);

  /* --------------------------------- save --------------------------------- */
  async function onSave(e) {
    e.preventDefault();
    setSaving(true);
    setMsg("");
    try {
      // sanitize qty (allow empty -> default 1)
      const qty = Math.max(1, parseInt((qtyStr || "1").replace(/[^\d]/g, ""), 10) || 1);

      const buyTotal = Math.abs(moneyToCents(buyPrice));
      const saleTotal = moneyToCents(salePrice);
      const shipTotal = moneyToCents(shipping);

      const perBuy = Math.round(qty ? buyTotal / qty : 0);
      const perSale = Math.round(qty ? saleTotal / qty : 0);
      const perShip = Math.round(qty ? shipTotal / qty : 0);

      const status = sold && perSale > 0 ? "sold" : "ordered";

      const base = {
        order_date: orderDate,
        item: itemName || null,
        profile_name: profileName || null,
        retailer: retailerName || null,
        marketplace: sold ? marketName || null : null,
        sale_date: sold ? saleDate || null : null,
        fees_pct: sold ? parsePct(feesPct) : 0,
        status,
      };

      const rows = Array.from({ length: qty }, () => ({
        ...base,
        buy_price_cents: perBuy,
        sale_price_cents: sold ? perSale : 0,
        shipping_cents: sold ? perShip : 0,
      }));

      const { error } = await supabase.from("orders").insert(rows);
      if (error) throw error;

      setMsg(`Saved ✔ (${qty} row${qty > 1 ? "s" : ""})`);

      // reset
      setItemName("");
      setRetailerName("");
      setQtyStr(""); // back to empty placeholder
      setBuyPrice("");
      setSold(false);
      setSaleDate("");
      setMarketName("");
      setSalePrice("");
      setFeesPct("0");
      setFeesLocked(false);
      setShipping("0");
    } catch (err) {
      setMsg(String(err.message || err));
    } finally {
      setSaving(false);
      setTimeout(() => setMsg(""), 2000);
    }
  }

  /* -------------------------------- render -------------------------------- */
  return (
    <LayoutWithSidebar active="add" section="orderbook">
      <PageHeader title="Quick Add" />

        <form onSubmit={onSave} className={`${card} space-y-6`}>
          {/* ORDER */}
          <div>
            <h2 className="text-lg font-semibold">Order details</h2>
            <p className="text-slate-400 text-sm -mt-1">Add a new or existing order</p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 min-w-0">
            <div className="min-w-0">
              <label className="text-slate-300 mb-1 block text-sm">Order Date</label>
              <input
                type="date"
                value={orderDate}
                onChange={(e) => setOrderDate(e.target.value)}
                className={`${inputBase} ${dateFix}`}
              />
            </div>

            <Combo
              label="Item"
              placeholder="Add or select an item…"
              value={itemName}
              setValue={setItemName}
              options={itemNames}
              onCreate={createItem}
            />

            <div className="min-w-0">
              <label className="text-slate-300 mb-1 block text-sm">Profile (optional)</label>
              <input
                value={profileName}
                onChange={(e) => setProfile(e.target.value)}
                placeholder="e.g. Target 3244"
                className={inputBase}
              />
            </div>

            <Combo
              label="Retailer"
              placeholder="Add or select a retailer…"
              value={retailerName}
              setValue={setRetailerName}
              options={retailerNames}
              onCreate={createRetailer}
            />

            <div className="min-w-0">
              <label className="text-slate-300 mb-1 block text-sm">Quantity</label>
              <input
                type="text"
                inputMode="numeric"
                pattern="[0-9]*"
                value={qtyStr}
                onChange={(e) => {
                  // allow empty while typing; keep only digits
                  const v = e.target.value.replace(/[^\d]/g, "");
                  setQtyStr(v);
                }}
                placeholder="e.g. 3"
                className={inputBase}
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
                className={inputBase}
              />
            </div>
          </div>

          {/* SALE (header + toggle) */}
          <div className="mt-2 flex items-center justify-between">
            <div>
              <h2 className="text-lg font-semibold">
                Sale details</h2>
              <p className="text-slate-400 text-sm -mt-1">If an order has already sold</p>
            </div>
            <Toggle value={sold} onChange={setSold} label="Sold" />
          </div>

          {/* Smoothly collapsing sale fields */}
          <Collapse open={sold}>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 min-w-0">
              <div className="min-w-0">
                <label className="text-slate-300 mb-1 block text-sm">Sale Date</label>
                <input
                  type="date"
                  value={saleDate}
                  onChange={(e) => setSaleDate(e.target.value)}
                  className={`${inputBase} ${dateFix}`}
                />
              </div>

              <Combo
                label="Marketplace"
                placeholder="Add or select a marketplace…"
                value={marketName}
                setValue={setMarketName}
                options={marketNames}
                onCreate={createMarket}
              />

              <div className="min-w-0">
                <label className="text-slate-300 mb-1 block text-sm">Sell Price (total)</label>
                <input
                  value={salePrice}
                  onChange={(e) => setSalePrice(e.target.value)}
                  placeholder="0"
                  className={inputBase}
                />
                <p className="text-xs text-slate-500 mt-1">
                  If qty &gt; 1 we’ll split this total across rows.
                </p>
              </div>

              <div className="min-w-0">
                <label className="text-slate-300 mb-1 block text-sm">Fees (%)</label>
                <input
                  value={feesPct}
                  onChange={(e) => !feesLocked && setFeesPct(e.target.value)}
                  placeholder="e.g. 9 or 9%"
                  disabled={feesLocked}
                  className={`${inputBase} ${feesLocked ? disabledInput : ""}`}
                />
                <p className="text-xs text-slate-500 mt-1">
                  Auto filled once a marketplace is selected..
                </p>
                {feesLocked && (
                  <p className="text-xs text-slate-500 mt-1">Locked from marketplace default.</p>
                )}
              </div>

              <div className="min-w-0 md:col-span-2">
                <label className="text-slate-300 mb-1 block text-sm">Shipping (total)</label>
                <input
                  value={shipping}
                  onChange={(e) => setShipping(e.target.value)}
                  className={inputBase}
                  placeholder="0"
                />
                <p className="text-xs text-slate-500 mt-1">
                  If qty &gt; 1 we’ll split shipping across rows.
                </p>
              </div>
            </div>
          </Collapse>

          {/* Save */}
          <div className="pt-2">
            <button
              type="submit"
              disabled={saving}
              className="w-full h-12 rounded-2xl bg-indigo-600 hover:bg-indigo-500 text-white font-medium"
            >
              {saving ? "Saving…" : "Add Order"}
            </button>
            {msg && (
              <div
                className={`mt-2 text-sm ${
                  msg && msg.startsWith("Saved") ? "text-emerald-400" : "text-rose-400"
                }`}
              >
                {msg}
              </div>
            )}
          </div>
        </form>
    </LayoutWithSidebar>
  );
}

/* ------------------------------- small UI ------------------------------- */
function Toggle({ value, onChange, label }) {
  return (
    <button
      type="button"
      onClick={() => onChange(!value)}
      className="inline-flex items-center gap-2 select-none"
      aria-pressed={value}
    >
      <span
        className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
          value ? "bg-indigo-600" : "bg-slate-700"
        }`}
      >
        <span
          className={`h-5 w-5 rounded-full bg-white shadow transform transition-transform ${
            value ? "translate-x-[22px]" : "translate-x-[3px]"
          }`}
        />
      </span>
      <span className="text-slate-200 text-sm">{label}</span>
    </button>
  );
}