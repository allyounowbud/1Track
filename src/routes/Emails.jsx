// src/routes/Emails.jsx
import { useEffect, useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "../lib/supabaseClient";
import HeaderWithTabs from "../components/HeaderWithTabs.jsx";

/* ----------------------------- UI tokens ----------------------------- */
const card =
  "rounded-2xl border border-slate-800 bg-slate-900/60 backdrop-blur p-4 sm:p-6 shadow-[0_10px_30px_rgba(0,0,0,.35)] overflow-hidden";
const inputBase =
  "w-full min-w-0 appearance-none bg-slate-900/60 border border-slate-800 rounded-xl px-4 py-3 text-slate-100 placeholder-slate-400 outline-none focus:ring-2 focus:ring-indigo-500";
const tabBtn =
  "inline-flex items-center justify-center h-10 px-4 rounded-xl border border-slate-800 bg-slate-900/60 text-slate-200 hover:bg-slate-900 transition";
const tabActive = "bg-indigo-600 text-white border-indigo-600 shadow hover:bg-indigo-600";

/* ----------------------------- helpers ------------------------------ */
const centsToStr = (c) => (Number(c || 0) / 100).toFixed(2);
const within = (d, from, to) => {
  if (!d) return false;
  const x = new Date(d).getTime();
  if (isNaN(x)) return false;
  if (from && x < from) return false;
  if (to && x > to) return false;
  return true;
};

/* ----------------------------- queries ------------------------------ */
async function getEmailAccounts() {
  const { data, error } = await supabase
    .from("email_accounts")
    .select("id, provider, email_address, updated_at")
    .order("updated_at", { ascending: false })
    .limit(1);
  if (error) throw error;
  return data || [];
}

async function getEmailOrders() {
  const { data, error } = await supabase
    .from("email_orders")
    .select("id, retailer, order_id, order_date, currency, total_cents, created_at")
    .order("order_date", { ascending: false })
    .limit(1000);
  if (error) throw error;
  return data || [];
}

async function getEmailShipments() {
  const { data, error } = await supabase
    .from("email_shipments")
    .select(
      "id, retailer, order_id, carrier, tracking_number, status, shipped_at, delivered_at, created_at"
    )
    .order("shipped_at", { ascending: false })
    .limit(1000);
  if (error) throw error;
  return data || [];
}

/* --------------------------------- page --------------------------------- */
export default function Emails() {
  const { data: accounts = [], refetch: refetchAcct, isLoading: acctLoading } = useQuery({
    queryKey: ["email-accounts"],
    queryFn: getEmailAccounts,
  });
  const { data: orders = [], refetch: refetchOrders, isLoading: ordersLoading } = useQuery({
    queryKey: ["email-orders"],
    queryFn: getEmailOrders,
  });
  const { data: ships = [], refetch: refetchShips, isLoading: shipsLoading } = useQuery({
    queryKey: ["email-shipments"],
    queryFn: getEmailShipments,
  });

  // current user (header avatar/name)
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

  const connected = !!accounts.length;
  const acctEmail = accounts[0]?.email_address || null;

  // Show “connected” banner when returning from OAuth
  const [justConnected, setJustConnected] = useState(false);
  useEffect(() => {
    const u = new URL(window.location.href);
    if (u.searchParams.get("connected")) {
      setJustConnected(true);
      u.searchParams.delete("connected");
      window.history.replaceState({}, "", u.toString());
    }
  }, []);

  /* ----------------------------- filters ----------------------------- */
  const [tab, setTab] = useState("orders"); // "orders" | "shipments"

  // shared date range
  const [range, setRange] = useState("30"); // all | month | 30 | custom
  const [fromStr, setFromStr] = useState("");
  const [toStr, setToStr] = useState("");

  const { fromMs, toMs } = useMemo(() => {
    if (range === "custom") {
      const f = fromStr ? new Date(fromStr).setHours(0, 0, 0, 0) : null;
      const t = toStr ? new Date(toStr).setHours(23, 59, 59, 999) : null;
      return { fromMs: f, toMs: t };
    }
    if (range === "month") {
      const now = new Date();
      const f = new Date(now.getFullYear(), now.getMonth(), 1).getTime();
      const t = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59, 999).getTime();
      return { fromMs: f, toMs: t };
    }
    if (range === "30") {
      const t = Date.now();
      const f = t - 29 * 24 * 3600 * 1000;
      return { fromMs: f, toMs: t };
    }
    return { fromMs: null, toMs: null };
  }, [range, fromStr, toStr]);

  // retailer filter (computed from data)
  const [retailer, setRetailer] = useState("");
  const orderRetailers = useMemo(
    () => Array.from(new Set(orders.map((o) => o.retailer).filter(Boolean))).sort(),
    [orders]
  );
  const shipRetailers = useMemo(
    () => Array.from(new Set(ships.map((s) => s.retailer).filter(Boolean))).sort(),
    [ships]
  );

  // shipment status filter
  const [shipStatus, setShipStatus] = useState(""); // '', 'in_transit', 'delivered', etc.

  // search bar
  const [q, setQ] = useState("");

  /* --------------------------- filtered views --------------------------- */
  const ordersView = useMemo(() => {
    return orders
      .filter((o) => (retailer ? o.retailer === retailer : true))
      .filter((o) => within(o.order_date, fromMs, toMs) || (!fromMs && !toMs))
      .filter((o) =>
        q
          ? [o.retailer, o.order_id, o.order_date]
              .filter(Boolean)
              .some((t) => String(t).toLowerCase().includes(q.toLowerCase()))
          : true
      );
  }, [orders, retailer, fromMs, toMs, q]);

  const shipsView = useMemo(() => {
    return ships
      .filter((s) => (retailer ? s.retailer === retailer : true))
      .filter((s) => (shipStatus ? s.status === shipStatus : true))
      .filter(
        (s) =>
          within(s.shipped_at || s.created_at, fromMs, toMs) ||
          within(s.delivered_at, fromMs, toMs) ||
          (!fromMs && !toMs)
      )
      .filter((s) =>
        q
          ? [s.retailer, s.order_id, s.carrier, s.tracking_number]
              .filter(Boolean)
              .some((t) => String(t).toLowerCase().includes(q.toLowerCase()))
          : true
      );
  }, [ships, retailer, shipStatus, fromMs, toMs, q]);

  /* ------------------------ actions: connect/sync ------------------------ */
  const [syncMsg, setSyncMsg] = useState("");
  const [syncing, setSyncing] = useState(false);

  // IMPORTANT: pass the Supabase user id in the query so the function can
  // store tokens against the correct user_id.
  async function connectGmail() {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      alert("Please sign in first.");
      return;
    }
    window.location.href =
      `/.netlify/functions/gmail-auth-start?uid=${encodeURIComponent(user.id)}`;
  }

  async function syncNow() {
  try {
    setSyncing(true);
    setSyncMsg("Syncing…");

    const { data: { session } } = await supabase.auth.getSession();
    const res = await fetch("/.netlify/functions/gmail-sync", {
      method: "POST",
      headers: {
        "Authorization": session?.access_token ? `Bearer ${session.access_token}` : "",
      },
    });

    // Try to read JSON; fall back to text for better error surfacing
    const text = await res.text();
    let j;
    try { j = JSON.parse(text); } catch { j = { error: text }; }

    if (!res.ok) {
      setSyncMsg(`Sync failed: ${j?.error || res.status}`);
    } else {
      setSyncMsg(`Imported ${j?.imported ?? 0} message(s) ✓`);
      await Promise.all([refetchAcct(), refetchOrders(), refetchShips()]);
    }
  } catch (e) {
    setSyncMsg(String(e.message || e));
  } finally {
    setSyncing(false);
    setTimeout(() => setSyncMsg(""), 2200);
  }
}


  /* -------------------------------- render -------------------------------- */
  return (
    <div className="min-h-screen bg-slate-950 text-slate-100">
      <div className="max-w-6xl mx-auto p-4 sm:p-6">
        <HeaderWithTabs active="emails" showTabs />

        {justConnected && (
          <div className="mb-4 rounded-xl border border-emerald-700 bg-emerald-900/30 text-emerald-200 px-4 py-3">
            Gmail connected ✓ — you can sync now.
          </div>
        )}

        {/* Connect + Actions */}
        <div className={`${card} mb-6`}>
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div className="min-w-0">
              <div className="flex items-center gap-2 text-lg font-semibold">
                <EnvelopeIcon className="h-5 w-5" />
                Emails
              </div>
              <p className="text-slate-400 text-sm mt-1">
                Connect your mailbox to automatically import order confirmations and shipping
                updates. We normalize each email into Orders &amp; Shipments.
              </p>
              {connected && (
                <p className="text-slate-300 text-sm mt-1">
                  Connected: <span className="font-medium">{acctEmail}</span>
                </p>
              )}
            </div>

            <div className="flex items-center gap-2 shrink-0">
              {!connected && (
                <button
                  onClick={connectGmail}
                  className="h-11 px-5 rounded-2xl bg-emerald-600 hover:bg-emerald-500 text-white font-medium"
                >
                  Connect Gmail
                </button>
              )}
              {connected && (
                <button
                  onClick={syncNow}
                  disabled={syncing}
                  className="h-11 px-5 rounded-2xl bg-indigo-600 hover:bg-indigo-500 disabled:opacity-60 text-white font-medium"
                >
                  {syncing ? "Syncing…" : "Sync now"}
                </button>
              )}
            </div>
          </div>
          {syncMsg && (
            <div className="mt-3 text-sm text-slate-300">
              {syncMsg}
            </div>
          )}
        </div>

        {/* Filters */}
        <div className={`${card} mb-6`}>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 min-w-0">
            <div>
              <label className="text-slate-300 mb-1 block text-sm">View</label>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => setTab("orders")}
                  className={`${tabBtn} ${tab === "orders" ? tabActive : ""}`}
                >
                  Orders
                </button>
                <button
                  type="button"
                  onClick={() => setTab("shipments")}
                  className={`${tabBtn} ${tab === "shipments" ? tabActive : ""}`}
                >
                  Shipments
                </button>
              </div>
            </div>

            <div>
              <label className="text-slate-300 mb-1 block text-sm">Date range</label>
              <select
                value={range}
                onChange={(e) => setRange(e.target.value)}
                className={inputBase}
              >
                <option value="30">Last 30 days</option>
                <option value="month">This month</option>
                <option value="all">All time</option>
                <option value="custom">Custom…</option>
              </select>
            </div>

            {range === "custom" && (
              <>
                <div>
                  <label className="text-slate-300 mb-1 block text-sm">From</label>
                  <input
                    type="date"
                    value={fromStr}
                    onChange={(e) => setFromStr(e.target.value)}
                    className={inputBase}
                  />
                </div>
                <div>
                  <label className="text-slate-300 mb-1 block text-sm">To</label>
                  <input
                    type="date"
                    value={toStr}
                    onChange={(e) => setToStr(e.target.value)}
                    className={inputBase}
                  />
                </div>
              </>
            )}

            <div>
              <label className="text-slate-300 mb-1 block text-sm">Retailer</label>
              <select
                value={retailer}
                onChange={(e) => setRetailer(e.target.value)}
                className={inputBase}
              >
                <option value="">All</option>
                {(tab === "orders" ? orderRetailers : shipRetailers).map((r) => (
                  <option key={r} value={r}>
                    {r}
                  </option>
                ))}
              </select>
            </div>

            {tab === "shipments" && (
              <div>
                <label className="text-slate-300 mb-1 block text-sm">Status</label>
                <select
                  value={shipStatus}
                  onChange={(e) => setShipStatus(e.target.value)}
                  className={inputBase}
                >
                  <option value="">All</option>
                  <option value="label_created">Label created</option>
                  <option value="in_transit">In transit</option>
                  <option value="delivered">Delivered</option>
                </select>
              </div>
            )}

            <div className="sm:col-span-2 lg:col-span-1">
              <label className="text-slate-300 mb-1 block text-sm">Search</label>
              <input
                value={q}
                onChange={(e) => setQ(e.target.value)}
                placeholder={tab === "orders" ? "Order # / retailer…" : "Tracking / carrier…"}
                className={inputBase}
              />
            </div>
          </div>
        </div>

        {/* Data */}
        {tab === "orders" ? (
          <div className={card}>
            <div className="text-lg font-semibold mb-3">Orders</div>
            <div className="overflow-x-auto">
              <table className="min-w-[760px] w-full text-sm">
                <thead className="text-slate-300">
                  <tr className="text-left">
                    <th className="py-2 pr-3">Retailer</th>
                    <th className="py-2 pr-3">Order #</th>
                    <th className="py-2 pr-3">Order Date</th>
                    <th className="py-2 pr-3 text-right">Total</th>
                  </tr>
                </thead>
                <tbody className="text-slate-200">
                  {ordersLoading && (
                    <tr><td className="py-6 text-slate-400" colSpan={4}>Loading…</td></tr>
                  )}
                  {!ordersLoading && ordersView.map((o) => (
                    <tr key={o.id} className="border-t border-slate-800">
                      <td className="py-2 pr-3">{o.retailer || "—"}</td>
                      <td className="py-2 pr-3">{o.order_id || "—"}</td>
                      <td className="py-2 pr-3">{o.order_date || "—"}</td>
                      <td className="py-2 pr-3 text-right">
                        ${centsToStr(o.total_cents)}
                      </td>
                    </tr>
                  ))}
                  {!ordersLoading && ordersView.length === 0 && (
                    <tr><td className="py-6 text-slate-400" colSpan={4}>No orders in this view.</td></tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        ) : (
          <div className={card}>
            <div className="text-lg font-semibold mb-3">Shipments</div>
            <div className="overflow-x-auto">
              <table className="min-w-[900px] w-full text-sm">
                <thead className="text-slate-300">
                  <tr className="text-left">
                    <th className="py-2 pr-3">Retailer</th>
                    <th className="py-2 pr-3">Order #</th>
                    <th className="py-2 pr-3">Carrier</th>
                    <th className="py-2 pr-3">Tracking</th>
                    <th className="py-2 pr-3">Status</th>
                    <th className="py-2 pr-3">Shipped</th>
                    <th className="py-2 pr-3">Delivered</th>
                  </tr>
                </thead>
                <tbody className="text-slate-200">
                  {shipsLoading && (
                    <tr><td className="py-6 text-slate-400" colSpan={7}>Loading…</td></tr>
                  )}
                  {!shipsLoading && shipsView.map((s) => (
                    <tr key={s.id} className="border-t border-slate-800">
                      <td className="py-2 pr-3">{s.retailer || "—"}</td>
                      <td className="py-2 pr-3">{s.order_id || "—"}</td>
                      <td className="py-2 pr-3">{s.carrier || "—"}</td>
                      <td className="py-2 pr-3">{s.tracking_number || "—"}</td>
                      <td className="py-2 pr-3">{s.status || "—"}</td>
                      <td className="py-2 pr-3">
                        {s.shipped_at ? new Date(s.shipped_at).toLocaleDateString() : "—"}
                      </td>
                      <td className="py-2 pr-3">
                        {s.delivered_at ? new Date(s.delivered_at).toLocaleDateString() : "—"}
                      </td>
                    </tr>
                  ))}
                  {!shipsLoading && shipsView.length === 0 && (
                    <tr><td className="py-6 text-slate-400" colSpan={7}>No shipments in this view.</td></tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* Tiny helper / footer */}
        <div className="text-xs text-slate-500 mt-4">
          Tip: You can re-run sync anytime. We keep raw emails so future parser improvements can
          repopulate Orders/Shipments without re-authorizing.
        </div>
      </div>
    </div>
  );
}

/* ------------------------------- icons ------------------------------- */
function EnvelopeIcon({ className = "h-5 w-5" }) {
  return (
    <svg viewBox="0 0 24 24" className={className} fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M4 6h16v12H4z" />
      <path d="m22 7-10 6L2 7" />
    </svg>
  );
}
