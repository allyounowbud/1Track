// src/routes/Settings.jsx
import { useState, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "../lib/supabaseClient";
import HeaderWithTabs from "../components/HeaderWithTabs.jsx";
import { moneyToCents, centsToStr, formatNumber } from "../utils/money.js";
import { pageCard, rowCard, inputSm, headerIconBtn, headerGhostBtn, iconSave, iconSaveBusy, iconDelete } from "../utils/ui.js";

/* ---------- queries ---------- */
async function getItems() {
  const { data, error } = await supabase
    .from("items")
    .select("id, name, market_value_cents")
    .order("name", { ascending: true });
  if (error) throw error;
  return data;
}
async function getRetailers() {
  const { data, error } = await supabase
    .from("retailers")
    .select("id, name")
    .order("name", { ascending: true });
  if (error) throw error;
  return data;
}
async function getMarkets() {
  const { data, error } = await supabase
    .from("marketplaces")
    .select("id, name, default_fees_pct")
    .order("name", { ascending: true });
  if (error) throw error;
  return data;
}

export default function Settings() {
  const { data: items = [], refetch: refetchItems } = useQuery({
    queryKey: ["items"],
    queryFn: getItems,
  });
  const { data: retailers = [], refetch: refetchRetailers } = useQuery({
    queryKey: ["retailers"],
    queryFn: getRetailers,
  });
  const { data: markets = [], refetch: refetchMarkets } = useQuery({
    queryKey: ["markets"],
    queryFn: getMarkets,
  });

  // OrderBook-style state management
  const [selectedRows, setSelectedRows] = useState(new Set());
  const [bulkActionsVisible, setBulkActionsVisible] = useState(false);
  const [newRows, setNewRows] = useState([]); // Array of temporary new rows
  const [nextNewRowId, setNextNewRowId] = useState(-1); // Negative IDs for new rows

  // Update bulk actions visibility when selection changes
  useEffect(() => {
    setBulkActionsVisible(selectedRows.size > 0);
  }, [selectedRows]);

  // Helper function to check if there are new rows in the system
  const hasNewRows = newRows.length > 0;

  /* ----- OrderBook-style Bulk Operations ----- */
  function toggleRowSelection(rowId) {
    const newSelected = new Set(selectedRows);
    if (newSelected.has(rowId)) {
      // Check if this is a new row - prevent deselection
      const isNewRow = rowId < 0;
      if (isNewRow) {
        return; // Don't allow deselection of new rows
      }
      newSelected.delete(rowId);
    } else {
      // If there are new rows, clear all selections first
      if (hasNewRows) {
        setSelectedRows(new Set([rowId]));
        return;
      }
      newSelected.add(rowId);
    }
    setSelectedRows(newSelected);
  }

  function toggleAllSelection() {
    if (selectedRows.size === (items.length + retailers.length + markets.length)) {
      // Check if there are new rows - prevent deselection
      if (hasNewRows) {
        return;
      }
      setSelectedRows(new Set());
    } else {
      // Select all existing rows
      const allIds = [
        ...items.map(item => item.id),
        ...retailers.map(retailer => retailer.id),
        ...markets.map(market => market.id)
      ];
      setSelectedRows(new Set(allIds));
    }
  }

  async function bulkSaveSelected() {
    if (selectedRows.size === 0) return;
    
    try {
      // For now, just show a message since we need to collect form data
      alert(`Saving ${selectedRows.size} selected items...`);
      setSelectedRows(new Set());
    } catch (e) {
      alert(`Failed to save: ${e.message}`);
    }
  }

  async function bulkDeleteSelected() {
    if (!confirm(`Are you sure you want to delete ${selectedRows.size} item(s)?`)) {
      return;
    }

    try {
      const selectedIds = Array.from(selectedRows).filter(id => id > 0); // Only existing items
      
      if (selectedIds.length > 0) {
        // Delete items
        const itemIds = selectedIds.filter(id => items.some(item => item.id === id));
        if (itemIds.length > 0) {
          const { error: itemsError } = await supabase
            .from("items")
            .delete()
            .in("id", itemIds);
          if (itemsError) throw itemsError;
        }

        // Delete retailers
        const retailerIds = selectedIds.filter(id => retailers.some(retailer => retailer.id === id));
        if (retailerIds.length > 0) {
          const { error: retailersError } = await supabase
            .from("retailers")
            .delete()
            .in("id", retailerIds);
          if (retailersError) throw retailersError;
        }

        // Delete markets
        const marketIds = selectedIds.filter(id => markets.some(market => market.id === id));
        if (marketIds.length > 0) {
          const { error: marketsError } = await supabase
            .from("marketplaces")
            .delete()
            .in("id", marketIds);
          if (marketsError) throw marketsError;
        }

        // Refresh data
        await Promise.all([refetchItems(), refetchRetailers(), refetchMarkets()]);
      }

      setSelectedRows(new Set());
      setNewRows([]);
    } catch (e) {
      alert(`Failed to delete: ${e.message}`);
    }
  }

  function cancelNewRows() {
    setNewRows([]);
    setSelectedRows(new Set());
  }

  function addNewRow(type) {
    const newId = nextNewRowId;
    setNextNewRowId(newId - 1);
    
    const newRow = {
      id: newId,
      type: type, // 'item', 'retailer', 'market'
      isNew: true
    };
    
    setNewRows(prev => [...prev, newRow]);
    setSelectedRows(new Set([newId]));
  }

  /* ----- Legacy Bulk Operations ----- */
  async function bulkSaveItems() {
    if (selectedItems.size === 0) return;
    
    // For now, just show a message since we don't have a way to get the edited data
    // In a real implementation, you'd need to track the edited data
    alert(`Saving ${selectedItems.size} selected items...`);
    setSelectedItems(new Set());
  }

  async function bulkDeleteItems() {
    if (selectedItems.size === 0) return;
    if (!confirm(`Delete ${selectedItems.size} selected items?`)) return;
    
    const { error } = await supabase
      .from("items")
      .delete()
      .in("id", Array.from(selectedItems));
    
    if (error) {
      alert(error.message);
    } else {
      await refetchItems();
      setSelectedItems(new Set());
    }
  }

  async function bulkSaveRetailers() {
    if (selectedRetailers.size === 0) return;
    alert(`Saving ${selectedRetailers.size} selected retailers...`);
    setSelectedRetailers(new Set());
  }

  async function bulkDeleteRetailers() {
    if (selectedRetailers.size === 0) return;
    if (!confirm(`Delete ${selectedRetailers.size} selected retailers?`)) return;
    
    const { error } = await supabase
      .from("retailers")
      .delete()
      .in("id", Array.from(selectedRetailers));
    
    if (error) {
      alert(error.message);
    } else {
      await refetchRetailers();
      setSelectedRetailers(new Set());
    }
  }

  async function bulkSaveMarkets() {
    if (selectedMarkets.size === 0) return;
    alert(`Saving ${selectedMarkets.size} selected marketplaces...`);
    setSelectedMarkets(new Set());
  }

  async function bulkDeleteMarkets() {
    if (selectedMarkets.size === 0) return;
    if (!confirm(`Delete ${selectedMarkets.size} selected marketplaces?`)) return;
    
    const { error } = await supabase
      .from("marketplaces")
      .delete()
      .in("id", Array.from(selectedMarkets));
    
    if (error) {
      alert(error.message);
    } else {
      await refetchMarkets();
      setSelectedMarkets(new Set());
    }
  }

  /* ----- CRUD: Items ----- */
  async function createItem(name, mvStr) {
    if (!name?.trim()) return false;
    const market_value_cents = moneyToCents(mvStr);
    const { error } = await supabase
      .from("items")
      .insert({ name: name.trim(), market_value_cents });
    if (!error) await refetchItems();
    return !error;
  }
  async function updateItem(id, name, mvStr) {
    const market_value_cents = moneyToCents(mvStr);
    const { error } = await supabase
      .from("items")
      .update({ name, market_value_cents })
      .eq("id", id);
    if (!error) await refetchItems();
    return !error;
  }
  async function deleteItem(id) {
    if (!confirm("Delete this item?")) return;
    const { error } = await supabase.from("items").delete().eq("id", id);
    if (error) alert(error.message);
    else await refetchItems();
  }

  /* ----- CRUD: Retailers ----- */
  async function createRetailer(name) {
    if (!name?.trim()) return false;
    const { error } = await supabase
      .from("retailers")
      .insert({ name: name.trim() });
    if (!error) await refetchRetailers();
    return !error;
  }
  async function updateRetailer(id, name) {
    const { error } = await supabase
      .from("retailers")
      .update({ name })
      .eq("id", id);
    if (!error) await refetchRetailers();
    return !error;
  }
  async function deleteRetailer(id) {
    if (!confirm("Delete this retailer?")) return;
    const { error } = await supabase.from("retailers").delete().eq("id", id);
    if (error) alert(error.message);
    else await refetchRetailers();
  }

  /* ----- CRUD: Marketplaces ----- */
  async function createMarket(name, feeStr) {
    const feeNum = Number(String(feeStr ?? "").replace("%", ""));
    const default_fee_pct = isNaN(feeNum) ? 0 : feeNum > 1 ? feeNum / 100 : feeNum;
    if (!name?.trim()) return false;
    const { error } = await supabase
      .from("marketplaces")
      .insert({ name: name.trim(), default_fees_pct: default_fee_pct });
    if (!error) await refetchMarkets();
    return !error;
  }
  async function updateMarket(id, name, feeStr) {
    const feeNum = Number(String(feeStr ?? "").replace("%", ""));
    const default_fee_pct = isNaN(feeNum) ? 0 : feeNum > 1 ? feeNum / 100 : feeNum;
    const { error } = await supabase
      .from("marketplaces")
      .update({ name, default_fees_pct: default_fee_pct })
      .eq("id", id);
    if (!error) await refetchMarkets();
    return !error;
  }
  async function deleteMarket(id) {
    if (!confirm("Delete this marketplace?")) return;
    const { error } = await supabase.from("marketplaces").delete().eq("id", id);
    if (error) alert(error.message);
    else await refetchMarkets();
  }

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100">
      <div className="max-w-[95vw] mx-auto p-4 sm:p-6">
        <HeaderWithTabs active="database" showTabs section="orderbook" showHubTab={true} />

        {/* OrderBook-style unified interface */}
        <div className={`${pageCard} overflow-hidden`}>
          {/* Bulk Actions Bar - OrderBook style */}
          {bulkActionsVisible && (
            <div className="px-4 py-3 border-b border-slate-800 bg-slate-800/30">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    checked={selectedRows.size === (items.length + retailers.length + markets.length) && (items.length + retailers.length + markets.length) > 0}
                    onChange={toggleAllSelection}
                    className="h-4 w-4 rounded border-slate-500 bg-slate-800/60 text-indigo-500 focus:ring-indigo-400 focus:ring-2 transition-all"
                  />
                  <span className="text-sm font-semibold text-slate-400">
                    {selectedRows.size}/{items.length + retailers.length + markets.length} Selected
                  </span>
                </div>

                <div className="flex items-center gap-2">
                  {/* Determine button visibility based on selection state */}
                  {(() => {
                    const hasSelection = selectedRows.size > 0;
                    const selectedItems = Array.from(selectedRows);
                    const hasNewRowsInSelection = selectedItems.some(id => id < 0);
                    const hasExistingRows = selectedItems.some(id => id > 0);
                    
                    // Default state: no selection - show only + add buttons
                    if (!hasSelection) {
                      return (
                        <>
                          <button
                            onClick={() => addNewRow('item')}
                            className="px-3 py-1 text-xs bg-slate-700 hover:bg-slate-600 text-slate-300 rounded-lg transition-colors"
                          >
                            + Add Item
                          </button>
                          <button
                            onClick={() => addNewRow('retailer')}
                            className="px-3 py-1 text-xs bg-slate-700 hover:bg-slate-600 text-slate-300 rounded-lg transition-colors"
                          >
                            + Add Retailer
                          </button>
                          <button
                            onClick={() => addNewRow('market')}
                            className="px-3 py-1 text-xs bg-slate-700 hover:bg-slate-600 text-slate-300 rounded-lg transition-colors"
                          >
                            + Add Marketplace
                          </button>
                        </>
                      );
                    }
                    
                    // New rows selected: show X cancel, save, and delete buttons
                    if (hasNewRowsInSelection) {
                      return (
                        <>
                          <button
                            onClick={cancelNewRows}
                            className="px-3 py-1 text-xs bg-slate-700 hover:bg-slate-600 text-slate-300 rounded-lg transition-colors"
                          >
                            ✕ Cancel
                          </button>
                          <button
                            onClick={bulkSaveSelected}
                            className="px-3 py-1 text-xs bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg transition-colors"
                          >
                            Save
                          </button>
                        </>
                      );
                    }
                    
                    // Existing rows selected: show X cancel, save, and delete buttons
                    if (hasExistingRows) {
                      return (
                        <>
                          <button
                            onClick={() => setSelectedRows(new Set())}
                            className="px-3 py-1 text-xs bg-slate-700 hover:bg-slate-600 text-slate-300 rounded-lg transition-colors"
                          >
                            ✕ Cancel
                          </button>
                          <button
                            onClick={bulkSaveSelected}
                            className="px-3 py-1 text-xs bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg transition-colors"
                          >
                            Save
                          </button>
                          <button
                            onClick={bulkDeleteSelected}
                            className="px-3 py-1 text-xs bg-rose-600 hover:bg-rose-500 text-white rounded-lg transition-colors"
                          >
                            Delete
                          </button>
                        </>
                      );
                    }
                    
                    return null;
                  })()}
                </div>
              </div>
            </div>
          )}

          {/* Header */}
          <div className="grid grid-cols-[auto_2fr_1fr] gap-4 px-4 py-3 border-b border-slate-800 text-xs text-slate-400 font-medium">
            <div className="w-6"></div>
            <div className="text-left">Name</div>
            <div className="text-left">Details</div>
          </div>

          {/* Rows */}
          <div className="space-y-2">
            {/* New rows first */}
            {newRows.map((newRow) => (
              <NewRowComponent
                key={newRow.id}
                row={newRow}
                isSelected={selectedRows.has(newRow.id)}
                onToggleSelection={() => toggleRowSelection(newRow.id)}
                onSave={(data) => {
                  // Handle saving new row
                  console.log('Saving new row:', data);
                  setNewRows(prev => prev.filter(row => row.id !== newRow.id));
                  setSelectedRows(new Set());
                  // Refresh appropriate data
                  if (newRow.type === 'item') refetchItems();
                  if (newRow.type === 'retailer') refetchRetailers();
                  if (newRow.type === 'market') refetchMarkets();
                }}
                onCancel={() => {
                  setNewRows(prev => prev.filter(row => row.id !== newRow.id));
                  setSelectedRows(new Set());
                }}
              />
            ))}

            {/* Existing items */}
            {items.map((item) => (
              <ItemRow
                key={item.id}
                item={item}
                isSelected={selectedRows.has(item.id)}
                onToggleSelection={() => toggleRowSelection(item.id)}
                onSave={() => refetchItems()}
              />
            ))}

            {/* Existing retailers */}
            {retailers.map((retailer) => (
              <RetailerRow
                key={retailer.id}
                retailer={retailer}
                isSelected={selectedRows.has(retailer.id)}
                onToggleSelection={() => toggleRowSelection(retailer.id)}
                onSave={() => refetchRetailers()}
              />
            ))}

            {/* Existing markets */}
            {markets.map((market) => (
              <MarketRow
                key={market.id}
                market={market}
                isSelected={selectedRows.has(market.id)}
                onToggleSelection={() => toggleRowSelection(market.id)}
                onSave={() => refetchMarkets()}
              />
            ))}

            {items.length === 0 && retailers.length === 0 && markets.length === 0 && newRows.length === 0 && (
              <div className="px-4 py-8 text-center text-slate-400">
                No items found. Click the + buttons above to add new items.
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

/* ---------- Components ---------- */

function ChevronDown({ className = "h-5 w-5" }) {
  return (
    <svg viewBox="0 0 24 24" className={className} fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M6 9l6 6 6-6" />
    </svg>
  );
}

/* ---------- OrderBook-style Row Components ---------- */

function NewRowComponent({ row, isSelected, onToggleSelection, onSave, onCancel }) {
  const [name, setName] = useState("");
  const [details, setDetails] = useState("");
  const [status, setStatus] = useState("");
  const [busy, setBusy] = useState(false);

  const handleSave = async () => {
    if (busy) return;
    setBusy(true);
    setStatus("Saving…");
    
    try {
      if (row.type === 'item') {
        const market_value_cents = moneyToCents(details);
        const { error } = await supabase
          .from("items")
          .insert({ name: name.trim(), market_value_cents });
        if (error) throw error;
      } else if (row.type === 'retailer') {
        const { error } = await supabase
          .from("retailers")
          .insert({ name: name.trim() });
        if (error) throw error;
      } else if (row.type === 'market') {
        const feeNum = Number(String(details ?? "").replace("%", ""));
        const default_fees_pct = isNaN(feeNum) ? 0 : feeNum > 1 ? feeNum / 100 : feeNum;
        const { error } = await supabase
          .from("marketplaces")
          .insert({ name: name.trim(), default_fees_pct });
        if (error) throw error;
      }
      
      setStatus("Saved ✓");
      setTimeout(() => {
        onSave({ name, details });
      }, 500);
    } catch (e) {
      setStatus(String(e.message || e));
      setTimeout(() => setStatus(""), 2000);
    } finally {
      setBusy(false);
    }
  };

  const getPlaceholder = () => {
    switch (row.type) {
      case 'item': return 'Item name';
      case 'retailer': return 'Retailer name';
      case 'market': return 'Marketplace name';
      default: return 'Name';
    }
  };

  const getDetailsPlaceholder = () => {
    switch (row.type) {
      case 'item': return 'Market value ($)';
      case 'retailer': return '';
      case 'market': return 'Fee %';
      default: return 'Details';
    }
  };

  return (
    <div 
      className={`rounded-xl border bg-slate-900/60 p-3 overflow-hidden transition cursor-pointer ${
        isSelected
          ? 'border-indigo-500 bg-indigo-500/10' 
          : 'border-slate-800 hover:bg-slate-800/50'
      }`}
      onClick={onToggleSelection}
    >
      <div className="grid grid-cols-[auto_2fr_1fr] gap-4 items-center min-w-0">
        <input
          type="checkbox"
          checked={isSelected}
          onChange={(e) => {
            e.stopPropagation();
            onToggleSelection();
          }}
          className="h-4 w-4 rounded border-slate-500 bg-slate-800/60 text-indigo-500 focus:ring-indigo-400 focus:ring-2 transition-all"
        />
        
        <input
          className="bg-slate-800/30 border border-slate-600/50 rounded-lg px-2 py-2 text-sm text-slate-100 focus:border-indigo-500 focus:outline-none w-full"
          value={name}
          onChange={(e) => {
            e.stopPropagation();
            setName(e.target.value);
          }}
          onClick={(e) => e.stopPropagation()}
          placeholder={getPlaceholder()}
        />
        
        {row.type !== 'retailer' && (
          <input
            className="bg-slate-800/30 border border-slate-600/50 rounded-lg px-2 py-2 text-sm text-slate-100 focus:border-indigo-500 focus:outline-none w-full"
            value={details}
            onChange={(e) => {
              e.stopPropagation();
              setDetails(e.target.value);
            }}
            onClick={(e) => e.stopPropagation()}
            placeholder={getDetailsPlaceholder()}
          />
        )}
        
        {row.type === 'retailer' && (
          <div className="flex gap-2">
            <button
              onClick={(e) => {
                e.stopPropagation();
                handleSave();
              }}
              disabled={busy || !name.trim()}
              className="px-3 py-1 text-xs bg-emerald-600 hover:bg-emerald-500 disabled:bg-slate-600 disabled:cursor-not-allowed text-white rounded-lg transition-colors"
            >
              {busy ? "Saving..." : "Save"}
            </button>
            <button
              onClick={(e) => {
                e.stopPropagation();
                onCancel();
              }}
              className="px-3 py-1 text-xs bg-slate-600 hover:bg-slate-500 text-white rounded-lg transition-colors"
            >
              Cancel
            </button>
          </div>
        )}
      </div>
      
      {status && (
        <div
          className={`text-right text-sm mt-1 ${
            status.startsWith("Saved")
              ? "text-emerald-400"
              : "text-rose-400"
          }`}
        >
          {status}
        </div>
      )}
    </div>
  );
}

function ItemRow({ item, isSelected, onToggleSelection, onSave }) {
  const [name, setName] = useState(item?.name ?? "");
  const [mv, setMv] = useState(centsToStr(item?.market_value_cents ?? 0));
  const [status, setStatus] = useState("");
  const [busy, setBusy] = useState(false);

  async function updateItem() {
    if (busy) return;
    setBusy(true);
    setStatus("Saving…");
    try {
      const market_value_cents = moneyToCents(mv);
      const { error } = await supabase
        .from("items")
        .update({ name: name.trim(), market_value_cents })
        .eq("id", item.id);
      if (error) throw error;
      setStatus("Saved ✓");
      setTimeout(() => setStatus(""), 1500);
      onSave();
    } catch (e) {
      setStatus(String(e.message || e));
      setTimeout(() => setStatus(""), 2000);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div 
      className={`rounded-xl border bg-slate-900/60 p-3 overflow-hidden transition cursor-pointer ${
        isSelected
          ? 'border-indigo-500 bg-indigo-500/10' 
          : 'border-slate-800 hover:bg-slate-800/50'
      }`}
      onClick={onToggleSelection}
    >
      <div className="grid grid-cols-[auto_2fr_1fr] gap-4 items-center min-w-0">
        <input
          type="checkbox"
          checked={isSelected}
          onChange={(e) => {
            e.stopPropagation();
            onToggleSelection();
          }}
          className="h-4 w-4 rounded border-slate-500 bg-slate-800/60 text-indigo-500 focus:ring-indigo-400 focus:ring-2 transition-all"
        />
        
        <input
          className="bg-slate-800/30 border border-slate-600/50 rounded-lg px-2 py-2 text-sm text-slate-100 focus:border-indigo-500 focus:outline-none w-full"
          value={name}
          onChange={(e) => {
            e.stopPropagation();
            setName(e.target.value);
          }}
          onBlur={updateItem}
          onClick={(e) => e.stopPropagation()}
          placeholder="Item name…"
        />
        
        <input
          className="bg-slate-800/30 border border-slate-600/50 rounded-lg px-2 py-2 text-sm text-slate-100 focus:border-indigo-500 focus:outline-none w-full"
          value={mv}
          onChange={(e) => {
            e.stopPropagation();
            setMv(e.target.value);
          }}
          onBlur={updateItem}
          onClick={(e) => e.stopPropagation()}
          placeholder="Market value ($)"
        />
      </div>
      
      {status && (
        <div
          className={`text-right text-sm mt-1 ${
            status.startsWith("Saved")
              ? "text-emerald-400"
              : "text-rose-400"
          }`}
        >
          {status}
        </div>
      )}
    </div>
  );
}

function RetailerRow({ retailer, isSelected, onToggleSelection, onSave }) {
  const [name, setName] = useState(retailer?.name ?? "");
  const [status, setStatus] = useState("");
  const [busy, setBusy] = useState(false);

  async function updateRetailer() {
    if (busy) return;
    setBusy(true);
    setStatus("Saving…");
    try {
      const { error } = await supabase
        .from("retailers")
        .update({ name: name.trim() })
        .eq("id", retailer.id);
      if (error) throw error;
      setStatus("Saved ✓");
      setTimeout(() => setStatus(""), 1500);
      onSave();
    } catch (e) {
      setStatus(String(e.message || e));
      setTimeout(() => setStatus(""), 2000);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div 
      className={`rounded-xl border bg-slate-900/60 p-3 overflow-hidden transition cursor-pointer ${
        isSelected
          ? 'border-indigo-500 bg-indigo-500/10' 
          : 'border-slate-800 hover:bg-slate-800/50'
      }`}
      onClick={onToggleSelection}
    >
      <div className="grid grid-cols-[auto_2fr_1fr] gap-4 items-center min-w-0">
        <input
          type="checkbox"
          checked={isSelected}
          onChange={(e) => {
            e.stopPropagation();
            onToggleSelection();
          }}
          className="h-4 w-4 rounded border-slate-500 bg-slate-800/60 text-indigo-500 focus:ring-indigo-400 focus:ring-2 transition-all"
        />
        
        <input
          className="bg-slate-800/30 border border-slate-600/50 rounded-lg px-2 py-2 text-sm text-slate-100 focus:border-indigo-500 focus:outline-none w-full"
          value={name}
          onChange={(e) => {
            e.stopPropagation();
            setName(e.target.value);
          }}
          onBlur={updateRetailer}
          onClick={(e) => e.stopPropagation()}
          placeholder="Retailer name…"
        />
        
        <div></div>
      </div>
      
      {status && (
        <div
          className={`text-right text-sm mt-1 ${
            status.startsWith("Saved")
              ? "text-emerald-400"
              : "text-rose-400"
          }`}
        >
          {status}
        </div>
      )}
    </div>
  );
}

function MarketRow({ market, isSelected, onToggleSelection, onSave }) {
  const [name, setName] = useState(market?.name ?? "");
  const [fee, setFee] = useState(((market?.default_fees_pct ?? 0) * 100).toString());
  const [status, setStatus] = useState("");
  const [busy, setBusy] = useState(false);

  async function updateMarket() {
    if (busy) return;
    setBusy(true);
    setStatus("Saving…");
    try {
      const default_fees_pct = parseFloat(fee) / 100;
      const { error } = await supabase
        .from("marketplaces")
        .update({ name: name.trim(), default_fees_pct })
        .eq("id", market.id);
      if (error) throw error;
      setStatus("Saved ✓");
      setTimeout(() => setStatus(""), 1500);
      onSave();
    } catch (e) {
      setStatus(String(e.message || e));
      setTimeout(() => setStatus(""), 2000);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div 
      className={`rounded-xl border bg-slate-900/60 p-3 overflow-hidden transition cursor-pointer ${
        isSelected
          ? 'border-indigo-500 bg-indigo-500/10' 
          : 'border-slate-800 hover:bg-slate-800/50'
      }`}
      onClick={onToggleSelection}
    >
      <div className="grid grid-cols-[auto_2fr_1fr] gap-4 items-center min-w-0">
        <input
          type="checkbox"
          checked={isSelected}
          onChange={(e) => {
            e.stopPropagation();
            onToggleSelection();
          }}
          className="h-4 w-4 rounded border-slate-500 bg-slate-800/60 text-indigo-500 focus:ring-indigo-400 focus:ring-2 transition-all"
        />
        
        <input
          className="bg-slate-800/30 border border-slate-600/50 rounded-lg px-2 py-2 text-sm text-slate-100 focus:border-indigo-500 focus:outline-none w-full"
          value={name}
          onChange={(e) => {
            e.stopPropagation();
            setName(e.target.value);
          }}
          onBlur={updateMarket}
          onClick={(e) => e.stopPropagation()}
          placeholder="Marketplace name…"
        />
        
        <input
          className="bg-slate-800/30 border border-slate-600/50 rounded-lg px-2 py-2 text-sm text-slate-100 focus:border-indigo-500 focus:outline-none w-full"
          value={fee}
          onChange={(e) => {
            e.stopPropagation();
            setFee(e.target.value);
          }}
          onBlur={updateMarket}
          onClick={(e) => e.stopPropagation()}
          placeholder="Fee %"
        />
      </div>
      
      {status && (
        <div
          className={`text-right text-sm mt-1 ${
            status.startsWith("Saved")
              ? "text-emerald-400"
              : "text-rose-400"
          }`}
        >
          {status}
        </div>
      )}
    </div>
  );
}
