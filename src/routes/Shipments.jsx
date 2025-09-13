// src/routes/Shipments.jsx
import { useState, useMemo } from "react";
import { Link } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "../lib/supabaseClient";
import LayoutWithSidebar from "../components/LayoutWithSidebar.jsx";
import PageHeader from "../components/PageHeader.jsx";
import { card } from "../utils/ui";

// Icons
const TruckIcon = ({ className }) => (
  <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7h12m0 0l-4-4m4 4l-4 4m0 6H4m0 0l4 4m-4-4l4-4" />
  </svg>
);

// Helper functions
async function getOrders() {
  // First try email_orders table, if it doesn't exist, return empty array
  try {
    const { data, error } = await supabase
      .from("email_orders")
      .select("id, user_id, retailer, order_id, order_date, item_name, quantity, unit_price_cents, total_cents, image_url, shipped_at, delivered_at, status, source_message_id, source_email, created_at")
      .order("order_date", { ascending: false })
      .limit(3000);
    if (error) {
      console.log("email_orders table error:", error);
      // If table doesn't exist, return empty array instead of throwing
      if (error.code === 'PGRST116' || error.message?.includes('relation "email_orders" does not exist')) {
        console.log("email_orders table does not exist yet - returning empty array");
        return [];
      }
      throw error;
    }
    return data || [];
  } catch (err) {
    console.log("email_orders table error:", err);
    // Return empty array for any error to prevent page crashes
    return [];
  }
}

// Function to create Gmail link for an order
function getGmailLink(messageId) {
  if (!messageId) return null;
  return `https://mail.google.com/mail/u/0/#inbox/${messageId}`;
}

// Function to clean up item names that have parsing issues
function cleanItemName(itemName) {
  if (!itemName || typeof itemName !== 'string') return null;
  
  // Remove common parsing artifacts
  let cleaned = itemName
    .replace(/p13n-asin-list-plain_email-order-confirmation_\d+/g, '') // Remove Amazon parsing artifacts
    .replace(/^[a-z0-9_-]+$/i, '') // Remove strings that are just IDs/artifacts
    .trim();
  
  // If the cleaned name is too short or still looks like an artifact, return null
  if (cleaned.length < 5 || /^[a-z0-9_-]+$/i.test(cleaned)) {
    return null;
  }
  
  return cleaned;
}

async function getShipments() {
  try {
    const { data, error } = await supabase
      .from("email_shipments")
      .select("id, user_id, retailer, order_id, tracking_number, carrier, status, shipped_at, delivered_at, created_at")
      .order("created_at", { ascending: false })
      .limit(3000);
    if (error) {
      console.log("email_shipments table error:", error);
      // If table doesn't exist, return empty array instead of throwing
      if (error.code === 'PGRST116' || error.message?.includes('relation "email_shipments" does not exist')) {
        console.log("email_shipments table does not exist yet - returning empty array");
        return [];
      }
      throw error;
    }
    return data || [];
  } catch (err) {
    console.log("email_shipments table error:", err);
    // Return empty array for any error to prevent page crashes
    return [];
  }
}

async function getEmailAccounts() {
  try {
    const { data, error } = await supabase
      .from("email_accounts")
      .select("id, email_address, user_id")
      .like("provider", "gmail%");
    if (error) {
      console.log("email_accounts table error:", error);
      // If table doesn't exist, return empty array instead of throwing
      if (error.code === 'PGRST116' || error.message?.includes('relation "email_accounts" does not exist')) {
        console.log("email_accounts table does not exist yet - returning empty array");
        return [];
      }
      throw error;
    }
    return data || [];
  } catch (err) {
    console.log("email_accounts table error:", err);
    // Return empty array for any error to prevent page crashes
    return [];
  }
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
  const { data: emailAccounts = [] } = useQuery({ queryKey: ["email-accounts"], queryFn: getEmailAccounts });

  /* ------------------ controls ------------------ */
  const [scope, setScope] = useState("all"); // all | ordered | shipping | delivered | canceled
  const [q, setQ] = useState("");
  const [expanded, setExpanded] = useState(() => new Set()); // uids of expanded rows
  const [syncing, setSyncing] = useState(false);
  const [syncMessage, setSyncMessage] = useState("");
  const [testing, setTesting] = useState(false);
  const [emailPreview, setEmailPreview] = useState(null); // { order, messageId }

  const rowsAll = useMemo(() => stitch(orders, ships), [orders, ships]);

  const rows = useMemo(() => {
    let r = rowsAll;
    if (scope === "shipping") {
      r = r.filter(x => !x.delivered_at && (x.status === "in_transit" || x.status === "out_for_delivery" || x.status === "label_created"));
    } else if (scope === "ordered") {
      r = r.filter(x => !x.shipped_at && !x.delivered_at && x.status !== "canceled");
    } else if (scope === "delivered") {
      r = r.filter(x => x.delivered_at);
    } else if (scope === "canceled") {
      r = r.filter(x => x.status === "canceled");
    }
    
    if (q.trim()) {
      const query = q.toLowerCase();
      r = r.filter(x => 
        (x.item_name && typeof x.item_name === 'string' && x.item_name.toLowerCase().includes(query)) ||
        (x.order_id && typeof x.order_id === 'string' && x.order_id.toLowerCase().includes(query)) ||
        (x.retailer && typeof x.retailer === 'string' && x.retailer.toLowerCase().includes(query)) ||
        (x.tracking_number && typeof x.tracking_number === 'string' && x.tracking_number.toLowerCase().includes(query))
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

  const getEmailForOrder = (order) => {
    // Use recipient_email if available, otherwise fallback to source_email
    return order?.recipient_email?.replace(/<|>/g, '') || order?.source_email || 'Unknown';
  };

  const previewEmail = async (order) => {
    if (!order?.source_message_id) return;
    
    try {
      // Fetch email content from our Gmail sync function
      const response = await fetch(`/.netlify/functions/gmail-sync?preview=${order.source_message_id}`);
      const result = await response.json();
      
      if (result.error) {
        console.error('Error fetching email:', result.error);
        return;
      }
      
      setEmailPreview({
        order,
        content: result,
        messageId: order.source_message_id
      });
    } catch (error) {
      console.error('Error previewing email:', error);
    }
  };

  const syncEmails = async () => {
    if (syncing) return;
    
    setSyncing(true);
    setSyncMessage("Syncing emails and updating shipments...");
    
    console.log("🚀 Starting Gmail sync...");
    
    try {
      console.log("📡 Calling Gmail sync function...");
      const response = await fetch(`/.netlify/functions/gmail-sync?mode=sync&debug=1`);
      const result = await response.json();
      
      console.log("📊 Sync result:", result);
      
      if (result.error) {
        console.error("❌ Sync error:", result.error);
        throw new Error(result.error);
      }
      
      const message = `Sync complete: ${result.imported || 0} imported, ${result.updated || 0} updated`;
      console.log("✅", message);
      setSyncMessage(message);
      
      // Refetch data to show updated shipments
      console.log("🔄 Refreshing orders and shipments...");
      await Promise.all([refetchOrders(), refetchShips()]);
      
      // Clear message after 3 seconds
      setTimeout(() => setSyncMessage(""), 3000);
    } catch (e) {
      console.error("💥 Sync failed:", e);
      setSyncMessage(`Sync failed: ${e.message}`);
      setTimeout(() => setSyncMessage(""), 5000);
    } finally {
      setSyncing(false);
      console.log("🏁 Sync process completed");
    }
  };

  const testGmailConnection = async () => {
    if (testing) return;
    
    setTesting(true);
    setSyncMessage("Testing all Gmail connections...");
    
    console.log("🔍 Testing Gmail connections...");
    
    try {
      // Test the health endpoint first to check environment
      const healthResponse = await fetch(`/.netlify/functions/gmail-sync?health=1`);
      const healthResult = await healthResponse.json();
      console.log("🏥 Health check:", healthResult);
      
      if (!healthResult.ok) {
        throw new Error("Gmail sync function is not properly configured");
      }
      
      // Test Gmail connection
      const response = await fetch(`/.netlify/functions/gmail-sync?test=gmail&debug=1`);
      const result = await response.json();
      
      console.log("📧 Gmail test result:", result);
      
      if (result.error) {
        // If it's a scope error, provide helpful guidance
        if (result.error.includes("insufficient authentication scopes")) {
          const message = `Authentication issue: Some Gmail accounts need to be reconnected. Go to the Emails page to reconnect accounts with expired tokens.`;
          setSyncMessage(message);
          console.warn("⚠️ Authentication scopes issue detected");
        } else {
          throw new Error(result.error);
        }
      } else {
        // Display detailed account status
        console.log("📊 Account Status Details:");
        console.log(`Total accounts: ${result.totalAccounts}`);
        console.log(`Working accounts: ${result.workingAccounts}`);
        console.log(`Total emails found: ${result.totalMessages}`);
        console.log("Individual account status:");
        
        result.accounts?.forEach((account, index) => {
          if (account.status === "connected") {
            console.log(`✅ Account ${index + 1}: ${account.email} - ${account.messageCount} emails`);
          } else {
            console.log(`❌ Account ${index + 1}: ${account.email} - ERROR: ${account.error}`);
            if (account.needsReconnection) {
              console.log(`   🔄 This account needs to be reconnected`);
            }
          }
        });
        
        const message = result.summary || `✅ Test complete: ${result.workingAccounts}/${result.totalAccounts} accounts working`;
        setSyncMessage(message);
        console.log("✅ Gmail test successful");
      }
      
      setTimeout(() => setSyncMessage(""), 8000);
    } catch (e) {
      console.error("❌ Gmail test failed:", e);
      setSyncMessage(`❌ Test failed: ${e.message}`);
      setTimeout(() => setSyncMessage(""), 8000);
    } finally {
      setTesting(false);
      console.log("🏁 Gmail test completed");
    }
  };

  return (
    <LayoutWithSidebar active="shipments" section="emails">
      <PageHeader title="Shipments" />

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
            <div className="flex items-center gap-2 shrink-0">
              <button 
                onClick={testGmailConnection} 
                disabled={testing} 
                className="h-10 px-4 rounded-xl bg-slate-600 hover:bg-slate-500 disabled:opacity-60 text-white font-medium transition-colors inline-flex items-center gap-2"
              >
                <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                {testing ? "Testing..." : "Test Connection"}
              </button>
              <button 
                onClick={syncEmails} 
                disabled={syncing} 
                className="h-10 px-4 rounded-xl bg-indigo-600 hover:bg-indigo-500 disabled:opacity-60 text-white font-medium transition-colors inline-flex items-center gap-2"
              >
                <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                </svg>
                {syncing ? "Syncing..." : "Sync Emails"}
              </button>
            </div>
          </div>
          {syncMessage && (
            <div className="mt-4 p-3 rounded-xl bg-slate-800/50 border border-slate-700 text-sm text-slate-300">
              {syncMessage}
            </div>
          )}
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
                <option value="canceled">Canceled</option>
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
            <div className="text-center py-8">
              <div className="text-slate-400 mb-6">
                {q.trim() ? 'No shipments match your search.' : 'No shipments found. Connect Gmail accounts to start tracking shipments.'}
              </div>
              {!q.trim() && (
                <button 
                  onClick={syncEmails} 
                  disabled={syncing} 
                  className="h-12 px-6 rounded-xl bg-indigo-600 hover:bg-indigo-500 disabled:opacity-60 text-white font-medium transition-colors inline-flex items-center gap-2"
                >
                  <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                  </svg>
                  {syncing ? "Syncing..." : "Sync Emails"}
                </button>
              )}
            </div>
          ) : (
            <div className="space-y-2">
              {rows.map((row) => {
                const key = `${row.retailer}_${row.order_id}`;
                const isExpanded = expanded.has(key);
                
                return (
                  <div
                    key={key}
                    className="border border-slate-700 rounded-lg hover:border-slate-600 transition-colors"
                  >
                    {/* Card Header - Clickable to expand/collapse */}
                    <div 
                      className="p-4 cursor-pointer"
                      onClick={() => toggleExpanded(key)}
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
                          </div>
                          
                          {row.item_name && cleanItemName(row.item_name) && (
                            <div className="text-sm text-slate-300 mb-1 truncate">
                              {cleanItemName(row.item_name)}
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
                        
                        <div className="flex items-center gap-3 ml-4">
                          {row.carrier && (
                            <div className="text-sm text-slate-400">
                              {row.carrier}
                            </div>
                          )}
                          {row.status && (
                            <span className={`text-xs px-2 py-1 rounded ${
                              row.status === 'delivered' ? 'bg-green-700 text-green-200' :
                              row.status === 'in_transit' ? 'bg-blue-700 text-blue-200' :
                              row.status === 'out_for_delivery' ? 'bg-yellow-700 text-yellow-200' :
                              row.status === 'canceled' ? 'bg-red-700 text-red-200' :
                              row.status === 'ordered' ? 'bg-slate-700 text-slate-300' :
                              'bg-slate-700 text-slate-300'
                            }`}>
                              {row.status === 'ordered' ? 'Order Placed' : row.status.replace('_', ' ')}
                            </span>
                          )}
                          <svg 
                            className={`h-5 w-5 text-slate-400 transition-transform ${isExpanded ? 'rotate-180' : ''}`}
                            fill="none" 
                            stroke="currentColor" 
                            viewBox="0 0 24 24"
                          >
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                          </svg>
                        </div>
                      </div>
                    </div>
                    
                    {/* Expanded Content */}
                    {isExpanded && (
                      <div className="border-t border-slate-700 p-4 bg-slate-800/30">
                        <div className="flex gap-4">
                          {/* Left Column - Compact Image */}
                          <div className="flex-shrink-0">
                            {row.image_url ? (
                              <img 
                                src={row.image_url} 
                                alt={row.item_name ? cleanItemName(row.item_name) || 'Product image' : 'Product image'}
                                className="w-20 h-20 object-contain rounded-lg border border-slate-600"
                                onError={(e) => {
                                  e.target.style.display = 'none';
                                  e.target.nextSibling.style.display = 'flex';
                                }}
                              />
                            ) : null}
                            <div 
                              className="w-20 h-20 bg-slate-700 border border-slate-600 rounded-lg flex items-center justify-center text-slate-400 text-xs"
                              style={{ display: row.image_url ? 'none' : 'flex' }}
                            >
                              No Image
                            </div>
                          </div>
                          
                          {/* Right Column - All Information */}
                          <div className="flex-1 min-w-0">
                            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 text-sm">
                              <div>
                                <span className="text-slate-400">Retailer:</span>
                                <div className="text-slate-200 font-medium">{row.retailer || '—'}</div>
                              </div>
                              <div>
                                <span className="text-slate-400">Order ID:</span>
                                <div className="text-slate-200 font-medium">{row.order_id || '—'}</div>
                              </div>
                              {row.tracking_number && (
                                <div>
                                  <span className="text-slate-400">Tracking:</span>
                                  <div className="text-slate-200 font-medium">{row.tracking_number}</div>
                                </div>
                              )}
                              {row.carrier && (
                                <div>
                                  <span className="text-slate-400">Carrier:</span>
                                  <div className="text-slate-200 font-medium">{row.carrier}</div>
                                </div>
                              )}
                              {row.quantity && (
                                <div>
                                  <span className="text-slate-400">Quantity:</span>
                                  <div className="text-slate-200 font-medium">{row.quantity}</div>
                                </div>
                              )}
                              {row.unit_price_cents && (
                                <div>
                                  <span className="text-slate-400">Unit Price:</span>
                                  <div className="text-slate-200 font-medium">{formatPrice(row.unit_price_cents)}</div>
                                </div>
                              )}
                              {row.total_cents && (
                                <div>
                                  <span className="text-slate-400">Total:</span>
                                  <div className="text-slate-200 font-medium">{formatPrice(row.total_cents)}</div>
                                </div>
                              )}
                              {row.status && (
                                <div>
                                  <span className="text-slate-400">Status:</span>
                                  <div className="text-slate-200 font-medium capitalize">{row.status.replace('_', ' ')}</div>
                                </div>
                              )}
                            </div>
                            
                            {row.item_name && cleanItemName(row.item_name) && (
                              <div className="mt-4">
                                <span className="text-slate-400 text-sm">Item Name:</span>
                                <div className="text-slate-200 font-medium mt-1">{cleanItemName(row.item_name)}</div>
                              </div>
                            )}
                            
                            {/* Email and Gmail Link */}
                            <div className="mt-4 flex items-center justify-between">
                              <div>
                                <span className="text-slate-400 text-sm">Email:</span>
                                <div className="text-slate-200 font-medium mt-1">{getEmailForOrder(row)}</div>
                              </div>
                              {row.source_message_id && (
                                <button
                                  onClick={() => previewEmail(row)}
                                  className="inline-flex items-center gap-2 h-8 px-3 rounded-lg bg-slate-700 hover:bg-slate-600 text-slate-200 text-sm font-medium transition-colors"
                                >
                                  <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 4.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                                  </svg>
                                  View Email
                                </button>
                              )}
                            </div>
                            
                            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mt-4 text-sm">
                              {row.order_date && (
                                <div>
                                  <span className="text-slate-400">Order Date:</span>
                                  <div className="text-slate-200">{formatDate(row.order_date)}</div>
                                </div>
                              )}
                              {row.shipped_at && (
                                <div>
                                  <span className="text-slate-400">Shipped Date:</span>
                                  <div className="text-slate-200">{formatDate(row.shipped_at)}</div>
                                </div>
                              )}
                              {row.delivered_at && (
                                <div>
                                  <span className="text-slate-400">Delivered Date:</span>
                                  <div className="text-slate-200">{formatDate(row.delivered_at)}</div>
                                </div>
                              )}
                            </div>
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Email Preview Modal */}
        {emailPreview && (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
            <div className="bg-slate-800 rounded-lg border-2 border-purple-500 shadow-xl max-w-4xl w-full max-h-[90vh] overflow-hidden">
              {/* Header */}
              <div className="flex items-center justify-between p-4 border-b border-slate-700 bg-slate-900/50">
                <h3 className="text-lg font-semibold text-slate-200">
                  Email Preview - {emailPreview.order.retailer} #{emailPreview.order.order_id}
                </h3>
                <button
                  onClick={() => setEmailPreview(null)}
                  className="text-slate-400 hover:text-slate-200 transition-colors p-1 rounded"
                >
                  <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>
              
              {/* Email Header Info */}
              <div className="p-4 border-b border-slate-700 bg-slate-900/30">
                <div className="space-y-3">
                  <div className="flex items-center justify-between py-2">
                    <span className="text-slate-400 text-sm font-medium">Date:</span>
                    <span className="text-slate-200 text-sm">{emailPreview.content.date || 'N/A'}</span>
                  </div>
                  <div className="flex items-center justify-between py-2">
                    <span className="text-slate-400 text-sm font-medium">From:</span>
                    <span className="text-slate-200 text-sm">{emailPreview.content.from?.replace(/<|>/g, '') || 'N/A'}</span>
                  </div>
                  <div className="flex items-center justify-between py-2">
                    <span className="text-slate-400 text-sm font-medium">To:</span>
                    <span className="text-slate-200 text-sm">{emailPreview.content.to?.replace(/<|>/g, '') || 'N/A'}</span>
                  </div>
                  <div className="flex items-start justify-between py-2">
                    <span className="text-slate-400 text-sm font-medium">Subject:</span>
                    <span className="text-slate-200 text-sm text-right max-w-[70%] break-words">
                      {emailPreview.content.subject || 'N/A'}
                    </span>
                  </div>
                </div>
              </div>
              
              {/* Email Content */}
              <div className="p-4 overflow-auto max-h-[60vh]">
                <div className="border border-slate-600 rounded-lg p-4 bg-white/5">
                  {emailPreview.content.html ? (
                    <div 
                      className="prose prose-invert max-w-none text-sm"
                      dangerouslySetInnerHTML={{ __html: emailPreview.content.html }}
                    />
                  ) : (
                    <div className="whitespace-pre-wrap text-slate-300 font-mono text-sm">
                      {emailPreview.content.text}
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
        )}
    </LayoutWithSidebar>
  );
}
