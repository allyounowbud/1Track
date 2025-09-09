// src/routes/MarkSold.jsx
import { useEffect, useMemo, useRef, useState } from "react";
import { NavLink, Link } from 'react-router-dom';
import { useQuery } from "@tanstack/react-query";
import { supabase } from "../lib/supabaseClient";
import HeaderWithTabs from "../components/HeaderWithTabs.jsx";
import { moneyToCents, centsToStr, parsePct, formatNumber } from "../utils/money.js";
import { Select } from "../components/Select.jsx";
import { SearchDropdown } from "../components/SearchDropdown.jsx";

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


export default function MarkSold() {

  const { data: openOrders = [], refetch: refetchOpen } = useQuery({
    queryKey: ["openOrders"],
    queryFn: getUnsoldOrders,
  });
  const { data: markets = [] } = useQuery({
    queryKey: ["markets-for-sell"],
    queryFn: getMarketplaces,
  });

  // ---------- form state ----------
  const today = new Date().toISOString().slice(0, 10);

  const [selected, setSelected] = useState(null); // order object

  const [salePrice, setSalePrice] = useState("");
  const [saleDate, setSaleDate] = useState(today);
  const [marketId, setMarketId] = useState("");
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


  // ---------- marketplace -> autofill fee ----------
  function onMarketChange(id) {
    setMarketId(id);
    const m = markets.find((x) => x.id === id);
    setMarketName(m?.name || "");
    if (m) {
      // show % to the user (like Quick Add)
      setFeesPct(((m.default_fees_pct ?? 0) * 100).toString());
      setFeesLocked(true);
    } else {
      setFeesPct("");
      setFeesLocked(false);
    }
  }

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
    <div className="min-h-screen bg-slate-950 text-slate-100">
      <div className="max-w-6xl mx-auto p-4 sm:p-6">

        {/* ======= SHARED HEADER + TABS ======= */}
        <HeaderWithTabs active="sold" section="orderbook" showHubTab={true} />
        {/* ==================================== */}

        {/* Card (mobile-friendly: overflow-hidden, min-w-0, responsive gaps) */}
        <form
          onSubmit={markSold}
          className="relative z-0 rounded-2xl border border-slate-800 bg-slate-900/60 backdrop-blur p-4 sm:p-6 shadow-[0_10px_30px_rgba(0,0,0,.35)] overflow-hidden space-y-5"
        >
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
                className="w-full min-w-0 bg-slate-900/60 border border-slate-800 rounded-xl px-4 py-3 text-slate-100 placeholder-slate-400 outline-none focus:ring-2 focus:ring-indigo-500"
              />
            </div>

            <div className="min-w-0">
              <label className="text-slate-300 mb-1 block text-sm">Sale Date</label>
              <input
                type="date"
                value={saleDate}
                onChange={(e) => setSaleDate(e.target.value)}
                className="w-full min-w-0 appearance-none bg-slate-900/60 border border-slate-800 rounded-xl px-4 py-3 text-slate-100 outline-none focus:ring-2 focus:ring-indigo-500"
              />
            </div>

            <div className="min-w-0">
              <label className="text-slate-300 mb-1 block text-sm">Sale Location</label>
              <Select
                value={marketId}
                onChange={onMarketChange}
                options={[
                  { value: "", label: "— Select marketplace —" },
                  ...markets.map((m) => ({ value: m.id, label: m.name }))
                ]}
                placeholder="— Select marketplace —"
              />
            </div>

            <div className="min-w-0">
              <label className="text-slate-300 mb-1 block text-sm">Fee (%)</label>
              <input
                value={feesPct}
                onChange={(e) => !feesLocked && setFeesPct(e.target.value)}
                placeholder="e.g. 9 or 9.5"
                disabled={feesLocked}
                className={`w-full min-w-0 bg-slate-900/60 border border-slate-800 rounded-xl px-4 py-3 text-slate-100 placeholder-slate-400 outline-none focus:ring-2 focus:ring-indigo-500 ${
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
                className="w-full min-w-0 bg-slate-900/60 border border-slate-800 rounded-xl px-4 py-3 text-slate-100 outline-none focus:ring-2 focus:ring-indigo-500"
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
      </div>
    </div>
  );
}