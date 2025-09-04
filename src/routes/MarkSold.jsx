// src/routes/MarkSold.jsx
import { useEffect, useMemo, useRef, useState } from "react";
import { NavLink } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "../lib/supabaseClient";

/* ---------- helpers (same as other pages) ---------- */
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

/* ---------- auth ---------- */
async function signOut() {
  await supabase.auth.signOut();
  window.location.href = "/login";
}

export default function MarkSold() {
  // current user (avatar/name in header)
  const [userInfo, setUserInfo] = useState({ avatar_url: "", username: "" });
  useEffect(() => {
    async function loadUser() {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return setUserInfo({ avatar_url: "", username: "" });
      const m = user.user_metadata || {};
      const username =
        m.user_name || m.preferred_username || m.full_name || m.name || user.email || "Account";
      const avatar_url = m.avatar_url || m.picture || "";
      setUserInfo({ avatar_url, username });
    }
    loadUser();
    const { data: sub } = supabase.auth.onAuthStateChange((_evt, session) => {
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

  const [search, setSearch] = useState("");
  const [dropdownOpen, setDropdownOpen] = useState(false);
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
  const boxRef = useRef(null);
  useEffect(() => {
    const onClick = (e) => {
      if (!boxRef.current) return;
      if (!boxRef.current.contains(e.target)) setDropdownOpen(false);
    };
    window.addEventListener("click", onClick, { passive: true });
    return () => window.removeEventListener("click", onClick);
  }, []);

  const label = (o) =>
    `${o.item ?? "—"} • ${o.retailer ?? "—"} • ${o.order_date} • Buy $${centsToStr(
      o.buy_price_cents
    )}`;

  const filtered = useMemo(() => {
    const q = search.toLowerCase();
    if (!q) return openOrders.slice(0, 50);
    return openOrders.filter((o) =>
      [o.item, o.retailer, o.order_date, label(o)]
        .filter(Boolean)
        .some((t) => String(t).toLowerCase().includes(q))
    );
  }, [openOrders, search]);

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

  // ---------- shared tab styles ----------
  const tabBase =
    "inline-flex items-center justify-center h-10 px-4 rounded-xl border border-slate-800 bg-slate-900/60 text-slate-200 hover:bg-slate-900 transition";
  const tabActive = "bg-indigo-600 text-white border-indigo-600 shadow hover:bg-indigo-600";

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100">
      <div className="max-w-6xl mx-auto p-4 sm:p-6">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <h1 className="text-3xl font-bold">OneTrack</h1>
          <div className="flex items-center gap-3">
            {userInfo.avatar_url ? (
              <img
                src={userInfo.avatar_url}
                alt=""
                className="h-8 w-8 rounded-full border border-slate-800 object-cover"
              />
            ) : (
              <div className="h-8 w-8 rounded-full bg-slate-800 grid place-items-center text-slate-300 text-xs">
                {(userInfo.username || "U").slice(0, 1).toUpperCase()}
              </div>
            )}
            <div className="hidden sm:block text-sm text-slate-300 max-w-[160px] truncate">
              {userInfo.username}
            </div>
            <button
              onClick={signOut}
              className="px-4 h-10 rounded-xl border border-slate-800 bg-slate-900/60 hover:bg-slate-900"
            >
              Sign out
            </button>
          </div>
        </div>

        {/* Tabs (same look + mobile-safe) */}
        <div className="relative z-20 flex flex-wrap items-center gap-2 mb-6">
          <NavLink to="/app" className={({ isActive }) => `${tabBase} ${isActive ? tabActive : ""}`}>
            Quick Add
          </NavLink>
          <NavLink to="/sold" className={({ isActive }) => `${tabBase} ${isActive ? tabActive : ""}`}>
            Mark as Sold
          </NavLink>
          <button className={tabBase}>Stats</button>
          <button className={tabBase}>Inventory</button>
          <button className={tabBase}>Flex</button>
          <NavLink
            to="/settings"
            className={({ isActive }) => `${tabBase} ${isActive ? tabActive : ""}`}
          >
            Settings
          </NavLink>
        </div>

        {/* Card (mobile-friendly: overflow-hidden, min-w-0, responsive gaps) */}
        <form
          onSubmit={markSold}
          className="relative z-0 rounded-2xl border border-slate-800 bg-slate-900/60 backdrop-blur p-4 sm:p-6 shadow-[0_10px_30px_rgba(0,0,0,.35)] overflow-hidden space-y-5"
        >
          {/* Open purchase (searchable) */}
          <div className="min-w-0">
            <label className="text-slate-300 mb-1 block text-sm">Select Open Purchase</label>
            <div ref={boxRef} className="relative">
              <input
                value={selected ? label(selected) : search}
                onChange={(e) => {
                  setSelected(null);
                  setSearch(e.target.value);
                }}
                onFocus={() => setDropdownOpen(true)}
                placeholder="Type to search…"
                className="w-full min-w-0 appearance-none bg-slate-900/60 border border-slate-800 rounded-xl px-4 py-3 text-slate-100 placeholder-slate-400 outline-none focus:ring-2 focus:ring-indigo-500"
              />
              {dropdownOpen && (
                <div className="absolute left-0 right-0 z-20 mt-2 max-h-64 overflow-auto overscroll-contain rounded-xl border border-slate-800 bg-slate-900/90 backdrop-blur shadow-xl">
                  {filtered.length === 0 && (
                    <div className="px-3 py-2 text-slate-400 text-sm">No matches.</div>
                  )}
                  {filtered.map((o) => (
                    <button
                      type="button"
                      key={o.id}
                      onClick={() => {
                        setSelected(o);
                        setSearch("");
                        setDropdownOpen(false);
                      }}
                      className="w-full text-left px-3 py-2 hover:bg-slate-800/70"
                    >
                      {label(o)}
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>

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
              <select
                value={marketId}
                onChange={(e) => onMarketChange(e.target.value)}
                className="w-full min-w-0 appearance-none bg-slate-900/60 border border-slate-800 rounded-xl px-4 py-3 text-slate-100 outline-none focus:ring-2 focus:ring-indigo-500"
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