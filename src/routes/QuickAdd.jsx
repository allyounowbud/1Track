// src/routes/QuickAdd.jsx
import { useEffect, useMemo, useRef, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "../lib/supabaseClient";
import HeaderWithTabs from "../components/HeaderWithTabs.jsx";

/* ----------------------------- helpers ----------------------------- */
const parseMoney = (v) => {
  const n = Number(String(v ?? "").replace(/[^0-9.\-]/g, ""));
  return isNaN(n) ? 0 : n;
};
const moneyToCents = (v) => Math.round(parseMoney(v) * 100);
const parsePct = (v) => {
  if (v === "" || v == null) return 0;
  const n = Number(String(v).replace("%", ""));
  if (isNaN(n)) return 0;
  return n > 1 ? n / 100 : n;
};

const inputBase =
  "w-full max-w-full min-w-0 block box-border appearance-none bg-slate-900/60 border border-slate-800 rounded-xl px-4 py-3 text-slate-100 placeholder-slate-400 outline-none focus:ring-2 focus:ring-indigo-500";
const card =
  "rounded-2xl border border-slate-800 bg-slate-900/60 backdrop-blur p-4 sm:p-6 shadow-[0_10px_30px_rgba(0,0,0,.35)] overflow-hidden";

/* ------------------------------ queries ------------------------------ */
async function getItems() {
  const { data, error } = await supabase.from("items").select("id, name").order("name");
  if (error) throw error;
  return data || [];
}
async function getRetailers() {
  const { data, error } = await supabase.from("retailers").select("id, name").order("name");
  if (error) throw error;
  return data || [];
}
async function getMarkets() {
  const { data, error } = await supabase
    .from("marketplaces")
    .select("id, name, default_fees_pct")
    .order("name");
  if (error) throw error;
  return data || [];
}

export default function QuickAdd() {
  /* ---------------- auth (header avatar/name) ---------------- */
  const [userInfo, setUserInfo] = useState({ avatar_url: "", username: "" });
  useEffect(() => {
    async function loadUser() {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return setUserInfo({ avatar_url: "", username: "" });
      const m = user.user_metadata || {};
      setUserInfo({
        avatar_url: m.avatar_url || m.picture || "",
        username:
          m.user_name ||
          m.preferred_username ||
          m.full_name ||
          m.name ||
          user.email ||
          "Account",
      });
    }
    loadUser();
    const { data: sub } = supabase.auth.onAuthStateChange((_e, session) => {
      const u = session?.user;
      if (!u) return setUserInfo({ avatar_url: "", username: "" });
      const m = u.user_metadata || {};
      setUserInfo({
        avatar_url: m.avatar_url || m.picture || "",
        username:
          m.user_name ||
          m.preferred_username ||
          m.full_name ||
          m.name ||
          u.email ||
          "Account",
      });
    });
    return () => sub.subscription.unsubscribe();
  }, []);

  /* ---------------- data ---------------- */
  const { data: items = [], refetch: refetchItems } = useQuery({ queryKey: ["items"], queryFn: getItems });
  const { data: retailers = [], refetch: refetchRetailers } = useQuery({
    queryKey: ["retailers"],
    queryFn: getRetailers,
  });
  const { data: markets = [], refetch: refetchMarkets } = useQuery({
    queryKey: ["markets"],
    queryFn: getMarkets,
  });

  /* ---------------- form state ---------------- */
  const today = new Date().toISOString().slice(0, 10);

  const [orderDate, setOrderDate] = useState(today);
  const [profileName, setProfileName] = useState("");

  const [itemId, setItemId] = useState("");
  const [itemInput, setItemInput] = useState("");
  const [retailerId, setRetailerId] = useState("");
  const [retailerInput, setRetailerInput] = useState("");

  const [qty, setQty] = useState(1);
  const [buyPrice, setBuyPrice] = useState("");

  const [sold, setSold] = useState(false);
  const [saleDate, setSaleDate] = useState("");
  const [marketId, setMarketId] = useState("");
  const [feesPct, setFeesPct] = useState("");
  const [shipping, setShipping] = useState("0");
  const [salePrice, setSalePrice] = useState("");

  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState("");

  /* ---------------- add-from-dropdown helpers ---------------- */
  async function createRow(table, name) {
    if (!name || !name.trim()) return null;
    const { data, error } = await supabase.from(table).insert({ name: name.trim() }).select().single();
    if (error) throw error;
    return data;
  }

  /* ---------------- submit ---------------- */
  async function onSave(e) {
    e.preventDefault();
    setSaving(true);
    setMsg("");

    try {
      // Resolve item/retailer text to rows if needed
      let itemName = "";
      if (itemId) {
        itemName = items.find((x) => x.id === itemId)?.name || "";
      } else if (itemInput.trim()) {
        const row = await createRow("items", itemInput);
        itemName = row?.name || "";
        await refetchItems();
      }

      let retailerName = "";
      if (retailerId) {
        retailerName = retailers.find((x) => x.id === retailerId)?.name || "";
      } else if (retailerInput.trim()) {
        const row = await createRow("retailers", retailerInput);
        retailerName = row?.name || "";
        await refetchRetailers();
      }

      let marketName = "";
      if (sold) {
        if (marketId === "__new__") {
          // Not exposing a custom name field for marketplace to keep UI simpler.
          // You can add one similarly to items/retailers if you want.
        }
        marketName = markets.find((x) => x.id === marketId)?.name || "";
      }

      const n = Math.max(1, parseInt(qty || "1", 10));
      const perBuy = Math.round(moneyToCents(buyPrice) / n);
      const perSale = sold ? Math.round(moneyToCents(salePrice) / n) : 0;
      const perShip = sold ? Math.round(moneyToCents(shipping) / n) : 0;

      const base = {
        order_date: orderDate,
        item: itemName || null,
        profile_name: profileName || null,
        retailer: retailerName || null,
        buy_price_cents: perBuy,
        status: sold ? "sold" : "ordered",
      };

      const addSale = sold
        ? {
            sale_date: saleDate || null,
            marketplace: marketName || null,
            sale_price_cents: perSale,
            shipping_cents: perShip,
            fees_pct: parsePct(feesPct),
          }
        : {
            sale_date: null,
            marketplace: null,
            sale_price_cents: 0,
            shipping_cents: 0,
            fees_pct: 0,
          };

      const rows = Array.from({ length: n }, () => ({ ...base, ...addSale }));
      const { error } = await supabase.from("orders").insert(rows);
      if (error) throw error;

      setMsg(`Saved ✓ (${n} row${n > 1 ? "s" : ""})`);

      // reset (keep date)
      setItemId("");
      setItemInput("");
      setRetailerId("");
      setRetailerInput("");
      setQty(1);
      setBuyPrice("");
      setSold(false);
      setSaleDate("");
      setMarketId("");
      setFeesPct("");
      setShipping("0");
      setSalePrice("");
      setTimeout(() => setMsg(""), 1500);
    } catch (err) {
      setMsg(String(err.message || err));
    } finally {
      setSaving(false);
    }
  }

  /* ---------------- dropdown (native select + "Add new…") ---------------- */
  function ItemSelect() {
    const hasText = itemInput.trim().length > 0;
    return (
      <div className="relative">
        <div className="flex gap-2">
          <input
            value={itemInput}
            onChange={(e) => {
              setItemInput(e.target.value);
              setItemId("");
            }}
            placeholder="Type or pick an item…"
            className={inputBase}
          />
        </div>
        {/* quick actions row */}
        <div className="mt-2 grid grid-cols-1 sm:grid-cols-2 gap-2">
          <select
            value={itemId}
            onChange={(e) => {
              setItemId(e.target.value);
              const picked = items.find((x) => x.id === e.target.value);
              if (picked) setItemInput(picked.name);
            }}
            className={inputBase}
          >
            <option value="">— Pick existing —</option>
            {items.map((i) => (
              <option key={i.id} value={i.id}>
                {i.name}
              </option>
            ))}
          </select>
          <button
            type="button"
            disabled={!hasText}
            onClick={async () => {
              const row = await createRow("items", itemInput);
              if (row) {
                await refetchItems();
                setItemId(row.id);
                setItemInput(row.name);
              }
            }}
            className={`rounded-xl border border-slate-800 px-4 py-3 text-sm ${
              hasText ? "bg-slate-900/60 hover:bg-slate-900" : "bg-slate-900/40 text-slate-500 cursor-not-allowed"
            }`}
          >
            + Add “{itemInput || "…" }”
          </button>
        </div>
      </div>
    );
  }

  function RetailerSelect() {
    const hasText = retailerInput.trim().length > 0;
    return (
      <div className="relative">
        <input
          value={retailerInput}
          onChange={(e) => {
            setRetailerInput(e.target.value);
            setRetailerId("");
          }}
          placeholder="Type or pick a retailer…"
          className={inputBase}
        />
        <div className="mt-2 grid grid-cols-1 sm:grid-cols-2 gap-2">
          <select
            value={retailerId}
            onChange={(e) => {
              setRetailerId(e.target.value);
              const picked = retailers.find((x) => x.id === e.target.value);
              if (picked) setRetailerInput(picked.name);
            }}
            className={inputBase}
          >
            <option value="">— Pick existing —</option>
            {retailers.map((r) => (
              <option key={r.id} value={r.id}>
                {r.name}
              </option>
            ))}
          </select>
          <button
            type="button"
            disabled={!hasText}
            onClick={async () => {
              const row = await createRow("retailers", retailerInput);
              if (row) {
                await refetchRetailers();
                setRetailerId(row.id);
                setRetailerInput(row.name);
              }
            }}
            className={`rounded-xl border border-slate-800 px-4 py-3 text-sm ${
              hasText ? "bg-slate-900/60 hover:bg-slate-900" : "bg-slate-900/40 text-slate-500 cursor-not-allowed"
            }`}
          >
            + Add “{retailerInput || "…" }”
          </button>
        </div>
      </div>
    );
  }

  /* ---------------- marketplace autofill fee ---------------- */
  function onChangeMarket(id) {
    setMarketId(id);
    const m = markets.find((x) => x.id === id);
    if (m) {
      setFeesPct(((m.default_fees_pct ?? 0) * 100).toString());
    } else {
      setFeesPct("");
    }
  }

  const saleDisabled = !sold;

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 overflow-x-hidden">
      <div className="max-w-6xl mx-auto p-4 sm:p-6">
        <HeaderWithTabs active="add" />

        <form onSubmit={onSave} className={`${card} relative z-0 space-y-5`}>
          {/* Order details */}
          <h2 className="text-lg font-semibold">Order details</h2>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 min-w-0">
            {/* Date */}
            <div className="min-w-0">
              <label className="text-slate-300 mb-1 block text-sm">Order Date</label>
              <input
                type="date"
                value={orderDate}
                onChange={(e) => setOrderDate(e.target.value)}
                className={`${inputBase} [field-sizing:content]`}
              />
            </div>

            {/* Item (text + add/pick) */}
            <div className="min-w-0">
              <label className="text-slate-300 mb-1 block text-sm">Item</label>
              <ItemSelect />
            </div>

            {/* Profile */}
            <div className="min-w-0">
              <label className="text-slate-300 mb-1 block text-sm">Profile name (optional)</label>
              <input
                value={profileName}
                onChange={(e) => setProfileName(e.target.value)}
                placeholder="name / Testing 1"
                className={inputBase}
              />
            </div>

            {/* Retailer (text + add/pick) */}
            <div className="min-w-0">
              <label className="text-slate-300 mb-1 block text-sm">Retailer</label>
              <RetailerSelect />
            </div>

            {/* Qty */}
            <div className="min-w-0">
              <label className="text-slate-300 mb-1 block text-sm">Quantity</label>
              <input
                type="number"
                min={1}
                value={qty}
                onChange={(e) => setQty(parseInt(e.target.value || "1", 10))}
                className={inputBase}
              />
              <p className="text-xs text-slate-500 mt-1">
                We’ll insert that many rows and split totals equally.
              </p>
            </div>

            {/* Buy price */}
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

          {/* Sale details header + toggle */}
          <div className="flex items-center justify-between gap-3 pt-2">
            <h3 className="text-lg font-semibold">
              Sale details <span className="text-slate-400 font-normal">(optional – if sold)</span>
            </h3>
            <label className="inline-flex items-center gap-2 select-none">
              <span className="text-sm text-slate-300">Sold</span>
              <button
                type="button"
                onClick={() => setSold((v) => !v)}
                className={`relative h-7 w-12 rounded-full transition-colors ${
                  sold ? "bg-emerald-600" : "bg-slate-700"
                }`}
                aria-pressed={sold}
              >
                <span
                  className={`absolute top-1 left-1 h-5 w-5 rounded-full bg-white transition-transform ${
                    sold ? "translate-x-5" : "translate-x-0"
                  }`}
                />
              </button>
            </label>
          </div>

          {/* Sale inputs */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 min-w-0">
            <div className="min-w-0">
              <label className="text-slate-300 mb-1 block text-sm">Sale Date</label>
              <input
                type="date"
                value={saleDate}
                onChange={(e) => setSaleDate(e.target.value)}
                disabled={saleDisabled}
                className={`${inputBase} ${saleDisabled ? "opacity-60 cursor-not-allowed" : ""} [field-sizing:content]`}
              />
            </div>

            <div className="min-w-0">
              <label className="text-slate-300 mb-1 block text-sm">Marketplace</label>
              <select
                value={marketId}
                onChange={(e) => onChangeMarket(e.target.value)}
                disabled={saleDisabled}
                className={`${inputBase} ${saleDisabled ? "opacity-60 cursor-not-allowed" : ""}`}
              >
                <option value="">— Select marketplace —</option>
                {markets.map((m) => (
                  <option key={m.id} value={m.id}>
                    {m.name}
                  </option>
                ))}
              </select>
            </div>

            <div className="min-w-0">
              <label className="text-slate-300 mb-1 block text-sm">Sell Price (total)</label>
              <input
                value={salePrice}
                onChange={(e) => setSalePrice(e.target.value)}
                placeholder="0 = unsold"
                disabled={saleDisabled}
                className={`${inputBase} ${saleDisabled ? "opacity-60 cursor-not-allowed" : ""}`}
              />
              <p className="text-xs text-slate-500 mt-1">If qty &gt; 1 we’ll split this total across rows.</p>
            </div>

            <div className="min-w-0">
              <label className="text-slate-300 mb-1 block text-sm">Fees (%)</label>
              <input
                value={feesPct}
                onChange={(e) => setFeesPct(e.target.value)}
                placeholder="e.g. 9 or 9.5"
                disabled={saleDisabled}
                className={`${inputBase} ${saleDisabled ? "opacity-60 cursor-not-allowed" : ""}`}
              />
            </div>

            <div className="min-w-0 md:col-span-2">
              <label className="text-slate-300 mb-1 block text-sm">Shipping (total)</label>
              <input
                value={shipping}
                onChange={(e) => setShipping(e.target.value)}
                placeholder="0"
                disabled={saleDisabled}
                className={`${inputBase} ${saleDisabled ? "opacity-60 cursor-not-allowed" : ""}`}
              />
              <p className="text-xs text-slate-500 mt-1">If qty &gt; 1 we’ll split shipping across rows.</p>
            </div>
          </div>

          {/* Save */}
          <div className="pt-2 flex items-center justify-between">
            <div className={`text-sm ${msg.includes("✓") ? "text-emerald-400" : "text-rose-400"}`}>{msg}</div>
            <button
              type="submit"
              disabled={saving}
              className="px-6 py-3 rounded-2xl bg-indigo-600 hover:bg-indigo-500 text-white"
            >
              {saving ? "Saving…" : "Save"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
