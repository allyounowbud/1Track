// src/routes/Emails.jsx
import { useEffect, useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "../lib/supabaseClient";
import HeaderWithTabs from "../components/HeaderWithTabs.jsx";
import { centsToStr } from "../utils/money.js";
import { card, inputBase, pill } from "../utils/ui.js";
const safeDate = (d) => (d ? new Date(d).toLocaleDateString() : "—");

function trackingUrl(carrier, tn) {
  if (!tn) return null;
  // If tn is an Amazon tracking link (full URL) just return it
  if (/^https?:\/\//i.test(tn)) return tn;
  const c = (carrier || "").toLowerCase();
  if (c === "ups") return `https://www.ups.com/track?tracknum=${encodeURIComponent(tn)}`;
  if (c === "usps") return `https://tools.usps.com/go/TrackConfirmAction?tLabels=${encodeURIComponent(tn)}`;
  if (c === "fedex") return `https://www.fedex.com/fedextrack/?tracknumbers=${encodeURIComponent(tn)}`;
  if (/^1Z/i.test(tn)) return `https://www.ups.com/track?tracknum=${encodeURIComponent(tn)}`;
  return `https://www.google.com/search?q=${encodeURIComponent(tn + " tracking")}`;
}

/** Merge orders + shipments into shipment-like rows */
function stitch(orders = [], shipments = []) {
  const byKey = new Map();
  const makeKey = (uid, retailer, order_id) => `${uid || ""}::${(retailer||'').trim()}::${(order_id||'').trim()}`;

  orders.forEach((o) => {
    const key = makeKey(o.user_id, o.retailer, o.order_id);
    byKey.set(key, {
      user_id: o.user_id,
      retailer: o.retailer || "Undefined",
      order_id: o.order_id || "—",
      order_date: o.order_date || null,
      item_name: o.item_name || null,
      quantity: o.quantity || null,
      unit_price_cents: o.unit_price_cents || null,
      total_cents: o.total_cents || 0,
      image_url: o.image_url || null,
      shipped_at: o.shipped_at || null,
      delivered_at: o.delivered_at || null,
      status: (o.status || "ordered").toLowerCase(),
      trackings: new Map(), // tn -> {tn, carrier}
      uid: null,
      source_message_id: o.source_message_id || null,
    });
  });

  const globalTracking = new Map();

  const attachToRow = (s) => {
    const viaOrder = s.order_id ? byKey.get(makeKey(s.user_id, s.retailer, s.order_id)) : null;
    if (viaOrder) return viaOrder;
    if (s.tracking_number && globalTracking.has(s.tracking_number)) {
      return globalTracking.get(s.tracking_number);
    }
    const key = makeKey(s.user_id, s.retailer, s.order_id || `#${s.tracking_number || s.id}`);
    if (!byKey.has(key)) {
      byKey.set(key, {
        user_id: s.user_id,
        retailer: s.retailer || "Undefined",
        order_id: s.order_id || "Unknown",
        order_date: null,
        item_name: null,
        quantity: null,
        unit_price_cents: null,
        total_cents: 0,
        image_url: null,
        shipped_at: null,
        delivered_at: null,
        status: "in_transit",
        trackings: new Map(),
        uid: null,
        source_message_id: null,
      });
    }
    return byKey.get(key);
  };

  shipments.forEach((s) => {
    const row = attachToRow(s);
    if (s.tracking_number) {
      // Only keep ONE tracking link for Amazon (first)
      if (!row.trackings.has(s.tracking_number)) {
        row.trackings.set(s.tracking_number, {
          tracking_number: s.tracking_number,
          carrier: s.carrier || "",
          shipped_at: s.shipped_at || null,
          delivered_at: s.delivered_at || null,
          status: (s.status || "").toLowerCase(),
        });
      }
      globalTracking.set(s.tracking_number, row);
    }
    row.shipped_at = row.shipped_at || s.shipped_at || null;
    row.delivered_at = row.delivered_at || s.delivered_at || null;

    const rank = (x) =>
      x === "canceled" ? 5 :
      x === "delivered" ? 4 :
      x === "out_for_delivery" ? 3 :
      (x === "in_transit" || x === "label_created") ? 2 :
      x === "ordered" ? 1 : 0;
    const st = (s.status || "").toLowerCase() || "in_transit";
    if (rank(st) > rank(row.status)) row.status = st;
  });

  const out = Array.from(byKey.values());
  for (const row of out) {
    const firstTracking = Array.from(row.trackings.keys()).sort()[0] || "";
    row.uid = `${row.user_id || ""}::${row.retailer || ""}::${row.order_id || ""}::${firstTracking}`;
    if (row.delivered_at) row.status = "delivered";
    else if (!row.shipped_at) row.status = row.status || "ordered";
  }
  return out;
}

/* ---------- queries ---------- */
async function getOrders() {
  const { data, error } = await supabase
    .from("email_orders")
    .select("id, user_id, retailer, order_id, order_date, item_name, quantity, unit_price_cents, total_cents, image_url, shipped_at, delivered_at, status, source_message_id")
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
    .limit(3000);
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

  const { data: accounts = [], refetch: refetchAccounts } = useQuery({ queryKey: ["email-accounts"], queryFn: getEmailAccounts });
  const { data: orders = [], refetch: refetchOrders, isLoading: lo1 } = useQuery({ queryKey: ["email-orders"], queryFn: getOrders });
  const { data: ships = [], refetch: refetchShips, isLoading: lo2 } = useQuery({ queryKey: ["email-shipments"], queryFn: getShipments });

  const connected = !!accounts.length;
  const acctEmail = accounts[0]?.email_address || null;

  /* ------------------ controls ------------------ */
  const [scope, setScope] = useState("all"); // all | ordered | shipping | delivered
  const [q, setQ] = useState("");
  const [expanded, setExpanded] = useState(() => new Set()); // uids of expanded rows

  const rowsAll = useMemo(() => stitch(orders, ships), [orders, ships]);

  const rows = useMemo(() => {
    let r = rowsAll;
    if (scope === "shipping") {
      r = r.filter(x => !x.delivered_at && (x.status === "in_transit" || x.status === "out_for_delivery" || x.status === "label_created"));
    } else if (scope === "ordered") {
      r = r.filter(x => !x.shipped_at && !x.delivered_at);
    } else if (scope === "delivered") {
      r = r.filter(x => !!x.delivered_at || x.status === "delivered");
    }
    if (q.trim()) {
      const t = q.toLowerCase();
      r = r.filter(x =>
        [x.item_name, x.retailer, x.order_id, ...Array.from(x.trackings.keys())]
          .filter(Boolean)
          .some(s => String(s).toLowerCase().includes(t))
      );
    }
    return r.sort((a, b) => {
      const ad = a.delivered_at ? new Date(a.delivered_at).getTime() : (a.shipped_at ? new Date(a.shipped_at).getTime() : new Date(a.order_date || 0).getTime());
      const bd = b.delivered_at ? new Date(b.delivered_at).getTime() : (b.shipped_at ? new Date(b.shipped_at).getTime() : new Date(b.order_date || 0).getTime());
      return bd - ad;
    });
  }, [rowsAll, scope, q]);

  /* ----------------------------- actions ----------------------------- */
  const [syncing, setSyncing] = useState(false);
  const [syncMsg, setSyncMsg] = useState("");

  const [previewOpen, setPreviewOpen] = useState(false);
  const [proposed, setProposed] = useState([]);

  function connectGmail() {
    window.location.href = "/.netlify/functions/gmail-auth-start";
  }

  async function disconnectGmail() {
    if (!confirm("Are you sure you want to disconnect your Gmail account? This will stop automatic email syncing.")) {
      return;
    }
    
    try {
      const { error } = await supabase
        .from("email_accounts")
        .delete()
        .eq("provider", "gmail");
      
      if (error) throw error;
      
      // Refresh the accounts data to update the UI
      await refetchAccounts();
      setSyncMsg("Gmail account disconnected successfully");
    } catch (e) {
      setSyncMsg(`Failed to disconnect: ${e.message}`);
    }
  }

  async function syncNow({ silent = false, label } = {}) {
    try {
      setSyncing(true);
      if (!silent) setSyncMsg(label || "Syncing…");
      const res = await fetch("/.netlify/functions/gmail-sync", { method: "POST" });
      const j = await res.json().catch(() => ({}));
      if (!silent) {
        setSyncMsg(res.ok ? `Imported ${j?.imported ?? 0}, updated ${j?.updated ?? 0}, skipped ${j?.skipped_existing ?? 0}` : `Sync failed: ${j?.error || res.status}`);
      }
      await Promise.all([refetchOrders(), refetchShips()]);
    } catch (e) {
      if (!silent) setSyncMsg(String(e.message || e));
    } finally {
      setSyncing(false);
      if (!silent) setTimeout(() => setSyncMsg(""), 2600);
    }
  }

  async function previewNew() {
    try {
      setSyncMsg("Looking for new orders…");
      const res = await fetch("/.netlify/functions/gmail-sync?mode=preview");
      const j = await res.json().catch(() => ({}));
      const list = j?.proposed || [];
      if (list.length === 0) {
        setSyncMsg("No new orders found.");
        setTimeout(() => setSyncMsg(""), 2200);
        return;
      }
      setSyncMsg("");
      setProposed(list);
      setPreviewOpen(true);
    } catch (e) {
      setSyncMsg(String(e.message || e));
      setTimeout(() => setSyncMsg(""), 2600);
    }
  }

  // Auto-sync on load
  useEffect(() => {
    if (!connected) return;
    syncNow({ silent: false, label: "Fetching new orders…" });
    const id = setInterval(() => { syncNow({ silent: true }); }, 15 * 60 * 1000);
    return () => clearInterval(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [connected]);

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
                <>
                  <button onClick={previewNew} className="h-11 px-5 rounded-2xl bg-slate-800 hover:bg-slate-700 text-white font-medium">
                    Preview new orders
                  </button>
                  <button onClick={() => syncNow()} disabled={syncing} className="h-11 px-5 rounded-2xl bg-indigo-600 hover:bg-indigo-500 disabled:opacity-60 text-white font-medium">
                    {syncing ? "Syncing…" : "Sync now"}
                  </button>
                  <button onClick={disconnectGmail} className="h-11 px-5 rounded-2xl bg-red-600 hover:bg-red-500 text-white font-medium">
                    Disconnect
                  </button>
                </>
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
              <TopTab label="Ordered" active={scope === "ordered"} onClick={() => setScope("ordered")} />
              <TopTab label="Shipping" active={scope === "shipping"} onClick={() => setScope("shipping")} />
              <TopTab label="Delivered" active={scope === "delivered"} onClick={() => setScope("delivered")} />
            </div>
            <div className="w-full sm:w-64">
              <input
                value={q}
                onChange={(e) => setQ(e.target.value)}
                placeholder="Search retailer, order #, item, tracking…"
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
            {rows.map((r) => {
              const key = r.uid;
              const isOpen = expanded.has(key);

              // primary tracking (at most one, and dedupe Amazon urls)
              let primaryTracking = null;
              if (r.trackings.size > 0) {
                const vals = Array.from(r.trackings.values());
                // prefer the first Amazon link, else first tracking number
                primaryTracking =
                  vals.find(v => /^https?:\/\//.test(v.tracking_number)) ||
                  vals[0];
              }

              return (
                <div key={key} className="py-2">
                  {/* Row header */}
                  <div className="flex items-center gap-3">
                    <div className="shrink-0">
                      <TruckIcon className="h-8 w-8 text-slate-300" />
                    </div>

                    <div className="min-w-0 flex-1">
                      <div className="flex items-center justify-between gap-2">
                        <div className="min-w-0 flex-1">
                          <div className="font-medium truncate pr-2">
                            {/* Title stops before the pill on small screens */}
                            <span className="truncate max-w-[70vw] inline-block align-bottom">
                              {r.item_name || "Item —"}
                            </span>
                            <span className="text-slate-400"> · {r.retailer || "Undefined"}</span>
                          </div>
                          <div className="text-xs text-slate-400 mt-0.5 truncate">
                            {r.order_id ? `Order # ${r.order_id}` : "Order # —"}
                          </div>
                        </div>
                        <div className="flex items-center gap-2 shrink-0">
                          <StatusPill status={r.status} />
                          <button
                            onClick={() =>
                              setExpanded((prev) => {
                                const next = new Set(prev);
                                if (next.has(key)) next.delete(key);
                                else next.add(key);
                                return next;
                              })
                            }
                            className="h-9 w-9 grid place-items-center rounded-xl border border-slate-800 bg-slate-900/60 hover:bg-slate-800 transition"
                            aria-label={isOpen ? "Collapse" : "Expand"}
                          >
                            <ChevronDown className={`h-5 w-5 transition-transform ${isOpen ? "rotate-180" : ""}`} />
                          </button>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Slide-down detail (full-bleed inside the card) */}
                  <div className={`transition-all duration-300 ease-in-out overflow-hidden`} style={{ maxHeight: isOpen ? 580 : 0 }}>
                    <div className="pt-4">
                      {/* Status strip */}
                      <div className="flex items-center justify-between text-sm">
                        <div className="font-semibold">
                          {statusHeadline(r.status)}
                        </div>
                        <div className="text-slate-400 text-xs">
                          {r.delivered_at
                            ? `Updated ${timeAgo(r.delivered_at)}`
                            : r.shipped_at
                            ? `Updated ${timeAgo(r.shipped_at)}`
                            : r.order_date
                            ? `Updated ${timeAgo(r.order_date)}`
                            : ""}
                        </div>
                      </div>
                      <ProgressBar status={r.status} className="mt-2" />

                      {/* Shipment line (single state text) */}
                      <div className="mt-3">
                        <div className="flex items-start gap-3">
                          <span className="mt-1 inline-block h-2 w-2 rounded-full bg-slate-400"></span>
                          <div>
                            <div className="font-medium">{shipmentLineTitle(r.status)}</div>
                            <div className="text-slate-400 text-sm">{shipmentLineSub(r.status)}</div>
                            <div className="text-slate-400 text-xs mt-1">
                              {dateForStatus(r)}
                            </div>
                          </div>
                        </div>
                      </div>

                      {/* Tracking + Carrier */}
                      <div className="mt-4 grid grid-cols-1 sm:grid-cols-2 gap-4">
                        <div>
                          <div className="text-xs text-slate-400 mb-1">Tracking number</div>
                          {primaryTracking ? (
                            <a
                              href={trackingUrl(primaryTracking.carrier, primaryTracking.tracking_number)}
                              target="_blank"
                              rel="noreferrer"
                              className="inline-flex items-center font-mono text-sm px-3 py-2 rounded-lg border border-slate-800 bg-slate-900/60 hover:bg-slate-800"
                            >
                              {/^https?:\/\//.test(primaryTracking.tracking_number)
                                ? "Open tracking"
                                : primaryTracking.tracking_number}
                            </a>
                          ) : (
                            <div className="text-slate-500">—</div>
                          )}
                        </div>
                        <div>
                          <div className="text-xs text-slate-400 mb-1">Carrier</div>
                          <div className="text-sm text-slate-200">{primaryTracking?.carrier || "—"}</div>
                        </div>
                      </div>

                      {/* Item row */}
                      <div className="mt-5 flex items-center gap-4">
                        <div className="h-16 w-16 rounded-xl border border-slate-800 bg-slate-900/40 grid place-items-center overflow-hidden">
                          {r.image_url ? (
                            <img src={r.image_url} alt="" className="h-full w-full object-cover" />
                          ) : (
                            <ImageIcon className="h-6 w-6 text-slate-400" />
                          )}
                        </div>
                        <div className="min-w-0">
                          <div className="font-medium truncate">{r.item_name || "—"}</div>
                          <div className="text-slate-400 text-sm">Qty {r.quantity ?? "—"}</div>
                        </div>
                      </div>

                      {/* Totals + order number */}
                      <div className="mt-4 grid grid-cols-1 sm:grid-cols-2 gap-4">
                        <div>
                          <div className="text-xs text-slate-400 mb-1">Total</div>
                          <div className="text-sm">{r.total_cents ? `$${centsToStr(r.total_cents)}` : "—"}</div>
                        </div>
                        <div>
                          <div className="text-xs text-slate-400 mb-1">Order number</div>
                          <div className="text-sm font-mono">{r.order_id || "—"}</div>
                        </div>
                      </div>

                      {/* Open original */}
                      <div className="mt-5">
                        <a
                          href={`https://mail.google.com/mail/u/0/#search/${encodeURIComponent(r.order_id || r.item_name || r.retailer || "")}`}
                          className="w-full inline-flex items-center justify-center h-11 rounded-xl border border-slate-800 bg-slate-900/60 hover:bg-slate-800 text-slate-100"
                          target="_blank" rel="noreferrer"
                        >
                          View original email
                        </a>
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        <div className="text-xs text-slate-500 mt-4">
          New order emails create an order row. Shipping/delivery emails update the same order over time.
        </div>
      </div>

      {/* ---------- Preview Modal ---------- */}
      {previewOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60">
          <div className="w-full max-w-lg bg-slate-900 border border-slate-800 rounded-2xl p-4">
            <div className="text-lg font-semibold">Add these new orders?</div>
            <div className="mt-3 max-h-72 overflow-auto divide-y divide-slate-800">
              {proposed.map((p, i) => (
                <div key={i} className="p-3 grid grid-cols-1 sm:grid-cols-12 gap-2">
                  <div className="sm:col-span-8 min-w-0">
                    <div className="font-medium truncate">{p.item_name || "Item —"} <span className="text-slate-400">· {p.retailer}</span></div>
                    <div className="text-xs text-slate-400">Order # {p.order_id || "—"} · {safeDate(p.order_date)}</div>
                  </div>
                  <div className="sm:col-span-4 text-right">
                    {p.total_cents ? <>${centsToStr(p.total_cents)}</> : <span className="text-slate-500">—</span>}
                  </div>
                </div>
              ))}
            </div>
            <div className="mt-4 flex justify-end gap-2">
              <button onClick={() => setPreviewOpen(false)} className="h-10 px-4 rounded-xl bg-slate-800 text-slate-200">Cancel</button>
              <button
                onClick={async () => {
                  setSyncMsg("Importing…");
                  const res = await fetch("/.netlify/functions/gmail-sync?mode=commit", { method: "POST" });
                  const j = await res.json().catch(() => ({}));
                  setSyncMsg(res.ok ? `Imported ${j?.imported ?? 0}, updated ${j?.updated ?? 0}` : `Failed: ${j?.error || res.status}`);
                  setPreviewOpen(false);
                  await Promise.all([refetchOrders(), refetchShips()]);
                  setTimeout(() => setSyncMsg(""), 2600);
                }}
                className="h-10 px-4 rounded-xl bg-emerald-600 text-white"
              >
                Confirm & Import
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

/* ---------- UI bits ---------- */
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
    canceled: "bg-rose-600/20 text-rose-300",
  };
  const txt =
    s === "delivered" ? "Delivered" :
    s === "out_for_delivery" ? "Out for delivery" :
    s === "in_transit" ? "In transit" :
    s === "label_created" ? "Label created" :
    s === "canceled" ? "Canceled" :
    "Order placed";
  return <span className={`${pill} ${map[s] || map.ordered}`}>{txt}</span>;
}
function ProgressBar({ status, className = "" }) {
  const s = (status || "").toLowerCase();
  const pct =
    s === "delivered" ? 100 :
    s === "out_for_delivery" ? 80 :
    s === "in_transit" ? 60 :
    s === "label_created" ? 30 :
    s === "canceled" ? 100 :
    15;
  return (
    <div className={`h-2 rounded-full bg-slate-800 overflow-hidden ${className}`}>
      <div className="h-full bg-gradient-to-r from-sky-500 to-emerald-500" style={{ width: `${pct}%` }} />
    </div>
  );
}
function statusHeadline(s) {
  s = (s || "").toLowerCase();
  if (s === "delivered") return "Delivered";
  if (s === "in_transit" || s === "out_for_delivery" || s === "label_created") return "In Transit";
  if (s === "canceled") return "Canceled";
  return "Ordered";
}
function shipmentLineTitle(s) {
  s = (s || "").toLowerCase();
  if (s === "delivered") return "Shipment delivered successfully";
  if (s === "in_transit" || s === "out_for_delivery" || s === "label_created") return "Shipment on the way";
  if (s === "canceled") return "Order canceled";
  return "Order confirmed";
}
function shipmentLineSub(s) {
  s = (s || "").toLowerCase();
  if (s === "delivered") return "Your package has been delivered.";
  if (s === "in_transit" || s === "out_for_delivery" || s === "label_created") return "Your package has been shipped. Check tracking below.";
  if (s === "canceled") return "Your order has been canceled. View the email for details.";
  return "Tracking information will appear once we get an update from the seller.";
}
function dateForStatus(r) {
  if (r.delivered_at) return safeDate(r.delivered_at);
  if (r.shipped_at) return safeDate(r.shipped_at);
  if (r.order_date) return safeDate(r.order_date);
  return "—";
}
function timeAgo(d) {
  if (!d) return "—";
  const ms = Date.now() - new Date(d).getTime();
  const days = Math.max(1, Math.round(ms / (1000 * 60 * 60 * 24)));
  return `${days} day${days === 1 ? "" : "s"} ago`;
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
function ChevronDown({ className = "h-5 w-5" }) {
  return (
    <svg viewBox="0 0 24 24" className={className} fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M6 9l6 6 6-6" />
    </svg>
  );
}
function ImageIcon({ className = "h-5 w-5" }) {
  return (
    <svg viewBox="0 0 24 24" className={className} fill="none" stroke="currentColor" strokeWidth="2">
      <rect x="3" y="5" width="18" height="14" rx="2" />
      <path d="M8 13l2.5-3 3 4 2.5-2 3 4H5z" />
      <circle cx="9" cy="9" r="1.5" />
    </svg>
  );
}