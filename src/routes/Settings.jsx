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

  // Separate state for each card (OrderBook-style)
  const [selectedItems, setSelectedItems] = useState(new Set());
  const [selectedRetailers, setSelectedRetailers] = useState(new Set());
  const [selectedMarkets, setSelectedMarkets] = useState(new Set());
  
  const [newItemRows, setNewItemRows] = useState([]);
  const [newRetailerRows, setNewRetailerRows] = useState([]);
  const [newMarketRows, setNewMarketRows] = useState([]);
  
  const [nextNewRowId, setNextNewRowId] = useState(-1);
  
  // Single card expansion state
  const [expandedCard, setExpandedCard] = useState(null); // 'items', 'retailers', 'markets', or null

  // Update bulk actions visibility for each card
  useEffect(() => {
    // Each card manages its own bulk actions visibility
  }, [selectedItems, selectedRetailers, selectedMarkets]);

  // Helper functions to check if there are new rows in each system
  const hasNewItemRows = newItemRows.length > 0;
  const hasNewRetailerRows = newRetailerRows.length > 0;
  const hasNewMarketRows = newMarketRows.length > 0;

  /* ----- Items Card Operations ----- */
  function toggleItemSelection(rowId) {
    const newSelected = new Set(selectedItems);
    if (newSelected.has(rowId)) {
      const isNewRow = rowId < 0;
      if (isNewRow) return; // Don't allow deselection of new rows
      newSelected.delete(rowId);
    } else {
      if (hasNewItemRows) {
        setSelectedItems(new Set([rowId]));
        return;
      }
      newSelected.add(rowId);
    }
    setSelectedItems(newSelected);
  }

  function toggleAllItemsSelection() {
    if (selectedItems.size === items.length) {
      if (hasNewItemRows) return;
      setSelectedItems(new Set());
    } else {
      setSelectedItems(new Set(items.map(item => item.id)));
    }
  }

  async function bulkSaveItems() {
    if (selectedItems.size === 0) return;
    
    const selectedIds = Array.from(selectedItems);
    const selectedItemsData = items.filter(item => selectedIds.includes(item.id));
    const itemNames = selectedItemsData.map(item => item.name).join(', ');
    
    const confirmMessage = `Save changes to ${selectedItems.size} item(s)?\n\nItems: ${itemNames}`;
    if (!confirm(confirmMessage)) return;
    
    alert(`Saving ${selectedItems.size} selected items...`);
    setSelectedItems(new Set());
  }

  async function bulkDeleteItems() {
    if (selectedItems.size === 0) return;
    
    const selectedIds = Array.from(selectedItems).filter(id => id > 0);
    const selectedItemsData = items.filter(item => selectedIds.includes(item.id));
    const itemNames = selectedItemsData.map(item => item.name).join(', ');
    
    const confirmMessage = `Delete ${selectedItems.size} item(s)? This action cannot be undone.\n\nItems: ${itemNames}`;
    if (!confirm(confirmMessage)) return;
    
    if (selectedIds.length > 0) {
      const { error } = await supabase.from("items").delete().in("id", selectedIds);
      if (error) throw error;
      await refetchItems();
    }
    setSelectedItems(new Set());
    setNewItemRows([]);
  }

  function cancelNewItemRows() {
    setNewItemRows([]);
    setSelectedItems(new Set());
  }

  function addNewItemRow() {
    const newId = nextNewRowId;
    setNextNewRowId(newId - 1);
    setNewItemRows(prev => [...prev, { id: newId, type: 'item', isNew: true }]);
    setSelectedItems(new Set([newId]));
  }

  /* ----- Retailers Card Operations ----- */
  function toggleRetailerSelection(rowId) {
    const newSelected = new Set(selectedRetailers);
    if (newSelected.has(rowId)) {
      const isNewRow = rowId < 0;
      if (isNewRow) return;
      newSelected.delete(rowId);
    } else {
      if (hasNewRetailerRows) {
        setSelectedRetailers(new Set([rowId]));
        return;
      }
      newSelected.add(rowId);
    }
    setSelectedRetailers(newSelected);
  }

  function toggleAllRetailersSelection() {
    if (selectedRetailers.size === retailers.length) {
      if (hasNewRetailerRows) return;
      setSelectedRetailers(new Set());
    } else {
      setSelectedRetailers(new Set(retailers.map(retailer => retailer.id)));
    }
  }

  async function bulkSaveRetailers() {
    if (selectedRetailers.size === 0) return;
    
    const selectedIds = Array.from(selectedRetailers);
    const selectedRetailersData = retailers.filter(retailer => selectedIds.includes(retailer.id));
    const retailerNames = selectedRetailersData.map(retailer => retailer.name).join(', ');
    
    const confirmMessage = `Save changes to ${selectedRetailers.size} retailer(s)?\n\nRetailers: ${retailerNames}`;
    if (!confirm(confirmMessage)) return;
    
    alert(`Saving ${selectedRetailers.size} selected retailers...`);
    setSelectedRetailers(new Set());
  }

  async function bulkDeleteRetailers() {
    if (selectedRetailers.size === 0) return;
    
    const selectedIds = Array.from(selectedRetailers).filter(id => id > 0);
    const selectedRetailersData = retailers.filter(retailer => selectedIds.includes(retailer.id));
    const retailerNames = selectedRetailersData.map(retailer => retailer.name).join(', ');
    
    const confirmMessage = `Delete ${selectedRetailers.size} retailer(s)? This action cannot be undone.\n\nRetailers: ${retailerNames}`;
    if (!confirm(confirmMessage)) return;
    
    if (selectedIds.length > 0) {
      const { error } = await supabase.from("retailers").delete().in("id", selectedIds);
      if (error) throw error;
      await refetchRetailers();
    }
    setSelectedRetailers(new Set());
    setNewRetailerRows([]);
  }

  function cancelNewRetailerRows() {
    setNewRetailerRows([]);
    setSelectedRetailers(new Set());
  }

  function addNewRetailerRow() {
    const newId = nextNewRowId;
    setNextNewRowId(newId - 1);
    setNewRetailerRows(prev => [...prev, { id: newId, type: 'retailer', isNew: true }]);
    setSelectedRetailers(new Set([newId]));
  }

  /* ----- Markets Card Operations ----- */
  function toggleMarketSelection(rowId) {
    const newSelected = new Set(selectedMarkets);
    if (newSelected.has(rowId)) {
      const isNewRow = rowId < 0;
      if (isNewRow) return;
      newSelected.delete(rowId);
    } else {
      if (hasNewMarketRows) {
        setSelectedMarkets(new Set([rowId]));
        return;
      }
      newSelected.add(rowId);
    }
    setSelectedMarkets(newSelected);
  }

  function toggleAllMarketsSelection() {
    if (selectedMarkets.size === markets.length) {
      if (hasNewMarketRows) return;
      setSelectedMarkets(new Set());
    } else {
      setSelectedMarkets(new Set(markets.map(market => market.id)));
    }
  }

  async function bulkSaveMarkets() {
    if (selectedMarkets.size === 0) return;
    
    const selectedIds = Array.from(selectedMarkets);
    const selectedMarketsData = markets.filter(market => selectedIds.includes(market.id));
    const marketNames = selectedMarketsData.map(market => market.name).join(', ');
    
    const confirmMessage = `Save changes to ${selectedMarkets.size} marketplace(s)?\n\nMarketplaces: ${marketNames}`;
    if (!confirm(confirmMessage)) return;
    
    alert(`Saving ${selectedMarkets.size} selected marketplaces...`);
    setSelectedMarkets(new Set());
  }

  async function bulkDeleteMarkets() {
    if (selectedMarkets.size === 0) return;
    
    const selectedIds = Array.from(selectedMarkets).filter(id => id > 0);
    const selectedMarketsData = markets.filter(market => selectedIds.includes(market.id));
    const marketNames = selectedMarketsData.map(market => market.name).join(', ');
    
    const confirmMessage = `Delete ${selectedMarkets.size} marketplace(s)? This action cannot be undone.\n\nMarketplaces: ${marketNames}`;
    if (!confirm(confirmMessage)) return;
    
    if (selectedIds.length > 0) {
      const { error } = await supabase.from("marketplaces").delete().in("id", selectedIds);
      if (error) throw error;
      await refetchMarkets();
    }
    setSelectedMarkets(new Set());
    setNewMarketRows([]);
  }

  function cancelNewMarketRows() {
    setNewMarketRows([]);
    setSelectedMarkets(new Set());
  }

  function addNewMarketRow() {
    const newId = nextNewRowId;
    setNextNewRowId(newId - 1);
    setNewMarketRows(prev => [...prev, { id: newId, type: 'market', isNew: true }]);
    setSelectedMarkets(new Set([newId]));
  }

  /* ----- Clear Selection Functions ----- */
  function clearItemsSelection() {
    setSelectedItems(new Set());
  }

  function clearRetailersSelection() {
    setSelectedRetailers(new Set());
  }

  function clearMarketsSelection() {
    setSelectedMarkets(new Set());
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

        {/* Items Card */}
        <SettingsCard
          title="Products"
          totalCount={items.length}
          selectedRows={selectedItems}
          newRows={newItemRows}
          hasNewRows={hasNewItemRows}
          toggleAllSelection={toggleAllItemsSelection}
          bulkSave={bulkSaveItems}
          bulkDelete={bulkDeleteItems}
          cancelNewRows={cancelNewItemRows}
          addNewRow={addNewItemRow}
          clearSelection={clearItemsSelection}
          data={items}
          newRowsData={newItemRows}
          onRowToggle={toggleItemSelection}
          onNewRowSave={(data) => {
            setNewItemRows(prev => prev.filter(row => row.id !== data.id));
            setSelectedItems(new Set());
            refetchItems();
          }}
          onNewRowCancel={(data) => {
            setNewItemRows(prev => prev.filter(row => row.id !== data.id));
            setSelectedItems(new Set());
          }}
          renderRow={(item) => (
            <ItemRow
              key={item.id}
              item={item}
              isSelected={selectedItems.has(item.id)}
              onToggleSelection={() => toggleItemSelection(item.id)}
              onSave={() => refetchItems()}
              disabled={hasNewItemRows}
            />
          )}
          renderNewRow={(newRow) => (
            <NewRowComponent
              key={newRow.id}
              row={newRow}
              isSelected={selectedItems.has(newRow.id)}
              onToggleSelection={() => toggleItemSelection(newRow.id)}
              onSave={(data) => {
                setNewItemRows(prev => prev.filter(row => row.id !== newRow.id));
                setSelectedItems(new Set());
                refetchItems();
              }}
              onCancel={() => {
                setNewItemRows(prev => prev.filter(row => row.id !== newRow.id));
                setSelectedItems(new Set());
              }}
            />
          )}
          cardType="items"
          isExpanded={expandedCard === 'items'}
          onToggleExpansion={() => setExpandedCard(expandedCard === 'items' ? null : 'items')}
        />

        {/* Retailers Card */}
        <SettingsCard
          title="Retailers"
          totalCount={retailers.length}
          selectedRows={selectedRetailers}
          newRows={newRetailerRows}
          hasNewRows={hasNewRetailerRows}
          toggleAllSelection={toggleAllRetailersSelection}
          bulkSave={bulkSaveRetailers}
          bulkDelete={bulkDeleteRetailers}
          cancelNewRows={cancelNewRetailerRows}
          addNewRow={addNewRetailerRow}
          clearSelection={clearRetailersSelection}
          data={retailers}
          newRowsData={newRetailerRows}
          onRowToggle={toggleRetailerSelection}
          renderRow={(retailer) => (
            <RetailerRow
              key={retailer.id}
              retailer={retailer}
              isSelected={selectedRetailers.has(retailer.id)}
              onToggleSelection={() => toggleRetailerSelection(retailer.id)}
              onSave={() => refetchRetailers()}
              disabled={hasNewRetailerRows}
            />
          )}
          renderNewRow={(newRow) => (
            <NewRowComponent
              key={newRow.id}
              row={newRow}
              isSelected={selectedRetailers.has(newRow.id)}
              onToggleSelection={() => toggleRetailerSelection(newRow.id)}
              onSave={(data) => {
                setNewRetailerRows(prev => prev.filter(row => row.id !== newRow.id));
                setSelectedRetailers(new Set());
                refetchRetailers();
              }}
              onCancel={() => {
                setNewRetailerRows(prev => prev.filter(row => row.id !== newRow.id));
                setSelectedRetailers(new Set());
              }}
            />
          )}
          cardType="retailers"
          isExpanded={expandedCard === 'retailers'}
          onToggleExpansion={() => setExpandedCard(expandedCard === 'retailers' ? null : 'retailers')}
        />

        {/* Markets Card */}
        <SettingsCard
          title="Marketplaces"
          totalCount={markets.length}
          selectedRows={selectedMarkets}
          newRows={newMarketRows}
          hasNewRows={hasNewMarketRows}
          toggleAllSelection={toggleAllMarketsSelection}
          bulkSave={bulkSaveMarkets}
          bulkDelete={bulkDeleteMarkets}
          cancelNewRows={cancelNewMarketRows}
          addNewRow={addNewMarketRow}
          clearSelection={clearMarketsSelection}
          data={markets}
          newRowsData={newMarketRows}
          onRowToggle={toggleMarketSelection}
          renderRow={(market) => (
            <MarketRow
              key={market.id}
              market={market}
              isSelected={selectedMarkets.has(market.id)}
              onToggleSelection={() => toggleMarketSelection(market.id)}
              onSave={() => refetchMarkets()}
              disabled={hasNewMarketRows}
            />
          )}
          renderNewRow={(newRow) => (
            <NewRowComponent
              key={newRow.id}
              row={newRow}
              isSelected={selectedMarkets.has(newRow.id)}
              onToggleSelection={() => toggleMarketSelection(newRow.id)}
              onSave={(data) => {
                setNewMarketRows(prev => prev.filter(row => row.id !== newRow.id));
                setSelectedMarkets(new Set());
                refetchMarkets();
              }}
              onCancel={() => {
                setNewMarketRows(prev => prev.filter(row => row.id !== newRow.id));
                setSelectedMarkets(new Set());
              }}
            />
          )}
          cardType="markets"
          isExpanded={expandedCard === 'markets'}
          onToggleExpansion={() => setExpandedCard(expandedCard === 'markets' ? null : 'markets')}
        />
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

function SettingsCard({ 
  title, 
  totalCount, 
  selectedRows, 
  newRows, 
  hasNewRows, 
  toggleAllSelection, 
  bulkSave, 
  bulkDelete, 
  cancelNewRows, 
  addNewRow, 
  clearSelection,
  data, 
  newRowsData, 
  onRowToggle, 
  renderRow, 
  renderNewRow,
  cardType,
  isExpanded,
  onToggleExpansion
}) {
  
  const hasSelection = selectedRows.size > 0;
  const selectedItems = Array.from(selectedRows);
  const hasNewRowsInSelection = selectedItems.some(id => id < 0);
  const hasExistingRows = selectedItems.some(id => id > 0);

  return (
    <section className={`${pageCard} mb-6`}>
      {/* Card Header - Clickable anywhere to expand */}
      <div 
        className="flex items-center justify-between gap-3 flex-wrap sm:flex-nowrap cursor-pointer hover:bg-slate-800/30 rounded-xl p-2 -m-2 transition-colors"
        onClick={onToggleExpansion}
      >
        <div className="min-w-0">
          <h2 className="text-lg font-semibold leading-[2.25rem]">{title}</h2>
          <p className="text-xs text-slate-400 -mt-1">Total: {totalCount}</p>
        </div>

        <div 
          className="flex items-center gap-2 ml-auto self-center -mt-2 sm:mt-0"
          onClick={(e) => e.stopPropagation()} // Prevent expansion when clicking buttons
        >
          {/* Action buttons - only show when expanded */}
          {isExpanded && (
            <div className="flex items-center gap-2">
              {/* Show selection count and select all button when expanded */}
              {!hasNewRows && (
                <div className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    checked={selectedRows.size === data.length && data.length > 0}
                    onChange={toggleAllSelection}
                    className="h-4 w-4 rounded border-slate-500 bg-slate-800/60 text-indigo-500 focus:ring-indigo-400 focus:ring-2 transition-all"
                  />
                  <span className="text-sm text-slate-400">
                    {selectedRows.size}/{data.length} selected
                  </span>
                </div>
              )}
              
              {/* Determine button visibility based on selection state */}
              {(() => {
                // New rows selected: show cancel and save buttons
                if (hasNewRowsInSelection) {
                  return (
                    <>
                      <button
                        onClick={cancelNewRows}
                        className="w-10 h-10 rounded-xl border border-slate-600 bg-slate-800/60 hover:bg-slate-700 hover:border-slate-500 text-slate-200 transition-all duration-200 flex items-center justify-center group"
                        title="Cancel Changes"
                      >
                        <svg className="w-4 h-4 transition-transform group-hover:scale-110" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                        </svg>
                      </button>
                      <button
                        onClick={bulkSave}
                        className="w-10 h-10 rounded-xl border border-slate-600 bg-slate-800/60 hover:bg-slate-700 hover:border-slate-500 text-slate-200 transition-all duration-200 flex items-center justify-center group"
                        title="Save Changes"
                      >
                        <svg className="w-4 h-4 transition-transform group-hover:scale-110" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7H5a2 2 0 00-2 2v9a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-3m-1 4l-3 3m0 0l-3-3m3 3V4" />
                        </svg>
                      </button>
                    </>
                  );
                }
                
                // Existing rows selected: show cancel, save, and delete buttons
                if (hasExistingRows) {
                  return (
                    <>
                      <button
                        onClick={clearSelection}
                        className="w-10 h-10 rounded-xl border border-slate-600 bg-slate-800/60 hover:bg-slate-700 hover:border-slate-500 text-slate-200 transition-all duration-200 flex items-center justify-center group"
                        title="Cancel Selection"
                      >
                        <svg className="w-4 h-4 transition-transform group-hover:scale-110" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                        </svg>
                      </button>
                      <button
                        onClick={bulkSave}
                        className="w-10 h-10 rounded-xl border border-slate-600 bg-slate-800/60 hover:bg-slate-700 hover:border-slate-500 text-slate-200 transition-all duration-200 flex items-center justify-center group"
                        title="Save Selected"
                      >
                        <svg className="w-4 h-4 transition-transform group-hover:scale-110" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7H5a2 2 0 00-2 2v9a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-3m-1 4l-3 3m0 0l-3-3m3 3V4" />
                        </svg>
                      </button>
                      <button
                        onClick={bulkDelete}
                        className="w-10 h-10 rounded-xl border border-slate-600 bg-slate-800/60 hover:bg-slate-700 hover:border-slate-500 text-slate-200 transition-all duration-200 flex items-center justify-center group"
                        title="Delete Selected"
                      >
                        <svg className="w-4 h-4 transition-transform group-hover:scale-110" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                        </svg>
                      </button>
                    </>
                  );
                }
                
                // No selection: show add button
                return (
                  <button
                    onClick={addNewRow}
                    className="w-10 h-10 rounded-xl border border-slate-600 bg-slate-800/60 hover:bg-slate-700 hover:border-slate-500 text-slate-200 transition-all duration-200 flex items-center justify-center group"
                    aria-label={`Add ${title.slice(0, -1).toLowerCase()}`}
                    title={`Add ${title.slice(0, -1).toLowerCase()}`}
                  >
                    <svg className="w-4 h-4 transition-transform group-hover:scale-110" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 5v14M5 12h14" />
                    </svg>
                  </button>
                );
              })()}
            </div>
          )}
          
          {/* Expand/Collapse chevron - no button wrapper, just the icon */}
          <ChevronDown className={`h-5 w-5 transition-transform ${isExpanded ? "rotate-180" : ""}`} />
        </div>
      </div>

      {/* Expanded Content */}
      {isExpanded && (
        <div className="pt-5 border-t border-slate-800 mt-4">
          {/* Header */}
          <div className={`grid gap-4 px-4 py-3 border-b border-slate-800 text-xs text-slate-400 font-medium ${
            cardType === 'retailers' 
              ? 'grid-cols-[auto_1fr_auto]' 
              : 'grid-cols-[auto_2fr_1fr]'
          }`}>
            <div className="w-6"></div>
            <div className="text-left">Name</div>
            {cardType !== 'retailers' && <div className="text-left">Details</div>}
            {cardType === 'retailers' && <div className="w-16"></div>}
          </div>

          {/* Rows - No scroll, show all data */}
          <div className="space-y-2">
            {/* New rows first */}
            {newRowsData.map(renderNewRow)}

            {/* Existing rows - hide when new rows are present */}
            {!hasNewRows && data.map(renderRow)}

            {data.length === 0 && newRowsData.length === 0 && (
              <div className="px-4 py-8 text-center text-slate-400">
                No {title.toLowerCase()} yet. Click the + button above to add new {title.slice(0, -1).toLowerCase()}.
              </div>
            )}
          </div>
        </div>
      )}
    </section>
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
                      <div className="text-slate-400 text-xs">
                        Use header buttons to save/cancel
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

function ItemRow({ item, isSelected, onToggleSelection, onSave, disabled = false }) {
  const [name, setName] = useState(item?.name ?? "");
  const [mv, setMv] = useState(centsToStr(item?.market_value_cents ?? 0));
  const [status, setStatus] = useState("");
  const [busy, setBusy] = useState(false);

  async function updateItem() {
    if (busy || disabled) return;
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

  async function deleteItem(id) {
    try {
      const { error } = await supabase.from("items").delete().eq("id", id);
      if (error) throw error;
      onSave();
    } catch (e) {
      alert(`Failed to delete: ${e.message}`);
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
        
        <div className="flex items-center gap-2">
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
          
          {/* Row action buttons */}
          <div className="flex gap-1">
            <button
              onClick={(e) => {
                e.stopPropagation();
                updateItem();
              }}
              disabled={busy}
              className="w-8 h-8 rounded-lg border border-slate-600 bg-slate-800/60 hover:bg-slate-700 hover:border-slate-500 text-slate-200 transition-all duration-200 flex items-center justify-center group disabled:opacity-50 disabled:cursor-not-allowed"
              title="Save Changes"
            >
              <svg className="w-3 h-3 transition-transform group-hover:scale-110" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7H5a2 2 0 00-2 2v9a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-3m-1 4l-3 3m0 0l-3-3m3 3V4" />
              </svg>
            </button>
            <button
              onClick={(e) => {
                e.stopPropagation();
                if (confirm(`Delete "${name}"? This action cannot be undone.`)) {
                  deleteItem(item.id);
                }
              }}
              className="w-8 h-8 rounded-lg border border-slate-600 bg-slate-800/60 hover:bg-slate-700 hover:border-slate-500 text-slate-200 transition-all duration-200 flex items-center justify-center group"
              title="Delete Item"
            >
              <svg className="w-3 h-3 transition-transform group-hover:scale-110" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
              </svg>
            </button>
          </div>
        </div>
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

function RetailerRow({ retailer, isSelected, onToggleSelection, onSave, disabled = false }) {
  const [name, setName] = useState(retailer?.name ?? "");
  const [status, setStatus] = useState("");
  const [busy, setBusy] = useState(false);

  async function updateRetailer() {
    if (busy || disabled) return;
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

  async function deleteRetailer(id) {
    try {
      const { error } = await supabase.from("retailers").delete().eq("id", id);
      if (error) throw error;
      onSave();
    } catch (e) {
      alert(`Failed to delete: ${e.message}`);
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
      <div className="grid grid-cols-[auto_1fr_auto] gap-4 items-center min-w-0">
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
        
        {/* Row action buttons */}
        <div className="flex gap-1">
          <button
            onClick={(e) => {
              e.stopPropagation();
              updateRetailer();
            }}
            disabled={busy}
            className="w-8 h-8 rounded-lg border border-slate-600 bg-slate-800/60 hover:bg-slate-700 hover:border-slate-500 text-slate-200 transition-all duration-200 flex items-center justify-center group disabled:opacity-50 disabled:cursor-not-allowed"
            title="Save Changes"
          >
            <svg className="w-3 h-3 transition-transform group-hover:scale-110" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7H5a2 2 0 00-2 2v9a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-3m-1 4l-3 3m0 0l-3-3m3 3V4" />
            </svg>
          </button>
          <button
            onClick={(e) => {
              e.stopPropagation();
              if (confirm(`Delete "${name}"? This action cannot be undone.`)) {
                deleteRetailer(retailer.id);
              }
            }}
            className="w-8 h-8 rounded-lg border border-slate-600 bg-slate-800/60 hover:bg-slate-700 hover:border-slate-500 text-slate-200 transition-all duration-200 flex items-center justify-center group"
            title="Delete Retailer"
          >
            <svg className="w-3 h-3 transition-transform group-hover:scale-110" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
            </svg>
          </button>
        </div>
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

function MarketRow({ market, isSelected, onToggleSelection, onSave, disabled = false }) {
  const [name, setName] = useState(market?.name ?? "");
  const [fee, setFee] = useState(((market?.default_fees_pct ?? 0) * 100).toString());
  const [status, setStatus] = useState("");
  const [busy, setBusy] = useState(false);

  async function updateMarket() {
    if (busy || disabled) return;
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

  async function deleteMarket(id) {
    try {
      const { error } = await supabase.from("marketplaces").delete().eq("id", id);
      if (error) throw error;
      onSave();
    } catch (e) {
      alert(`Failed to delete: ${e.message}`);
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
        
        <div className="flex items-center gap-2">
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
          
          {/* Row action buttons */}
          <div className="flex gap-1">
            <button
              onClick={(e) => {
                e.stopPropagation();
                updateMarket();
              }}
              disabled={busy}
              className="w-8 h-8 rounded-lg border border-slate-600 bg-slate-800/60 hover:bg-slate-700 hover:border-slate-500 text-slate-200 transition-all duration-200 flex items-center justify-center group disabled:opacity-50 disabled:cursor-not-allowed"
              title="Save Changes"
            >
              <svg className="w-3 h-3 transition-transform group-hover:scale-110" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7H5a2 2 0 00-2 2v9a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-3m-1 4l-3 3m0 0l-3-3m3 3V4" />
              </svg>
            </button>
            <button
              onClick={(e) => {
                e.stopPropagation();
                if (confirm(`Delete "${name}"? This action cannot be undone.`)) {
                  deleteMarket(market.id);
                }
              }}
              className="w-8 h-8 rounded-lg border border-slate-600 bg-slate-800/60 hover:bg-slate-700 hover:border-slate-500 text-slate-200 transition-all duration-200 flex items-center justify-center group"
              title="Delete Marketplace"
            >
              <svg className="w-3 h-3 transition-transform group-hover:scale-110" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
              </svg>
            </button>
          </div>
        </div>
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
