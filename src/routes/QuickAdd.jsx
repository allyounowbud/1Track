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
  return data;
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

export default function QuickAdd() {
  const { data: orders, isLoading, error, refetch } = useQuery({
    queryKey: ["orders"],
    queryFn: getOrders,
  });
  const { data: retailers = [], refetch: refetchRetailers } = useQuery({
    queryKey: ["retailers"],
    queryFn: getRetailers,
  });
  const { data: items = [], refetch: refetchItems } = useQuery({
    queryKey: ["items"],
    queryFn: getItems,
  });
  const { data: markets = [], refetch: refetchMarkets } = useQuery({
    queryKey: ["markets"],
    queryFn: getMarketplaces,
  });

  // current user (header shows it)
  const [userInfo, setUserInfo] = useState({ avatar_url: "", username: "" });
  useEffect(() => {
    async function loadUser() {
      const {
        data: { user },
      } = await supabase.auth.getUser();
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

  /* ---------- form state ---------- */
  const today = new Date().toISOString().slice(0, 10);
  const [orderDate, setOrderDate] = useState(today);

  const [itemId, setItemId] = useState("");
  const [itemName, setItemName] = useState("");

  const [profileName, setProfile] = useState("");
  const [retailerId, setRetailerId] = useState("");
  const [retailerName, setRetailerName] = useState("");

  const [qty, setQty] = useState(1);
  const [buyPrice, setBuyPrice] = useState("");

  const [sold, setSold] = useState(false);
  const [saleDate, setSaleDate] = useState("");
  const [marketId, setMarketId] = useState("");
  const [marketName, setMarketName] = useState("");
  const [salePrice, setSalePrice] = useState("");
  const [feesPct, setFeesPct] = useState("0");
  const [feesLocked, setFeesLocked] = useState(false);
  const [shipping, setShipping] = useState("0");

  const saleDisabled = !sold;

  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState("");

  /* ---------- create-on-type helpers ---------- */
  async function createItem(name) {
    const nm = name.trim();
    if (!nm) return null;
    const { data, error } = await supabase
      .from("items")
      .insert({ name: nm })
      .select()
      .single();
    if (error) throw error;
    await refetchItems();
    return data;
  }
  async function createRetailer(name) {
    const nm = name.trim();
    if (!nm) return null;
    const { data, error } = await supabase
      .from("retailers")
      .insert({ name: nm })
      .select()
      .single();
    if (error) throw error;
    await refetchRetailers();
    return data;
  }
  async function createMarketplace(name) {
    const nm = name.trim();
    if (!nm) return null;
    const { data, error } = await supabase
      .from("marketplaces")
      .insert({ name: nm, default_fees_pct: 0 })
      .select()
      .single();
    if (error) throw error;
    await refetchMarkets();
    return data;
  }

  /* ---------- save rows (multi-qty split) ---------- */
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

      const status = sold && perSale > 0 ? "sold" : "ordered";
      const fee = sold ? parsePct(feesPct) : 0;

      const base = {
        order_date: orderDate,
        item: itemName || null,
        profile_name: profileName || null,
        retailer: retailerName || null,
        // sales bits filled only if sold
        sale_date: sold ? (saleDate || null) : null,
        marketplace: sold ? marketName || null : null,
        fees_pct: fee,
        status,
      };

      const rows = Array.from({ length: n }, () => ({
        ...base,
        buy_price_cents: perBuy,
        sale_price_cents: perSale,
        shipping_cents: perShip,
      }));

      const { error: insErr } = await supabase.from("orders").insert(rows);
      if (insErr) throw insErr;

      setMsg(`Saved ✔ (${n} row${n > 1 ? "s" : ""})`);

      // reset (keep order date + qty)
      setItemId("");
      setItemName("");
      setProfile("");
      setRetailerId("");
      setRetailerName("");
      setBuyPrice("");
      setSold(false);
      setSaleDate("");
      setMarketId("");
      setMarketName("");
      setSalePrice("");
      setFeesPct("0");
      setFeesLocked(false);
      setShipping("0");

      await refetch();
    } catch (err) {
      setMsg(String(err.message || err));
    } finally {
      setSaving(false);
    }
  }

  /* ---------- UI ---------- */
  return (
    <div className="min-h-screen bg-slate-950 text-slate-100">
      <div className="max-w-6xl mx-auto p-4 sm:p-6">
        <HeaderWithTabs active="add" showTabs />

        <form onSubmit={saveOrder} className="space-y-6">
          {/* Combined card: Order & Sale */}
          <div className="rounded-2xl border border-slate-800 bg-slate-900/60 backdrop-blur p-4 sm:p-6 shadow-[0_10px_30px_rgba(0,0,0,.35)] overflow-visible relative isolate">
            <div className="flex items-center justify-between gap-3">
              <h2 className="text-lg font-semibold">Order &amp; Sale</h2>
              <ToggleSwitch checked={sold} onChange={(v) => setSold(v)} label="Sold" />
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-4 min-w-0">
              {/* Order Date */}
              <Field label="Order Date">
                <input
                  type="date"
                  value={orderDate}
                  onChange={(e) => setOrderDate(e.target.value)}
                  className="w-full min-w-0 appearance-none bg-slate-900/60 border border-slate-800 rounded-xl px-4 py-3 text-slate-100 focus:ring-2 focus:ring-indigo-500"
                />
              </Field>

              {/* Item (combo + create) */}
              <Field label="Item">
                <ComboCreate
                  placeholder="Type or pick an item..."
                  valueId={itemId}
                  valueName={itemName}
                  options={items.map((i) => ({ id: i.id, name: i.name }))}
                  onSelect={(opt) => {
                    setItemId(opt?.id || "");
                    setItemName(opt?.name || "");
                  }}
                  onCreate={async (q) => {
                    const row = await createItem(q);
                    setItemId(row?.id || "");
                    setItemName(row?.name || q);
                  }}
                />
              </Field>

              {/* Profile name */}
              <Field label="Profile name (optional)">
                <input
                  value={profileName}
                  onChange={(e) => setProfile(e.target.value)}
                  placeholder="name / Testing 1"
                  className="w-full min-w-0 bg-slate-900/60 border border-slate-800 rounded-xl px-4 py-3 text-slate-100 focus:ring-2 focus:ring-indigo-500"
                />
              </Field>

              {/* Retailer (combo + create) */}
              <Field label="Retailer">
                <ComboCreate
                  placeholder="Type or pick a retailer..."
                  valueId={retailerId}
                  valueName={retailerName}
                  options={retailers.map((r) => ({ id: r.id, name: r.name }))}
                  onSelect={(opt) => {
                    setRetailerId(opt?.id || "");
                    setRetailerName(opt?.name || "");
                  }}
                  onCreate={async (q) => {
                    const row = await createRetailer(q);
                    setRetailerId(row?.id || "");
                    setRetailerName(row?.name || q);
                  }}
                />
              </Field>

              {/* Quantity */}
              <Field label="Quantity" hint="We’ll insert that many rows and split totals equally.">
                <input
                  type="number"
                  min={1}
                  value={qty}
                  onChange={(e) => setQty(Math.max(1, parseInt(e.target.value || "1", 10)))}
                  className="w-full min-w-0 bg-slate-900/60 border border-slate-800 rounded-xl px-4 py-3 text-slate-100 focus:ring-2 focus:ring-indigo-500"
                />
              </Field>

              {/* Buy price */}
              <Field label="Buy Price (total)">
                <input
                  value={buyPrice}
                  onChange={(e) => setBuyPrice(e.target.value)}
                  placeholder="e.g. 67.70"
                  className="w-full min-w-0 bg-slate-900/60 border border-slate-800 rounded-xl px-4 py-3 text-slate-100 placeholder-slate-400 focus:ring-2 focus:ring-indigo-500"
                />
              </Field>

              {/* Sale Date */}
              <Field label="Sale Date" disabled={saleDisabled}>
                <input
                  type="date"
                  value={saleDate}
                  onChange={(e) => setSaleDate(e.target.value)}
                  disabled={saleDisabled}
                  className={`w-full min-w-0 appearance-none bg-slate-900/60 border border-slate-800 rounded-xl px-4 py-3 text-slate-100 focus:ring-2 focus:ring-indigo-500 ${
                    saleDisabled ? "opacity-60 cursor-not-allowed" : ""
                  }`}
                />
              </Field>

              {/* Marketplace (combo + create) */}
              <Field label="Marketplace" disabled={saleDisabled}>
                <ComboCreate
                  placeholder="Type or pick a marketplace..."
                  valueId={marketId}
                  valueName={marketName}
                  options={markets.map((m) => ({ id: m.id, name: m.name, fees: m.default_fees_pct ?? 0 }))}
                  onSelect={(opt) => {
                    setMarketId(opt?.id || "");
                    setMarketName(opt?.name || "");
                    if (!saleDisabled && opt) {
                      setFeesPct(((opt.fees ?? 0) * 100).toString());
                      setFeesLocked(true);
                    } else {
                      setFeesLocked(false);
                    }
                  }}
                  onCreate={async (q) => {
                    const row = await createMarketplace(q);
                    setMarketId(row?.id || "");
                    setMarketName(row?.name || q);
                    if (!saleDisabled && row) {
                      setFeesPct(((row.default_fees_pct ?? 0) * 100).toString());
                      setFeesLocked(true);
                    }
                  }}
                  disabled={saleDisabled}
                />
                {/* quick chips */}
                <div className={`flex gap-2 mt-2 ${saleDisabled ? "opacity-50 pointer-events-none" : ""}`}>
                  <button
                    type="button"
                    onClick={() => {
                      setMarketId("");
                      setMarketName("eBay");
                      setFeesPct("13"); // example default
                      setFeesLocked(false);
                    }}
                    className="px-3 py-1.5 rounded-full border border-slate-800 bg-slate-900/60 hover:bg-slate-900 text-slate-100 text-xs"
                  >
                    eBay
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setMarketId("");
                      setMarketName("Local (Cash)");
                      setFeesPct("0");
                      setFeesLocked(false);
                    }}
                    className="px-3 py-1.5 rounded-full border border-slate-800 bg-slate-900/60 hover:bg-slate-900 text-slate-100 text-xs"
                  >
                    Local (Cash)
                  </button>
                </div>
              </Field>

              {/* Sell price */}
              <Field label="Sell Price (total)" hint="If qty > 1 we’ll split this total across rows." disabled={saleDisabled}>
                <input
                  value={salePrice}
                  onChange={(e) => setSalePrice(e.target.value)}
                  placeholder="0 = unsold"
                  disabled={saleDisabled}
                  className={`w-full min-w-0 bg-slate-900/60 border border-slate-800 rounded-xl px-4 py-3 text-slate-100 placeholder-slate-400 focus:ring-2 focus:ring-indigo-500 ${
                    saleDisabled ? "opacity-60 cursor-not-allowed" : ""
                  }`}
                />
              </Field>

              {/* Fees (%) */}
              <Field
                label="Fees (%)"
                hint={feesLocked ? "Locked from marketplace default." : "e.g. 9 or 9%"}
                disabled={saleDisabled}
              >
                <input
                  value={feesPct}
                  onChange={(e) => !feesLocked && !saleDisabled && setFeesPct(e.target.value)}
                  disabled={saleDisabled || feesLocked}
                  className={`w-full min-w-0 bg-slate-900/60 border border-slate-800 rounded-xl px-4 py-3 text-slate-100 placeholder-slate-400 focus:ring-2 focus:ring-indigo-500 ${
                    saleDisabled || feesLocked ? "opacity-60 cursor-not-allowed" : ""
                  }`}
                />
              </Field>

              {/* Shipping */}
              <Field label="Shipping (total)" hint="If qty > 1 we’ll split shipping across rows." disabled={saleDisabled}>
                <input
                  value={shipping}
                  onChange={(e) => setShipping(e.target.value)}
                  disabled={saleDisabled}
                  className={`w-full min-w-0 bg-slate-900/60 border border-slate-800 rounded-xl px-4 py-3 text-slate-100 focus:ring-2 focus:ring-indigo-500 ${
                    saleDisabled ? "opacity-60 cursor-not-allowed" : ""
                  }`}
                />
              </Field>
            </div>

            <div className="mt-6 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div
                className={`text-sm ${
                  msg.startsWith("Saved") ? "text-emerald-400" : msg ? "text-rose-400" : "text-slate-400"
                }`}
              >
                {msg}
              </div>
              <button
                className="px-6 py-3 rounded-2xl bg-indigo-600 hover:bg-indigo-500 text-white"
                disabled={saving}
              >
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
            {orders?.map((o) => (
              <div
                key={o.id}
                className="rounded-xl border border-slate-800 bg-slate-900/60 p-4 overflow-visible"
              >
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
            {orders?.length === 0 && <div className="text-slate-400">No orders yet.</div>}
          </div>
        </div>
      </div>
    </div>
  );
}

/* ------------------------ small pieces ------------------------ */

function Field({ label, hint, children, disabled = false }) {
  return (
    <div className={`min-w-0 ${disabled ? "opacity-70" : ""}`}>
      <label className="text-slate-300 mb-1 block text-sm">{label}</label>
      {children}
      {hint && <p className="text-xs text-slate-500 mt-1">{hint}</p>}
    </div>
  );
}

/** Accessible toggle switch with proper track/knob (no giant green pill) */
function ToggleSwitch({ checked, onChange, label }) {
  return (
    <button
      type="button"
      onClick={() => onChange(!checked)}
      className="inline-flex items-center gap-2"
      aria-pressed={checked}
    >
      <span
        className={`relative inline-flex h-6 w-11 rounded-full transition-colors ${
          checked ? "bg-emerald-600" : "bg-slate-700"
        }`}
        role="switch"
        aria-checked={checked}
      >
        <span
          className={`absolute top-0.5 left-0.5 h-5 w-5 rounded-full bg-white transition-transform ${
            checked ? "translate-x-5" : "translate-x-0"
          }`}
        />
      </span>
      <span className="text-slate-200 text-sm select-none">{label}</span>
    </button>
  );
}

/** Searchable combobox with "Add ..." option.
 * Always renders its menu ABOVE everything via z-[200] and parent has overflow-visible.
 */
function ComboCreate({
  options = [],
  valueId = "",
  valueName = "",
  onSelect,
  onCreate,
  placeholder = "Type or pick…",
  disabled = false,
}) {
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState(valueName || "");
  const rootRef = useRef(null);

  // close on outside click
  useEffect(() => {
    function onDoc(e) {
      if (!rootRef.current?.contains(e.target)) setOpen(false);
    }
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, []);

  useEffect(() => {
    // sync external value → input text
    setQ(valueName || "");
  }, [valueName]);

  const filtered = useMemo(() => {
    const qq = (q || "").toLowerCase().trim();
    return qq
      ? options.filter((o) => (o.name || "").toLowerCase().includes(qq))
      : options;
  }, [q, options]);

  const canCreate =
    q.trim().length > 0 &&
    !options.some((o) => (o.name || "").toLowerCase() === q.trim().toLowerCase());

  return (
    <div
      ref={rootRef}
      className={`relative isolate ${disabled ? "opacity-60 pointer-events-none" : ""}`}
    >
      <input
        value={q}
        onChange={(e) => {
          setQ(e.target.value);
          setOpen(true);
        }}
        onFocus={() => setOpen(true)}
        placeholder={placeholder}
        className="w-full min-w-0 bg-slate-900/60 border border-slate-800 rounded-xl px-4 py-3 text-slate-100 focus:ring-2 focus:ring-indigo-500"
      />
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400"
        aria-label="Toggle options"
      >
        ▾
      </button>

      {open && (
        <div className="absolute z-[200] left-0 right-0 mt-2 max-h-64 overflow-auto rounded-xl border border-slate-800 bg-slate-900 shadow-xl">
          {filtered.map((o) => (
            <div
              key={o.id}
              className="px-3 py-2 hover:bg-slate-800 cursor-pointer text-slate-100"
              onMouseDown={(e) => e.preventDefault()}
              onClick={() => {
                onSelect?.(o);
                setQ(o.name || "");
                setOpen(false);
              }}
            >
              {o.name}
            </div>
          ))}
          {filtered.length === 0 && (
            <div className="px-3 py-2 text-slate-400">No matches</div>
          )}
          {canCreate && (
            <button
              type="button"
              className="w-full text-left px-3 py-2 bg-indigo-600/10 hover:bg-indigo-600/20 text-indigo-300"
              onMouseDown={(e) => e.preventDefault()}
              onClick={async () => {
                const nm = q.trim();
                const row = (await onCreate?.(nm)) || { id: "", name: nm };
                onSelect?.(row);
                setQ(row.name || nm);
                setOpen(false);
              }}
            >
              Add “{q.trim()}”
            </button>
          )}
        </div>
      )}
    </div>
  );
}
