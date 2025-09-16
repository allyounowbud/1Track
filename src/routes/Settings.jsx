// src/routes/Settings.jsx
import { useState, useEffect, useRef } from "react";
import { useLocation } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "../lib/supabaseClient";
import LayoutWithSidebar from "../components/LayoutWithSidebar.jsx";
import PageHeader from "../components/PageHeader.jsx";
import ProductSearchDropdown from "../components/ProductSearchDropdown.jsx";
import { CategoryItemRow, NewCategoryRowComponent, SimpleItemRow, NewSimpleRowComponent } from "../components/CategoryComponents.jsx";
import UnifiedProductsCard from "../components/UnifiedProductsCard.jsx";
import { moneyToCents, centsToStr, formatNumber } from "../utils/money.js";
import { pageCard, rowCard, inputSm, headerIconBtn, headerGhostBtn, iconSave, iconSaveBusy, iconDelete } from "../utils/ui.js";
import { getBatchMarketData, getMarketValueInCents, getMarketValueFormatted } from "../services/marketDataService.js";

/* ---------- queries ---------- */
async function getProducts() {
  const { data, error } = await supabase
    .from("products")
    .select("id, name, category, market_value_cents, price_source, api_product_id, api_last_updated, api_price_cents, manual_override, upc_code, console_name, search_terms")
    .order("category, name", { ascending: true });
  if (error) throw error;
  return data;
}

async function getItems() {
  const { data, error } = await supabase
    .from("items")
    .select("id, name, market_value_cents, price_source, api_product_id, api_last_updated, api_price_cents, manual_override")
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
  // Tab and view state
  const location = useLocation();
  const activeTab = location.pathname.split('/')[2] || 'products';
  const [productsView, setProductsView] = useState('sealed'); // 'sealed' or 'singles'

  // Unified products query
  const { data: allProducts = [], refetch: refetchProducts } = useQuery({
    queryKey: ["products"],
    queryFn: getProducts,
  });

  // Helper functions to filter products by category
  const tcgSealed = allProducts.filter(p => p.category === 'tcg_sealed');
  const tcgSingles = allProducts.filter(p => p.category === 'tcg_singles');
  const videoGames = allProducts.filter(p => p.category === 'video_games');
  const otherItems = allProducts.filter(p => p.category === 'other_items');

  // Legacy queries for backward compatibility (will be removed after migration)
  const { data: items = [], refetch: refetchItems } = useQuery({
    queryKey: ["items"],
    queryFn: getItems,
  });

  // Market data state for all categories
  const [marketData, setMarketData] = useState({});
  const [marketDataLoading, setMarketDataLoading] = useState(false);

  // Fetch market data for all products
  useEffect(() => {
    const allProducts = [
      ...tcgSealed.map(item => item.name),
      ...tcgSingles.map(item => item.name),
      ...videoGames.map(item => item.name),
      ...items.map(item => item.name)
    ].filter(Boolean);

    if (allProducts.length > 0) {
      setMarketDataLoading(true);
      getBatchMarketData(allProducts)
        .then(data => {
          setMarketData(data);
          setMarketDataLoading(false);
        })
        .catch(error => {
          console.error('Error fetching market data:', error);
          setMarketDataLoading(false);
        });
    }
  }, [tcgSealed, tcgSingles, videoGames, items]);

  const { data: retailers = [], refetch: refetchRetailers } = useQuery({
    queryKey: ["retailers"],
    queryFn: getRetailers,
  });

  const { data: markets = [], refetch: refetchMarkets } = useQuery({
    queryKey: ["markets"],
    queryFn: getMarkets,
  });

  // Unified products state
  const [selectedProducts, setSelectedProducts] = useState(new Set());
  const [newProductRows, setNewProductRows] = useState([]);
  const [expandedCategories, setExpandedCategories] = useState(new Set(['tcg_sealed'])); // Default to TCG Sealed expanded
  
  // Legacy states for backward compatibility
  const [selectedItems, setSelectedItems] = useState(new Set());
  const [selectedTCGSealed, setSelectedTCGSealed] = useState(new Set());
  const [selectedTCGSingles, setSelectedTCGSingles] = useState(new Set());
  const [selectedVideoGames, setSelectedVideoGames] = useState(new Set());
  const [selectedRetailers, setSelectedRetailers] = useState(new Set());
  const [selectedMarkets, setSelectedMarkets] = useState(new Set());
  
  // Legacy new row states
  const [newItemRows, setNewItemRows] = useState([]);
  const [newTCGSealedRows, setNewTCGSealedRows] = useState([]);
  const [newTCGSinglesRows, setNewTCGSinglesRows] = useState([]);
  const [newVideoGameRows, setNewVideoGameRows] = useState([]);
  const [newRetailerRows, setNewRetailerRows] = useState([]);
  const [newMarketRows, setNewMarketRows] = useState([]);
  
  const [nextNewRowId, setNextNewRowId] = useState(-1);
  
  // Single card expansion state
  const [expandedCard, setExpandedCard] = useState(null);

  // Function to clear all unsaved changes
  const clearAllUnsavedChanges = () => {
    setNewItemRows([]);
    setNewTCGSealedRows([]);
    setNewTCGSinglesRows([]);
    setNewVideoGameRows([]);
    setNewRetailerRows([]);
    setNewMarketRows([]);
    setSelectedItems(new Set());
    setSelectedTCGSealed(new Set());
    setSelectedTCGSingles(new Set());
    setSelectedVideoGames(new Set());
    setSelectedRetailers(new Set());
    setSelectedMarkets(new Set());
    setExpandedCard(null);
  };

  // Helper functions to check if there are new rows in each system
  const hasNewItemRows = newItemRows.length > 0;
  const hasNewTCGSealedRows = newTCGSealedRows.length > 0;
  const hasNewTCGSinglesRows = newTCGSinglesRows.length > 0;
  const hasNewVideoGameRows = newVideoGameRows.length > 0;
  const hasNewRetailerRows = newRetailerRows.length > 0;
  const hasNewMarketRows = newMarketRows.length > 0;

  // Global check for any new rows across all cards
  const hasAnyNewRows = hasNewItemRows || hasNewTCGSealedRows || hasNewTCGSinglesRows || hasNewVideoGameRows || hasNewRetailerRows || hasNewMarketRows;

  // Effect to clear unsaved changes when leaving the page
  useEffect(() => {
    const handleBeforeUnload = (e) => {
      if (hasAnyNewRows) {
        e.preventDefault();
        e.returnValue = '';
        clearAllUnsavedChanges();
      }
    };

    const handleVisibilityChange = () => {
      if (document.visibilityState === 'hidden' && hasAnyNewRows) {
        clearAllUnsavedChanges();
      }
    };

    window.addEventListener('beforeunload', handleBeforeUnload);
    document.addEventListener('visibilitychange', handleVisibilityChange);

    return () => {
      window.removeEventListener('beforeunload', handleBeforeUnload);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      // Don't clear unsaved changes on cleanup - this was causing cards to collapse when adding new rows
    };
  }, [hasAnyNewRows]);

  // Effect to clear unsaved changes when navigating to different tabs or pages
  useEffect(() => {
    if (hasAnyNewRows) {
      clearAllUnsavedChanges();
    }
  }, [location.pathname]); // Clear unsaved changes when the URL path changes

  // Effect to clear unsaved changes when switching tabs within the database page
  useEffect(() => {
    if (hasAnyNewRows) {
      clearAllUnsavedChanges();
    }
  }, [activeTab]); // Clear unsaved changes when switching between database tabs (products, retailers, markets)

  // Effect to clear unsaved changes when switching between Sealed/Singles view in Products tab
  useEffect(() => {
    if (hasAnyNewRows) {
      clearAllUnsavedChanges();
    }
  }, [productsView]); // Clear unsaved changes when switching between Sealed/Singles view

  // Function to determine which card is currently being edited
  const getActiveCard = () => {
    if (hasNewItemRows) return 'items';
    if (hasNewTCGSealedRows) return 'tcg_sealed';
    if (hasNewTCGSinglesRows) return 'tcg_singles';
    if (hasNewVideoGameRows) return 'video_games';
    if (hasNewRetailerRows) return 'retailers';
    if (hasNewMarketRows) return 'markets';
    return null;
  };

  const activeCard = getActiveCard();


  /* ----- Retailer Operations ----- */
  
  // Retailer Operations
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

  function addNewRetailerRow() {
    // Prevent adding new rows if any other card already has a new row
    if (hasAnyNewRows) return;
    
    const newId = nextNewRowId;
    setNextNewRowId(newId - 1);
    setNewRetailerRows(prev => [...prev, { id: newId, type: 'retailer', isNew: true }]);
    setSelectedRetailers(new Set([newId]));
    setExpandedCard('retailers'); // Auto-expand the card when adding a new row
  }

  // Retailer Bulk Operations
  function toggleAllRetailerSelection() {
    if (selectedRetailers.size === retailers.length) {
      if (hasNewRetailerRows) return;
      setSelectedRetailers(new Set());
    } else {
      const allIds = retailers.map(retailer => retailer.id);
      setSelectedRetailers(new Set(allIds));
    }
  }

  async function bulkSaveRetailers() {
    setSelectedRetailers(new Set());
  }

  async function bulkDeleteRetailers() {
    const selectedIds = Array.from(selectedRetailers).filter(id => id > 0);
    if (selectedIds.length === 0) return;
    
    if (!confirm(`Delete ${selectedIds.length} retailer(s)? This action cannot be undone.`)) return;
    
    try {
      const { error } = await supabase
        .from('retailers')
        .delete()
        .in('id', selectedIds);
      
      if (error) throw error;
      await refetchRetailers();
      setSelectedRetailers(new Set());
    } catch (e) {
      alert(`Failed to delete: ${e.message}`);
    }
  }

  /* ----- Marketplace Operations ----- */
  
  // Marketplace Operations
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

  function addNewMarketRow() {
    // Prevent adding new rows if any other card already has a new row
    if (hasAnyNewRows) return;
    
    const newId = nextNewRowId;
    setNextNewRowId(newId - 1);
    setNewMarketRows(prev => [...prev, { id: newId, type: 'marketplace', isNew: true }]);
    setSelectedMarkets(new Set([newId]));
    setExpandedCard('markets'); // Auto-expand the card when adding a new row
  }

  // Marketplace Bulk Operations
  function toggleAllMarketSelection() {
    if (selectedMarkets.size === markets.length) {
      if (hasNewMarketRows) return;
    setSelectedMarkets(new Set());
    } else {
      const allIds = markets.map(market => market.id);
      setSelectedMarkets(new Set(allIds));
    }
  }

  async function bulkSaveMarkets() {
      setSelectedMarkets(new Set());
  }

  async function bulkDeleteMarkets() {
    const selectedIds = Array.from(selectedMarkets).filter(id => id > 0);
    if (selectedIds.length === 0) return;
    
    if (!confirm(`Delete ${selectedIds.length} marketplace(s)? This action cannot be undone.`)) return;
    
    try {
      const { error } = await supabase
        .from('marketplaces')
        .delete()
        .in('id', selectedIds);
      
      if (error) throw error;
      await refetchMarkets();
      setSelectedMarkets(new Set());
    } catch (e) {
      alert(`Failed to delete: ${e.message}`);
    }
  }

  /* ----- TCG Operations ----- */
  
  // TCG Sealed Operations
  function toggleTCGSealedSelection(rowId) {
    const newSelected = new Set(selectedTCGSealed);
    if (newSelected.has(rowId)) {
      const isNewRow = rowId < 0;
      if (isNewRow) return;
      newSelected.delete(rowId);
    } else {
      if (hasNewTCGSealedRows) {
        setSelectedTCGSealed(new Set([rowId]));
        return;
      }
      newSelected.add(rowId);
    }
    setSelectedTCGSealed(newSelected);
  }

  function addNewTCGSealedRow() {
    // Prevent adding new rows if any other card already has a new row
    if (hasAnyNewRows) return;
    
    const newId = nextNewRowId;
    setNextNewRowId(newId - 1);
    setNewTCGSealedRows(prev => [...prev, { id: newId, type: 'tcg_sealed', isNew: true }]);
    setSelectedTCGSealed(new Set([newId]));
    setExpandedCard('tcg_sealed'); // Auto-expand the card when adding a new row
  }

  // TCG Singles Operations
  function toggleTCGSinglesSelection(rowId) {
    const newSelected = new Set(selectedTCGSingles);
    if (newSelected.has(rowId)) {
      const isNewRow = rowId < 0;
      if (isNewRow) return;
      newSelected.delete(rowId);
    } else {
      if (hasNewTCGSinglesRows) {
        setSelectedTCGSingles(new Set([rowId]));
        return;
      }
      newSelected.add(rowId);
    }
    setSelectedTCGSingles(newSelected);
  }

  function addNewTCGSinglesRow() {
    // Prevent adding new rows if any other card already has a new row
    if (hasAnyNewRows) return;
    
    const newId = nextNewRowId;
    setNextNewRowId(newId - 1);
    setNewTCGSinglesRows(prev => [...prev, { id: newId, type: 'tcg_singles', isNew: true }]);
    setSelectedTCGSingles(new Set([newId]));
    setExpandedCard('tcg_singles'); // Auto-expand the card when adding a new row
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
    // Prevent adding new rows if any other card already has a new row
    if (hasAnyNewRows) return;
    
    const newId = nextNewRowId;
    setNextNewRowId(newId - 1);
    setNewVideoGameRows(prev => [...prev, { id: newId, type: 'video_game', isNew: true }]);
    setSelectedVideoGames(new Set([newId]));
    setExpandedCard('video_games'); // Auto-expand the card when adding a new row
  }

  /* ----- Bulk Operations ----- */
  
  // TCG Sealed Bulk Operations
  function toggleAllTCGSealedSelection() {
    if (selectedTCGSealed.size === tcgSealed.length) {
      if (hasNewTCGSealedRows) return;
      setSelectedTCGSealed(new Set());
    } else {
      const allIds = tcgSealed.map(item => item.id);
      setSelectedTCGSealed(new Set(allIds));
    }
  }

  async function bulkSaveTCGSealed() {
    setSelectedTCGSealed(new Set());
  }

  async function bulkDeleteTCGSealed() {
    const selectedIds = Array.from(selectedTCGSealed).filter(id => id > 0);
    if (selectedIds.length === 0) return;
    
    if (!confirm(`Delete ${selectedIds.length} TCG sealed item(s)? This action cannot be undone.`)) return;
    
    try {
      const { error } = await supabase
        .from('products')
        .delete()
        .in('id', selectedIds);
      
      if (error) throw error;
      await refetchProducts();
      setSelectedTCGSealed(new Set());
    } catch (e) {
      alert(`Failed to delete: ${e.message}`);
    }
  }

  /* ----- Unified Products Operations ----- */
  
  // Unified Products Operations
  function toggleProductSelection(rowId) {
    const newSelected = new Set(selectedProducts);
    if (newSelected.has(rowId)) {
      const isNewRow = rowId < 0;
      if (isNewRow) return;
      newSelected.delete(rowId);
    } else {
      if (newProductRows.length > 0) {
        setSelectedProducts(new Set([rowId]));
        return;
      }
      newSelected.add(rowId);
    }
    setSelectedProducts(newSelected);
  }

  function addNewProductRow(category = 'tcg_sealed') {
    if (newProductRows.length > 0) return; // Only allow one new row at a time
    
    const newId = nextNewRowId;
    setNextNewRowId(newId - 1);
    setNewProductRows(prev => [...prev, { 
      id: newId, 
      category, 
      isNew: true,
      name: '',
      market_value_cents: 0
    }]);
    setSelectedProducts(new Set([newId]));
    setExpandedCategories(prev => new Set([...prev, category])); // Auto-expand the category
  }

  // Unified Products Bulk Operations
  function toggleAllProductsSelection(category) {
    if (category === 'all') {
      // Handle select all for all products
      if (selectedProducts.size === allProducts.length) {
        if (newProductRows.length > 0) return;
        setSelectedProducts(new Set());
      } else {
        const newSelected = new Set(selectedProducts);
        allProducts.forEach(product => newSelected.add(product.id));
        setSelectedProducts(newSelected);
      }
    } else {
      // Handle select all for specific category
      const categoryProducts = allProducts.filter(p => p.category === category);
      const categorySelected = Array.from(selectedProducts).filter(id => {
        const product = allProducts.find(p => p.id === id);
        return product && product.category === category;
      });
      
      if (categorySelected.length === categoryProducts.length) {
        if (newProductRows.length > 0) return;
        // Remove all selections for this category
        const newSelected = new Set(selectedProducts);
        categorySelected.forEach(id => newSelected.delete(id));
        setSelectedProducts(newSelected);
      } else {
        // Select all products in this category
        const newSelected = new Set(selectedProducts);
        categoryProducts.forEach(product => newSelected.add(product.id));
        setSelectedProducts(newSelected);
      }
    }
  }

  async function bulkSaveProducts() {
    setSelectedProducts(new Set());
  }

  async function bulkDeleteProducts() {
    const selectedIds = Array.from(selectedProducts).filter(id => id > 0);
    if (selectedIds.length === 0) return;
    
    if (!confirm(`Delete ${selectedIds.length} product(s)? This action cannot be undone.`)) return;
    
    try {
      const { error } = await supabase
        .from('products')
        .delete()
        .in('id', selectedIds);
      
      if (error) throw error;
      await refetchProducts();
      setSelectedProducts(new Set());
    } catch (e) {
      alert(`Failed to delete: ${e.message}`);
    }
  }

  // Category toggle functions
  function toggleCategoryExpansion(category) {
    setExpandedCategories(prev => {
      const newSet = new Set(prev);
      if (newSet.has(category)) {
        newSet.delete(category);
      } else {
        newSet.add(category);
      }
      return newSet;
    });
  }

  // Remove new row function
  function removeNewRow(rowId) {
    setNewProductRows(prev => prev.filter(row => row.id !== rowId));
    setSelectedProducts(prev => {
      const newSet = new Set(prev);
      newSet.delete(rowId);
      return newSet;
    });
  }

  /* ----- Other Items Operations ----- */
  
  // Other Items Operations
  function toggleItemsSelection(rowId) {
    const newSelected = new Set(selectedItems);
    if (newSelected.has(rowId)) {
      const isNewRow = rowId < 0;
      if (isNewRow) return;
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

  function addNewItemRow() {
    // Prevent adding new rows if any other card already has a new row
    if (hasAnyNewRows) return;
    
    const newId = nextNewRowId;
    setNextNewRowId(newId - 1);
    setNewItemRows(prev => [...prev, { id: newId, category: 'other_items', isNew: true }]);
    setSelectedItems(new Set([newId]));
    setExpandedCard('items'); // Auto-expand the card when adding a new row
  }

  // Other Items Bulk Operations
  function toggleAllItemsSelection() {
    if (selectedItems.size === otherItems.length) {
      if (hasNewItemRows) return;
      setSelectedItems(new Set());
    } else {
      const allIds = otherItems.map(item => item.id);
      setSelectedItems(new Set(allIds));
    }
  }

  async function bulkSaveItems() {
    setSelectedItems(new Set());
  }

  async function bulkDeleteItems() {
    const selectedIds = Array.from(selectedItems).filter(id => id > 0);
    if (selectedIds.length === 0) return;
    
    if (!confirm(`Delete ${selectedIds.length} item(s)? This action cannot be undone.`)) return;
    
    try {
      const { error } = await supabase
        .from('products')
        .delete()
        .in('id', selectedIds);
      
      if (error) throw error;
      await refetchProducts();
      setSelectedItems(new Set());
    } catch (e) {
      alert(`Failed to delete: ${e.message}`);
    }
  }

  // TCG Singles Bulk Operations
  function toggleAllTCGSinglesSelection() {
    if (selectedTCGSingles.size === tcgSingles.length) {
      if (hasNewTCGSinglesRows) return;
      setSelectedTCGSingles(new Set());
    } else {
      const allIds = tcgSingles.map(item => item.id);
      setSelectedTCGSingles(new Set(allIds));
    }
  }

  async function bulkSaveTCGSingles() {
    setSelectedTCGSingles(new Set());
  }

  async function bulkDeleteTCGSingles() {
    const selectedIds = Array.from(selectedTCGSingles).filter(id => id > 0);
    if (selectedIds.length === 0) return;
    
    if (!confirm(`Delete ${selectedIds.length} TCG singles item(s)? This action cannot be undone.`)) return;
    
    try {
      const { error } = await supabase
        .from('tcg_singles')
        .delete()
        .in('id', selectedIds);
      
      if (error) throw error;
      await refetchTCGSingles();
      setSelectedTCGSingles(new Set());
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
        .from('products')
        .delete()
        .in('id', selectedIds);
      
      if (error) throw error;
      await refetchProducts();
      setSelectedVideoGames(new Set());
    } catch (e) {
      alert(`Failed to delete: ${e.message}`);
    }
  }

  /* ----- Components ---------- */

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
                    {cardType === 'items' && "Other products collection with names and market values"}
                    {cardType === 'tcg_sealed' && "TCG sealed products collection with names and market values"}
                    {cardType === 'tcg_singles' && "TCG singles collection with names and market values"}
                  {cardType === 'retailers' && "Retailers where you purchase items"}
                  {cardType === 'markets' && "Marketplaces with their fee percentages"}
                  {cardType === 'video_games' && "Video game collection with names and market values"}
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
                    {cardType === 'items' && "No items yet"}
                    {cardType === 'tcg_sealed' && "No items yet"}
                    {cardType === 'tcg_singles' && "No items yet"}
                    {cardType === 'retailers' && "No retailers yet"}
                    {cardType === 'markets' && "No marketplaces yet"}
                    {cardType === 'video_games' && "No items yet"}
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
            {/* Header with Selection Count and Actions - Only show when not adding new rows and there are items */}
            {!hasNewRows && data.length > 0 && (
            <div className="flex items-center py-1 px-4 mb-2">
              {/* Left side - Selection Count (matches card header structure) */}
              <div className="flex-1">
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
              </div>

              {/* Right side - Action Buttons */}
              <div className="flex items-center gap-2">
              {/* Determine button visibility based on selection state */}
              {(() => {
                const hasSelection = selectedRows.size > 0;
                const selectedItems = Array.from(selectedRows);
                const hasNewRowsInSelection = selectedItems.some(id => id < 0);
                const hasExistingRows = selectedItems.some(id => id > 0);
                
                    // Default state: no selection - show add button
                if (!hasSelection) {
                  return (
                      <button
                        onClick={addNewRow}
                        className="w-8 h-8 sm:w-10 sm:h-10 rounded-lg border border-slate-600 bg-slate-800/60 hover:bg-slate-700 hover:border-slate-500 text-slate-200 transition-all duration-200 flex items-center justify-center group"
                        title="Add New Item"
                      >
                        <svg className="w-3.5 h-3.5 sm:w-4 sm:h-4 transition-transform group-hover:scale-110" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
                        </svg>
                      </button>
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
          )}

            {/* Page break line - Hidden when adding new rows or when no items */}
            {!hasNewRows && data.length > 0 && (
            <div className="border-b border-slate-800 mb-2"></div>
          )}

            {/* Column Headers - Only show when there are items */}
            {data.length > 0 && (
              <div className={`hidden sm:grid gap-4 px-4 py-3 border-b border-slate-800 text-xs text-slate-400 font-medium ${
                cardType === 'retailers' || cardType === 'markets' 
                  ? 'grid-cols-[auto_1fr_auto]' 
                  : 'grid-cols-[auto_2fr_1fr]'
              }`}>
                <div className="w-6"></div>
                <div className="text-left">Name</div>
                {cardType !== 'retailers' && cardType !== 'markets' && (
                  <div className="text-left">Market Value</div>
                )}
                {cardType === 'retailers' || cardType === 'markets' ? (
                  <div className="w-20"></div>
                ) : null}
              </div>
            )}

          {/* Rows - No scroll, show all data */}
          <div className="space-y-2 overflow-visible">
            {/* New rows first */}
            {newRowsData.map(renderNewRow)}

            {/* Existing rows - hide when new rows are present */}
            {!hasNewRows && data.map(renderRow)}

            {data.length === 0 && newRowsData.length === 0 && (
              <div className="px-4 py-8 text-center text-slate-400">
                  {(cardType === 'items' || cardType === 'tcg_sealed' || cardType === 'tcg_singles' || cardType === 'video_games' || cardType === 'retailers' || cardType === 'markets') ? (
                    <>
                      {(cardType === 'retailers' || cardType === 'markets') ? `No ${title.toLowerCase()} yet. Click ` : "No items yet. Click "}
            <button
              onClick={(e) => {
                e.stopPropagation();
                          addNewRow();
              }}
                        className="text-indigo-400 hover:text-indigo-300 cursor-pointer transition-colors"
            >
                        + add new
            </button>
                      {" "}{(cardType === 'retailers' || cardType === 'markets') ? `${title.slice(0, -1).toLowerCase()}.` : "order."}
                    </>
                  ) : (
                    <>
                      No {title.toLowerCase()} yet. Click{" "}
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                          addNewRow();
                  }}
                        className="text-indigo-400 hover:text-indigo-300 underline cursor-pointer transition-colors"
                >
                        + add {title.slice(0, -1).toLowerCase()}
                </button>
                      {" "}to add new {title.slice(0, -1).toLowerCase()}.
                    </>
                  )}
          </div>
        )}
      </div>
            </div>
          )}
      </section>
    );
  }

  return (
    <LayoutWithSidebar active="database" section="database">
      <PageHeader title={`Database - ${activeTab.charAt(0).toUpperCase() + activeTab.slice(1)}`} />

      {/* Products Tab Content */}
      {activeTab === "products" && (
        <div className="space-y-6">
          {/* View Toggle */}
          <div className="flex gap-2">
          <button
              onClick={() => setProductsView('sealed')}
              className={`px-4 py-2 rounded-lg font-medium transition-colors ${
                productsView === 'sealed'
                  ? 'bg-blue-600 text-white'
                  : 'bg-slate-700 text-slate-300 hover:bg-slate-600'
              }`}
            >
              Sealed
          </button>
          <button
              onClick={() => setProductsView('singles')}
              className={`px-4 py-2 rounded-lg font-medium transition-colors ${
                productsView === 'singles'
                  ? 'bg-blue-600 text-white'
                  : 'bg-slate-700 text-slate-300 hover:bg-slate-600'
              }`}
            >
              Singles
          </button>
      </div>

          {/* Unified Products View */}
          {productsView === 'sealed' && (
            <UnifiedProductsCard
              products={allProducts}
              selectedProducts={selectedProducts}
              newProductRows={newProductRows}
              expandedCategories={expandedCategories}
              onToggleProductSelection={toggleProductSelection}
              onToggleAllProductsSelection={toggleAllProductsSelection}
              onAddNewProductRow={addNewProductRow}
              onBulkSave={bulkSaveProducts}
              onBulkDelete={bulkDeleteProducts}
              onToggleCategoryExpansion={toggleCategoryExpansion}
              onRefetch={refetchProducts}
              onRemoveNewRow={removeNewRow}
              marketData={marketData}
              marketDataLoading={marketDataLoading}
            />
          )}

          {/* Singles View */}
          {productsView === 'singles' && (
            <>
              {/* TCG Singles Card */}
              {(!hasAnyNewRows || hasNewTCGSinglesRows) && (
                <SettingsCard
                  title="TCG Singles"
                  totalCount={tcgSingles.length}
                  selectedRows={selectedTCGSingles}
                  newRows={newTCGSinglesRows}
                  hasNewRows={hasNewTCGSinglesRows}
                  toggleAllSelection={toggleAllTCGSinglesSelection}
                  bulkSave={bulkSaveTCGSingles}
                  bulkDelete={bulkDeleteTCGSingles}
                  cancelNewRows={() => {
                    setNewTCGSinglesRows([]);
                    setSelectedTCGSingles(new Set());
                  }}
                  addNewRow={addNewTCGSinglesRow}
                  clearSelection={() => setSelectedTCGSingles(new Set())}
                  data={tcgSingles}
                  newRowsData={newTCGSinglesRows}
                  onRowToggle={toggleTCGSinglesSelection}
                  renderRow={(item) => (
                    <CategoryItemRow
                      key={item.id}
                      item={item}
                      isSelected={selectedTCGSingles.has(item.id)}
                      onToggleSelection={() => toggleTCGSinglesSelection(item.id)}
                      onSave={() => refetchTCGSingles()}
                      disabled={hasNewTCGSinglesRows}
                      category="tcg_singles"
                      isCheckboxDisabled={hasNewTCGSinglesRows}
                      gameType={item.game_type}
                      marketData={marketData}
                      marketDataLoading={marketDataLoading}
                    />
                  )}
                  renderNewRow={(newRow) => (
                    <NewCategoryRowComponent
                      key={newRow.id}
                      row={newRow}
                      isSelected={selectedTCGSingles.has(newRow.id)}
                      onToggleSelection={() => toggleTCGSinglesSelection(newRow.id)}
                      onSave={(data) => {
                        setNewTCGSinglesRows(prev => prev.filter(row => row.id !== newRow.id));
                        setSelectedTCGSingles(new Set());
                        refetchTCGSingles();
                      }}
                      onCancel={() => {
                        setNewTCGSinglesRows(prev => prev.filter(row => row.id !== newRow.id));
                        setSelectedTCGSingles(new Set());
                      }}
                    />
                  )}
                  cardType="tcg_singles"
              isExpanded={expandedCard === 'tcg_singles' || hasNewTCGSinglesRows}
              onToggleExpansion={() => {
                if (hasNewTCGSinglesRows) return; // Prevent collapse when this card has new rows
                setExpandedCard(expandedCard === 'tcg_singles' ? null : 'tcg_singles');
              }}
                />
              )}
            </>
          )}
        </div>
      )}

      {/* Retailers Tab Content */}
      {activeTab === "retailers" && (
        <div className="space-y-6">
          {(!hasAnyNewRows || hasNewRetailerRows) && (
            <SettingsCard
              title="Retailers"
              totalCount={retailers.length}
              selectedRows={selectedRetailers}
              newRows={newRetailerRows}
              hasNewRows={hasNewRetailerRows}
              toggleAllSelection={toggleAllRetailerSelection}
              bulkSave={bulkSaveRetailers}
              bulkDelete={bulkDeleteRetailers}
              cancelNewRows={() => {
                setNewRetailerRows([]);
                setSelectedRetailers(new Set());
              }}
              addNewRow={addNewRetailerRow}
              clearSelection={() => setSelectedRetailers(new Set())}
              data={retailers}
              newRowsData={newRetailerRows}
              onRowToggle={toggleRetailerSelection}
              renderRow={(retailer) => (
                <SimpleItemRow
                  key={retailer.id}
                  item={retailer}
                  isSelected={selectedRetailers.has(retailer.id)}
                  onToggleSelection={() => toggleRetailerSelection(retailer.id)}
                  onSave={() => refetchRetailers()}
                  disabled={hasNewRetailerRows}
                  isCheckboxDisabled={hasNewRetailerRows}
                />
              )}
              renderNewRow={(newRow) => (
                <NewSimpleRowComponent
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
              isExpanded={expandedCard === 'retailers' || hasNewRetailerRows}
              onToggleExpansion={() => {
                if (hasNewRetailerRows) return; // Prevent collapse when this card has new rows
                setExpandedCard(expandedCard === 'retailers' ? null : 'retailers');
              }}
            />
          )}
        </div>
      )}

      {/* Marketplaces Tab Content */}
      {activeTab === "marketplaces" && (
        <div className="space-y-6">
          {(!hasAnyNewRows || hasNewMarketRows) && (
            <SettingsCard
              title="Marketplaces"
              totalCount={markets.length}
              selectedRows={selectedMarkets}
              newRows={newMarketRows}
              hasNewRows={hasNewMarketRows}
              toggleAllSelection={toggleAllMarketSelection}
              bulkSave={bulkSaveMarkets}
              bulkDelete={bulkDeleteMarkets}
              cancelNewRows={() => {
                setNewMarketRows([]);
                setSelectedMarkets(new Set());
              }}
              addNewRow={addNewMarketRow}
              clearSelection={() => setSelectedMarkets(new Set())}
              data={markets}
              newRowsData={newMarketRows}
              onRowToggle={toggleMarketSelection}
              renderRow={(market) => (
                <SimpleItemRow
                  key={market.id}
                  item={market}
                  isSelected={selectedMarkets.has(market.id)}
                  onToggleSelection={() => toggleMarketSelection(market.id)}
                  onSave={() => refetchMarkets()}
                  disabled={hasNewMarketRows}
                  isCheckboxDisabled={hasNewMarketRows}
                />
              )}
              renderNewRow={(newRow) => (
                <NewSimpleRowComponent
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
              isExpanded={expandedCard === 'markets' || hasNewMarketRows}
              onToggleExpansion={() => {
                if (hasNewMarketRows) return; // Prevent collapse when this card has new rows
                setExpandedCard(expandedCard === 'markets' ? null : 'markets');
              }}
            />
          )}
        </div>
      )}
    </LayoutWithSidebar>
  );
}