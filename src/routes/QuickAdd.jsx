// src/routes/QuickAdd.jsx
import { useEffect, useMemo, useRef, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "../lib/supabaseClient";
import LayoutWithSidebar from "../components/LayoutWithSidebar.jsx";
import PageHeader from "../components/PageHeader.jsx";
import { moneyToCents, parsePct, formatNumber } from "../utils/money.js";
import { card, inputBase, dateFix, disabledInput } from "../utils/ui.js";
import { SearchDropdown } from "../components/SearchDropdown.jsx";

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

/* ------------------------- Use SearchDropdown directly ------------------------- */

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

  // dropdown states
  const [itemDropdownOpen, setItemDropdownOpen] = useState(false);
  const [retailerDropdownOpen, setRetailerDropdownOpen] = useState(false);
  const [marketDropdownOpen, setMarketDropdownOpen] = useState(false);

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

  // Close dropdowns when clicking outside
  useEffect(() => {
    const handleClickOutside = () => {
      setItemDropdownOpen(false);
      setRetailerDropdownOpen(false);
      setMarketDropdownOpen(false);
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  /* -------------------------- derived lists (names) ------------------------- */
  const itemNames = useMemo(() => {
    const names = items.map((i) => i.name).filter(Boolean);
    console.log('QuickAdd - Items from DB:', items);
    console.log('QuickAdd - Item names:', names);
    return names;
  }, [items]);
  const retailerNames = useMemo(() => {
    const names = retailers.map((r) => r.name).filter(Boolean);
    console.log('QuickAdd - Retailers from DB:', retailers);
    console.log('QuickAdd - Retailer names:', names);
    return names;
  }, [retailers]);
  const marketNames = useMemo(() => {
    const names = markets.map((m) => m.name).filter(Boolean);
    console.log('QuickAdd - Markets from DB:', markets);
    console.log('QuickAdd - Market names:', names);
    return names;
  }, [markets]);

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
              <label htmlFor="order-date" className="text-slate-300 mb-1 block text-sm">Order Date</label>
              <input
                id="order-date"
                name="order-date"
                type="date"
                value={orderDate}
                onChange={(e) => setOrderDate(e.target.value)}
                className={`${inputBase} ${dateFix}`}
              />
            </div>

            <div className="min-w-0">
              <label htmlFor="item-input" className="text-slate-300 mb-1 block text-sm">Item</label>
              <div className="relative">
                <input
                  id="item-input"
                  name="item"
                  value={itemName}
                  onChange={(e) => setItemName(e.target.value)}
                  onFocus={() => setItemDropdownOpen(true)}
                  placeholder="Add or select an item…"
                  className="w-full min-w-0 appearance-none bg-slate-900/60 border border-slate-800 rounded-xl py-3 pr-10 text-slate-100 placeholder-slate-400 outline-none focus:border-indigo-500 px-4"
                />
                {itemName && (
                  <button
                    type="button"
                    onClick={() => setItemName("")}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-200 transition-colors"
                  >
                    <svg className="w-4 h-4" viewBox="0 0 20 20" fill="currentColor">
                      <path d="M6.28 5.22a.75.75 0 00-1.06 1.06L8.94 10l-3.72 3.72a.75.75 0 101.06 1.06L10 11.06l3.72 3.72a.75.75 0 101.06-1.06L11.06 10l3.72-3.72a.75.75 0 00-1.06-1.06L10 8.94 6.28 5.22z" />
                    </svg>
                  </button>
                )}
                {itemDropdownOpen && (
                  <div className="absolute left-0 right-0 z-[99999] mt-2 max-h-64 overflow-y-auto overscroll-contain rounded-xl border border-slate-800 bg-slate-900 shadow-xl">
                    {/* Add new item option */}
                    {!itemNames.some(name => name.toLowerCase() === itemName.toLowerCase()) && itemName.trim() && (
                      <button
                        type="button"
                        onClick={async () => {
                          const createdName = await createItem(itemName.trim());
                          if (createdName) {
                            setItemName(createdName);
                            setItemDropdownOpen(false);
                          }
                        }}
                        className="w-full text-left px-3 py-2 text-indigo-300 hover:bg-slate-800/70"
                      >
                        + Add "{itemName.trim()}"
                      </button>
                    )}

                    {/* Existing items */}
                    {(() => {
                      const filtered = itemNames.filter(name => 
                        name.toLowerCase().includes(itemName.toLowerCase())
                      ).slice(0, 20);
                      console.log('QuickAdd - Filtered items for dropdown:', filtered);
                      return filtered;
                    })().map((name) => (
                      <button
                        type="button"
                        key={name}
                        onClick={() => {
                          setItemName(name);
                          setItemDropdownOpen(false);
                        }}
                        className="w-full text-left px-3 py-2 text-slate-100 hover:bg-slate-800/70"
                      >
                        {name}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            </div>

            <div className="min-w-0">
              <label htmlFor="profile" className="text-slate-300 mb-1 block text-sm">Profile (optional)</label>
              <input
                id="profile"
                name="profile"
                value={profileName}
                onChange={(e) => setProfile(e.target.value)}
                placeholder="e.g. Target 3244"
                className={inputBase}
              />
            </div>

            <div className="min-w-0">
              <label htmlFor="retailer-input" className="text-slate-300 mb-1 block text-sm">Retailer</label>
              <div className="relative">
                <input
                  id="retailer-input"
                  name="retailer"
                  value={retailerName}
                  onChange={(e) => setRetailerName(e.target.value)}
                  onFocus={() => setRetailerDropdownOpen(true)}
                  placeholder="Add or select a retailer…"
                  className="w-full min-w-0 appearance-none bg-slate-900/60 border border-slate-800 rounded-xl py-3 pr-10 text-slate-100 placeholder-slate-400 outline-none focus:border-indigo-500 px-4"
                />
                {retailerName && (
                  <button
                    type="button"
                    onClick={() => setRetailerName("")}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-200 transition-colors"
                  >
                    <svg className="w-4 h-4" viewBox="0 0 20 20" fill="currentColor">
                      <path d="M6.28 5.22a.75.75 0 00-1.06 1.06L8.94 10l-3.72 3.72a.75.75 0 101.06 1.06L10 11.06l3.72 3.72a.75.75 0 101.06-1.06L11.06 10l3.72-3.72a.75.75 0 00-1.06-1.06L10 8.94 6.28 5.22z" />
                    </svg>
                  </button>
                )}
                {retailerDropdownOpen && (
                  <div className="absolute left-0 right-0 z-[99999] mt-2 max-h-64 overflow-y-auto overscroll-contain rounded-xl border border-slate-800 bg-slate-900 shadow-xl">
                    {/* Add new retailer option */}
                    {!retailerNames.some(name => name.toLowerCase() === retailerName.toLowerCase()) && retailerName.trim() && (
                      <button
                        type="button"
                        onClick={async () => {
                          const createdName = await createRetailer(retailerName.trim());
                          if (createdName) {
                            setRetailerName(createdName);
                            setRetailerDropdownOpen(false);
                          }
                        }}
                        className="w-full text-left px-3 py-2 text-indigo-300 hover:bg-slate-800/70"
                      >
                        + Add "{retailerName.trim()}"
                      </button>
                    )}

                    {/* Existing retailers */}
                    {retailerNames.filter(name => 
                      name.toLowerCase().includes(retailerName.toLowerCase())
                    ).slice(0, 20).map((name) => (
                      <button
                        type="button"
                        key={name}
                        onClick={() => {
                          setRetailerName(name);
                          setRetailerDropdownOpen(false);
                        }}
                        className="w-full text-left px-3 py-2 text-slate-100 hover:bg-slate-800/70"
                      >
                        {name}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            </div>

            <div className="min-w-0">
              <label htmlFor="quantity" className="text-slate-300 mb-1 block text-sm">Quantity</label>
              <input
                id="quantity"
                name="quantity"
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
                We'll insert that many rows and split totals equally.
              </p>
            </div>

            <div className="min-w-0">
              <label htmlFor="buy-price" className="text-slate-300 mb-1 block text-sm">Buy Price (total)</label>
              <input
                id="buy-price"
                name="buy-price"
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

              <div className="min-w-0">
                <label htmlFor="marketplace-input" className="text-slate-300 mb-1 block text-sm">Marketplace</label>
                <div className="relative">
                  <input
                    id="marketplace-input"
                    name="marketplace"
                    value={marketName}
                    onChange={(e) => setMarketName(e.target.value)}
                    onFocus={() => setMarketDropdownOpen(true)}
                    placeholder="Add or select a marketplace…"
                    className="w-full min-w-0 appearance-none bg-slate-900/60 border border-slate-800 rounded-xl py-3 pr-10 text-slate-100 placeholder-slate-400 outline-none focus:border-indigo-500 px-4"
                  />
                  {marketName && (
                    <button
                      type="button"
                      onClick={() => setMarketName("")}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-200 transition-colors"
                    >
                      <svg className="w-4 h-4" viewBox="0 0 20 20" fill="currentColor">
                        <path d="M6.28 5.22a.75.75 0 00-1.06 1.06L8.94 10l-3.72 3.72a.75.75 0 101.06 1.06L10 11.06l3.72 3.72a.75.75 0 101.06-1.06L11.06 10l3.72-3.72a.75.75 0 00-1.06-1.06L10 8.94 6.28 5.22z" />
                      </svg>
                    </button>
                  )}
                  {marketDropdownOpen && (
                    <div className="absolute left-0 right-0 z-[99999] mt-2 max-h-64 overflow-y-auto overscroll-contain rounded-xl border border-slate-800 bg-slate-900 shadow-xl">
                      {/* Add new marketplace option */}
                      {!marketNames.some(name => name.toLowerCase() === marketName.toLowerCase()) && marketName.trim() && (
                        <button
                          type="button"
                          onClick={async () => {
                            const createdName = await createMarket(marketName.trim());
                            if (createdName) {
                              setMarketName(createdName);
                              setMarketDropdownOpen(false);
                            }
                          }}
                          className="w-full text-left px-3 py-2 text-indigo-300 hover:bg-slate-800/70"
                        >
                          + Add "{marketName.trim()}"
                        </button>
                      )}

                      {/* Existing marketplaces */}
                      {marketNames.filter(name => 
                        name.toLowerCase().includes(marketName.toLowerCase())
                      ).slice(0, 20).map((name) => (
                        <button
                          type="button"
                          key={name}
                          onClick={() => {
                            setMarketName(name);
                            setMarketDropdownOpen(false);
                          }}
                          className="w-full text-left px-3 py-2 text-slate-100 hover:bg-slate-800/70"
                        >
                          {name}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              </div>

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