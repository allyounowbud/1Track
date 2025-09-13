// src/routes/MarkSold.jsx
import { useEffect, useMemo, useRef, useState } from "react";
import { NavLink, Link } from 'react-router-dom';
import { useQuery } from "@tanstack/react-query";
import { supabase } from "../lib/supabaseClient";
import LayoutWithSidebar from "../components/LayoutWithSidebar.jsx";
import PageHeader from "../components/PageHeader.jsx";
import { moneyToCents, centsToStr, parsePct, formatNumber } from "../utils/money.js";
import { Select } from "../components/Select.jsx";
import { SearchDropdown } from "../components/SearchDropdown.jsx";
import { inputBase, disabledInput } from "../utils/ui.js";

/* ---------- queries ---------- */
async function getUnsoldOrders() {
  // Inventory = orders with no sale or 0 sale
  const { data, error } = await supabase
    .from("orders")
    .select("id, order_date, item, retailer, buy_price_cents")
    .or("sale_price_cents.is.null,sale_price_cents.eq.0")
    .order("order_date", { ascending: false })
    .limit(500);
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

  // close on outside click
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

        {/* dropdown menu */}
        {open && (
          <div
            ref={menuRef}
            className="absolute left-0 right-0 z-[99999] mt-2 max-h-64 overflow-y-auto overscroll-contain rounded-xl border border-slate-800 bg-slate-900 shadow-xl"
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
                  className="w-full text-left px-3 py-2 text-slate-200 hover:bg-slate-800/70"
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
                  + Add "{text.trim()}"
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
                  className="w-full text-left px-3 py-2 text-slate-100 hover:bg-slate-800/70"
                >
                  {opt}
                </button>
              ))}
          </div>
        )}
      </div>
    </div>
  );
}


export default function MarkSold() {

  const { data: openOrders = [], refetch: refetchOpen } = useQuery({
    queryKey: ["openOrders"],
    queryFn: getUnsoldOrders,
  });
  const { data: markets = [], refetch: refetchMarkets } = useQuery({
    queryKey: ["markets-for-sell"],
    queryFn: getMarketplaces,
  });

  // ---------- form state ----------
  const today = new Date().toISOString().slice(0, 10);

  const [selected, setSelected] = useState(null); // order object
  const [search, setSearch] = useState(""); // search term for dropdown

  const [salePrice, setSalePrice] = useState("");
  const [saleDate, setSaleDate] = useState(today);
  const [marketName, setMarketName] = useState("");
  const [feesPct, setFeesPct] = useState("");       // shown as % text, e.g. "10" or "10.5"
  const [feesLocked, setFeesLocked] = useState(false);
  const [shipping, setShipping] = useState("0");

  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState("");

  // ---------- searchable dropdown (mobile-safe) ----------

  const label = (o) =>
    `${o.item ?? "—"} • ${o.retailer ?? "—"} • ${o.order_date} • Buy $${centsToStr(
      o.buy_price_cents
    )}`;

  // ---------- marketplace creation ----------
  async function createMarketplace(name) {
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

  // ---------- marketplace -> autofill fee ----------
  useEffect(() => {
    if (!marketName) {
      setFeesLocked(false);
      setFeesPct("");
      return;
    }
    const m = markets.find((x) => x.name === marketName);
    if (m) {
      // show % to the user (like Quick Add)
      setFeesPct(((m.default_fees_pct ?? 0) * 100).toString());
      setFeesLocked(true);
    } else {
      setFeesLocked(false);
    }
  }, [marketName, markets]);

  // ---------- save ----------
  async function markSold(e) {
    e.preventDefault();
    if (!selected) {
      setMsg("Pick a purchase first");
      return;
    }
    setSaving(true);
    setMsg("");
    try {
      const { error } = await supabase
        .from("orders")
        .update({
          sale_price_cents: moneyToCents(salePrice),
          sale_date: saleDate || today,
          marketplace: marketName || null,
          fees_pct: parsePct(feesPct),
          shipping_cents: moneyToCents(shipping),
          status: "sold",
        })
        .eq("id", selected.id);

      if (error) throw error;

      setMsg("Marked sold ✓");
      // reset most fields; keep marketplace if you want—here we keep it to speed multiple entries
      setSelected(null);
      setSearch("");
      setSalePrice("");
      setSaleDate(today);
      setShipping("0");
      await refetchOpen();
    } catch (err) {
      setMsg(String(err.message || err));
    } finally {
      setSaving(false);
      setTimeout(() => setMsg(""), 1800);
    }
  }


  return (
    <LayoutWithSidebar active="sold" section="orderbook">
      <PageHeader title="Mark as Sold" />
        {/* ==================================== */}

        {/* Card (mobile-friendly: overflow-hidden, min-w-0, responsive gaps) */}
        <form
          onSubmit={markSold}
          className="relative z-0 rounded-2xl border border-slate-800 bg-slate-900/60 backdrop-blur p-4 sm:p-6 shadow-[0_10px_30px_rgba(0,0,0,.35)] overflow-hidden space-y-5"
        >
          {/* SALE DETAILS TITLE */}
          <div>
            <h2 className="text-lg font-semibold">Sale details</h2>
            <p className="text-slate-400 text-sm -mt-1">Mark an existing order as sold</p>
          </div>
          {/* Open purchase (searchable) */}
          <SearchDropdown
            value={selected ? selected.id : ""}
            onChange={(value) => {
              const order = openOrders.find(o => o.id === value);
              setSelected(order || null);
            }}
            options={openOrders}
            placeholder="Type to search…"
            label="Select Open Purchase"
            getOptionLabel={(order) => label(order)}
            getOptionValue={(order) => order.id}
            filterOptions={(orders, search) => {
              if (!search.trim()) return orders.slice(0, 20);
              return orders.filter(order => 
                label(order).toLowerCase().includes(search.toLowerCase())
              ).slice(0, 20);
            }}
          />

          {/* Grid of inputs (stacks on mobile) */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 min-w-0">
            <div className="min-w-0">
              <label className="text-slate-300 mb-1 block text-sm">Sell Price</label>
              <input
                value={salePrice}
                onChange={(e) => setSalePrice(e.target.value)}
                placeholder="e.g. 120.00"
                className="w-full min-w-0 bg-slate-900/60 border border-slate-800 rounded-xl px-4 py-3 text-slate-100 placeholder-slate-400 outline-none focus:border-indigo-500"
              />
            </div>

            <div className="min-w-0">
              <label className="text-slate-300 mb-1 block text-sm">Sale Date</label>
              <input
                type="date"
                value={saleDate}
                onChange={(e) => setSaleDate(e.target.value)}
                className="w-full min-w-0 appearance-none bg-slate-900/60 border border-slate-800 rounded-xl px-4 py-3 text-slate-100 outline-none focus:border-indigo-500"
              />
            </div>

            <Combo
              label="Sale Location"
              placeholder="Add or select a marketplace…"
              value={marketName}
              setValue={setMarketName}
              options={markets.map((m) => m.name)}
              onCreate={createMarketplace}
            />

            <div className="min-w-0">
              <label className="text-slate-300 mb-1 block text-sm">Fee (%)</label>
              <input
                value={feesPct}
                onChange={(e) => !feesLocked && setFeesPct(e.target.value)}
                placeholder="e.g. 9 or 9.5"
                disabled={feesLocked}
                className={`w-full min-w-0 bg-slate-900/60 border border-slate-800 rounded-xl px-4 py-3 text-slate-100 placeholder-slate-400 outline-none focus:border-indigo-500 ${
                  feesLocked ? "opacity-60 cursor-not-allowed" : ""
                }`}
              />
              {feesLocked && (
                <p className="text-xs text-slate-500 mt-1">Locked from marketplace default.</p>
              )}
            </div>

            <div className="min-w-0 md:col-span-2">
              <label className="text-slate-300 mb-1 block text-sm">Shipping</label>
              <input
                value={shipping}
                onChange={(e) => setShipping(e.target.value)}
                className="w-full min-w-0 bg-slate-900/60 border border-slate-800 rounded-xl px-4 py-3 text-slate-100 outline-none focus:border-indigo-500"
                placeholder="0"
              />
            </div>
          </div>

          {/* Submit */}
          <div className="pt-2">
            <button
              type="submit"
              disabled={saving}
              className="w-full h-12 rounded-2xl bg-indigo-600 hover:bg-indigo-500 text-white font-medium"
            >
              {saving ? "Saving…" : "Mark Sold"}
            </button>
            {msg && (
              <div
                className={`mt-2 text-sm ${
                  msg.includes("✓") ? "text-emerald-400" : "text-rose-400"
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