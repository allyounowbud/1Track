// src/routes/QuickAdd.jsx
import { useEffect, useRef, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
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

/* ---------- shared UI tokens ---------- */
const card =
  "rounded-2xl border border-slate-800 bg-slate-900/60 backdrop-blur p-4 sm:p-6 shadow-[0_10px_30px_rgba(0,0,0,.35)]";
const inputBase =
  "w-full min-w-0 appearance-none bg-slate-900/60 border border-slate-800 rounded-xl px-4 py-3 text-slate-100 placeholder-slate-400 focus:ring-2 focus:ring-indigo-500";

/* ---------- Addable combobox (type to add) ---------- */
function AddableCombo({
  label,
  options, // [{id, name}]
  valueId,
  setValueId,
  valueName,
  setValueName,
  placeholder = "Start typing…",
  addTable, // "items" | "retailers" | "marketplaces"
  addExtra = {}, // extra fields on insert
  onAfterSelect, // optional hook (e.g., lock fees)
}) {
  const [open, setOpen] = useState(false);
  const [text, setText] = useState(valueName || "");
  const rootRef = useRef(null);

  useEffect(() => {
    function onDoc(e) {
      if (!rootRef.current?.contains(e.target)) setOpen(false);
    }
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, []);

  // keep input text in sync if selection changed from outside
  useEffect(() => {
    if (valueName && !text) setText(valueName);
  }, [valueName]); // eslint-disable-line

  const lower = (s) => (s || "").trim().toLowerCase();
  const filtered = options.filter((o) => lower(o.name).includes(lower(text)));
  const exact = options.find((o) => lower(o.name) === lower(text));
  const showAdd = text.trim().length > 1 && !exact;

  async function addNew() {
    const name = text.trim();
    if (!name) return;
    // insert with returning row
    let payload = { name, ...addExtra };
    const { data, error } = await supabase.from(addTable).insert(payload).select().single();
    if (error) throw error;
    setValueId(data.id);
    setValueName(data.name);
    setOpen(false);
    onAfterSelect?.(data);
  }

  function choose(o) {
    setValueId(o.id);
    setValueName(o.name);
    setText(o.name);
    setOpen(false);
    onAfterSelect?.(o);
  }

  return (
    <div ref={rootRef} className="min-w-0">
      <label className="text-slate-300 mb-1 block text-sm">{label}</label>
      <div className="relative isolate">
        <input
          value={text}
          onChange={(e) => {
            setText(e.target.value);
            setOpen(true);
            // clear selection while typing
            setValueId("");
            setValueName(e.target.value);
          }}
          onFocus={() => setOpen(true)}
          placeholder={placeholder}
          className={`${inputBase} pr-10`}
        />
        <button
          type="button"
          onClick={() => setOpen((v) => !v)}
          className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400"
          aria-label="Toggle"
        >
          ▾
        </button>

        {open && (
          <div className="absolute z-[80] left-0 right-0 mt-2 max-h-60 overflow-auto rounded-xl border border-slate-800 bg-slate-900 shadow-xl">
            {filtered.map((o) => (
              <div
                key={o.id}
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => choose(o)}
                className="px-3 py-2 hover:bg-slate-800 cursor-pointer text-slate-100"
              >
                {o.name}
              </div>
            ))}
            {filtered.length === 0 && !showAdd && (
              <div className="px-3 py-2 text-slate-400">No matches</div>
            )}
            {showAdd && (
              <button
                type="button"
                onMouseDown={(e) => e.preventDefault()}
                onClick={addNew}
                className="w-full text-left px-3 py-2 bg-slate-800/60 hover:bg-slate-800 text-indigo-300"
              >
                Add “{text.trim()}”
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

/* ---------- tiny toggle ---------- */
function Toggle({ checked, onChange, label }) {
  return (
    <button
      type="button"
      onClick={() => onChange(!checked)}
      className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-full border ${
        checked
          ? "bg-emerald-600/90 border-emerald-500 text-white"
          : "bg-slate-900/60 border-slate-800 text-slate-200"
      }`}
      aria-pressed={checked}
    >
      <span
        className={`inline-block w-8 h-4 rounded-full relative transition-colors ${
          checked ? "bg-white/30" : "bg-white/10"
        }`}
      >
        <span
          className={`absolute top-1/2 -translate-y-1/2 w-3.5 h-3.5 rounded-full bg-white transition-transform ${
            checked ? "translate-x-4" : "translate-x-0.5"
          }`}
        />
      </span>
      <span className="text-sm">{label}</span>
    </button>
  );
}

export default function QuickAdd() {
  const queryClient = useQueryClient();
  const { data: orders, isLoading, error, refetch } = useQuery({
    queryKey: ["orders"],
    queryFn: getOrders,
  });
  const { data: retailers = [] } = useQuery({
    queryKey: ["retailers"],
    queryFn: getRetailers,
  });
  const { data: items = [] } = useQuery({
    queryKey: ["items"],
    queryFn: getItems,
  });
  const { data: markets = [] } = useQuery({
    queryKey: ["markets"],
    queryFn: getMarketplaces,
  });

  // ensure lists refresh after adding via combobox
  async function refreshLists() {
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: ["items"] }),
      queryClient.invalidateQueries({ queryKey: ["retailers"] }),
      queryClient.invalidateQueries({ queryKey: ["markets"] }),
    ]);
  }

  /* --- current user (for avatar/name) --- */
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

  /* ---- Quick Add form state ---- */
  const today = new Date().toISOString().slice(0, 10);
  const [orderDate, setOrderDate] = useState(today);

  const [itemId, setItemId] = useState("");
  const [itemName, setItemName] = useState("");

  const [profileName, setProfile] = useState(""); // optional

  const [retailerId, setRetailerId] = useState("");
  const [retailerName, setRetailerName] = useState("");

  const [qty, setQty] = useState(1);
  const [buyPrice, setBuyPrice] = useState("");

  // sale section + toggle
  const [sold, setSold] = useState(false);
  const [salePrice, setSalePrice] = useState("");
  const [saleDate, setSaleDate] = useState("");
  const [marketId, setMarketId] = useState("");
  const [marketName, setMarketName] = useState("");
  const [feesPct, setFeesPct] = useState("0");
  const [feesLocked, setFeesLocked] = useState(false);
  const [shipping, setShipping] = useState("0");

  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState("");

  /* ---------- save rows (multi-qty split) ---------- */
  async function saveOrder(e) {
    e.preventDefault();
    setSaving(true);
    setMsg("");
    try {
      const n = Math.max(1, parseInt(qty || "1", 10));
      const buyTotal = Math.abs(moneyToCents(buyPrice));

      const base = {
        order_date: orderDate,
        item: itemName || null,
        profile_name: profileName || null,
        retailer: retailerName || null,
        status: sold ? "sold" : "ordered",
      };

      let perSale = 0, perShip = 0, feePct = 0, saleDt = null, marketStr = null;
      if (sold) {
        const saleTotal = moneyToCents(salePrice);
        const shipTotal = moneyToCents(shipping);
        perSale = Math.round(saleTotal / n);
        perShip = Math.round(shipTotal / n);
        feePct = parsePct(feesPct);
        saleDt = saleDate || null;
        marketStr = marketName || null;
      }

      const perBuy = Math.round(buyTotal / n);

      const rows = Array.from({ length: n }, () => ({
        ...base,
        buy_price_cents: perBuy,
        sale_price_cents: perSale,
        shipping_cents: perShip,
        sale_date: saleDt,
        marketplace: marketStr,
        fees_pct: feePct,
      }));

      const { error } = await supabase.from("orders").insert(rows);
      if (error) throw error;

      setMsg(`Saved ✔ (${n} row${n > 1 ? "s" : ""})`);
      // reset (keep today)
      setItemId("");
      setItemName("");
      setProfile("");
      setRetailerId("");
      setRetailerName("");
      setQty(1);
      setBuyPrice("");
      setSold(false);
      setSalePrice("");
      setSaleDate("");
      setMarketId("");
      setMarketName("");
      setFeesPct("0");
      setFeesLocked(false);
      setShipping("0");

      await refetch();
      await refreshLists();
    } catch (err) {
      setMsg(String(err.message || err));
    } finally {
      setSaving(false);
    }
  }

  /* ---------- sign out (unused) ---------- */
  async function signOut() {
    await supabase.auth.signOut();
    window.location.href = "/login";
  }

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100">
      <div className="max-w-6xl mx-auto p-4 sm:p-6">
        <HeaderWithTabs active="add" showTabs />

        {/* QUICK ADD */}
        <form onSubmit={saveOrder} className="space-y-6">
          {/* Combined Order + Sale card */}
          <div className={`${card} overflow-hidden`}>
            <div className="flex items-center justify-between gap-3 mb-4">
              <h2 className="text-lg font-semibold">Order & Sale</h2>
              <Toggle checked={sold} onChange={setSold} label="Sold" />
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 min-w-0">
              <div className="min-w-0">
                <label className="text-slate-300 mb-1 block text-sm">Order Date</label>
                <input
                  type="date"
                  value={orderDate}
                  onChange={(e) => setOrderDate(e.target.value)}
                  className={inputBase}
                />
              </div>

              {/* ITEM (addable) */}
              <AddableCombo
                label="Item"
                options={items}
                valueId={itemId}
                setValueId={setItemId}
                valueName={itemName}
                setValueName={setItemName}
                placeholder="Type or pick an item…"
                addTable="items"
                onAfterSelect={() => refreshLists()}
              />

              <div className="min-w-0">
                <label className="text-slate-300 mb-1 block text-sm">Profile name (optional)</label>
                <input
                  value={profileName}
                  onChange={(e) => setProfile(e.target.value)}
                  placeholder="name / Testing 1"
                  className={inputBase}
                />
              </div>

              {/* RETAILER (addable) */}
              <AddableCombo
                label="Retailer"
                options={retailers}
                valueId={retailerId}
                setValueId={setRetailerId}
                valueName={retailerName}
                setValueName={setRetailerName}
                placeholder="Type or pick a retailer…"
                addTable="retailers"
                onAfterSelect={() => refreshLists()}
              />

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

              <div className="min-w-0">
                <label className="text-slate-300 mb-1 block text-sm">Buy Price (total)</label>
                <input
                  value={buyPrice}
                  onChange={(e) => setBuyPrice(e.target.value)}
                  placeholder="e.g. 67.70"
                  className={`${inputBase} placeholder-slate-400`}
                />
              </div>

              {/* --- SALE SECTION --- */}
              <div className="min-w-0">
                <label className="text-slate-300 mb-1 block text-sm">Sale Date</label>
                <input
                  type="date"
                  value={saleDate}
                  onChange={(e) => setSaleDate(e.target.value)}
                  disabled={!sold}
                  className={`${inputBase} ${!sold ? "opacity-60 cursor-not-allowed" : ""}`}
                />
              </div>

              {/* MARKETPLACE (addable) */}
              <AddableCombo
                label="Marketplace"
                options={markets}
                valueId={marketId}
                setValueId={setMarketId}
                valueName={marketName}
                setValueName={setMarketName}
                placeholder="Type or pick a marketplace…"
                addTable="marketplaces"
                addExtra={{ default_fees_pct: 0 }}
                onAfterSelect={(m) => {
                  // if marketplace has default fees, lock field w/ value
                  const pct = Number(m?.default_fees_pct || 0);
                  if (pct > 0) {
                    setFeesPct((pct * 100).toString());
                    setFeesLocked(true);
                  } else {
                    setFeesLocked(false);
                  }
                  setMarketName(m?.name || "");
                  setSold(true); // selecting a marketplace likely implies sold
                }}
              />

              <div className="min-w-0">
                <label className="text-slate-300 mb-1 block text-sm">Sell Price (total)</label>
                <input
                  value={salePrice}
                  onChange={(e) => setSalePrice(e.target.value)}
                  placeholder="0 = unsold"
                  disabled={!sold}
                  className={`${inputBase} placeholder-slate-400 ${
                    !sold ? "opacity-60 cursor-not-allowed" : ""
                  }`}
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
                  disabled={!sold || feesLocked}
                  className={`${inputBase} placeholder-slate-400 ${
                    !sold || feesLocked ? "opacity-60 cursor-not-allowed" : ""
                  }`}
                />
                {feesLocked && (
                  <p className="text-xs text-slate-500 mt-1">
                    Locked from marketplace default.
                  </p>
                )}
              </div>

              <div className="min-w-0">
                <label className="text-slate-300 mb-1 block text-sm">Shipping (total)</label>
                <input
                  value={shipping}
                  onChange={(e) => setShipping(e.target.value)}
                  disabled={!sold}
                  className={`${inputBase} ${!sold ? "opacity-60 cursor-not-allowed" : ""}`}
                />
                <p className="text-xs text-slate-500 mt-1">
                  If qty &gt; 1 we’ll split shipping across rows.
                </p>
              </div>
            </div>

            <div className="mt-6 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div
                className={`text-sm ${
                  msg.startsWith("Saved") ? "text-emerald-400" : "text-rose-400"
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
                className="rounded-xl border border-slate-800 bg-slate-900/60 p-4 overflow-hidden"
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
                  Buy ${centsToStr(o.buy_price_cents)} • Sell ${centsToStr(o.sale_price_cents)} •
                  Ship ${centsToStr(o.shipping_cents)}
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
