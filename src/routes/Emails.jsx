// src/routes/Emails.jsx
import { useEffect, useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "../lib/supabaseClient";
import HeaderWithTabs from "../components/HeaderWithTabs.jsx";

/* ---------- tokens ---------- */
const card =
  "rounded-2xl border border-slate-800 bg-slate-900/60 backdrop-blur p-4 sm:p-6 shadow-[0_10px_30px_rgba(0,0,0,.35)] overflow-hidden";
const inputBase =
  "w-full min-w-0 appearance-none bg-slate-900/60 border border-slate-800 rounded-xl px-4 py-3 text-slate-100 placeholder-slate-400 outline-none focus:ring-2 focus:ring-indigo-500";
const pill = "inline-flex items-center gap-1 px-2.5 h-7 rounded-full text-xs font-medium";

/* ---------- helpers ---------- */
const centsToStr = (c) => (Number(c || 0) / 100).toFixed(2);

/** Merge orders + shipments into shipment-like rows */
function stitch(orders = [], shipments = []) {
  // Map orders by composite key for quick lookup
  const byKey = new Map(); // key => entity
  const makeKey = (retailer, order_id) => `${(retailer||'').trim()}::${(order_id||'').trim()}`;

  orders.forEach((o) => {
    const key = makeKey(o.retailer, o.order_id);
    byKey.set(key, {
      retailer: o.retailer || "—",
      order_id: o.order_id || "—",
      order_date: o.order_date || null,
      total_cents: o.total_cents || 0,
      // shipping aggregates – will be extended by shipments
      shipped_at: o.shipped_at || null,
      delivered_at: o.delivered_at || null,
      status: o.status || "ordered",
      // extra
      trackings: new Map(), // tracking_number -> shipment row
    });
  });

  // Attach shipments to their order by (retailer, order_id) first
  // If no order_id, attach by unique tracking_number to any existing order with same tracking already seen
  const globalTracking = new Map(); // tracking -> stitched row (to avoid duplicates)
  // seed from existing stitched rows (in case your normalize already put shipped/delivered on orders)
  for (const row of byKey.values()) {
    for (const t of row.trackings?.keys?.() || []) {
      globalTracking.set(t, row);
    }
  }

  const attachToRow = (s) => {
    const viaOrder = s.order_id ? byKey.get(makeKey(s.retailer, s.order_id)) : null;
    if (viaOrder) return viaOrder;

    // Fallback: if tracking already attached somewhere, reuse that row
    if (s.tracking_number && globalTracking.has(s.tracking_number)) {
      return globalTracking.get(s.tracking_number);
    }

    // Final fallback: create a synthetic row (for shipments we can't tie back yet)
    const key = makeKey(s.retailer, s.order_id || `#${s.tracking_number || s.id}`);
    if (!byKey.has(key)) {
      byKey.set(key, {
        retailer: s.retailer || "—",
        order_id: s.order_id || "Unknown",
        order_date: null,
        total_cents: 0,
        shipped_at: null,
        delivered_at: null,
        status: "in_transit",
        trackings: new Map(),
      });
    }
    return byKey.get(key);
  };

  shipments.forEach((s) => {
    const row = attachToRow(s);
    if (s.tracking_number) {
      row.trackings.set(s.tracking_number, {
        tracking_number: s.tracking_number,
        carrier: s.carrier || "",
        shipped_at: s.shipped_at || null,
        delivered_at: s.delivered_at || null,
        status: s.status || "",
      });
      globalTracking.set(s.tracking_number, row);
    }
    // Update aggregates
    row.shipped_at = row.shipped_at || s.shipped_at || null;
    row.delivered_at = row.delivered_at || s.delivered_at || null;

    // Status precedence
    const st = (s.status || "").toLowerCase();
    const rank = (x) =>
      x === "delivered" ? 3 :
      (x === "out_for_delivery" ? 2 :
      (x === "in_transit" || x === "label_created" ? 1 :
      (x === "ordered" ? 0 : -1)));
    const best = rank(row.status);
    const cur = rank(st || "in_transit");
    if (cur > best) row.status = st || "in_transit";
  });

  // If no shipments, derive status from order
  for (const row of byKey.values()) {
    if (!row.shipped_at && !row.delivered_at) {
      row.status = row.status || "ordered";
    }
    if (row.delivered_at) row.status = "delivered";
  }

  return Array.from(byKey.values());
}

/* ---------- queries ---------- */
async function getOrders() {
  const { data, error } = await supabase
    .from("email_orders")
    .select("id, user_id, retailer, order_id, order_date, total_cents, shipped_at, delivered_at, status")
    .order("order_date", { ascending: false })
    .limit(2000);
  if (error) throw error;
  return data || [];
}

async function getShipments() {
  const { data, error } = await supabase
    .from("email_shipments")
    .select("id, user_id, retailer, order_id, tracking_number, carrier, status, shipped_at, delivered_at, created_at")
    .order("created_at", { ascending: false })
    .limit(4000);
  if (error) throw error;
  return data || [];
}

async function getEmailAccounts() {
  const { data, error } = await supabase
    .from("email_accounts")
    .select("email_address, updated_at")
    .order("updated_at", { ascending: false })
    .limit(1);
  if (error) throw error;
  return data || [];
}

/* --------------------------------- page --------------------------------- */
export default function Emails() {
  // header user (kept to match other pages)
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

  const { data: accounts = [] } = useQuery({ queryKey: ["email-accounts"], queryFn: getEmailAccounts });
  const { data: orders = [], refetch: refetchOrders, isLoading: lo1 } = useQuery({ queryKey: ["email-orders"], queryFn: getOrders });
  const { data: ships = [], refetch: refetchShips, isLoading: lo2 } = useQuery({ queryKey: ["email-shipments"], queryFn: getShipments });

  const connected = !!accounts.length;
  const acctEmail = accounts[0]?.email_address || null;

  /* ------------------ controls (filters/top tabs/search) ------------------ */
  const [scope, setScope] = useState("all"); // all | shipping | to_ship | delivered
  const [q, setQ] = useState("");

  const rowsAll = useMemo(() => stitch(orders, ships), [orders, ships]);

  const rows = useMemo(() => {
    let r = rowsAll;
    // Status filter buckets
    if (scope === "shipping") {
      r = r.filter(x => !x.delivered_at && (x.status === "in_transit" || x.status === "out_for_delivery" || x.status === "label_created"));
    } else if (scope === "to_ship") {
      r = r.filter(x => !x.shipped_at && !x.delivered_at);
    } else if (scope === "delivered") {
      r = r.filter(x => !!x.delivered_at || x.status === "delivered");
    }
    // Search
    if (q.trim()) {
      const t = q.toLowerCase();
      r = r.filter(x =>
        [x.retailer, x.order_id, ...Array.from(x.trackings.keys())]
          .filter(Boolean)
          .some(s => String(s).toLowerCase().includes(t))
      );
    }
    // Sort: delivered last date desc, otherwise recent activity desc
    return r.sort((a, b) => {
      const ad = a.delivered_at ? new Date(a.delivered_at).getTime() : (a.shipped_at ? new Date(a.shipped_at).getTime() : new Date(a.order_date || 0).getTime());
      const bd = b.delivered_at ? new Date(b.delivered_at).getTime() : (b.shipped_at ? new Date(b.shipped_at).getTime() : new Date(b.order_date || 0).getTime());
      return bd - ad;
    });
  }, [rowsAll, scope, q]);

  /* ----------------------------- actions ----------------------------- */
  const [syncing, setSyncing] = useState(false);
  const [syncMsg, setSyncMsg] = useState("");

  function connectGmail() {
    window.location.href = "/.netlify/functions/gmail-auth-start";
  }

  async function syncNow() {
    try {
      setSyncing(true);
      setSyncMsg("Syncing…");
      const res = await fetch("/.netlify/functions/gmail-sync", { method: "POST" });
      const j = await res.json().catch(() => ({}));
      setSyncMsg(res.ok ? `Imported ${j?.imported ?? 0}, updated ${j?.updated ?? 0}, skipped ${j?.skipped_existing ?? 0}` : `Sync failed: ${j?.error || res.status}`);
      await Promise.all([refetchOrders(), refetchShips()]);
    } catch (e) {
      setSyncMsg(String(e.message || e));
    } finally {
      setSyncing(false);
      setTimeout(() => setSyncMsg(""), 2600);
    }
  }

  /* ------------------------------- render ------------------------------- */
  return (
    <div className="min-h-screen bg-slate-950 text-slate-100">
      <div className="max-w-6xl mx-auto p-4 sm:p-6">
        <HeaderWithTabs active="emails" showTabs />

        {/* Connect / Sync */}
        <div className={`${card} mb-6`}>
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div className="min-w-0">
              <div className="flex items-center gap-2 text-lg font-semibold">
                <MailIcon className="h-5 w-5" />
                Emails
              </div>
              <p className="text-slate-400 text-sm mt-1">
                Connect your mailbox to automatically import order confirmations and shipping updates. We link shipping emails to their orders by order # and tracking number.
              </p>
              {connected && (
                <p className="text-slate-300 text-sm mt-1">
                  Connected: <span className="font-medium">{acctEmail}</span>
                </p>
              )}
            </div>
            <div className="flex items-center gap-2 shrink-0">
              {!connected ? (
                <button onClick={connectGmail} className="h-11 px-5 rounded-2xl bg-emerald-600 hover:bg-emerald-500 text-white font-medium">
                  Connect Gmail
                </button>
              ) : (
                <button onClick={syncNow} disabled={syncing} className="h-11 px-5 rounded-2xl bg-indigo-600 hover:bg-indigo-500 disabled:opacity-60 text-white font-medium">
                  {syncing ? "Syncing…" : "Sync now"}
                </button>
              )}
            </div>
          </div>
          {syncMsg && <div className="mt-3 text-sm text-slate-300">{syncMsg}</div>}
        </div>

        {/* Top tabs + search */}
        <div className={`${card} mb-6`}>
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-4">
              <TopTab label="All" active={scope === "all"} onClick={() => setScope("all")} />
              <TopTab label="Shipping" active={scope === "shipping"} onClick={() => setScope("shipping")} />
              <TopTab label="To be shipped" active={scope === "to_ship"} onClick={() => setScope("to_ship")} />
              <TopTab label="Delivered" active={scope === "delivered"} onClick={() => setScope("delivered")} />
            </div>
            <div className="w-full sm:w-64">
              <input
                value={q}
                onChange={(e) => setQ(e.target.value)}
                placeholder="Search retailer, order #, tracking…"
                className={inputBase}
              />
            </div>
          </div>
        </div>

        {/* List */}
        <div className={`${card}`}>
          <div className="text-lg font-semibold mb-3">Shipments</div>
          {(lo1 || lo2) && <div className="text-slate-400">Loading…</div>}
          {!lo1 && !lo2 && rows.length === 0 && <div className="text-slate-400">No results.</div>}

          <div className="divide-y divide-slate-800">
            {rows.map((r, i) => (
              <div key={i} className="py-3 flex items-center gap-3">
                <div className="shrink-0">
                  <TruckIcon className="h-9 w-9 text-slate-300" />
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div className="min-w-0">
                      <div className="font-medium truncate">
                        {r.order_id || "Unknown"} <span className="text-slate-400">· {r.retailer}</span>
                      </div>
                      <div className="text-xs text-slate-400 mt-0.5">
                        {r.order_date ? `Ordered ${new Date(r.order_date).toLocaleDateString()}` : "Order date —"}
                        {r.shipped_at ? ` · Shipped ${new Date(r.shipped_at).toLocaleDateString()}` : ""}
                        {r.delivered_at ? ` · Delivered ${new Date(r.delivered_at).toLocaleDateString()}` : ""}
                      </div>
                    </div>
                    <StatusPill status={r.status} />
                  </div>

                  {/* Tracking chips */}
                  {r.trackings.size > 0 && (
                    <div className="mt-2 flex flex-wrap gap-1.5">
                      {Array.from(r.trackings.values()).map((t) => (
                        <span key={t.tracking_number} className={`${pill} bg-slate-800/70 text-slate-200`}>
                          <span className="opacity-70">{t.carrier || "Carrier"}</span>
                          <span className="font-mono">{t.tracking_number}</span>
                        </span>
                      ))}
                    </div>
                  )}
                </div>

                {/* total (if present) */}
                <div className="hidden sm:block text-right shrink-0 min-w-[80px] text-slate-200">
                  {r.total_cents ? <>${centsToStr(r.total_cents)}</> : <span className="text-slate-500">—</span>}
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="text-xs text-slate-500 mt-4">
          We automatically link shipping emails to their orders (by order # and tracking). Re-sync anytime to pick up new messages.
        </div>
      </div>
    </div>
  );
}

/* ---------- small UI ---------- */
function TopTab({ label, active, onClick }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`h-9 px-4 rounded-full border transition ${
        active ? "bg-indigo-600 text-white border-indigo-600" : "bg-slate-900/60 text-slate-200 border-slate-800 hover:bg-slate-900"
      }`}
    >
      {label}
    </button>
  );
}

function StatusPill({ status }) {
  const s = (status || "").toLowerCase();
  const map = {
    delivered: "bg-emerald-600/20 text-emerald-300",
    out_for_delivery: "bg-amber-600/20 text-amber-300",
    in_transit: "bg-sky-600/20 text-sky-300",
    label_created: "bg-slate-700/50 text-slate-300",
    ordered: "bg-slate-700/50 text-slate-300",
  };
  const txt =
    s === "delivered" ? "Delivered" :
    s === "out_for_delivery" ? "Out for delivery" :
    s === "in_transit" ? "In transit" :
    s === "label_created" ? "Label created" :
    "Ordered";
  return <span className={`${pill} ${map[s] || map.ordered}`}>{txt}</span>;
}

function MailIcon({ className = "h-5 w-5" }) {
  return (
    <svg viewBox="0 0 24 24" className={className} fill="none" stroke="currentColor" strokeWidth="2">
      <rect x="3" y="5" width="18" height="14" rx="2" />
      <path d="M3 7l9 6 9-6" />
    </svg>
  );
}
function TruckIcon({ className = "h-6 w-6" }) {
  return (
    <svg viewBox="0 0 24 24" className={className} fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M3 7h11v10H3zM14 10h4l3 3v4h-7z" />
      <circle cx="7.5" cy="18" r="1.5" />
      <circle cx="17.5" cy="18" r="1.5" />
    </svg>
  );
}