// src/routes/OrderBook.jsx
import { useEffect, useMemo, useState, useRef } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "../lib/supabaseClient";
import HeaderWithTabs from "../components/HeaderWithTabs.jsx";
import { moneyToCents, centsToStr, parsePct } from "../utils/money.js";
import { pageCard, rowCard, inputSm } from "../utils/ui.js";
const fmtNiceDate = (yyyyMmDd) => {
  if (!yyyyMmDd) return "Unknown date";
  const [y, m, d] = yyyyMmDd.split("-").map((n) => Number(n));
  const dt = new Date(y, (m || 1) - 1, d || 1);
  return dt.toLocaleDateString(undefined, {
    month: "long",
    day: "numeric",
    year: "numeric",
  });
};

/* Build permissive keywords for date search */
function dateKeywords(yyyyMmDd) {
  if (!yyyyMmDd) return "";
  const [yStr, mStr, dStr] = yyyyMmDd.split("-");
  const y = Number(yStr),
    m = Number(mStr),
    d = Number(dStr);
  const monthLong = [
    "january",
    "february",
    "march",
    "april",
    "may",
    "june",
    "july",
    "august",
    "september",
    "october",
    "november",
    "december",
  ][(m || 1) - 1];
  const monthShort = monthLong.slice(0, 3);

  const m1 = String(m);
  const m2 = m.toString().padStart(2, "0");
  const d1 = String(d);
  const d2 = d.toString().padStart(2, "0");

  return [
    `${m1}/${d1}`,
    `${m2}/${d2}`,
    `${m1}/${d1}/${y}`,
    `${m2}/${d2}/${y}`,
    `${monthLong}`,
    `${monthShort}`,
    `${monthLong} ${d1}`,
    `${monthLong} ${d2}`,
    `${monthShort} ${d1}`,
    `${monthShort} ${d2}`,
    `${monthLong} ${y}`,
    `${monthShort} ${y}`,
    `${monthLong} ${d1} ${y}`,
    `${monthLong} ${d2} ${y}`,
    `${monthShort} ${d1} ${y}`,
    `${monthShort} ${d2} ${y}`,
    `${yStr}-${mStr}-${dStr}`,
  ]
    .join(" ")
    .toLowerCase();
}

/* ---------- queries ---------- */
async function getOrders(limit = 500) {
  const { data, error } = await supabase
    .from("orders")
    .select(
      "id, order_date, item, profile_name, retailer, marketplace, buy_price_cents, sale_price_cents, sale_date, fees_pct, shipping_cents, status"
    )
    .order("order_date", { ascending: false })
    .limit(limit);
  if (error) throw error;
  return data ?? [];
}
async function getItems() {
  const { data, error } = await supabase
    .from("items")
    .select("id, name")
    .order("name", { ascending: true });
  if (error) throw error;
  return data ?? [];
}
async function getRetailers() {
  const { data, error } = await supabase
    .from("retailers")
    .select("id, name")
    .order("name", { ascending: true });
  if (error) throw error;
  return data ?? [];
}
async function getMarkets() {
  const { data, error } = await supabase
    .from("marketplaces")
    .select("id, name, default_fees_pct")
    .order("name", { ascending: true });
  if (error) throw error;
  return data ?? [];
}

/* ====================== PAGE ====================== */
export default function OrderBook() {
  const {
    data: orders = [],
    isLoading,
    error,
    refetch,
  } = useQuery({ queryKey: ["orders", 500], queryFn: () => getOrders(500) });
  const { data: items = [] } = useQuery({ queryKey: ["items"], queryFn: getItems });
  const { data: retailers = [] } = useQuery({
    queryKey: ["retailers"],
    queryFn: getRetailers,
  });
  const { data: markets = [] } = useQuery({
    queryKey: ["markets"],
    queryFn: getMarkets,
  });

  // Normalize native date input rendering
  useEffect(() => {
    const tag = document.createElement("style");
    tag.innerHTML = `
      .tw-date { -webkit-appearance:none; appearance:none; height:2.5rem; padding:0 .75rem; background:transparent; }
      .tw-date::-webkit-datetime-edit, .tw-date::-webkit-datetime-edit-fields-wrapper { padding:0; line-height:1.25rem; }
      .tw-date::-webkit-calendar-picker-indicator { opacity:.9; }
    `;
    document.head.appendChild(tag);
    return () => document.head.removeChild(tag);
  }, []);

  /* single fuzzy search bar */
  const [q, setQ] = useState("");

  /* bulk selection state */
  const [selectedRows, setSelectedRows] = useState(new Set());
  const [bulkActionsVisible, setBulkActionsVisible] = useState(false);
  const [viewMode, setViewMode] = useState('grid'); // 'grid' or 'list'
  
  /* new row state */
  const [newRows, setNewRows] = useState([]); // Array of temporary new rows
  const [nextNewRowId, setNextNewRowId] = useState(-1); // Negative IDs for new rows
  
  /* refs for collecting form data from OrderRow components */
  const orderRowRefs = useRef(new Map());
  
  /* form state management for persistent form data */
  const [formStates, setFormStates] = useState(new Map());

  // Update bulk actions visibility when selection changes
  useEffect(() => {
    setBulkActionsVisible(selectedRows.size > 0);
  }, [selectedRows]);

  /* bulk action functions */
  function toggleRowSelection(rowId) {
    const newSelected = new Set(selectedRows);
    if (newSelected.has(rowId)) {
      newSelected.delete(rowId);
    } else {
      newSelected.add(rowId);
    }
    setSelectedRows(newSelected);
  }

  function toggleAllSelection() {
    if (selectedRows.size === filtered.length) {
      // Deselect all
      setSelectedRows(new Set());
    } else {
      // Select all
      setSelectedRows(new Set(filtered.map(row => row.id)));
    }
  }

  async function bulkSaveSelected() {
    if (selectedRows.size === 0) return;

    try {
      // Collect current form data from all selected OrderRow components
      const formDataArray = [];
      const selectedOrders = filtered.filter(order => selectedRows.has(order.id));
      
      console.log("Selected orders:", selectedOrders);
      console.log("OrderRow refs:", orderRowRefs.current);
      
      for (const order of selectedOrders) {
        const orderRowRef = orderRowRefs.current.get(order.id);
        console.log(`Order ${order.id} ref:`, orderRowRef);
        
        if (orderRowRef && orderRowRef.getFormData) {
          const formData = orderRowRef.getFormData();
          console.log(`Order ${order.id} form data:`, formData);
          formDataArray.push({ ...order, ...formData });
        } else {
          console.log(`Order ${order.id} - no ref or getFormData, using original data`);
          // Fallback to original order data if ref not available
          formDataArray.push(order);
        }
      }
      
      console.log("Final form data array:", formDataArray);

      // Separate new rows from existing rows
      const newRowsToSave = formDataArray.filter(order => order.isNew);
      const existingRowsToUpdate = formDataArray.filter(order => !order.isNew);

      // Handle new rows - insert into database
      if (newRowsToSave.length > 0) {
        console.log("New rows to save:", newRowsToSave);
        
        const newOrdersData = newRowsToSave.map(row => ({
          order_date: row.order_date || new Date().toISOString().split('T')[0],
          item: row.item || "",
          profile_name: row.profile_name || "",
          retailer: row.retailer || "",
          buy_price_cents: moneyToCents(row.buy_price_cents || 0),
          sale_price_cents: moneyToCents(row.sale_price_cents || 0),
          sale_date: row.sale_date || null,
          marketplace: row.marketplace || "",
          shipping_cents: moneyToCents(row.shipping_cents || 0),
          fees_pct: parsePct(row.fees_pct || 0) / 100,
        }));

        console.log("New orders data to insert:", newOrdersData);

        const { error: insertError } = await supabase
          .from("orders")
          .insert(newOrdersData);

        if (insertError) {
          console.error("Insert error:", insertError);
          throw insertError;
        }
        
        console.log("Successfully inserted new rows");
      }

      // Handle existing rows - update in database
      if (existingRowsToUpdate.length > 0) {
        console.log("Existing rows to update:", existingRowsToUpdate);
        
        for (const row of existingRowsToUpdate) {
          const updateData = {
            order_date: row.order_date || new Date().toISOString().split('T')[0], // Default to today if empty
            item: row.item || "",
            profile_name: row.profile_name || "",
            retailer: row.retailer || "",
            buy_price_cents: moneyToCents(row.buy_price_cents || 0),
            sale_price_cents: moneyToCents(row.sale_price_cents || 0),
            sale_date: row.sale_date || null, // Sale date can be null
            marketplace: row.marketplace || "",
            shipping_cents: moneyToCents(row.shipping_cents || 0),
            fees_pct: parsePct(row.fees_pct || 0) / 100,
          };

          console.log(`Updating order ${row.id} with data:`, updateData);

          const { error: updateError } = await supabase
            .from("orders")
            .update(updateData)
            .eq("id", row.id);

          if (updateError) {
            console.error(`Update error for order ${row.id}:`, updateError);
            throw updateError;
          }
          
          console.log(`Successfully updated order ${row.id}`);
        }
      }

      // Clear new rows and selection
      setNewRows([]);
      setSelectedRows(new Set());
      refetch();
      
      alert(`Saved ${selectedRows.size} order${selectedRows.size > 1 ? 's' : ''}`);
    } catch (e) {
      alert(`Failed to save orders: ${e.message}`);
    }
  }

  async function bulkDeleteSelected() {
    if (!confirm(`Are you sure you want to delete ${selectedRows.size} order${selectedRows.size > 1 ? 's' : ''}?`)) {
      return;
    }

    try {
      const { error } = await supabase
        .from("orders")
        .delete()
        .in("id", Array.from(selectedRows));
      
      if (error) throw error;
      
      // Clear selection and refresh
      setSelectedRows(new Set());
      refetch();
    } catch (e) {
      alert(`Failed to delete orders: ${e.message}`);
    }
  }

  /* new row management functions */
  function addNewRow() {
    // Get today's date in YYYY-MM-DD format
    const today = new Date();
    const todayStr = today.toISOString().split('T')[0];
    
    const newRow = {
      id: nextNewRowId,
      order_date: todayStr, // Default to today's date
      item: "",
      profile_name: "",
      retailer: "",
      buy_price_cents: 0,
      sale_price_cents: 0,
      sale_date: "",
      marketplace: "",
      shipping_cents: 0,
      fees_pct: 0,
      isNew: true
    };
    
    setNewRows(prev => [...prev, newRow]);
    setNextNewRowId(prev => prev - 1);
    
    // Auto-select the new row
    setSelectedRows(prev => new Set([...prev, newRow.id]));
  }

  function cancelNewRows() {
    // Remove all new rows and clear selection
    setNewRows([]);
    setSelectedRows(new Set());
  }

  function removeNewRow(rowId) {
    setNewRows(prev => prev.filter(row => row.id !== rowId));
    setSelectedRows(prev => {
      const newSet = new Set(prev);
      newSet.delete(rowId);
      return newSet;
    });
  }

  const filtered = useMemo(() => {
    const query = (q || "").trim().toLowerCase();
    const allRows = [...newRows, ...orders]; // Include new rows at the top
    
    if (!query) return allRows;

    const tokens = query.split(/\s+/).filter(Boolean); // AND tokens

    return allRows.filter((o) => {
      const haystack = [
        o.item || "",
        o.retailer || "",
        o.marketplace || "",
        o.profile_name || "",
        dateKeywords(o.order_date || ""),
        dateKeywords(o.sale_date || ""),
      ]
        .join(" ")
        .toLowerCase();

      return tokens.every((t) => haystack.includes(t));
    });
  }, [orders, newRows, q]);

  /* group by order_date */
  const grouped = useMemo(() => {
    const map = new Map();
    const newRowsInFiltered = filtered.filter(o => o.isNew);
    const existingRowsInFiltered = filtered.filter(o => !o.isNew);
    
    // Add existing rows to groups
    for (const o of existingRowsInFiltered) {
      const key = o.order_date || "__unknown__";
      if (!map.has(key)) map.set(key, []);
      map.get(key).push(o);
    }
    
    // Add new rows to a special "New Orders" group at the top
    if (newRowsInFiltered.length > 0) {
      map.set("__new__", newRowsInFiltered);
    }
    
    const keys = Array.from(map.keys()).sort((a, b) => {
      if (a === "__new__") return -1; // New orders first
      if (a === "__unknown__") return 1;
      if (b === "__unknown__") return -1;
      return a < b ? 1 : a > b ? -1 : 0;
    });
    
    return keys.map((k) => ({
      key: k,
      nice: k === "__new__" ? "New Orders" : k === "__unknown__" ? "Unknown date" : fmtNiceDate(k),
      rows: map.get(k),
    }));
  }, [filtered]);

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100">
      <div className="max-w-6xl mx-auto p-4 sm:p-6">
        <HeaderWithTabs />

        {/* Search + meta */}
        <div className={`${pageCard} mb-6`}>
          <div className="grid grid-cols-1 gap-3 items-end">
            <div className="relative">
              <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                <svg
                  className="h-5 w-5 text-slate-400"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                  xmlns="http://www.w3.org/2000/svg"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
                  />
                </svg>
              </div>
              <input
                value={q}
                onChange={(e) => setQ(e.target.value)}
                placeholder="Search for orders"
                className={`${inputSm} pl-10`}
              />
            </div>

              {!!q && (
              <div className="flex justify-end">
                <button
                  onClick={() => setQ("")}
                  className="h-9 px-4 rounded-xl border border-slate-800 bg-slate-900/60 hover:bg-slate-900 text-slate-100"
                >
                  Clear search
                </button>
              </div>
              )}
          </div>
        </div>


        {/* Day cards */}
        {isLoading && <div className="text-slate-400">Loading…</div>}
        {error && <div className="text-rose-400">{String(error.message || error)}</div>}

        <UnifiedOrderView
          viewMode={viewMode}
          setViewMode={setViewMode}
          grouped={grouped}
          filtered={filtered}
          items={items}
          retailers={retailers}
          markets={markets}
          onSaved={refetch}
          onDeleted={refetch}
          selectedRows={selectedRows}
          onToggleRowSelection={toggleRowSelection}
          setSelectedRows={setSelectedRows}
          toggleAllSelection={toggleAllSelection}
          bulkSaveSelected={bulkSaveSelected}
          addNewRow={addNewRow}
          cancelNewRows={cancelNewRows}
          bulkDeleteSelected={bulkDeleteSelected}
          orderRowRefs={orderRowRefs}
          formStates={formStates}
          setFormStates={setFormStates}
        />
      </div>
    </div>
  );
}

/* ---------- Unified Order View Component ---------- */
function UnifiedOrderView({ 
  viewMode, 
  setViewMode, 
  grouped, 
  filtered, 
  items, 
  retailers, 
  markets, 
  onSaved, 
  onDeleted, 
  selectedRows, 
  onToggleRowSelection, 
  setSelectedRows, 
  toggleAllSelection, 
  bulkSaveSelected, 
  bulkDeleteSelected,
  addNewRow,
  cancelNewRows,
  orderRowRefs,
  formStates,
  setFormStates
}) {
  return (
    <div className={`${pageCard}`}>
      {/* Header with View Toggle and Actions */}
      <div className="flex items-center justify-between mb-4 pb-4 border-b border-slate-700">
        {/* Left side - View Toggle and Selection Count */}
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2">
            <button
              onClick={() => setViewMode('grid')}
              className={`w-10 h-10 rounded-xl border transition-all duration-200 flex items-center justify-center group ${
                viewMode === 'grid'
                  ? 'border-indigo-500 bg-indigo-600 text-white'
                  : 'border-slate-600 bg-slate-800/60 hover:bg-slate-700 hover:border-slate-500 text-slate-200'
              }`}
              title="Grid View"
            >
              <svg className={`w-4 h-4 transition-transform ${viewMode === 'grid' ? 'group-hover:scale-110' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2V6zM14 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2V6zM4 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2v-2zM14 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2v-2z" />
              </svg>
            </button>
            <button
              onClick={() => setViewMode('list')}
              className={`w-10 h-10 rounded-xl border transition-all duration-200 flex items-center justify-center group ${
                viewMode === 'list'
                  ? 'border-indigo-500 bg-indigo-600 text-white'
                  : 'border-slate-600 bg-slate-800/60 hover:bg-slate-700 hover:border-slate-500 text-slate-200'
              }`}
              title="List View"
            >
              <svg className={`w-4 h-4 transition-transform ${viewMode === 'list' ? 'group-hover:scale-110' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 10h16M4 14h16M4 18h16" />
              </svg>
            </button>
          </div>
          <div className="flex items-center gap-3">
            <input
              type="checkbox"
              checked={selectedRows.size === filtered.length && filtered.length > 0}
              onChange={toggleAllSelection}
              className="h-4 w-4 rounded border-slate-500 bg-slate-800/60 text-indigo-500 focus:ring-indigo-400 focus:ring-2 transition-all"
            />
            <span className="text-sm font-semibold text-slate-400">
              {selectedRows.size}/{filtered.length} Selected
            </span>
          </div>
        </div>

        {/* Right side - Action Buttons */}
        <div className="flex items-center gap-2">
          {/* Add New Order Button */}
          <button
            onClick={selectedRows.size > 0 ? cancelNewRows : addNewRow}
            className={`w-10 h-10 rounded-xl border transition-all duration-200 flex items-center justify-center group ${
              selectedRows.size === 0
                ? 'border-green-600 bg-green-600 hover:bg-green-700 hover:border-green-500 text-white'
                : 'border-red-600 bg-red-600 hover:bg-red-700 hover:border-red-500 text-white'
            }`}
            title={selectedRows.size > 0 ? "Cancel Changes" : "Add New Order"}
          >
            <svg className={`w-4 h-4 transition-transform group-hover:scale-110`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
              {selectedRows.size === 0 ? (
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
              ) : (
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              )}
            </svg>
          </button>
          <button
            onClick={bulkSaveSelected}
            disabled={selectedRows.size === 0}
            className={`w-10 h-10 rounded-xl border transition-all duration-200 flex items-center justify-center group ${
              selectedRows.size > 0
                ? 'border-slate-600 bg-slate-800/60 hover:bg-slate-700 hover:border-slate-500 text-slate-200'
                : 'border-slate-700 bg-slate-800/30 text-slate-500 cursor-not-allowed'
            }`}
            title={selectedRows.size > 0 ? "Save Selected Orders" : "No orders selected"}
          >
            <svg className={`w-4 h-4 transition-transform ${selectedRows.size > 0 ? 'group-hover:scale-110' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7H5a2 2 0 00-2 2v9a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-3m-1 4l-3 3m0 0l-3-3m3 3V4" />
            </svg>
          </button>
          <button
            onClick={bulkDeleteSelected}
            disabled={selectedRows.size === 0}
            className={`w-10 h-10 rounded-xl border transition-all duration-200 flex items-center justify-center group ${
              selectedRows.size > 0
                ? 'border-red-600/50 bg-red-900/30 hover:bg-red-800/50 hover:border-red-500 text-red-200'
                : 'border-slate-700 bg-slate-800/30 text-slate-500 cursor-not-allowed'
            }`}
            title={selectedRows.size > 0 ? "Delete Selected Orders" : "No orders selected"}
          >
            <svg className={`w-4 h-4 transition-transform ${selectedRows.size > 0 ? 'group-hover:scale-110' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
            </svg>
          </button>
        </div>
      </div>


      {/* Content Area */}
      {viewMode === 'grid' ? (
        <UnifiedGridView
          grouped={grouped}
          items={items}
          retailers={retailers}
          markets={markets}
          onSaved={onSaved}
          onDeleted={onDeleted}
          selectedRows={selectedRows}
          onToggleRowSelection={onToggleRowSelection}
          setSelectedRows={setSelectedRows}
          orderRowRefs={orderRowRefs}
          formStates={formStates}
          setFormStates={setFormStates}
        />
      ) : (
        <UnifiedListView
          orders={filtered}
          items={items}
          retailers={retailers}
          markets={markets}
          onSaved={onSaved}
          onDeleted={onDeleted}
          selectedRows={selectedRows}
          onToggleRowSelection={onToggleRowSelection}
          setSelectedRows={setSelectedRows}
          orderRowRefs={orderRowRefs}
          formStates={formStates}
          setFormStates={setFormStates}
        />
      )}
    </div>
  );
}

/* ---------- Unified Grid View Component ---------- */
function UnifiedGridView({ grouped, items, retailers, markets, onSaved, onDeleted, selectedRows, onToggleRowSelection, setSelectedRows, orderRowRefs, formStates, setFormStates }) {
  if (!grouped.length) {
    return <div className="text-slate-400">No orders found.</div>;
  }

  return (
    <div className="space-y-3">
          {grouped.map((g) => (
        <UnifiedDaySection
              key={g.key}
              title={g.nice}
              dateKey={g.key}
              count={g.rows.length}
          defaultOpen={false}
              rows={g.rows}
              items={items}
              retailers={retailers}
              markets={markets}
          onSaved={onSaved}
          onDeleted={onDeleted}
          selectedRows={selectedRows}
          onToggleRowSelection={onToggleRowSelection}
          setSelectedRows={setSelectedRows}
          orderRowRefs={orderRowRefs}
          formStates={formStates}
          setFormStates={setFormStates}
            />
          ))}
    </div>
  );
}

/* ---------- Unified List View Component ---------- */
function UnifiedListView({ orders, items, retailers, markets, onSaved, onDeleted, selectedRows, onToggleRowSelection, setSelectedRows, orderRowRefs, formStates, setFormStates }) {
  if (!orders.length) {
    return <div className="text-slate-400">No orders found.</div>;
  }

  return (
    <>
      {/* Table Header - Hidden on mobile */}
      <div className="hidden lg:grid grid-cols-[auto_1fr_2fr_1fr_1fr_1fr_1fr_1fr_1fr_1fr] gap-2 items-center mb-4 pb-3 border-b border-slate-700">
        <div className="w-6"></div>
        <div className="text-xs text-slate-300 font-medium">Order date</div>
        <div className="text-xs text-slate-300 font-medium">Item</div>
        <div className="text-xs text-slate-300 font-medium">Profile</div>
        <div className="text-xs text-slate-300 font-medium">Retailer</div>
        <div className="text-xs text-slate-300 font-medium">Buy $</div>
        <div className="text-xs text-slate-300 font-medium">Sale $</div>
        <div className="text-xs text-slate-300 font-medium">Sale date</div>
        <div className="text-xs text-slate-300 font-medium">Marketplace</div>
        <div className="text-xs text-slate-300 font-medium">Ship $</div>
      </div>

      {/* Table Body */}
      <div className="space-y-2">
        {orders.map((order) => (
          <OrderRow
            key={order.id}
            order={order}
            items={items}
            retailers={retailers}
            markets={markets}
            onSaved={onSaved}
            onDeleted={onDeleted}
            isSelected={selectedRows.has(order.id)}
            onToggleSelection={() => onToggleRowSelection(order.id)}
            orderRowRefs={orderRowRefs}
            formStates={formStates}
            setFormStates={setFormStates}
          />
        ))}
      </div>
    </>
  );
}

/* ---------- Unified Day Section Component ---------- */
function UnifiedDaySection({ title, dateKey, count, defaultOpen, rows, items, retailers, markets, onSaved, onDeleted, selectedRows, onToggleRowSelection, setSelectedRows, orderRowRefs, formStates, setFormStates }) {
  const [open, setOpen] = useState(defaultOpen);
  const allRowsSelected = rows.length > 0 && rows.every(row => selectedRows.has(row.id));

  return (
    <div className={`border rounded-xl overflow-hidden transition-all ${
      allRowsSelected 
        ? 'border-indigo-500 bg-indigo-500/10' 
        : 'border-slate-800'
    }`}>
      {/* Header Row */}
      <div 
        className={`flex items-center justify-between p-4 cursor-pointer transition-colors ${
          allRowsSelected
            ? 'bg-indigo-500/20 hover:bg-indigo-500/30'
            : 'bg-slate-800/30 hover:bg-slate-800/50'
        }`}
        onClick={() => setOpen(!open)}
      >
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-3">
            <input
              type="checkbox"
              checked={allRowsSelected}
              onChange={(e) => {
                e.stopPropagation();
                const newSelected = new Set(selectedRows);
                if (allRowsSelected) {
                  // Deselect all rows in this section
                  rows.forEach(row => newSelected.delete(row.id));
                } else {
                  // Select all rows in this section
                  rows.forEach(row => newSelected.add(row.id));
                }
                setSelectedRows(newSelected);
              }}
              onClick={(e) => e.stopPropagation()}
              className="h-4 w-4 rounded border-slate-500 bg-slate-800/60 text-indigo-500 focus:ring-indigo-400 focus:ring-2 transition-all"
            />
          </div>
          <div>
            <div className="text-lg font-semibold text-slate-100">{title}</div>
            <div className="text-sm text-slate-400">{count} orders</div>
          </div>
        </div>
        <ChevronDown className={`w-5 h-5 text-slate-400 transition-transform ${open ? 'rotate-180' : ''}`} />
      </div>

      {/* Content */}
      {open && (
        <div className="p-4 border-t border-slate-700">
          {/* Header Row for Orders */}
          <div className="hidden lg:grid grid-cols-[auto_1fr_2fr_1fr_1fr_1fr_1fr_1fr_1fr_1fr] gap-2 items-center mb-3 pb-2 border-b border-slate-700">
            <div className="w-6"></div>
            <div className="text-xs text-slate-300 font-medium">Order date</div>
            <div className="text-xs text-slate-300 font-medium">Item</div>
            <div className="text-xs text-slate-300 font-medium">Profile</div>
            <div className="text-xs text-slate-300 font-medium">Retailer</div>
            <div className="text-xs text-slate-300 font-medium">Buy $</div>
            <div className="text-xs text-slate-300 font-medium">Sale $</div>
            <div className="text-xs text-slate-300 font-medium">Sale date</div>
            <div className="text-xs text-slate-300 font-medium">Marketplace</div>
            <div className="text-xs text-slate-300 font-medium">Ship $</div>
          </div>

          {/* Order Rows */}
          <div className="space-y-2">
            {rows.map((order) => (
              <OrderRow
                key={order.id}
                order={order}
                items={items}
                retailers={retailers}
                markets={markets}
                onSaved={onSaved}
                onDeleted={onDeleted}
                isSelected={selectedRows.has(order.id)}
                onToggleSelection={() => onToggleRowSelection(order.id)}
                orderRowRefs={orderRowRefs}
                formStates={formStates}
                setFormStates={setFormStates}
            />
          ))}
          </div>
        </div>
          )}
        </div>
  );
}

/* ---------- List View Component ---------- */
function ListView({ orders, items, retailers, markets, onSaved, onDeleted, selectedRows, onToggleRowSelection, setSelectedRows }) {
  if (!orders.length) {
    return <div className={`${pageCard} text-slate-400`}>No orders found.</div>;
  }

  return (
    <div className={`${pageCard}`}>
      {/* Table Header - Hidden on mobile */}
      <div className="hidden lg:grid grid-cols-[auto_1fr_2fr_1fr_1fr_1fr_1fr_1fr_1fr_1fr] gap-2 items-center mb-4 pb-3 border-b border-slate-700">
        <div className="w-6 flex items-center justify-center">
          <input
            type="checkbox"
            checked={selectedRows.size === orders.length && orders.length > 0}
            onChange={() => {
              if (selectedRows.size === orders.length) {
                setSelectedRows(new Set());
              } else {
                setSelectedRows(new Set(orders.map(o => o.id)));
              }
            }}
            className="h-4 w-4 rounded border-slate-500 bg-slate-800/60 text-indigo-500 focus:ring-indigo-400 focus:ring-2 transition-all"
          />
        </div>
        <div className="text-xs text-slate-300 font-medium">Order date</div>
        <div className="text-xs text-slate-300 font-medium">Item</div>
        <div className="text-xs text-slate-300 font-medium">Profile</div>
        <div className="text-xs text-slate-300 font-medium">Retailer</div>
        <div className="text-xs text-slate-300 font-medium">Buy $</div>
        <div className="text-xs text-slate-300 font-medium">Sale $</div>
        <div className="text-xs text-slate-300 font-medium">Sale date</div>
        <div className="text-xs text-slate-300 font-medium">Marketplace</div>
        <div className="text-xs text-slate-300 font-medium">Ship $</div>
      </div>

      {/* Mobile Header - Show on small screens */}
      <div className="lg:hidden flex items-center justify-between mb-4 pb-3 border-b border-slate-700">
        <div className="text-sm font-semibold text-slate-400">
          Orders ({orders.length})
        </div>
      </div>

      {/* Table Body */}
      <div className="space-y-2 max-h-96 overflow-y-auto scrollbar-thin scrollbar-thumb-slate-600 scrollbar-track-slate-800 pr-2">
        {orders.map((order) => (
          <OrderRow
            key={order.id}
            order={order}
            items={items}
            retailers={retailers}
            markets={markets}
            onSaved={onSaved}
            onDeleted={onDeleted}
            isSelected={selectedRows.has(order.id)}
            onToggleSelection={() => onToggleRowSelection(order.id)}
          />
        ))}
      </div>
    </div>
  );
}

/* ============== Day Card ============== */
function DayCard({
  title,
  dateKey, // YYYY-MM-DD or "__unknown__"
  count,
  rows,
  items,
  retailers,
  markets,
  onSaved,
  onDeleted,
  defaultOpen = false,
  selectedRows,
  onToggleRowSelection,
  setSelectedRows,
}) {
  const [open, setOpen] = useState(defaultOpen);
  const [adding, setAdding] = useState(false);

  async function addNewForDay() {
    if (!dateKey || dateKey === "__unknown__") return;
    setAdding(true);
    try {
      const base = {
        order_date: dateKey,
        item: null,
        profile_name: null,
        retailer: null,
        marketplace: null,
        sale_date: null,
        buy_price_cents: 0,
        sale_price_cents: 0,
        shipping_cents: 0,
        fees_pct: 0,
        status: "ordered",
      };
      const { error } = await supabase.from("orders").insert(base);
      if (error) throw error;
      onSaved && onSaved();
      setOpen(true);
    } catch (e) {
      alert(e.message || String(e));
    } finally {
      setAdding(false);
    }
  }

  return (
    <div className={pageCard}>
      {/* header - controls pinned top-right (mobile & desktop) */}
      <div className="relative min-h-[2.25rem]">
        {/* Controls */}
        <div className="absolute right-0 top-0 flex items-center gap-2">
          {open && (
            <button
              onClick={addNewForDay}
              disabled={!dateKey || dateKey === "__unknown__" || adding}
              className={`h-9 w-9 rounded-xl border border-slate-800 text-lg leading-none ${
                adding
                  ? "bg-slate-800 text-slate-300 cursor-not-allowed"
                  : "bg-slate-900/60 hover:bg-slate-900 text-slate-100"
              }`}
              title={
                dateKey === "__unknown__" ? "Unknown date" : `Add order on ${title}`
              }
            >
              {adding ? "…" : "+"}
            </button>
          )}

          <button
            onClick={() => setOpen((v) => !v)}
            className="h-9 w-9 grid place-items-center rounded-xl border border-slate-800 bg-slate-900/60 hover:bg-slate-800 transition"
            aria-label={open ? "Collapse" : "Expand"}
          >
            <ChevronDown className={`h-5 w-5 transition-transform ${open ? "rotate-180" : ""}`} />
          </button>
        </div>

        {/* Title and Select All */}
        <div className="pr-36 sm:pr-40">
          <div className="flex items-center gap-3">
            <div className="flex-1">
          <h3 className="text-lg font-semibold leading-tight break-words">{title}</h3>
          <p className="text-xs text-slate-400">
            {count} order{count !== 1 ? "s" : ""}
          </p>
            </div>
            {open && (
              <div className="flex items-center gap-2 lg:hidden">
                <input
                  type="checkbox"
                  checked={rows.every(row => selectedRows.has(row.id))}
                  onChange={(e) => {
                    const rowIds = rows.map(row => row.id);
                    if (e.target.checked) {
                      // Select all rows in this card
                      const newSelected = new Set(selectedRows);
                      rowIds.forEach(id => newSelected.add(id));
                      setSelectedRows(newSelected);
                    } else {
                      // Deselect all rows in this card
                      const newSelected = new Set(selectedRows);
                      rowIds.forEach(id => newSelected.delete(id));
                      setSelectedRows(newSelected);
                    }
                  }}
                  className="h-4 w-4 rounded border-slate-500 bg-slate-800/60 text-indigo-500 focus:ring-indigo-400 focus:ring-2 transition-all"
                />
                <span className="text-xs text-slate-400">Select all</span>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* content */}
      <div className={`transition-all duration-300 ease-in-out overflow-hidden`} style={{ maxHeight: open ? 1000 : 0 }}>
        <div className="pt-5">
          {/* Header row - text only */}
          <div className="hidden lg:block">
            <div className="grid grid-cols-[auto_1fr_2fr_1fr_1fr_1fr_1fr_1fr_1fr_1fr] gap-2 items-center min-w-0 px-3 py-2 mb-1">
              <div className="flex items-center justify-center">
                <input
                  type="checkbox"
                  checked={rows.every(row => selectedRows.has(row.id))}
                  onChange={(e) => {
                    const rowIds = rows.map(row => row.id);
                    if (e.target.checked) {
                      // Select all rows in this card
                      const newSelected = new Set(selectedRows);
                      rowIds.forEach(id => newSelected.add(id));
                      setSelectedRows(newSelected);
                    } else {
                      // Deselect all rows in this card
                      const newSelected = new Set(selectedRows);
                      rowIds.forEach(id => newSelected.delete(id));
                      setSelectedRows(newSelected);
                    }
                  }}
                  className="h-4 w-4 rounded border-slate-500 bg-slate-800/60 text-indigo-500 focus:ring-indigo-400 focus:ring-2 transition-all"
                />
              </div>
              <div className="text-xs text-slate-300 font-medium">Order date</div>
              <div className="text-xs text-slate-300 font-medium">Item</div>
              <div className="text-xs text-slate-300 font-medium">Profile</div>
              <div className="text-xs text-slate-300 font-medium">Retailer</div>
              <div className="text-xs text-slate-300 font-medium">Buy $</div>
              <div className="text-xs text-slate-300 font-medium">Sale $</div>
              <div className="text-xs text-slate-300 font-medium">Sale date</div>
              <div className="text-xs text-slate-300 font-medium">Marketplace</div>
              <div className="text-xs text-slate-300 font-medium">Ship $</div>
            </div>
          </div>

          <div className="space-y-3 max-h-96 overflow-y-auto scrollbar-thin scrollbar-thumb-slate-600 scrollbar-track-slate-800 pr-2">
            {rows.map((o) => (
              <OrderRow
                key={o.id}
                order={o}
                items={items}
                retailers={retailers}
                markets={markets}
                onSaved={onSaved}
                onDeleted={onDeleted}
                isSelected={selectedRows.has(o.id)}
                onToggleSelection={() => onToggleRowSelection(o.id)}
              />
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

/* ============== Row component ============== */
function OrderRow({ order, items, retailers, markets, onSaved, onDeleted, isSelected, onToggleSelection, orderRowRefs, formStates, setFormStates }) {
  // Get or initialize form state for this order
  const getFormState = () => {
    if (!formStates.has(order.id)) {
      const initialState = {
        order_date: order.order_date || "",
        item: order.item || "",
        profile_name: order.profile_name || "",
        retailer: order.retailer || "",
        buyPrice: centsToStr(order.buy_price_cents),
        salePrice: centsToStr(order.sale_price_cents),
        sale_date: order.sale_date || "",
        marketplace: order.marketplace || "",
        feesPct: ((order.fees_pct ?? 0) * 100).toString(),
        shipping: centsToStr(order.shipping_cents),
      };
      setFormStates(prev => new Map(prev).set(order.id, initialState));
      return initialState;
    }
    return formStates.get(order.id);
  };

  const formState = getFormState();
  
  // State setters that update the persistent form state
  const setOrderDate = (value) => {
    setFormStates(prev => {
      const newMap = new Map(prev);
      const currentState = newMap.get(order.id) || {};
      newMap.set(order.id, { ...currentState, order_date: value });
      return newMap;
    });
  };
  
  const setItem = (value) => {
    setFormStates(prev => {
      const newMap = new Map(prev);
      const currentState = newMap.get(order.id) || {};
      newMap.set(order.id, { ...currentState, item: value });
      return newMap;
    });
  };
  
  const setProfile = (value) => {
    setFormStates(prev => {
      const newMap = new Map(prev);
      const currentState = newMap.get(order.id) || {};
      newMap.set(order.id, { ...currentState, profile_name: value });
      return newMap;
    });
  };
  
  const setRetailer = (value) => {
    setFormStates(prev => {
      const newMap = new Map(prev);
      const currentState = newMap.get(order.id) || {};
      newMap.set(order.id, { ...currentState, retailer: value });
      return newMap;
    });
  };
  
  const setBuyPrice = (value) => {
    setFormStates(prev => {
      const newMap = new Map(prev);
      const currentState = newMap.get(order.id) || {};
      newMap.set(order.id, { ...currentState, buyPrice: value });
      return newMap;
    });
  };
  
  const setSalePrice = (value) => {
    setFormStates(prev => {
      const newMap = new Map(prev);
      const currentState = newMap.get(order.id) || {};
      newMap.set(order.id, { ...currentState, salePrice: value });
      return newMap;
    });
  };
  
  const setSaleDate = (value) => {
    setFormStates(prev => {
      const newMap = new Map(prev);
      const currentState = newMap.get(order.id) || {};
      newMap.set(order.id, { ...currentState, sale_date: value });
      return newMap;
    });
  };
  
  const setMarketplace = (value) => {
    setFormStates(prev => {
      const newMap = new Map(prev);
      const currentState = newMap.get(order.id) || {};
      newMap.set(order.id, { ...currentState, marketplace: value });
      return newMap;
    });
  };
  
  const setFeesPct = (value) => {
    setFormStates(prev => {
      const newMap = new Map(prev);
      const currentState = newMap.get(order.id) || {};
      newMap.set(order.id, { ...currentState, feesPct: value });
      return newMap;
    });
  };
  
  const setShipping = (value) => {
    setFormStates(prev => {
      const newMap = new Map(prev);
      const currentState = newMap.get(order.id) || {};
      newMap.set(order.id, { ...currentState, shipping: value });
      return newMap;
    });
  };

  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState("");

  // Register this component with the refs map
  useEffect(() => {
    if (orderRowRefs) {
      // Create a function that captures current state values
      const getFormData = () => {
        const currentFormState = formStates.get(order.id) || formState;
        const formData = {
          order_date: currentFormState.order_date,
          item: currentFormState.item,
          profile_name: currentFormState.profile_name,
          retailer: currentFormState.retailer,
          buy_price_cents: currentFormState.buyPrice,
          sale_price_cents: currentFormState.salePrice,
          sale_date: currentFormState.sale_date,
          marketplace: currentFormState.marketplace,
          shipping_cents: currentFormState.shipping,
          fees_pct: currentFormState.feesPct,
        };
        console.log(`OrderRow ${order.id} getFormData called, returning:`, formData);
        return formData;
      };
      
      console.log(`Registering OrderRow ${order.id} with refs`);
      orderRowRefs.current.set(order.id, { getFormData });
      return () => {
        console.log(`Unregistering OrderRow ${order.id} from refs`);
        orderRowRefs.current.delete(order.id);
      };
    }
  }, [order.id, orderRowRefs, formStates, formState]);

  function handleMarketplaceChange(name) {
    setMarketplace(name);
    const mk = markets.find((m) => m.name === name);
    const currentFormState = formStates.get(order.id) || formState;
    const current = Number(String(currentFormState.feesPct).replace("%", "")) || 0;
    if (mk && (!current || current === 0)) {
      setFeesPct(((mk.default_fees_pct ?? 0) * 100).toString());
    }
  }

  async function save() {
    setBusy(true);
    setMsg("");
    try {
      const currentFormState = formStates.get(order.id) || formState;
      const statusValue = moneyToCents(currentFormState.salePrice) > 0 ? "sold" : "ordered";
      const payload = {
        order_date: currentFormState.order_date || null,
        item: currentFormState.item || null,
        profile_name: currentFormState.profile_name || null,
        retailer: currentFormState.retailer || null,
        marketplace: currentFormState.marketplace || null,
        buy_price_cents: moneyToCents(currentFormState.buyPrice),
        sale_price_cents: moneyToCents(currentFormState.salePrice),
        sale_date: currentFormState.sale_date || null,
        fees_pct: parsePct(currentFormState.feesPct),
        shipping_cents: moneyToCents(currentFormState.shipping),
        status: statusValue,
      };
      const { error } = await supabase.from("orders").update(payload).eq("id", order.id);
      if (error) throw error;
      setMsg("Saved ✓");
      onSaved && onSaved();
      setTimeout(() => setMsg(""), 1500);
    } catch (err) {
      setMsg(String(err.message || err));
    } finally {
      setBusy(false);
    }
  }

  async function del() {
    if (!confirm("Delete this order?")) return;
    const { error } = await supabase.from("orders").delete().eq("id", order.id);
    if (error) alert(error.message);
    else onDeleted && onDeleted();
  }

  return (
    <div 
      className={`rounded-xl border bg-slate-900/60 p-3 overflow-hidden transition cursor-pointer ${
        isSelected || order.isNew
          ? 'border-indigo-500 bg-indigo-500/10' 
          : 'border-slate-800 hover:bg-slate-800/50'
      }`}
      onClick={onToggleSelection}
    >
      <div className="grid grid-cols-1 lg:grid-cols-[auto_1fr_2fr_1fr_1fr_1fr_1fr_1fr_1fr_1fr] gap-2 items-center min-w-0 overflow-hidden">
        {/* Selection checkbox */}
        <input
          type="checkbox"
          checked={isSelected}
          onChange={(e) => {
            e.stopPropagation();
            onToggleSelection();
          }}
          className="h-4 w-4 rounded border-slate-500 bg-slate-800/60 text-indigo-500 focus:ring-indigo-400 focus:ring-2 transition-all"
        />
        
        {/* Order Date - Responsive */}
        <input
          type="date"
          value={formState.order_date || ""}
          onChange={(e) => setOrderDate(e.target.value)}
          onClick={(e) => e.stopPropagation()}
          className="bg-slate-800/30 border border-slate-600/50 rounded-lg px-2 py-1 text-xs text-slate-100 focus:border-indigo-500 focus:outline-none w-full min-w-0 max-w-full"
        />

        {/* Item Name - Most Important */}
        <select
          value={formState.item || ""}
          onChange={(e) => setItem(e.target.value)}
          onClick={(e) => e.stopPropagation()}
          className="bg-slate-800/30 border border-slate-600/50 rounded-lg px-2 py-1 text-sm text-slate-100 focus:border-indigo-500 focus:outline-none w-full"
        >
          <option value="" className="text-slate-400">Select item...</option>
          {items.map((it) => (
            <option key={it.id} value={it.name} className="bg-slate-800 text-slate-100">
              {it.name}
            </option>
          ))}
        </select>

        {/* Profile */}
        <input
          value={formState.profile_name}
          onChange={(e) => setProfile(e.target.value)}
          onClick={(e) => e.stopPropagation()}
          placeholder="Profile"
          className="bg-slate-800/30 border border-slate-600/50 rounded-lg px-2 py-1 text-sm text-slate-100 focus:border-indigo-500 focus:outline-none w-full"
        />

        {/* Retailer */}
        <select
          value={formState.retailer || ""}
          onChange={(e) => setRetailer(e.target.value)}
          onClick={(e) => e.stopPropagation()}
          className="bg-slate-800/30 border border-slate-600/50 rounded-lg px-2 py-1 text-sm text-slate-100 focus:border-indigo-500 focus:outline-none w-full"
        >
          <option value="" className="text-slate-400">Retailer</option>
          {retailers.map((r) => (
            <option key={r.id} value={r.name} className="bg-slate-800 text-slate-100">
              {r.name}
            </option>
          ))}
        </select>

        {/* Buy Price */}
        <input
          value={formState.buyPrice}
          onChange={(e) => setBuyPrice(e.target.value)}
          onClick={(e) => e.stopPropagation()}
          placeholder="Buy"
          className="bg-slate-800/30 border border-slate-600/50 rounded-lg px-2 py-1 text-sm text-slate-100 focus:border-indigo-500 focus:outline-none w-full"
        />

        {/* Sale Price */}
        <input
          value={formState.salePrice}
          onChange={(e) => setSalePrice(e.target.value)}
          onClick={(e) => e.stopPropagation()}
          placeholder="Sale"
          className="bg-slate-800/30 border border-slate-600/50 rounded-lg px-2 py-1 text-sm text-slate-100 focus:border-indigo-500 focus:outline-none w-full"
        />

        {/* Sale Date - Responsive */}
        <input
          type="date"
          value={formState.sale_date || ""}
          onChange={(e) => setSaleDate(e.target.value)}
          onClick={(e) => e.stopPropagation()}
          className="bg-slate-800/30 border border-slate-600/50 rounded-lg px-2 py-1 text-xs text-slate-100 focus:border-indigo-500 focus:outline-none w-full min-w-0 max-w-full"
        />

        {/* Marketplace */}
        <select
          value={formState.marketplace || ""}
          onChange={(e) => handleMarketplaceChange(e.target.value)}
          onClick={(e) => e.stopPropagation()}
          className="bg-slate-800/30 border border-slate-600/50 rounded-lg px-2 py-1 text-sm text-slate-100 focus:border-indigo-500 focus:outline-none w-full"
        >
          <option value="" className="text-slate-400">Market</option>
          {markets.map((m) => (
            <option key={m.id} value={m.name} className="bg-slate-800 text-slate-100">
              {m.name}
            </option>
          ))}
        </select>

        {/* Shipping */}
        <input
          value={formState.shipping}
          onChange={(e) => setShipping(e.target.value)}
          onClick={(e) => e.stopPropagation()}
          placeholder="Ship"
          className="bg-slate-800/30 border border-slate-600/50 rounded-lg px-2 py-1 text-sm text-slate-100 focus:border-indigo-500 focus:outline-none w-full"
        />

      </div>

      {msg && (
        <div
          className={`text-right text-sm mt-1 ${
            msg.startsWith("Saved") ? "text-emerald-400" : "text-rose-400"
          }`}
        >
          {msg}
        </div>
      )}
    </div>
  );
}

function ChevronDown({ className = "h-5 w-5" }) {
  return (
    <svg viewBox="0 0 24 24" className={className} fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M6 9l6 6 6-6" />
    </svg>
  );
}
