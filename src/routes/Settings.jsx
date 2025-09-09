// src/routes/Settings.jsx
import { useState, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "../lib/supabaseClient";
import HeaderWithTabs from "../components/HeaderWithTabs.jsx";
import { moneyToCents, centsToStr } from "../utils/money.js";
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

  // Single card expansion - only one can be open at a time
  const [openCard, setOpenCard] = useState(null); // 'items', 'retailers', 'markets', or null

  // Bulk selection state for each card
  const [selectedItems, setSelectedItems] = useState(new Set());
  const [selectedRetailers, setSelectedRetailers] = useState(new Set());
  const [selectedMarkets, setSelectedMarkets] = useState(new Set());

  // temp rows when adding - none needed now

  // Helper functions for single card expansion
  const openItems = openCard === 'items';
  const openRetailers = openCard === 'retailers';
  const openMarkets = openCard === 'markets';

  const toggleCard = (cardName) => {
    if (openCard === cardName) {
      setOpenCard(null);
      // Clear selections when closing
      if (cardName === 'items') setSelectedItems(new Set());
      if (cardName === 'retailers') setSelectedRetailers(new Set());
      if (cardName === 'markets') setSelectedMarkets(new Set());
    } else {
      setOpenCard(cardName);
      // Clear other selections when opening a new card
      setSelectedItems(new Set());
      setSelectedRetailers(new Set());
      setSelectedMarkets(new Set());
    }
  };

  /* ----- Bulk Operations ----- */
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
      <div className="max-w-6xl mx-auto p-4 sm:p-6">
        <HeaderWithTabs active="settings" showTabs />

        {/* ---------- Items ---------- */}
        <section className={`${pageCard} mb-6`}>
          <div className="flex items-center justify-between gap-3 flex-wrap sm:flex-nowrap">
            <div className="min-w-0">
              <h2 className="text-lg font-semibold leading-[2.25rem]">Products</h2>
              <p className="text-xs text-slate-400 -mt-1">Total: {items.length}</p>
            </div>

            <div className="flex items-center gap-2 ml-auto self-center -mt-2 sm:mt-0">
              {/* Bulk Actions - only show when items are selected */}
              {openItems && selectedItems.size > 0 && (
                <div className="flex items-center gap-2">
                  <span className="text-sm text-slate-400">
                    {selectedItems.size} selected
                  </span>
                <button
                    onClick={bulkSaveItems}
                    className="h-9 w-9 inline-flex items-center justify-center rounded-xl border border-slate-800 bg-slate-900/60 hover:bg-slate-900 text-slate-100"
                    title="Save selected"
                    aria-label="Save selected"
                  >
                    <svg
                      viewBox="0 0 24 24"
                      className="h-5 w-5"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    >
                      <path d="M20 6L9 17l-5-5" />
                    </svg>
                  </button>
                  <button
                    onClick={bulkDeleteItems}
                    className="h-9 w-9 inline-flex items-center justify-center rounded-xl border border-rose-600 bg-rose-600 hover:bg-rose-500 text-white"
                    title="Delete selected"
                    aria-label="Delete selected"
                  >
                    <svg
                      viewBox="0 0 24 24"
                      className="h-5 w-5"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    >
                      <path d="M3 6h18" />
                      <path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6" />
                      <path d="M10 11v6M14 11v6" />
                      <path d="M9 6V4a2 2 0 0 1 2-2h2a2 2 0 0 1 2 2v2" />
                    </svg>
                  </button>
                </div>
              )}

              {openItems && (
                <button
                  onClick={async () => {
                    try {
                      const { error } = await supabase
                        .from("items")
                        .insert({ name: "New item name here", market_value_cents: 0 });
                      if (error) throw error;
                      await refetchItems();
                    } catch (e) {
                      alert(e.message || String(e));
                    }
                  }}
                  className="h-9 w-9 inline-flex items-center justify-center rounded-xl border border-slate-800 bg-slate-900/60 hover:bg-slate-900 text-slate-100"
                  aria-label="Add item"
                  title="Add item"
                >
                  <svg
                    viewBox="0 0 24 24"
                    className="h-5 w-5"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  >
                    <path d="M12 5v14M5 12h14" />
                  </svg>
                </button>
              )}
              <button
                onClick={() => toggleCard('items')}
                className="h-9 w-9 inline-flex items-center justify-center rounded-xl border border-slate-800 bg-slate-900/60 hover:bg-slate-900 text-slate-100"
                aria-label={openItems ? "Collapse" : "Expand"}
              >
                <ChevronDown className={`h-5 w-5 transition-transform ${openItems ? "rotate-180" : ""}`} />
              </button>
            </div>
          </div>

          {/* content */}
          <div className={`transition-all duration-300 ease-in-out overflow-hidden`} style={{ maxHeight: openItems ? 1000 : 0 }}>
            <div className="pt-5">
              {/* Header row - text only */}
              <div className="hidden sm:block">
                <div className="grid grid-cols-[1fr_160px] gap-2 items-center min-w-0 px-3 py-2 mb-1">
                  <div className="flex items-center gap-2">
                    <div className="w-6 flex items-center justify-center">
                      <input
                        type="checkbox"
                        checked={items.length > 0 && selectedItems.size === items.length}
                        onChange={(e) => {
                          if (e.target.checked) {
                            // Select all items
                            const allItemIds = items.map(item => item.id);
                            setSelectedItems(new Set(allItemIds));
                          } else {
                            // Deselect all items
                            setSelectedItems(new Set());
                          }
                        }}
                        className="h-4 w-4 rounded border-slate-500 bg-slate-800/60 text-indigo-500 focus:ring-indigo-400 focus:ring-2 transition-all"
                      />
                    </div>
                    <span className="text-xs text-slate-300 font-medium">Item</span>
                  </div>
                  <div className="text-xs text-slate-300 font-medium">Market value ($)</div>
                </div>
              </div>

              <div className="space-y-3 max-h-96 overflow-y-auto scrollbar-thin scrollbar-thumb-slate-600 scrollbar-track-slate-800 pr-2">
                {items
                  .sort((a, b) => {
                    // Put new items (with placeholder text) at the top
                    const aIsNew = a.name === "New item name here";
                    const bIsNew = b.name === "New item name here";
                    if (aIsNew && !bIsNew) return -1;
                    if (!aIsNew && bIsNew) return 1;
                    // Then sort alphabetically
                    return a.name.localeCompare(b.name);
                  })
                  .map((it) => (
                  <ItemRow
                    key={it.id}
                    it={it}
                    isNew={it.name === "New item name here"}
                    isSelected={selectedItems.has(it.id)}
                    onToggleSelection={() => {
                      const newSelected = new Set(selectedItems);
                      if (newSelected.has(it.id)) {
                        newSelected.delete(it.id);
                      } else {
                        newSelected.add(it.id);
                      }
                      setSelectedItems(newSelected);
                    }}
                    onDelete={() => deleteItem(it.id)}
                  />
                ))}
                {!items.length && (
                  <div className="text-slate-400">No items yet.</div>
                )}
              </div>
            </div>
          </div>
        </section>

        {/* ---------- Retailers ---------- */}
        <section className={`${pageCard} mb-6`}>
          <div className="flex items-center justify-between gap-3 flex-wrap sm:flex-nowrap">
            <div className="min-w-0">
              <h2 className="text-lg font-semibold leading-[2.25rem]">Retailers</h2>
              <p className="text-xs text-slate-400 -mt-1">Total: {retailers.length}</p>
            </div>

            <div className="flex items-center gap-2 ml-auto self-center -mt-2 sm:mt-0">
              {/* Bulk Actions - only show when retailers are selected */}
              {openRetailers && selectedRetailers.size > 0 && (
                <div className="flex items-center gap-2">
                  <span className="text-sm text-slate-400">
                    {selectedRetailers.size} selected
                  </span>
                <button
                    onClick={bulkSaveRetailers}
                    className="h-9 w-9 inline-flex items-center justify-center rounded-xl border border-slate-800 bg-slate-900/60 hover:bg-slate-900 text-slate-100"
                    title="Save selected"
                    aria-label="Save selected"
                  >
                    <svg
                      viewBox="0 0 24 24"
                      className="h-5 w-5"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    >
                      <path d="M20 6L9 17l-5-5" />
                    </svg>
                  </button>
                  <button
                    onClick={bulkDeleteRetailers}
                    className="h-9 w-9 inline-flex items-center justify-center rounded-xl border border-rose-600 bg-rose-600 hover:bg-rose-500 text-white"
                    title="Delete selected"
                    aria-label="Delete selected"
                  >
                    <svg
                      viewBox="0 0 24 24"
                      className="h-5 w-5"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    >
                      <path d="M3 6h18" />
                      <path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6" />
                      <path d="M10 11v6M14 11v6" />
                      <path d="M9 6V4a2 2 0 0 1 2-2h2a2 2 0 0 1 2 2v2" />
                    </svg>
                  </button>
                </div>
              )}

              {openRetailers && (
                <button
                  onClick={async () => {
                    try {
                      const { error } = await supabase
                        .from("retailers")
                        .insert({ name: "New retailer name here" });
                      if (error) throw error;
                      await refetchRetailers();
                    } catch (e) {
                      alert(e.message || String(e));
                    }
                  }}
                  className="h-9 w-9 inline-flex items-center justify-center rounded-xl border border-slate-800 bg-slate-900/60 hover:bg-slate-900 text-slate-100"
                  aria-label="Add retailer"
                  title="Add retailer"
                >
                  <svg
                    viewBox="0 0 24 24"
                    className="h-5 w-5"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  >
                    <path d="M12 5v14M5 12h14" />
                  </svg>
                </button>
              )}
              <button
                onClick={() => toggleCard('retailers')}
                className="h-9 w-9 inline-flex items-center justify-center rounded-xl border border-slate-800 bg-slate-900/60 hover:bg-slate-900 text-slate-100"
                aria-label={openRetailers ? "Collapse" : "Expand"}
              >
                <ChevronDown className={`h-5 w-5 transition-transform ${openRetailers ? "rotate-180" : ""}`} />
              </button>
            </div>
          </div>

          {/* content */}
          <div className={`transition-all duration-300 ease-in-out overflow-hidden`} style={{ maxHeight: openRetailers ? 1000 : 0 }}>
            <div className="pt-5">
              {/* Header row - text only */}
              <div className="hidden sm:block">
                <div className="grid grid-cols-[1fr] gap-2 items-center min-w-0 px-3 py-2 mb-1">
                  <div className="flex items-center gap-2">
                    <div className="w-6 flex items-center justify-center">
                      <input
                        type="checkbox"
                        checked={retailers.length > 0 && selectedRetailers.size === retailers.length}
                        onChange={(e) => {
                          if (e.target.checked) {
                            // Select all retailers
                            const allRetailerIds = retailers.map(retailer => retailer.id);
                            setSelectedRetailers(new Set(allRetailerIds));
                          } else {
                            // Deselect all retailers
                            setSelectedRetailers(new Set());
                          }
                        }}
                        className="h-4 w-4 rounded border-slate-500 bg-slate-800/60 text-indigo-500 focus:ring-indigo-400 focus:ring-2 transition-all"
                      />
                    </div>
                    <span className="text-xs text-slate-300 font-medium">Retailer</span>
                  </div>
                </div>
              </div>

              <div className="space-y-3 max-h-96 overflow-y-auto scrollbar-thin scrollbar-thumb-slate-600 scrollbar-track-slate-800 pr-2">
                {retailers
                  .sort((a, b) => {
                    // Put new retailers (with placeholder text) at the top
                    const aIsNew = a.name === "New retailer name here";
                    const bIsNew = b.name === "New retailer name here";
                    if (aIsNew && !bIsNew) return -1;
                    if (!aIsNew && bIsNew) return 1;
                    // Then sort alphabetically
                    return a.name.localeCompare(b.name);
                  })
                  .map((r) => (
                  <RetailerRow
                    key={r.id}
                    r={r}
                    isNew={r.name === "New retailer name here"}
                    isSelected={selectedRetailers.has(r.id)}
                    onToggleSelection={() => {
                      const newSelected = new Set(selectedRetailers);
                      if (newSelected.has(r.id)) {
                        newSelected.delete(r.id);
                      } else {
                        newSelected.add(r.id);
                      }
                      setSelectedRetailers(newSelected);
                    }}
                    onDelete={() => deleteRetailer(r.id)}
                  />
                ))}
                {!retailers.length && (
                  <div className="text-slate-400">No retailers yet.</div>
                )}
              </div>
            </div>
          </div>
        </section>

        {/* ---------- Marketplaces ---------- */}
        <section className={`${pageCard}`}>
          <div className="flex items-center justify-between gap-3 flex-wrap sm:flex-nowrap">
            <div className="min-w-0">
              <h2 className="text-lg font-semibold leading-[2.25rem]">Marketplaces</h2>
              <p className="text-xs text-slate-400 -mt-1">Total: {markets.length}</p>
            </div>

            <div className="flex items-center gap-2 ml-auto self-center -mt-2 sm:mt-0">
              {/* Bulk Actions - only show when markets are selected */}
              {openMarkets && selectedMarkets.size > 0 && (
                <div className="flex items-center gap-2">
                  <span className="text-sm text-slate-400">
                    {selectedMarkets.size} selected
                  </span>
                <button
                    onClick={bulkSaveMarkets}
                    className="h-9 w-9 inline-flex items-center justify-center rounded-xl border border-slate-800 bg-slate-900/60 hover:bg-slate-900 text-slate-100"
                    title="Save selected"
                    aria-label="Save selected"
                  >
                    <svg
                      viewBox="0 0 24 24"
                      className="h-5 w-5"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    >
                      <path d="M20 6L9 17l-5-5" />
                    </svg>
                  </button>
                  <button
                    onClick={bulkDeleteMarkets}
                    className="h-9 w-9 inline-flex items-center justify-center rounded-xl border border-rose-600 bg-rose-600 hover:bg-rose-500 text-white"
                    title="Delete selected"
                    aria-label="Delete selected"
                  >
                    <svg
                      viewBox="0 0 24 24"
                      className="h-5 w-5"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    >
                      <path d="M3 6h18" />
                      <path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6" />
                      <path d="M10 11v6M14 11v6" />
                      <path d="M9 6V4a2 2 0 0 1 2-2h2a2 2 0 0 1 2 2v2" />
                    </svg>
                  </button>
                </div>
              )}

              {openMarkets && (
                <button
                  onClick={async () => {
                    try {
                      const { error } = await supabase
                        .from("marketplaces")
                        .insert({ name: "New marketplace name here", default_fees_pct: 0 });
                      if (error) throw error;
                      await refetchMarkets();
                    } catch (e) {
                      alert(e.message || String(e));
                    }
                  }}
                  className="h-9 w-9 inline-flex items-center justify-center rounded-xl border border-slate-800 bg-slate-900/60 hover:bg-slate-900 text-slate-100"
                  aria-label="Add marketplace"
                  title="Add marketplace"
                >
                  <svg
                    viewBox="0 0 24 24"
                    className="h-5 w-5"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  >
                    <path d="M12 5v14M5 12h14" />
                  </svg>
                </button>
              )}
              <button
                onClick={() => toggleCard('markets')}
                className="h-9 w-9 inline-flex items-center justify-center rounded-xl border border-slate-800 bg-slate-900/60 hover:bg-slate-900 text-slate-100"
                aria-label={openMarkets ? "Collapse" : "Expand"}
              >
                <ChevronDown className={`h-5 w-5 transition-transform ${openMarkets ? "rotate-180" : ""}`} />
              </button>
            </div>
          </div>

          {/* content */}
          <div className={`transition-all duration-300 ease-in-out overflow-hidden`} style={{ maxHeight: openMarkets ? 1000 : 0 }}>
            <div className="pt-5">
              {/* Header row - text only */}
              <div className="hidden sm:block">
                <div className="grid grid-cols-[1fr_140px] gap-2 items-center min-w-0 px-3 py-2 mb-1">
                  <div className="flex items-center gap-2">
                    <div className="w-6 flex items-center justify-center">
                      <input
                        type="checkbox"
                        checked={markets.length > 0 && selectedMarkets.size === markets.length}
                        onChange={(e) => {
                          if (e.target.checked) {
                            // Select all markets
                            const allMarketIds = markets.map(market => market.id);
                            setSelectedMarkets(new Set(allMarketIds));
                          } else {
                            // Deselect all markets
                            setSelectedMarkets(new Set());
                          }
                        }}
                        className="h-4 w-4 rounded border-slate-500 bg-slate-800/60 text-indigo-500 focus:ring-indigo-400 focus:ring-2 transition-all"
                      />
                    </div>
                    <span className="text-xs text-slate-300 font-medium">Marketplace</span>
                  </div>
                  <div className="text-xs text-slate-300 font-medium">Fee %</div>
                </div>
              </div>

              <div className="space-y-3 max-h-96 overflow-y-auto scrollbar-thin scrollbar-thumb-slate-600 scrollbar-track-slate-800 pr-2">
                {markets
                  .sort((a, b) => {
                    // Put new marketplaces (with placeholder text) at the top
                    const aIsNew = a.name === "New marketplace name here";
                    const bIsNew = b.name === "New marketplace name here";
                    if (aIsNew && !bIsNew) return -1;
                    if (!aIsNew && bIsNew) return 1;
                    // Then sort alphabetically
                    return a.name.localeCompare(b.name);
                  })
                  .map((m) => (
                  <MarketRow
                    key={m.id}
                    m={m}
                    isNew={m.name === "New marketplace name here"}
                    isSelected={selectedMarkets.has(m.id)}
                    onToggleSelection={() => {
                      const newSelected = new Set(selectedMarkets);
                      if (newSelected.has(m.id)) {
                        newSelected.delete(m.id);
                      } else {
                        newSelected.add(m.id);
                      }
                      setSelectedMarkets(newSelected);
                    }}
                    onDelete={() => deleteMarket(m.id)}
                  />
                ))}
                {!markets.length && (
                  <div className="text-slate-400">No marketplaces yet.</div>
                )}
              </div>
            </div>
          </div>
        </section>
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

/* ---------- Row components ---------- */

function ItemRow({ it, isNew = false, isSelected = false, onToggleSelection, onDelete }) {
  const [name, setName] = useState(it?.name ?? "");
  const [mv, setMv] = useState(centsToStr(it?.market_value_cents ?? 0));
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
        .eq("id", it.id);
      if (error) throw error;
      setStatus("Saved ✓");
      setTimeout(() => setStatus(""), 1500);
    } catch (e) {
      setStatus(String(e.message || e));
      setTimeout(() => setStatus(""), 2000);
    } finally {
    setBusy(false);
    }
  }

  return (
    <div 
      className={`${rowCard} cursor-pointer transition-all ${
        isSelected || isNew
          ? 'border-indigo-500 bg-indigo-500/10' 
          : 'border-slate-800 hover:bg-slate-800/50'
      }`}
      onClick={onToggleSelection}
    >
      <div className="grid grid-cols-1 sm:grid-cols-[1fr_160px] gap-2 items-center min-w-0">
        <div className="flex items-center gap-2">
          <div className="w-6 flex items-center justify-center">
            <input
              type="checkbox"
              checked={isSelected}
              onChange={(e) => {
                e.stopPropagation();
                onToggleSelection();
              }}
              className="h-4 w-4 rounded border-slate-500 bg-slate-800/60 text-indigo-500 focus:ring-indigo-400 focus:ring-2 transition-all"
            />
          </div>
        <input
          className={inputSm}
          value={name}
            onChange={(e) => {
              e.stopPropagation();
              setName(e.target.value);
            }}
            onBlur={updateItem}
            onClick={(e) => e.stopPropagation()}
            placeholder={isNew ? "New item name here" : "Item name…"}
          />
        </div>
        <input
          className={`${inputSm} sm:w-[160px]`}
          value={mv}
          onChange={(e) => {
            e.stopPropagation();
            setMv(e.target.value);
          }}
          onBlur={updateItem}
          onClick={(e) => e.stopPropagation()}
          placeholder="e.g. 129.99"
        />
      </div>
      {status && (
        <div
          className={`text-right text-sm mt-1 ${
            status.startsWith("Saved")
              ? "text-emerald-400"
              : status === "Error"
              ? "text-rose-400"
              : "text-slate-400"
          }`}
        >
          {status}
        </div>
      )}
    </div>
  );
}

function RetailerRow({ r, isNew = false, isSelected = false, onToggleSelection, onDelete }) {
  const [name, setName] = useState(r?.name ?? "");
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
        .eq("id", r.id);
      if (error) throw error;
      setStatus("Saved ✓");
      setTimeout(() => setStatus(""), 1500);
    } catch (e) {
      setStatus(String(e.message || e));
      setTimeout(() => setStatus(""), 2000);
    } finally {
    setBusy(false);
    }
  }

  return (
    <div 
      className={`${rowCard} cursor-pointer transition-all ${
        isSelected || isNew
          ? 'border-indigo-500 bg-indigo-500/10' 
          : 'border-slate-800 hover:bg-slate-800/50'
      }`}
      onClick={onToggleSelection}
    >
      <div className="grid grid-cols-1 sm:grid-cols-[1fr] gap-2 items-center min-w-0">
        <div className="flex items-center gap-2">
          <div className="w-6 flex items-center justify-center">
            <input
              type="checkbox"
              checked={isSelected}
              onChange={(e) => {
                e.stopPropagation();
                onToggleSelection();
              }}
              className="h-4 w-4 rounded border-slate-500 bg-slate-800/60 text-indigo-500 focus:ring-indigo-400 focus:ring-2 transition-all"
            />
          </div>
        <input
          className={inputSm}
          value={name}
          onChange={(e) => {
            e.stopPropagation();
            setName(e.target.value);
          }}
          onBlur={updateRetailer}
          onClick={(e) => e.stopPropagation()}
          placeholder={isNew ? "New retailer name here" : "Retailer name…"}
        />
        </div>
      </div>
      {status && (
        <div
          className={`text-right text-sm mt-1 ${
            status.startsWith("Saved")
              ? "text-emerald-400"
              : status === "Error"
              ? "text-rose-400"
              : "text-slate-400"
          }`}
        >
          {status}
        </div>
      )}
    </div>
  );
}

function MarketRow({ m, isNew = false, isSelected = false, onToggleSelection, onDelete }) {
  const [name, setName] = useState(m?.name ?? "");
  const [fee, setFee] = useState(((m?.default_fees_pct ?? 0) * 100).toString());
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
        .eq("id", m.id);
      if (error) throw error;
      setStatus("Saved ✓");
      setTimeout(() => setStatus(""), 1500);
    } catch (e) {
      setStatus(String(e.message || e));
      setTimeout(() => setStatus(""), 2000);
    } finally {
    setBusy(false);
    }
  }

  return (
    <div 
      className={`${rowCard} cursor-pointer transition-all ${
        isSelected || isNew
          ? 'border-indigo-500 bg-indigo-500/10' 
          : 'border-slate-800 hover:bg-slate-800/50'
      }`}
      onClick={onToggleSelection}
    >
      <div className="grid grid-cols-1 sm:grid-cols-[1fr_140px] gap-2 items-center min-w-0">
        <div className="flex items-center gap-2">
          <div className="w-6 flex items-center justify-center">
            <input
              type="checkbox"
              checked={isSelected}
              onChange={(e) => {
                e.stopPropagation();
                onToggleSelection();
              }}
              className="h-4 w-4 rounded border-slate-500 bg-slate-800/60 text-indigo-500 focus:ring-indigo-400 focus:ring-2 transition-all"
            />
          </div>
        <input
          className={inputSm}
          value={name}
          onChange={(e) => {
            e.stopPropagation();
            setName(e.target.value);
          }}
          onBlur={updateMarket}
          onClick={(e) => e.stopPropagation()}
          placeholder={isNew ? "New marketplace name here" : "Marketplace name…"}
        />
        </div>
        <input
          className={`${inputSm} sm:w-[140px]`}
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
              : status === "Error"
              ? "text-rose-400"
              : "text-slate-400"
          }`}
        >
          {status}
        </div>
      )}
    </div>
  );
}
