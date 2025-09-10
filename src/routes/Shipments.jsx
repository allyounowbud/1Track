// src/routes/Shipments.jsx
import { useState, useMemo } from "react";
import { Link } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "../lib/supabaseClient";
import HeaderWithTabs from "../components/HeaderWithTabs";
import { card } from "../utils/ui";

// Icons
const TruckIcon = ({ className }) => (
  <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7h12m0 0l-4-4m4 4l-4 4m0 6H4m0 0l4 4m-4-4l4-4" />
  </svg>
);

// Helper functions
async function getOrders() {
  const { data, error } = await supabase
    .from("email_orders")
    .select("id, user_id, retailer, order_id, order_date, item_name, quantity, unit_price_cents, total_cents, image_url, created_at")
    .order("created_at", { ascending: false })
    .limit(3000);
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

// Stitch orders and shipments together
function stitch(orders, ships) {
  const map = new Map();
  
  // Add all orders
  orders.forEach(o => {
    const key = `${o.retailer}_${o.order_id}`;
    map.set(key, { ...o, type: "order" });
  });
  
  // Add/merge shipments
  ships.forEach(s => {
    const key = `${s.retailer}_${s.order_id}`;
    const existing = map.get(key);
    if (existing) {
      // Merge shipment data into existing order
      map.set(key, {
        ...existing,
        ...s,
        type: "order_with_shipment"
      });
    } else {
      // Standalone shipment
      map.set(key, { ...s, type: "shipment" });
    }
  });
  
  return Array.from(map.values());
}

/* --------------------------------- page --------------------------------- */
export default function Shipments() {
  const { data: orders = [], refetch: refetchOrders, isLoading: lo1 } = useQuery({ queryKey: ["email-orders"], queryFn: getOrders });
  const { data: ships = [], refetch: refetchShips, isLoading: lo2 } = useQuery({ queryKey: ["email-shipments"], queryFn: getShipments });

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
      r = r.filter(x => x.delivered_at);
    }
    
    if (q.trim()) {
      const query = q.toLowerCase();
      r = r.filter(x => 
        (x.item_name && x.item_name.toLowerCase().includes(query)) ||
        (x.order_id && x.order_id.toLowerCase().includes(query)) ||
        (x.retailer && x.retailer.toLowerCase().includes(query)) ||
        (x.tracking_number && x.tracking_number.toLowerCase().includes(query))
      );
    }
    
    return r;
  }, [rowsAll, scope, q]);

  const toggleExpanded = (id) => {
    const newExpanded = new Set(expanded);
    if (newExpanded.has(id)) {
      newExpanded.delete(id);
    } else {
      newExpanded.add(id);
    }
    setExpanded(newExpanded);
  };

  const formatDate = (dateStr) => {
    if (!dateStr) return "—";
    return new Date(dateStr).toLocaleDateString();
  };

  const formatPrice = (cents) => {
    if (!cents) return "—";
    return `$${(cents / 100).toFixed(2)}`;
  };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100">
      <div className="max-w-[95vw] mx-auto p-4 sm:p-6">
        <HeaderWithTabs active="shipments" showTabs={false} section="automations" />

        {/* Back to Hub */}
        <div className="mb-6">
          <Link 
            to="/" 
            className="inline-flex items-center gap-2 h-10 px-4 rounded-xl border border-slate-800 bg-slate-900/60 text-slate-200 hover:bg-slate-900 transition"
          >
            <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
            Hub
          </Link>
        </div>

        {/* Shipments Management */}
        <div className={`${card} mb-6`}>
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div className="min-w-0">
              <div className="flex items-center gap-2 text-lg font-semibold">
                <TruckIcon className="h-5 w-5" />
                Shipments
              </div>
              <p className="text-slate-400 text-sm mt-1">
                Track and manage your order shipments. View order confirmations, shipping updates, and delivery status from all connected email accounts.
              </p>
            </div>
          </div>
        </div>

        {/* Filters */}
        <div className={`${card} mb-6`}>
          <div className="flex flex-wrap items-center gap-4">
            <div className="flex items-center gap-2">
              <span className="text-slate-300 text-sm">Filter:</span>
              <select
                value={scope}
                onChange={(e) => setScope(e.target.value)}
                className="bg-slate-800 border border-slate-600 rounded-lg px-3 py-2 text-sm text-slate-100 focus:border-indigo-500 focus:outline-none"
              >
                <option value="all">All</option>
                <option value="ordered">Ordered</option>
                <option value="shipping">Shipping</option>
                <option value="delivered">Delivered</option>
              </select>
            </div>
            
            <div className="flex-1 min-w-0">
              <input
                type="text"
                value={q}
                onChange={(e) => setQ(e.target.value)}
                placeholder="Search orders, items, tracking numbers..."
                className="w-full bg-slate-800 border border-slate-600 rounded-lg px-3 py-2 text-sm text-slate-100 focus:border-indigo-500 focus:outline-none"
              />
            </div>
            
            <div className="text-slate-400 text-sm">
              {rows.length} {rows.length === 1 ? 'item' : 'items'}
            </div>
          </div>
        </div>

        {/* Shipments List */}
        <div className={`${card}`}>
          {lo1 || lo2 ? (
            <div className="text-slate-400">Loading shipments...</div>
          ) : rows.length === 0 ? (
            <div className="text-slate-400 text-center py-8">
              {q.trim() ? 'No shipments match your search.' : 'No shipments found. Connect Gmail accounts to start tracking shipments.'}
            </div>
          ) : (
            <div className="space-y-2">
              {rows.map((row) => (
                <div
                  key={`${row.retailer}_${row.order_id}`}
                  className="border border-slate-700 rounded-lg p-4 hover:border-slate-600 transition-colors"
                >
                  <div className="flex items-center justify-between">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-3 mb-2">
                        <span className="text-sm font-medium text-slate-200">
                          {row.retailer} #{row.order_id}
                        </span>
                        {row.tracking_number && (
                          <span className="text-xs bg-slate-700 text-slate-300 px-2 py-1 rounded">
                            {row.tracking_number}
                          </span>
                        )}
                        {row.status && (
                          <span className={`text-xs px-2 py-1 rounded ${
                            row.status === 'delivered' ? 'bg-green-700 text-green-200' :
                            row.status === 'in_transit' ? 'bg-blue-700 text-blue-200' :
                            row.status === 'out_for_delivery' ? 'bg-yellow-700 text-yellow-200' :
                            'bg-slate-700 text-slate-300'
                          }`}>
                            {row.status.replace('_', ' ')}
                          </span>
                        )}
                      </div>
                      
                      {row.item_name && (
                        <div className="text-sm text-slate-300 mb-1">
                          {row.item_name}
                        </div>
                      )}
                      
                      <div className="flex items-center gap-4 text-xs text-slate-400">
                        {row.order_date && (
                          <span>Ordered: {formatDate(row.order_date)}</span>
                        )}
                        {row.shipped_at && (
                          <span>Shipped: {formatDate(row.shipped_at)}</span>
                        )}
                        {row.delivered_at && (
                          <span>Delivered: {formatDate(row.delivered_at)}</span>
                        )}
                        {row.total_cents && (
                          <span>Total: {formatPrice(row.total_cents)}</span>
                        )}
                      </div>
                    </div>
                    
                    {row.carrier && (
                      <div className="text-sm text-slate-400 ml-4">
                        {row.carrier}
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
