// src/routes/Settings.jsx
import { useState, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "../lib/supabaseClient";
import LayoutWithSidebar from "../components/LayoutWithSidebar.jsx";
import PageHeader from "../components/PageHeader.jsx";
import ProductSearchDropdown from "../components/ProductSearchDropdown.jsx";
import { CategoryItemRow, NewCategoryRowComponent } from "../components/CategoryComponents.jsx";
import { moneyToCents, centsToStr, formatNumber } from "../utils/money.js";
import { pageCard, rowCard, inputSm, headerIconBtn, headerGhostBtn, iconSave, iconSaveBusy, iconDelete } from "../utils/ui.js";

/* ---------- queries ---------- */
async function getItems() {
  const { data, error } = await supabase
    .from("items")
    .select("id, name, market_value_cents, price_source, api_product_id, api_last_updated, api_price_cents, manual_override")
    .order("name", { ascending: true });
  if (error) throw error;
  return data;
}

// Category-specific queries
async function getPokemonCards() {
  const { data, error } = await supabase
    .from("pokemon_cards")
    .select("id, name, market_value_cents, price_source, api_product_id, api_last_updated, api_price_cents, manual_override, upc_code, console_name")
    .order("name", { ascending: true });
  if (error) throw error;
  return data;
}

async function getVideoGames() {
  const { data, error } = await supabase
    .from("video_games")
    .select("id, name, market_value_cents, price_source, api_product_id, api_last_updated, api_price_cents, manual_override, upc_code, console_name")
    .order("name", { ascending: true });
  if (error) throw error;
  return data;
}

async function getMagicCards() {
  const { data, error } = await supabase
    .from("magic_cards")
    .select("id, name, market_value_cents, price_source, api_product_id, api_last_updated, api_price_cents, manual_override, upc_code, console_name")
    .order("name", { ascending: true });
  if (error) throw error;
  return data;
}

async function getYugiohCards() {
  const { data, error } = await supabase
    .from("yugioh_cards")
    .select("id, name, market_value_cents, price_source, api_product_id, api_last_updated, api_price_cents, manual_override, upc_code, console_name")
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

/* ---------- Price Charting API functions ---------- */
async function searchPriceChartingProducts(productName) {
  const response = await fetch(`/.netlify/functions/price-charting-search?q=${encodeURIComponent(productName)}`);
  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error || 'Search failed');
  }
  return await response.json();
}

async function updateItemPrice(itemId, productId) {
  const response = await fetch('/.netlify/functions/price-charting-update-price', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ itemId, productId })
  });
  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error || 'Update failed');
  }
  return await response.json();
}

  async function bulkUpdatePrices(itemIds) {
    console.log('bulkUpdatePrices called with:', itemIds);
    
    const requestBody = { itemIds };
    console.log('Request body:', requestBody);
    
    const response = await fetch('/.netlify/functions/price-charting-local-bulk-update', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(requestBody)
    });
    
    console.log('Response status:', response.status);
    console.log('Response headers:', response.headers);
    
    if (!response.ok) {
      let errorText;
      try {
        const error = await response.json();
        errorText = error.error || 'Bulk update failed';
      } catch (e) {
        errorText = `HTTP ${response.status}: ${response.statusText}`;
      }
      throw new Error(errorText);
    }
    
    const responseText = await response.text();
    console.log('Response text:', responseText);
    
    try {
      return JSON.parse(responseText);
    } catch (e) {
      throw new Error(`Failed to parse response: ${responseText}`);
    }
  }

export default function Settings() {
  // Custom checkbox styling for dark theme
  useEffect(() => {
    const tag = document.createElement("style");
    tag.innerHTML = `
      /* Custom checkbox styling for dark theme */
      input[type="checkbox"] {
        -webkit-appearance: none;
        appearance: none;
        background-color: #1e293b; /* slate-800 */
        border: 1px solid #475569; /* slate-600 */
        border-radius: 0.25rem;
        width: 1rem;
        height: 1rem;
        position: relative;
        cursor: pointer;
      }
      
      input[type="checkbox"]:checked {
        background-color: #6366f1; /* indigo-500 */
        border-color: #6366f1;
      }
      
      input[type="checkbox"]:checked::after {
        content: "✓";
        position: absolute;
        top: 50%;
        left: 50%;
        transform: translate(-50%, -50%);
        color: white;
        font-size: 0.75rem;
        font-weight: bold;
      }
      
      input[type="checkbox"]:focus {
        outline: 2px solid #6366f1;
        outline-offset: 2px;
      }
    `;
    document.head.appendChild(tag);
    return () => document.head.removeChild(tag);
  }, []);

  // Category-specific queries
  const { data: pokemonCards = [], refetch: refetchPokemonCards } = useQuery({
    queryKey: ["pokemon_cards"],
    queryFn: getPokemonCards,
  });
  
  const { data: videoGames = [], refetch: refetchVideoGames } = useQuery({
    queryKey: ["video_games"],
    queryFn: getVideoGames,
  });
  
  const { data: magicCards = [], refetch: refetchMagicCards } = useQuery({
    queryKey: ["magic_cards"],
    queryFn: getMagicCards,
  });
  
  const { data: yugiohCards = [], refetch: refetchYugiohCards } = useQuery({
    queryKey: ["yugioh_cards"],
    queryFn: getYugiohCards,
  });

  // Keep the old items query for backward compatibility during transition
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
  
  // Category-specific states
  const [selectedPokemonCards, setSelectedPokemonCards] = useState(new Set());
  const [selectedVideoGames, setSelectedVideoGames] = useState(new Set());
  const [selectedMagicCards, setSelectedMagicCards] = useState(new Set());
  const [selectedYugiohCards, setSelectedYugiohCards] = useState(new Set());
  
  const [newItemRows, setNewItemRows] = useState([]);
  const [newRetailerRows, setNewRetailerRows] = useState([]);
  const [newMarketRows, setNewMarketRows] = useState([]);
  
  // Category-specific new row states
  const [newPokemonCardRows, setNewPokemonCardRows] = useState([]);
  const [newVideoGameRows, setNewVideoGameRows] = useState([]);
  const [newMagicCardRows, setNewMagicCardRows] = useState([]);
  const [newYugiohCardRows, setNewYugiohCardRows] = useState([]);
  
  const [nextNewRowId, setNextNewRowId] = useState(-1);
  
  // Single card expansion state
  const [expandedCard, setExpandedCard] = useState(null); // 'items', 'retailers', 'markets', 'pokemon_cards', 'video_games', 'magic_cards', 'yugioh_cards', or null
  
  // Price Charting API state
  const [searchResults, setSearchResults] = useState([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [isSearching, setIsSearching] = useState(false);
  const [selectedSearchResult, setSelectedSearchResult] = useState(null);
  const [isUpdatingPrice, setIsUpdatingPrice] = useState(false);
  const [bulkUpdateProgress, setBulkUpdateProgress] = useState(null);

  // Update bulk actions visibility for each card
  useEffect(() => {
    // Each card manages its own bulk actions visibility
  }, [selectedItems, selectedRetailers, selectedMarkets, selectedPokemonCards, selectedVideoGames, selectedMagicCards, selectedYugiohCards]);

  // Helper functions to check if there are new rows in each system
  const hasNewItemRows = newItemRows.length > 0;
  const hasNewRetailerRows = newRetailerRows.length > 0;
  const hasNewMarketRows = newMarketRows.length > 0;
  
  // Category-specific helper functions
  const hasNewPokemonCardRows = newPokemonCardRows.length > 0;
  const hasNewVideoGameRows = newVideoGameRows.length > 0;
  const hasNewMagicCardRows = newMagicCardRows.length > 0;
  const hasNewYugiohCardRows = newYugiohCardRows.length > 0;

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

  /* ----- Price Charting API Functions ----- */
  async function handleProductSearch(query) {
    if (!query.trim()) {
      setSearchResults([]);
      return;
    }
    
    setIsSearching(true);
    try {
      const response = await searchPriceChartingProducts(query);
      setSearchResults(response.data?.products || []);
    } catch (error) {
      console.error('Search error:', error);
      alert(`Search failed: ${error.message}`);
      setSearchResults([]);
    } finally {
      setIsSearching(false);
    }
  }

  async function handleUpdateItemPrice(itemId, productId) {
    setIsUpdatingPrice(true);
    try {
      const response = await updateItemPrice(itemId, productId);
      await refetchItems(); // Refresh the items list
      alert(`Price updated successfully! New price: $${(response.result.priceCents / 100).toFixed(2)}`);
      setSelectedSearchResult(null);
      setSearchQuery('');
      setSearchResults([]);
    } catch (error) {
      console.error('Update error:', error);
      alert(`Update failed: ${error.message}`);
    } finally {
      setIsUpdatingPrice(false);
    }
  }

  async function handleBulkUpdatePrices() {
    if (selectedItems.size === 0) {
      alert('Please select items to update');
      return;
    }
    
    const selectedIds = Array.from(selectedItems);
    const confirmMessage = `Update prices for ${selectedIds.length} selected items? This will search local CSV data for current prices.`;
    if (!confirm(confirmMessage)) return;
    
    setBulkUpdateProgress({ total: selectedIds.length, completed: 0, errors: [] });
    
    try {
      const response = await bulkUpdatePrices(selectedIds);
      await refetchItems(); // Refresh the items list
      
      let message = `Updated ${response.results.successful.length} items successfully`;
      if (response.results.failed.length > 0) {
        message += `\n\n${response.results.failed.length} items failed:\n`;
        message += response.results.failed.map(e => `• ${e.item_name}: ${e.error}`).join('\n');
      }
      
      alert(message);
      setSelectedItems(new Set());
    } catch (error) {
      console.error('Bulk update error:', error);
      alert(`Bulk update failed: ${error.message}`);
    } finally {
      setBulkUpdateProgress(null);
    }
  }

  async function handleSyncAllProducts() {
    if (items.length === 0) {
      alert('No products to sync');
      return;
    }
    
    const confirmMessage = `Sync prices for all ${items.length} products? This will search local CSV data for each product name and update prices automatically. Products that can't be found will be skipped.`;
    if (!confirm(confirmMessage)) return;
    
    setBulkUpdateProgress({ total: items.length, completed: 0, errors: [] });
    
    try {
      // Get all item IDs for bulk update
      const itemIds = items.map(item => item.id);
      console.log('Sync All Products - Item IDs:', itemIds);
      console.log('Sync All Products - Item count:', itemIds.length);
      
      // Use the bulk update function with local CSV data
      const response = await bulkUpdatePrices(itemIds);
      console.log('Sync All Products - Response:', response);
      
      await refetchItems(); // Refresh the items list
      
      let message = `Synced ${response.results.successful.length} products successfully`;
      if (response.results.failed.length > 0) {
        message += `\n\n${response.results.failed.length} products couldn't be found or updated:\n`;
        message += response.results.failed.map(e => `• ${e.item_name}: ${e.error}`).join('\n');
      }
      
      alert(message);
    } catch (error) {
      console.error('Sync all error:', error);
      alert(`Sync all failed: ${error.message}`);
    } finally {
      setBulkUpdateProgress(null);
    }
  }

  // Debounced search function
  useEffect(() => {
    const timeoutId = setTimeout(() => {
      if (searchQuery) {
        handleProductSearch(searchQuery);
      }
    }, 500);

    return () => clearTimeout(timeoutId);
  }, [searchQuery]);

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
    
    const selectedIds = Array.from(selectedItems);
    const newRowIds = selectedIds.filter(id => id < 0);
    const existingRowIds = selectedIds.filter(id => id > 0);
    
    if (newRowIds.length > 0) {
      // Handle new rows - they should be saved individually by the NewRowComponent
      // Just clear the selection after they're saved
      setSelectedItems(new Set());
      await refetchItems();
    } else if (existingRowIds.length > 0) {
      // For existing rows, individual saves are handled by the row components
      // Just clear the selection
      setSelectedItems(new Set());
      await refetchItems();
    }
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
    
    const selectedIds = Array.from(selectedRetailers);
    const newRowIds = selectedIds.filter(id => id < 0);
    const existingRowIds = selectedIds.filter(id => id > 0);
    
    if (newRowIds.length > 0) {
      // Handle new rows - they should be saved individually by the NewRowComponent
      // Just clear the selection after they're saved
      setSelectedRetailers(new Set());
      await refetchRetailers();
    } else if (existingRowIds.length > 0) {
      // For existing rows, individual saves are handled by the row components
      // Just clear the selection
      setSelectedRetailers(new Set());
      await refetchRetailers();
    }
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
    
    const selectedIds = Array.from(selectedMarkets);
    const newRowIds = selectedIds.filter(id => id < 0);
    const existingRowIds = selectedIds.filter(id => id > 0);
    
    if (newRowIds.length > 0) {
      // Handle new rows - they should be saved individually by the NewRowComponent
      // Just clear the selection after they're saved
      setSelectedMarkets(new Set());
      await refetchMarkets();
    } else if (existingRowIds.length > 0) {
      // For existing rows, individual saves are handled by the row components
      // Just clear the selection
      setSelectedMarkets(new Set());
      await refetchMarkets();
    }
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

  /* ----- Category-specific Operations ----- */
  
  // Pokemon Cards Operations
  function togglePokemonCardSelection(rowId) {
    const newSelected = new Set(selectedPokemonCards);
    if (newSelected.has(rowId)) {
      const isNewRow = rowId < 0;
      if (isNewRow) return;
      newSelected.delete(rowId);
    } else {
      if (hasNewPokemonCardRows) {
        setSelectedPokemonCards(new Set([rowId]));
        return;
      }
      newSelected.add(rowId);
    }
    setSelectedPokemonCards(newSelected);
  }

  function addNewPokemonCardRow() {
    const newId = nextNewRowId;
    setNextNewRowId(newId - 1);
    setNewPokemonCardRows(prev => [...prev, { id: newId, type: 'pokemon_card', isNew: true }]);
    setSelectedPokemonCards(new Set([newId]));
  }

  // Video Games Operations
  function toggleVideoGameSelection(rowId) {
    const newSelected = new Set(selectedVideoGames);
    if (newSelected.has(rowId)) {
      const isNewRow = rowId < 0;
      if (isNewRow) return;
      newSelected.delete(rowId);
    } else {
      if (hasNewVideoGameRows) {
        setSelectedVideoGames(new Set([rowId]));
        return;
      }
      newSelected.add(rowId);
    }
    setSelectedVideoGames(newSelected);
  }

  function addNewVideoGameRow() {
    const newId = nextNewRowId;
    setNextNewRowId(newId - 1);
    setNewVideoGameRows(prev => [...prev, { id: newId, type: 'video_game', isNew: true }]);
    setSelectedVideoGames(new Set([newId]));
  }

  // Magic Cards Operations
  function toggleMagicCardSelection(rowId) {
    const newSelected = new Set(selectedMagicCards);
    if (newSelected.has(rowId)) {
      const isNewRow = rowId < 0;
      if (isNewRow) return;
      newSelected.delete(rowId);
    } else {
      if (hasNewMagicCardRows) {
        setSelectedMagicCards(new Set([rowId]));
        return;
      }
      newSelected.add(rowId);
    }
    setSelectedMagicCards(newSelected);
  }

  function addNewMagicCardRow() {
    const newId = nextNewRowId;
    setNextNewRowId(newId - 1);
    setNewMagicCardRows(prev => [...prev, { id: newId, type: 'magic_card', isNew: true }]);
    setSelectedMagicCards(new Set([newId]));
  }

  // Yu-Gi-Oh Cards Operations
  function toggleYugiohCardSelection(rowId) {
    const newSelected = new Set(selectedYugiohCards);
    if (newSelected.has(rowId)) {
      const isNewRow = rowId < 0;
      if (isNewRow) return;
      newSelected.delete(rowId);
    } else {
      if (hasNewYugiohCardRows) {
        setSelectedYugiohCards(new Set([rowId]));
        return;
      }
      newSelected.add(rowId);
    }
    setSelectedYugiohCards(newSelected);
  }

  function addNewYugiohCardRow() {
    const newId = nextNewRowId;
    setNextNewRowId(newId - 1);
    setNewYugiohCardRows(prev => [...prev, { id: newId, type: 'yugioh_card', isNew: true }]);
    setSelectedYugiohCards(new Set([newId]));
  }

  /* ----- Category-specific Bulk Operations ----- */
  
  // Pokemon Cards Bulk Operations
  function toggleAllPokemonCardsSelection() {
    if (selectedPokemonCards.size === pokemonCards.length) {
      if (hasNewPokemonCardRows) return;
      setSelectedPokemonCards(new Set());
    } else {
      const allIds = pokemonCards.map(card => card.id);
      setSelectedPokemonCards(new Set(allIds));
    }
  }

  async function bulkSavePokemonCards() {
    // This will be handled by individual row save buttons
    // Bulk save is not needed since each row saves individually
    setSelectedPokemonCards(new Set());
  }

  async function bulkDeletePokemonCards() {
    const selectedIds = Array.from(selectedPokemonCards).filter(id => id > 0);
    if (selectedIds.length === 0) return;
    
    if (!confirm(`Delete ${selectedIds.length} pokemon card(s)? This action cannot be undone.`)) return;
    
    try {
      const { error } = await supabase
        .from('pokemon_cards')
        .delete()
        .in('id', selectedIds);
      
      if (error) throw error;
      await refetchPokemonCards();
      setSelectedPokemonCards(new Set());
    } catch (e) {
      alert(`Failed to delete: ${e.message}`);
    }
  }

  // Video Games Bulk Operations
  function toggleAllVideoGamesSelection() {
    if (selectedVideoGames.size === videoGames.length) {
      if (hasNewVideoGameRows) return;
      setSelectedVideoGames(new Set());
    } else {
      const allIds = videoGames.map(game => game.id);
      setSelectedVideoGames(new Set(allIds));
    }
  }

  async function bulkSaveVideoGames() {
    setSelectedVideoGames(new Set());
  }

  async function bulkDeleteVideoGames() {
    const selectedIds = Array.from(selectedVideoGames).filter(id => id > 0);
    if (selectedIds.length === 0) return;
    
    if (!confirm(`Delete ${selectedIds.length} video game(s)? This action cannot be undone.`)) return;
    
    try {
      const { error } = await supabase
        .from('video_games')
        .delete()
        .in('id', selectedIds);
      
      if (error) throw error;
      await refetchVideoGames();
      setSelectedVideoGames(new Set());
    } catch (e) {
      alert(`Failed to delete: ${e.message}`);
    }
  }

  // Magic Cards Bulk Operations
  function toggleAllMagicCardsSelection() {
    if (selectedMagicCards.size === magicCards.length) {
      if (hasNewMagicCardRows) return;
      setSelectedMagicCards(new Set());
    } else {
      const allIds = magicCards.map(card => card.id);
      setSelectedMagicCards(new Set(allIds));
    }
  }

  async function bulkSaveMagicCards() {
    setSelectedMagicCards(new Set());
  }

  async function bulkDeleteMagicCards() {
    const selectedIds = Array.from(selectedMagicCards).filter(id => id > 0);
    if (selectedIds.length === 0) return;
    
    if (!confirm(`Delete ${selectedIds.length} magic card(s)? This action cannot be undone.`)) return;
    
    try {
      const { error } = await supabase
        .from('magic_cards')
        .delete()
        .in('id', selectedIds);
      
      if (error) throw error;
      await refetchMagicCards();
      setSelectedMagicCards(new Set());
    } catch (e) {
      alert(`Failed to delete: ${e.message}`);
    }
  }

  // Yu-Gi-Oh Cards Bulk Operations
  function toggleAllYugiohCardsSelection() {
    if (selectedYugiohCards.size === yugiohCards.length) {
      if (hasNewYugiohCardRows) return;
      setSelectedYugiohCards(new Set());
    } else {
      const allIds = yugiohCards.map(card => card.id);
      setSelectedYugiohCards(new Set(allIds));
    }
  }

  async function bulkSaveYugiohCards() {
    setSelectedYugiohCards(new Set());
  }

  async function bulkDeleteYugiohCards() {
    const selectedIds = Array.from(selectedYugiohCards).filter(id => id > 0);
    if (selectedIds.length === 0) return;
    
    if (!confirm(`Delete ${selectedIds.length} yugioh card(s)? This action cannot be undone.`)) return;
    
    try {
      const { error } = await supabase
        .from('yugioh_cards')
        .delete()
        .in('id', selectedIds);
      
      if (error) throw error;
      await refetchYugiohCards();
      setSelectedYugiohCards(new Set());
    } catch (e) {
      alert(`Failed to delete: ${e.message}`);
    }
  }

  return (
    <LayoutWithSidebar active="database" section="orderbook">
      <PageHeader title="Settings" />

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
          bulkUpdatePrices={handleBulkUpdatePrices}
          syncAllProducts={handleSyncAllProducts}
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

        {/* Pokemon Cards Card */}
        <SettingsCard
          title="Pokemon Cards"
          totalCount={pokemonCards.length}
          selectedRows={selectedPokemonCards}
          newRows={newPokemonCardRows}
          hasNewRows={hasNewPokemonCardRows}
          toggleAllSelection={toggleAllPokemonCardsSelection}
          bulkSave={bulkSavePokemonCards}
          bulkDelete={bulkDeletePokemonCards}
          cancelNewRows={() => {
            setNewPokemonCardRows([]);
            setSelectedPokemonCards(new Set());
          }}
          addNewRow={addNewPokemonCardRow}
          clearSelection={() => setSelectedPokemonCards(new Set())}
          data={pokemonCards}
          newRowsData={newPokemonCardRows}
          onRowToggle={togglePokemonCardSelection}
          renderRow={(card) => (
            <CategoryItemRow
              key={card.id}
              item={card}
              isSelected={selectedPokemonCards.has(card.id)}
              onToggleSelection={() => togglePokemonCardSelection(card.id)}
              onSave={() => refetchPokemonCards()}
              disabled={hasNewPokemonCardRows}
              category="pokemon_cards"
            />
          )}
          renderNewRow={(newRow) => (
            <NewCategoryRowComponent
              key={newRow.id}
              row={newRow}
              isSelected={selectedPokemonCards.has(newRow.id)}
              onToggleSelection={() => togglePokemonCardSelection(newRow.id)}
              onSave={(data) => {
                setNewPokemonCardRows(prev => prev.filter(row => row.id !== newRow.id));
                setSelectedPokemonCards(new Set());
                refetchPokemonCards();
              }}
              onCancel={() => {
                setNewPokemonCardRows(prev => prev.filter(row => row.id !== newRow.id));
                setSelectedPokemonCards(new Set());
              }}
            />
          )}
          cardType="pokemon_cards"
          isExpanded={expandedCard === 'pokemon_cards'}
          onToggleExpansion={() => setExpandedCard(expandedCard === 'pokemon_cards' ? null : 'pokemon_cards')}
        />

        {/* Video Games Card */}
        <SettingsCard
          title="Video Games"
          totalCount={videoGames.length}
          selectedRows={selectedVideoGames}
          newRows={newVideoGameRows}
          hasNewRows={hasNewVideoGameRows}
          toggleAllSelection={toggleAllVideoGamesSelection}
          bulkSave={bulkSaveVideoGames}
          bulkDelete={bulkDeleteVideoGames}
          cancelNewRows={() => {
            setNewVideoGameRows([]);
            setSelectedVideoGames(new Set());
          }}
          addNewRow={addNewVideoGameRow}
          clearSelection={() => setSelectedVideoGames(new Set())}
          data={videoGames}
          newRowsData={newVideoGameRows}
          onRowToggle={toggleVideoGameSelection}
          renderRow={(game) => (
            <CategoryItemRow
              key={game.id}
              item={game}
              isSelected={selectedVideoGames.has(game.id)}
              onToggleSelection={() => toggleVideoGameSelection(game.id)}
              onSave={() => refetchVideoGames()}
              disabled={hasNewVideoGameRows}
              category="video_games"
            />
          )}
          renderNewRow={(newRow) => (
            <NewCategoryRowComponent
              key={newRow.id}
              row={newRow}
              isSelected={selectedVideoGames.has(newRow.id)}
              onToggleSelection={() => toggleVideoGameSelection(newRow.id)}
              onSave={(data) => {
                setNewVideoGameRows(prev => prev.filter(row => row.id !== newRow.id));
                setSelectedVideoGames(new Set());
                refetchVideoGames();
              }}
              onCancel={() => {
                setNewVideoGameRows(prev => prev.filter(row => row.id !== newRow.id));
                setSelectedVideoGames(new Set());
              }}
            />
          )}
          cardType="video_games"
          isExpanded={expandedCard === 'video_games'}
          onToggleExpansion={() => setExpandedCard(expandedCard === 'video_games' ? null : 'video_games')}
        />

        {/* Magic Cards Card */}
        <SettingsCard
          title="Magic Cards"
          totalCount={magicCards.length}
          selectedRows={selectedMagicCards}
          newRows={newMagicCardRows}
          hasNewRows={hasNewMagicCardRows}
          toggleAllSelection={toggleAllMagicCardsSelection}
          bulkSave={bulkSaveMagicCards}
          bulkDelete={bulkDeleteMagicCards}
          cancelNewRows={() => {
            setNewMagicCardRows([]);
            setSelectedMagicCards(new Set());
          }}
          addNewRow={addNewMagicCardRow}
          clearSelection={() => setSelectedMagicCards(new Set())}
          data={magicCards}
          newRowsData={newMagicCardRows}
          onRowToggle={toggleMagicCardSelection}
          renderRow={(card) => (
            <CategoryItemRow
              key={card.id}
              item={card}
              isSelected={selectedMagicCards.has(card.id)}
              onToggleSelection={() => toggleMagicCardSelection(card.id)}
              onSave={() => refetchMagicCards()}
              disabled={hasNewMagicCardRows}
              category="magic_cards"
            />
          )}
          renderNewRow={(newRow) => (
            <NewCategoryRowComponent
              key={newRow.id}
              row={newRow}
              isSelected={selectedMagicCards.has(newRow.id)}
              onToggleSelection={() => toggleMagicCardSelection(newRow.id)}
              onSave={(data) => {
                setNewMagicCardRows(prev => prev.filter(row => row.id !== newRow.id));
                setSelectedMagicCards(new Set());
                refetchMagicCards();
              }}
              onCancel={() => {
                setNewMagicCardRows(prev => prev.filter(row => row.id !== newRow.id));
                setSelectedMagicCards(new Set());
              }}
            />
          )}
          cardType="magic_cards"
          isExpanded={expandedCard === 'magic_cards'}
          onToggleExpansion={() => setExpandedCard(expandedCard === 'magic_cards' ? null : 'magic_cards')}
        />

        {/* Yu-Gi-Oh Cards Card */}
        <SettingsCard
          title="Yu-Gi-Oh Cards"
          totalCount={yugiohCards.length}
          selectedRows={selectedYugiohCards}
          newRows={newYugiohCardRows}
          hasNewRows={hasNewYugiohCardRows}
          toggleAllSelection={toggleAllYugiohCardsSelection}
          bulkSave={bulkSaveYugiohCards}
          bulkDelete={bulkDeleteYugiohCards}
          cancelNewRows={() => {
            setNewYugiohCardRows([]);
            setSelectedYugiohCards(new Set());
          }}
          addNewRow={addNewYugiohCardRow}
          clearSelection={() => setSelectedYugiohCards(new Set())}
          data={yugiohCards}
          newRowsData={newYugiohCardRows}
          onRowToggle={toggleYugiohCardSelection}
          renderRow={(card) => (
            <CategoryItemRow
              key={card.id}
              item={card}
              isSelected={selectedYugiohCards.has(card.id)}
              onToggleSelection={() => toggleYugiohCardSelection(card.id)}
              onSave={() => refetchYugiohCards()}
              disabled={hasNewYugiohCardRows}
              category="yugioh_cards"
            />
          )}
          renderNewRow={(newRow) => (
            <NewCategoryRowComponent
              key={newRow.id}
              row={newRow}
              isSelected={selectedYugiohCards.has(newRow.id)}
              onToggleSelection={() => toggleYugiohCardSelection(newRow.id)}
              onSave={(data) => {
                setNewYugiohCardRows(prev => prev.filter(row => row.id !== newRow.id));
                setSelectedYugiohCards(new Set());
                refetchYugiohCards();
              }}
              onCancel={() => {
                setNewYugiohCardRows(prev => prev.filter(row => row.id !== newRow.id));
                setSelectedYugiohCards(new Set());
              }}
            />
          )}
          cardType="yugioh_cards"
          isExpanded={expandedCard === 'yugioh_cards'}
          onToggleExpansion={() => setExpandedCard(expandedCard === 'yugioh_cards' ? null : 'yugioh_cards')}
        />

    </LayoutWithSidebar>
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
  bulkUpdatePrices,
  syncAllProducts,
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
    <section 
      className={`${pageCard} mb-6 cursor-pointer hover:bg-slate-800/20 transition-colors`}
      onClick={onToggleExpansion}
    >
      {/* Card Header */}
      <div 
        className="flex items-center justify-between gap-3 flex-wrap sm:flex-nowrap rounded-xl p-2 -m-2"
      >
        <div className="min-w-0 flex-1">
          <h2 className="text-lg font-semibold leading-[2.25rem]">{title}</h2>
          <p className="text-xs text-slate-400 -mt-1">Total: {totalCount}</p>
          
          {/* Collapsed preview content */}
          {!isExpanded && (
            <div className="mt-3">
              {/* Clean purpose description */}
              <div className="flex items-center gap-2 mb-2">
                <div className="w-1.5 h-1.5 rounded-full bg-indigo-400/60"></div>
                <p className="text-sm text-slate-300">
                  {cardType === 'items' && "Product catalog with names and market values"}
                  {cardType === 'retailers' && "Retailers where you purchase items"}
                  {cardType === 'markets' && "Marketplaces with their fee percentages"}
                  {cardType === 'pokemon_cards' && "Pokemon card collection with names and market values"}
                  {cardType === 'video_games' && "Video game collection with names and market values"}
                  {cardType === 'magic_cards' && "Magic: The Gathering card collection with names and market values"}
                  {cardType === 'yugioh_cards' && "Yu-Gi-Oh card collection with names and market values"}
                </p>
              </div>
              
              {/* Clean sample preview */}
              {data.length > 0 && (
                <div className="flex items-center gap-2">
                  <div className="w-1 h-1 rounded-full bg-slate-500"></div>
                  <p className="text-xs text-slate-500">
                    {data.length === 1 ? "1 item" : `${data.length} items`}
                    {data.length > 0 && (
                      <span className="ml-1 text-slate-600">
                        • {data[0]?.name}
                        {data.length > 1 && " and others"}
                      </span>
                    )}
                  </p>
                </div>
              )}
              
              {/* Clean empty state */}
              {data.length === 0 && (
                <div className="flex items-center gap-2">
                  <div className="w-1 h-1 rounded-full bg-slate-600"></div>
                  <p className="text-xs text-slate-500">
                    {cardType === 'items' && "No products yet"}
                    {cardType === 'retailers' && "No retailers yet"}
                    {cardType === 'markets' && "No marketplaces yet"}
                    {cardType === 'pokemon_cards' && "No pokemon cards yet"}
                    {cardType === 'video_games' && "No video games yet"}
                    {cardType === 'magic_cards' && "No magic cards yet"}
                    {cardType === 'yugioh_cards' && "No yugioh cards yet"}
                  </p>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Expand/Collapse chevron */}
        <ChevronDown className={`h-5 w-5 text-slate-400 transition-transform duration-200 flex-shrink-0 ${
          isExpanded ? 'rotate-180' : ''
        }`} />
      </div>

      {/* Expanded Content */}
      {isExpanded && (
        <div 
          className="pt-5 border-t border-slate-800 mt-4 overflow-visible"
          onClick={(e) => e.stopPropagation()} // Prevent card expansion when clicking in expanded area
        >
          {/* Header with Selection Count and Actions - Card-like structure without background */}
          <div className="flex items-center justify-between py-1 px-4 mb-2">
            {/* Left side - Selection Count (matches card header structure) */}
            <div className="flex items-center gap-4">
              <input
                type="checkbox"
                checked={selectedRows.size === data.length && data.length > 0}
                onChange={toggleAllSelection}
                className="h-4 w-4 rounded border-slate-600 bg-slate-800 text-indigo-500 focus:ring-indigo-500 focus:ring-2 transition-all flex-shrink-0 accent-indigo-500"
              />
              <div>
                <div className="text-sm sm:text-lg text-slate-400 whitespace-nowrap">
                  {selectedRows.size}/{data.length} Selected
                </div>
              </div>
            </div>

            {/* Right side - Action Buttons */}
            <div className="flex items-center gap-2">

              {/* Determine button visibility based on selection state */}
              {(() => {
                const hasSelection = selectedRows.size > 0;
                const selectedItems = Array.from(selectedRows);
                const hasNewRowsInSelection = selectedItems.some(id => id < 0);
                const hasExistingRows = selectedItems.some(id => id > 0);
                
                // Default state: no selection - show sync all and add buttons
                if (!hasSelection) {
                  return (
                    <>
                      {syncAllProducts && (
                        <button
                          onClick={syncAllProducts}
                          className="w-8 h-8 sm:w-10 sm:h-10 rounded-lg border border-indigo-600 bg-indigo-800/60 hover:bg-indigo-700 hover:border-indigo-500 text-indigo-200 transition-all duration-200 flex items-center justify-center group"
                          title="Sync All Products from Local CSV Data"
                        >
                          <svg className="w-3.5 h-3.5 sm:w-4 sm:h-4 transition-transform group-hover:scale-110" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                          </svg>
                        </button>
                      )}
                      <button
                        onClick={addNewRow}
                        className="w-8 h-8 sm:w-10 sm:h-10 rounded-lg border border-slate-600 bg-slate-800/60 hover:bg-slate-700 hover:border-slate-500 text-slate-200 transition-all duration-200 flex items-center justify-center group"
                        title="Add New Item"
                      >
                        <svg className="w-3.5 h-3.5 sm:w-4 sm:h-4 transition-transform group-hover:scale-110" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
                        </svg>
                      </button>
                    </>
                  );
                }
                
                // New rows only: show X cancel and save buttons
                if (hasNewRowsInSelection && !hasExistingRows) {
                  return (
                    <>
                      <button
                        onClick={cancelNewRows}
                        className="w-8 h-8 sm:w-10 sm:h-10 rounded-lg border border-slate-600 bg-slate-800/60 hover:bg-slate-700 hover:border-slate-500 text-slate-200 transition-all duration-200 flex items-center justify-center group"
                        title="Cancel Changes"
                      >
                        <svg className="w-3.5 h-3.5 sm:w-4 sm:h-4 transition-transform group-hover:scale-110" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                        </svg>
                      </button>
                      <button
                        onClick={bulkSave}
                        className="w-8 h-8 sm:w-10 sm:h-10 rounded-lg border border-slate-600 bg-slate-800/60 hover:bg-slate-700 hover:border-slate-500 text-slate-200 transition-all duration-200 flex items-center justify-center group"
                        title="Save Changes"
                      >
                        <svg className="w-3.5 h-3.5 sm:w-4 sm:h-4 transition-transform group-hover:scale-110" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                        </svg>
                      </button>
                    </>
                  );
                }
                
                // Mixed or existing rows only: show cancel, save, delete buttons
                return (
                  <>
                    <button
                      onClick={clearSelection}
                    className="w-8 h-8 sm:w-10 sm:h-10 rounded-lg border border-slate-600 bg-slate-800/60 hover:bg-slate-700 hover:border-slate-500 text-slate-200 transition-all duration-200 flex items-center justify-center group"
                    title="Cancel Selection"
                  >
                    <svg className="w-3.5 h-3.5 sm:w-4 sm:h-4 transition-transform group-hover:scale-110" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  </button>
                  <button
                    onClick={bulkSave}
                    className="w-8 h-8 sm:w-10 sm:h-10 rounded-lg border border-slate-600 bg-slate-800/60 hover:bg-slate-700 hover:border-slate-500 text-slate-200 transition-all duration-200 flex items-center justify-center group"
                    title="Save Selected"
                  >
                    <svg className="w-3.5 h-3.5 sm:w-4 sm:h-4 transition-transform group-hover:scale-110" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7H5a2 2 0 00-2 2v9a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-3m-1 4l-3 3m0 0l-3-3m3 3V4" />
                    </svg>
                  </button>
                  {bulkUpdatePrices && (
                    <button
                      onClick={() => bulkUpdatePrices(Array.from(selectedItems))}
                      className="w-8 h-8 sm:w-10 sm:h-10 rounded-lg border border-indigo-600 bg-indigo-800/60 hover:bg-indigo-700 hover:border-indigo-500 text-indigo-200 transition-all duration-200 flex items-center justify-center group"
                      title="Update Prices from Local CSV Data"
                    >
                      <svg className="w-3.5 h-3.5 sm:w-4 sm:h-4 transition-transform group-hover:scale-110" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                      </svg>
                    </button>
                  )}
                  <button
                    onClick={bulkDelete}
                    className="w-8 h-8 sm:w-10 sm:h-10 rounded-lg border border-slate-600 bg-slate-800/60 hover:bg-slate-700 hover:border-slate-500 text-slate-200 transition-all duration-200 flex items-center justify-center group"
                    title="Delete Selected"
                  >
                    <svg className="w-3.5 h-3.5 sm:w-4 sm:h-4 transition-transform group-hover:scale-110" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                    </svg>
                  </button>
                </>
                );
              })()}
            </div>
          </div>

          {/* Page break line */}
          <div className="border-b border-slate-700 mb-2"></div>

          {/* Column Headers */}
          <div className={`hidden sm:grid gap-4 px-4 py-3 border-b border-slate-800 text-xs text-slate-400 font-medium ${
            cardType === 'retailers' 
              ? 'grid-cols-1 sm:grid-cols-[auto_1fr_auto]' 
              : 'grid-cols-1 sm:grid-cols-[auto_2fr_1fr]'
          }`}>
            <div className="w-6"></div>
            <div className="text-left">Name</div>
            {cardType === 'items' && <div className="text-left">Market Value</div>}
            {cardType === 'markets' && <div className="text-left">Fee (%)</div>}
            {cardType === 'retailers' && <div className="w-16"></div>}
              </div>

          {/* Rows - No scroll, show all data */}
          <div className="space-y-2 overflow-visible">
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
  const [selectedProduct, setSelectedProduct] = useState(null);

  const handleProductSelect = (product) => {
    setSelectedProduct(product);
    setName(product.product_name);
    // Set market value from the product data if available
    if (product.loose_price) {
      setDetails(product.loose_price.toString());
    }
  };

  const handleSave = async () => {
    if (busy) return;
    setBusy(true);
    setStatus("Saving…");
    
    try {
      if (row.type === 'item') {
        const market_value_cents = moneyToCents(details);
        const itemData = { 
          name: name.trim(), 
          market_value_cents,
          price_source: selectedProduct ? 'api' : 'manual'
        };
        
        // Add API-related fields if a product was selected
        if (selectedProduct) {
          itemData.api_product_id = selectedProduct.product_id;
          itemData.api_price_cents = selectedProduct.loose_price ? Math.round(selectedProduct.loose_price * 100) : null;
          itemData.api_last_updated = new Date().toISOString();
          itemData.upc_code = selectedProduct.upc_code || null;
          itemData.product_category = 'Pokemon Cards';
          itemData.console_name = selectedProduct.console_name || null;
        }
        
        const { error } = await supabase
          .from("items")
          .insert(itemData);
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

  // No useEffect - we'll handle save directly in the component

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
      className={`rounded-xl border bg-slate-900/60 p-3 overflow-visible transition cursor-pointer ${
        isSelected
          ? 'border-indigo-500 bg-indigo-500/10' 
          : 'border-slate-800 hover:bg-slate-800/50'
      }`}
      onClick={onToggleSelection}
    >
      {/* Desktop: Grid layout */}
      <div className={`hidden sm:grid gap-4 items-center min-w-0 ${
        row.type === 'retailer' 
          ? 'grid-cols-1 sm:grid-cols-[1fr_auto]' 
          : 'grid-cols-1 sm:grid-cols-[2fr_1fr]'
      }`}>
        {row.type === 'item' ? (
          <div onClick={(e) => e.stopPropagation()}>
            <ProductSearchDropdown
              value={name}
              onChange={setName}
              onProductSelect={handleProductSelect}
              placeholder="Search Pokemon cards..."
              className="w-full"
            />
          </div>
        ) : (
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
        )}
        
        <div className="flex items-center gap-2">
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
          
          {/* Row action buttons */}
          <div className="flex gap-1">
            <button
              onClick={(e) => {
                e.stopPropagation();
                handleSave();
              }}
              disabled={busy}
              className="w-8 h-8 rounded-lg border border-slate-600 bg-slate-800/60 hover:bg-slate-700 hover:border-slate-500 text-slate-200 transition-all duration-200 flex items-center justify-center group disabled:opacity-50 disabled:cursor-not-allowed"
              title="Save New Row"
            >
              <svg className="w-3 h-3 transition-transform group-hover:scale-110" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7H5a2 2 0 00-2 2v9a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-3m-1 4l-3 3m0 0l-3-3m3 3V4" />
              </svg>
            </button>
            <button
              onClick={(e) => {
                e.stopPropagation();
                onCancel();
              }}
              className="w-8 h-8 rounded-lg border border-slate-600 bg-slate-800/60 hover:bg-slate-700 hover:border-slate-500 text-slate-200 transition-all duration-200 flex items-center justify-center group"
              title="Cancel New Row"
            >
              <svg className="w-3 h-3 transition-transform group-hover:scale-110" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
        </div>
      </div>

      {/* Mobile: Stacked layout with labels - NO checkbox */}
      <div className="sm:hidden space-y-3">
        <div>
          <label className="block text-xs text-slate-400 mb-1">
            {row.type === 'item' ? 'Item Name' : 
             row.type === 'retailer' ? 'Retailer Name' : 
             'Marketplace Name'}
          </label>
          {row.type === 'item' ? (
            <div onClick={(e) => e.stopPropagation()}>
              <ProductSearchDropdown
                value={name}
                onChange={setName}
                onProductSelect={handleProductSelect}
                placeholder="Search Pokemon cards..."
                className="w-full"
              />
            </div>
          ) : (
            <input
              className="w-full h-10 appearance-none bg-slate-900/60 border border-slate-800 rounded-xl px-3 py-2 text-sm text-slate-100 placeholder-slate-400 outline-none focus:border-indigo-500"
              value={name}
              onChange={(e) => {
                e.stopPropagation();
                setName(e.target.value);
              }}
              onClick={(e) => e.stopPropagation()}
              placeholder={getPlaceholder()}
            />
          )}
        </div>
        
        {row.type !== 'retailer' && (
          <div>
            <label className="block text-xs text-slate-400 mb-1">
              {row.type === 'item' ? 'Market Value' : 'Fee (%)'}
            </label>
            <div className="flex items-center gap-2">
              <input
                className="flex-1 h-10 appearance-none bg-slate-900/60 border border-slate-800 rounded-xl px-3 py-2 text-sm text-slate-100 placeholder-slate-400 outline-none focus:border-indigo-500"
                value={details}
                onChange={(e) => {
                  e.stopPropagation();
                  setDetails(e.target.value);
                }}
                onClick={(e) => e.stopPropagation()}
                placeholder={getDetailsPlaceholder()}
              />
              
              {/* Row action buttons */}
              <div className="flex gap-1">
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    handleSave();
                  }}
                  disabled={busy}
                  className="w-8 h-8 rounded-lg border border-slate-600 bg-slate-800/60 hover:bg-slate-700 hover:border-slate-500 text-slate-200 transition-all duration-200 flex items-center justify-center group disabled:opacity-50 disabled:cursor-not-allowed"
                  title="Save New Row"
                >
                  <svg className="w-3 h-3 transition-transform group-hover:scale-110" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7H5a2 2 0 00-2 2v9a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-3m-1 4l-3 3m0 0l-3-3m3 3V4" />
                  </svg>
                </button>
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    onCancel();
                  }}
                  className="w-8 h-8 rounded-lg border border-slate-600 bg-slate-800/60 hover:bg-slate-700 hover:border-slate-500 text-slate-200 transition-all duration-200 flex items-center justify-center group"
                  title="Cancel New Row"
                >
                  <svg className="w-3 h-3 transition-transform group-hover:scale-110" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>
            </div>
          </div>
        )}
        
        {row.type === 'retailer' && (
          <div>
            <div className="flex items-center gap-2">
              {/* Row action buttons */}
              <div className="flex gap-1 ml-auto">
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    handleSave();
                  }}
                  disabled={busy}
                  className="w-8 h-8 rounded-lg border border-slate-600 bg-slate-800/60 hover:bg-slate-700 hover:border-slate-500 text-slate-200 transition-all duration-200 flex items-center justify-center group disabled:opacity-50 disabled:cursor-not-allowed"
                  title="Save New Row"
                >
                  <svg className="w-3 h-3 transition-transform group-hover:scale-110" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7H5a2 2 0 00-2 2v9a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-3m-1 4l-3 3m0 0l-3-3m3 3V4" />
                  </svg>
                </button>
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    onCancel();
                  }}
                  className="w-8 h-8 rounded-lg border border-slate-600 bg-slate-800/60 hover:bg-slate-700 hover:border-slate-500 text-slate-200 transition-all duration-200 flex items-center justify-center group"
                  title="Cancel New Row"
                >
                  <svg className="w-3 h-3 transition-transform group-hover:scale-110" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
      
      {/* Mobile-only ghost text for row selection */}
      <div className="sm:hidden text-xs text-slate-500 text-center mt-2 cursor-pointer select-none">
        {isSelected ? "Selected" : "Click to select row"}
      </div>
      
      {status && (
        <div
          className={`text-right text-sm mt-1 ${
            status && status.startsWith("Saved")
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
  const [upcCode, setUpcCode] = useState(item?.upc_code ?? "");
  const [productCategory, setProductCategory] = useState(item?.product_category ?? "");
  const [consoleName, setConsoleName] = useState(item?.console_name ?? "");
  const [status, setStatus] = useState("");
  const [busy, setBusy] = useState(false);
  const [selectedProduct, setSelectedProduct] = useState(null);

  const handleProductSelect = (product) => {
    setSelectedProduct(product);
    setName(product.product_name);
    // Set market value from the product data if available
    if (product.loose_price) {
      setMv(product.loose_price.toString());
    }
    // Set other fields if available
    if (product.upc_code) {
      setUpcCode(product.upc_code);
    }
    if (product.console_name) {
      setConsoleName(product.console_name);
    }
    // Set category to Pokemon Cards if it's a Pokemon product
    if (product.console_name && product.console_name.toLowerCase().includes('pokemon')) {
      setProductCategory('Pokemon Cards');
    }
  };

  async function updateItem() {
    if (busy || disabled) return;
    setBusy(true);
    setStatus("Saving…");
    try {
      const market_value_cents = moneyToCents(mv);
      const updateData = { 
        name: name.trim(), 
        market_value_cents,
        upc_code: upcCode.trim() || null,
        product_category: productCategory.trim() || null,
        console_name: consoleName.trim() || null
      };
      
      // Add API-related fields if a product was selected
      if (selectedProduct) {
        updateData.price_source = 'api';
        updateData.api_product_id = selectedProduct.product_id;
        updateData.api_price_cents = selectedProduct.loose_price ? Math.round(selectedProduct.loose_price * 100) : null;
        updateData.api_last_updated = new Date().toISOString();
      } else {
        updateData.price_source = 'manual';
      }
      
      const { error } = await supabase
        .from("items")
        .update(updateData)
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
      {/* Desktop: Grid layout with checkbox */}
      <div className="hidden sm:grid grid-cols-[auto_2fr_1fr_1fr_1fr_auto] gap-4 items-center min-w-0">
        <input
          type="checkbox"
          checked={isSelected}
          onChange={(e) => {
            e.stopPropagation();
            onToggleSelection();
          }}
          className="h-4 w-4 rounded border-slate-500 bg-slate-800 text-indigo-500 focus:ring-indigo-400 focus:ring-2 transition-all accent-indigo-500"
        />
        
        <div onClick={(e) => e.stopPropagation()}>
          <ProductSearchDropdown
            value={name}
            onChange={setName}
            onProductSelect={handleProductSelect}
            placeholder="Search Pokemon cards..."
            className="w-full"
          />
        </div>
        
        <input
          className="bg-slate-800/30 border border-slate-600/50 rounded-lg px-2 py-2 text-sm text-slate-100 focus:border-indigo-500 focus:outline-none w-full"
          value={mv}
          onChange={(e) => {
            e.stopPropagation();
            setMv(e.target.value);
          }}
          onClick={(e) => e.stopPropagation()}
          placeholder="Market value ($)"
        />
        
        <input
          className="bg-slate-800/30 border border-slate-600/50 rounded-lg px-2 py-2 text-sm text-slate-100 focus:border-indigo-500 focus:outline-none w-full"
          value={upcCode}
          onChange={(e) => {
            e.stopPropagation();
            setUpcCode(e.target.value);
          }}
          onClick={(e) => e.stopPropagation()}
          placeholder="UPC/EAN Code"
        />
        
        <input
          className="bg-slate-800/30 border border-slate-600/50 rounded-lg px-2 py-2 text-sm text-slate-100 focus:border-indigo-500 focus:outline-none w-full"
          value={productCategory}
          onChange={(e) => {
            e.stopPropagation();
            setProductCategory(e.target.value);
          }}
          onClick={(e) => e.stopPropagation()}
          placeholder="Category (e.g., Video Games)"
        />
        
        <div className="flex items-center gap-2">
          
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

      {/* Mobile: Stacked layout with labels - NO checkbox */}
      <div className="sm:hidden space-y-3">
        <div>
          <label className="block text-xs text-slate-400 mb-1">Item Name</label>
          <div onClick={(e) => e.stopPropagation()}>
            <ProductSearchDropdown
              value={name}
              onChange={setName}
              onProductSelect={handleProductSelect}
              placeholder="Search Pokemon cards..."
              className="w-full"
            />
          </div>
        </div>
        
        <div>
          <label className="block text-xs text-slate-400 mb-1">Market Value</label>
          <div className="flex items-center gap-2">
            <input
              className="flex-1 h-10 appearance-none bg-slate-900/60 border border-slate-800 rounded-xl px-3 py-2 text-sm text-slate-100 placeholder-slate-400 outline-none focus:border-indigo-500"
              value={mv}
              onChange={(e) => {
                e.stopPropagation();
                setMv(e.target.value);
              }}
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
      </div>
      
      {/* Mobile-only ghost text for row selection */}
      <div className="sm:hidden text-xs text-slate-500 text-center mt-2 cursor-pointer select-none">
        {isSelected ? "Selected" : "Click to select row"}
      </div>
      
      {status && (
        <div
          className={`text-right text-sm mt-1 ${
            status && status.startsWith("Saved")
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
      {/* Desktop: Grid layout with checkbox */}
      <div className="hidden sm:grid grid-cols-[auto_1fr_auto] gap-4 items-center min-w-0">
        <input
          type="checkbox"
          checked={isSelected}
          onChange={(e) => {
            e.stopPropagation();
            onToggleSelection();
          }}
          className="h-4 w-4 rounded border-slate-500 bg-slate-800 text-indigo-500 focus:ring-indigo-400 focus:ring-2 transition-all accent-indigo-500"
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

      {/* Mobile: Stacked layout with labels - NO checkbox */}
      <div className="sm:hidden space-y-3">
        <div>
          <label className="block text-xs text-slate-400 mb-1">Retailer Name</label>
          <div className="flex items-center gap-2">
            <input
              className="flex-1 h-10 appearance-none bg-slate-900/60 border border-slate-800 rounded-xl px-3 py-2 text-sm text-slate-100 placeholder-slate-400 outline-none focus:border-indigo-500"
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
        </div>
      </div>
      
      {/* Mobile-only ghost text for row selection */}
      <div className="sm:hidden text-xs text-slate-500 text-center mt-2 cursor-pointer select-none">
        {isSelected ? "Selected" : "Click to select row"}
      </div>
      
      {status && (
        <div
          className={`text-right text-sm mt-1 ${
            status && status.startsWith("Saved")
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
      {/* Desktop: Grid layout with checkbox */}
      <div className="hidden sm:grid grid-cols-[auto_2fr_1fr] gap-4 items-center min-w-0">
        <input
          type="checkbox"
          checked={isSelected}
          onChange={(e) => {
            e.stopPropagation();
            onToggleSelection();
          }}
          className="h-4 w-4 rounded border-slate-500 bg-slate-800 text-indigo-500 focus:ring-indigo-400 focus:ring-2 transition-all accent-indigo-500"
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

      {/* Mobile: Stacked layout with labels - NO checkbox */}
      <div className="sm:hidden space-y-3">
        <div>
          <label className="block text-xs text-slate-400 mb-1">Marketplace Name</label>
          <input
            className="w-full h-10 appearance-none bg-slate-900/60 border border-slate-800 rounded-xl px-3 py-2 text-sm text-slate-100 placeholder-slate-400 outline-none focus:border-indigo-500"
            value={name}
            onChange={(e) => {
              e.stopPropagation();
              setName(e.target.value);
            }}
            onBlur={updateMarket}
            onClick={(e) => e.stopPropagation()}
            placeholder="Marketplace name…"
          />
        </div>
        
        <div>
          <label className="block text-xs text-slate-400 mb-1">Fee (%)</label>
          <div className="flex items-center gap-2">
            <input
              className="flex-1 h-10 appearance-none bg-slate-900/60 border border-slate-800 rounded-xl px-3 py-2 text-sm text-slate-100 placeholder-slate-400 outline-none focus:border-indigo-500"
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
      </div>
      
      {/* Mobile-only ghost text for row selection */}
      <div className="sm:hidden text-xs text-slate-500 text-center mt-2 cursor-pointer select-none">
        {isSelected ? "Selected" : "Click to select row"}
      </div>
      
      {status && (
        <div
          className={`text-right text-sm mt-1 ${
            status && status.startsWith("Saved")
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
