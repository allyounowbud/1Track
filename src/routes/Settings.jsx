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
import UnifiedRetailersCard from "../components/UnifiedRetailersCard.jsx";
import UnifiedMarketplacesCard from "../components/UnifiedMarketplacesCard.jsx";
import { moneyToCents, centsToStr, formatNumber } from "../utils/money.js";
import { pageCard, rowCard, inputSm, headerIconBtn, headerGhostBtn, iconSave, iconSaveBusy, iconDelete } from "../utils/ui.js";

/* ---------- queries ---------- */
async function getProducts() {
  console.log('Fetching products from items table...');
  const { data, error } = await supabase
    .from("items")
    .select("id, name, product_category, market_value_cents, price_source, api_product_id, api_last_updated, api_price_cents, manual_override, upc_code, console_name, search_terms")
    .order("product_category, name", { ascending: true });
  if (error) {
    console.error('Error fetching products:', error);
    throw error;
  }
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

  // Unified products query
  const { data: allProducts = [], refetch: refetchProducts, isLoading: productsLoading, error: productsError } = useQuery({
    queryKey: ["products"],
    queryFn: getProducts,
  });


  // Helper functions to filter products by category
  const collectibles = allProducts.filter(p => p.product_category === 'Collectibles');
  const sportsCards = allProducts.filter(p => p.product_category === 'Sports Cards');
  const otherItems = allProducts.filter(p => p.product_category === 'Other');

  // Legacy queries for backward compatibility (will be removed after migration)
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

  // Unified products state
  const [selectedProducts, setSelectedProducts] = useState(new Set());
  const [newProductRows, setNewProductRows] = useState([]);
  const [expandedCategories, setExpandedCategories] = useState(new Set(['Collectibles', 'Sports Cards', 'Other'])); // Default to all categories expanded
  
  // Legacy states for backward compatibility
  const [selectedItems, setSelectedItems] = useState(new Set());
  const [selectedTCGSealed, setSelectedTCGSealed] = useState(new Set());
  const [selectedVideoGames, setSelectedVideoGames] = useState(new Set());
  const [selectedRetailers, setSelectedRetailers] = useState(new Set());
  const [selectedMarkets, setSelectedMarkets] = useState(new Set());
  
  // Legacy new row states
  const [newItemRows, setNewItemRows] = useState([]);
  const [newTCGSealedRows, setNewTCGSealedRows] = useState([]);
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
    setNewVideoGameRows([]);
    setNewRetailerRows([]);
    setNewMarketRows([]);
    setSelectedItems(new Set());
    setSelectedTCGSealed(new Set());
    setSelectedVideoGames(new Set());
    setSelectedRetailers(new Set());
    setSelectedMarkets(new Set());
    setExpandedCard(null);
  };

  // Helper functions to check if there are new rows in each system
  const hasNewItemRows = newItemRows.length > 0;
  const hasNewTCGSealedRows = newTCGSealedRows.length > 0;
  const hasNewVideoGameRows = newVideoGameRows.length > 0;
  const hasNewRetailerRows = newRetailerRows.length > 0;
  const hasNewMarketRows = newMarketRows.length > 0;

  // Global check for any new rows across all cards
  const hasAnyNewRows = hasNewItemRows || hasNewTCGSealedRows || hasNewVideoGameRows || hasNewRetailerRows || hasNewMarketRows;

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


  // Function to determine which card is currently being edited
  const getActiveCard = () => {
    if (hasNewItemRows) return 'items';
    if (hasNewTCGSealedRows) return 'tcg_sealed';
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
    setSelectedProducts(newSelected);
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
  
  // Collectibles Bulk Operations
  function toggleAllCollectiblesSelection() {
    if (selectedTCGSealed.size === collectibles.length) {
      if (hasNewTCGSealedRows) return;
      setSelectedTCGSealed(new Set());
    } else {
      const allIds = collectibles.map(item => item.id);
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
        .from('items')
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

  function addNewProductRow(category = '') {
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
    if (category === false) {
      // Clear all selections
      setSelectedProducts(new Set());
      return;
    }
    
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
      const categoryProducts = allProducts.filter(p => p.product_category === category);
      const categorySelected = Array.from(selectedProducts).filter(id => {
        const product = allProducts.find(p => p.id === id);
        return product && product.product_category === category;
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
    // For now, just clear selection since individual saves are handled by CategoryItemRow
    // In the future, this could be enhanced to save all selected items at once
    setSelectedProducts(new Set());
  }

  async function bulkDeleteProducts() {
    const selectedIds = Array.from(selectedProducts).filter(id => id > 0);
    if (selectedIds.length === 0) return;
    
    if (!confirm(`Delete ${selectedIds.length} product(s)? This action cannot be undone.`)) return;
    
    try {
      const { error } = await supabase
        .from('items')
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

  // Delete category function
  async function deleteCategory(categoryToDelete) {
    // Prevent deletion of "Other" category
    if (categoryToDelete === 'Other') {
      alert('The "Other" category cannot be deleted.');
      return;
    }

    // Confirm deletion
    const categoryProducts = allProducts.filter(p => p.product_category === categoryToDelete);
    const confirmMessage = categoryProducts.length > 0 
      ? `Delete category "${categoryToDelete}"? This will move ${categoryProducts.length} items to the "Other" category.`
      : `Delete category "${categoryToDelete}"?`;
    
    if (!confirm(confirmMessage)) {
      return;
    }

    try {
      // If there are products in this category, move them to "Other"
      if (categoryProducts.length > 0) {
        const productIds = categoryProducts.map(p => p.id);
        
        const { error } = await supabase
          .from('items')
          .update({ product_category: 'Other' })
          .in('id', productIds);

        if (error) {
          console.error('Error moving products to Other category:', error);
          alert('Error moving products to Other category. Please try again.');
          return;
        }
      }

      // Remove category from expanded categories if it was expanded
      setExpandedCategories(prev => {
        const newSet = new Set(prev);
        newSet.delete(categoryToDelete);
        return newSet;
      });

      // Refresh the data
      await refetchProducts();
      
      console.log(`Category "${categoryToDelete}" deleted successfully`);
    } catch (error) {
      console.error('Error deleting category:', error);
      alert('Error deleting category. Please try again.');
    }
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
        .from('items')
        .delete()
        .in('id', selectedIds);
      
      if (error) throw error;
      await refetchProducts();
      setSelectedItems(new Set());
    } catch (e) {
      alert(`Failed to delete: ${e.message}`);
    }
  }


  // Sports Cards Bulk Operations
  function toggleAllSportsCardsSelection() {
    if (selectedVideoGames.size === sportsCards.length) {
      if (hasNewVideoGameRows) return;
      setSelectedVideoGames(new Set());
    } else {
      const allIds = sportsCards.map(card => card.id);
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
        .from('items')
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
      className={`${pageCard} mb-6 cursor-pointer hover:bg-gray-100 dark:hover:bg-slate-800/20 transition-colors`}
      onClick={onToggleExpansion}
    >
      {/* Card Header */}
      <div 
        className="flex items-center justify-between gap-3 flex-wrap sm:flex-nowrap rounded-xl p-2 -m-2"
      >
        <div className="min-w-0 flex-1">
          <h2 className="text-lg font-semibold leading-[2.25rem]">{title}</h2>
          <p className="text-xs text-gray-500 dark:text-slate-400 -mt-1">Total: {totalCount}</p>
          
          {/* Collapsed preview content */}
          {!isExpanded && (
            <div className="mt-3">
              {/* Clean purpose description */}
              <div className="mb-2">
                <p className="text-sm text-gray-700 dark:text-slate-300">
                    {cardType === 'items' && "Other products collection with names and market values"}
                    {cardType === 'tcg_sealed' && "TCG sealed products collection with names and market values"}
                  {cardType === 'retailers' && "Retailers where you purchase items"}
                  {cardType === 'markets' && "Marketplaces with their fee percentages"}
                  {cardType === 'video_games' && "Video game collection with names and market values"}
                </p>
              </div>
              
              {/* Clean sample preview */}
              {data.length > 0 && (
                <div className="flex items-center gap-2">
                  <div className="w-1 h-1 rounded-full bg-gray-400 dark:bg-slate-500"></div>
                  <p className="text-xs text-gray-500 dark:text-slate-500">
                    {data.length === 1 ? "1 item" : `${data.length} items`}
                    {data.length > 0 && (
                      <span className="ml-1 text-gray-600 dark:text-slate-600">
                        • {data[0]?.name}
                        {data.length > 1 && " and others"}
                      </span>
                    )}
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
                  {(cardType === 'items' || cardType === 'tcg_sealed' || cardType === 'video_games' || cardType === 'retailers' || cardType === 'markets') ? (
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
      {/* Mobile App Style Header */}
      <div className="px-4 py-4 border-b border-gray-200 dark:border-gray-700/50">
        <h1 className="text-xl font-bold text-gray-900 dark:text-white">
          {activeTab === "products" ? "Add Products" : 
           activeTab === "retailers" ? "Add Retailers" : 
           activeTab === "marketplaces" ? "Add Marketplaces" : 
           `Database - ${activeTab.charAt(0).toUpperCase() + activeTab.slice(1)}`}
        </h1>
        <p className="text-sm text-gray-600 dark:text-gray-300 mt-1">
          {activeTab === "products" ? "Manage your product database" :
           activeTab === "retailers" ? "Manage retailers" :
           activeTab === "marketplaces" ? "Manage marketplaces" :
           "Database management"}
        </p>
      </div>
      
      {/* Description for each tab */}
      {activeTab === "products" && (
        <div className="px-4 py-4 text-xs text-gray-600 dark:text-gray-400 mb-4 leading-relaxed">
          <p className="mb-1">
            <strong>Manual Product Database:</strong> Add items not tracked by the API with custom categories and market values.
          </p>
          <p className="mb-1">
            <strong>How to use:</strong> Click "Add Product" to create new entries, select rows for bulk actions (save/delete), or expand categories to edit existing items.
          </p>
          <p>
            <strong>Categories:</strong> Organize items by type (Collectibles, Sports Cards, etc.) for better inventory management.
          </p>
        </div>
      )}
      {activeTab === "retailers" && (
        <p className="px-4 py-4 text-sm text-gray-700 dark:text-gray-300 mb-6">
          Retailers where you purchase items for your collection.
        </p>
      )}
      {activeTab === "marketplaces" && (
        <p className="px-4 py-4 text-sm text-gray-700 dark:text-gray-300 mb-6">
          Marketplaces with their fee percentages for selling items.
        </p>
      )}

      {/* Products Tab Content */}
      {activeTab === "products" && (
        <div className="px-4 py-4 space-y-6">
          {/* Unified Products View */}
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
            onDeleteCategory={deleteCategory}
            onRefetch={refetchProducts}
            onRemoveNewRow={removeNewRow}
            isLoading={productsLoading}
            error={productsError}
          />
        </div>
      )}

      {/* Retailers Tab Content */}
      {activeTab === "retailers" && (
        <div className="px-4 py-4 space-y-6">
          <UnifiedRetailersCard
            retailers={retailers}
            selectedRetailers={selectedRetailers}
            newRetailerRows={newRetailerRows}
            onToggleRetailerSelection={toggleRetailerSelection}
            onToggleAllRetailersSelection={toggleAllRetailerSelection}
            onAddNewRetailerRow={addNewRetailerRow}
            onBulkSave={bulkSaveRetailers}
            onBulkDelete={bulkDeleteRetailers}
            onRefetch={refetchRetailers}
            onRemoveNewRow={removeNewRow}
          />
        </div>
      )}

      {/* Marketplaces Tab Content */}
      {activeTab === "marketplaces" && (
        <div className="px-4 py-4 space-y-6">
          <UnifiedMarketplacesCard
            marketplaces={markets}
            selectedMarketplaces={selectedMarkets}
            newMarketplaceRows={newMarketRows}
            onToggleMarketplaceSelection={toggleMarketSelection}
            onToggleAllMarketplacesSelection={toggleAllMarketSelection}
            onAddNewMarketplaceRow={addNewMarketRow}
            onBulkSave={bulkSaveMarkets}
            onBulkDelete={bulkDeleteMarkets}
            onRefetch={refetchMarkets}
            onRemoveNewRow={removeNewRow}
          />
        </div>
      )}
    </LayoutWithSidebar>
  );
}