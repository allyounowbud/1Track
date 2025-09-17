// Comprehensive search page like Collectr for browsing and adding items to collection
import { useState, useEffect, useMemo, useRef } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '../lib/supabaseClient.js';
import { centsToStr } from '../utils/money.js';
import { card, inputBase } from '../utils/ui.js';

// Icons
const SearchIcon = () => (
  <svg className="w-5 h-5" viewBox="0 0 20 20" fill="currentColor">
    <path fillRule="evenodd" d="M9 3.5a5.5 5.5 0 100 11 5.5 5.5 0 000-11zM2 9a7 7 0 1112.452 4.391l3.328 3.329a.75.75 0 11-1.06 1.06l-3.329-3.328A7 7 0 012 9z" clipRule="evenodd" />
  </svg>
);

const FilterIcon = () => (
  <svg className="w-5 h-5" viewBox="0 0 20 20" fill="currentColor">
    <path d="M10 3.75a2 2 0 10-4 0 2 2 0 004 0zM17.25 4.5H.75a.75.75 0 000 1.5h16.5a.75.75 0 000-1.5zM5 10.75a2 2 0 11-4 0 2 2 0 014 0zM19.25 11.5H8.75a.75.75 0 000 1.5h10.5a.75.75 0 000-1.5zM12.75 17.75a2 2 0 11-4 0 2 2 0 014 0zM19.25 18.5H15a.75.75 0 000 1.5h4.25a.75.75 0 000-1.5z" />
  </svg>
);

const PlusIcon = () => (
  <svg className="w-4 h-4" viewBox="0 0 20 20" fill="currentColor">
    <path d="M10.75 4.75a.75.75 0 00-1.5 0v4.5h-4.5a.75.75 0 000 1.5h4.5v4.5a.75.75 0 001.5 0v-4.5h4.5a.75.75 0 000-1.5h-4.5v-4.5z" />
  </svg>
);

const ChevronDownIcon = () => (
  <svg className="w-4 h-4" viewBox="0 0 20 20" fill="currentColor">
    <path fillRule="evenodd" d="M5.23 7.21a.75.75 0 011.06.02L10 11.168l3.71-3.938a.75.75 0 111.08 1.04l-4.25 4.5a.75.75 0 01-1.08 0l-4.25-4.5a.75.75 0 01.02-1.06z" clipRule="evenodd" />
  </svg>
);

const StarIcon = () => (
  <svg className="w-4 h-4" viewBox="0 0 20 20" fill="currentColor">
    <path fillRule="evenodd" d="M10.868 2.884c-.321-.772-1.415-.772-1.736 0l-1.83 4.401-4.753.381c-.833.067-1.171 1.107-.536 1.651l3.62 3.102-1.106 4.637c-.194.813.691 1.456 1.405 1.02L10 15.591l4.069 2.485c.713.436 1.598-.207 1.404-1.02l-1.106-4.637 3.62-3.102c.635-.544.297-1.584-.536-1.65l-4.752-.382-1.831-4.401z" clipRule="evenodd" />
  </svg>
);

const LoadingSpinner = () => (
  <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-slate-400"></div>
);

// Search API function
async function searchProducts(query, filters = {}) {
  if (!query.trim()) return [];
  
  try {
    const response = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/price-charting/search?q=${encodeURIComponent(query)}&limit=100`, {
      headers: {
        'Authorization': `Bearer ${import.meta.env.VITE_SUPABASE_ANON_KEY}`,
        'Content-Type': 'application/json',
      }
    });
    
    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }
    
    const data = await response.json();
    
    if (data.success && data.data) {
      let products = [];
      
      if (data.data.products && Array.isArray(data.data.products)) {
        products = data.data.products;
      } else if (Array.isArray(data.data)) {
        products = data.data;
      } else if (data.data.product) {
        products = [data.data.product];
      }
      
      // Apply filters
      return products.filter(product => {
        const productName = (product['product-name'] || product.product_name || product.name || '').toLowerCase();
        const consoleName = (product['console-name'] || product.console_name || product.console || '').toLowerCase();
        
        // Filter by TCG type
        if (filters.tcgType && filters.tcgType !== 'all') {
          const tcgType = filters.tcgType.toLowerCase();
          if (tcgType === 'pokemon') {
            if (!productName.includes('pokemon') && !productName.includes('pokémon') && !consoleName.includes('pokemon')) {
              return false;
            }
          } else if (tcgType === 'magic') {
            if (!productName.includes('magic') && !productName.includes('mtg') && !consoleName.includes('magic')) {
              return false;
            }
          } else if (tcgType === 'yugioh') {
            if (!productName.includes('yugioh') && !productName.includes('yu-gi-oh') && !consoleName.includes('yugioh')) {
              return false;
            }
          } else if (tcgType === 'sports') {
            if (!productName.includes('baseball') && !productName.includes('football') && !productName.includes('basketball') && !productName.includes('sports')) {
              return false;
            }
          } else if (tcgType === 'video_games') {
            if (!productName.includes('nintendo') && !productName.includes('playstation') && !productName.includes('xbox') && !productName.includes('game')) {
              return false;
            }
          }
        }
        
        // Filter by set name
        if (filters.setName && filters.setName.trim()) {
          const setName = filters.setName.toLowerCase();
          if (!consoleName.includes(setName) && !productName.includes(setName)) {
            return false;
          }
        }
        
        // Filter by product type
        if (filters.productType && filters.productType !== 'all') {
          const productType = filters.productType.toLowerCase();
          if (productType === 'sealed') {
            // Sealed products typically don't have '#' in the name (which indicates singles)
            if (productName.includes('#')) {
              return false;
            }
          } else if (productType === 'singles') {
            // Singles typically have '#' in the name
            if (!productName.includes('#')) {
              return false;
            }
          }
        }
        
        return true;
      });
    }
    
    return [];
  } catch (error) {
    console.error('Error searching products:', error);
    return [];
  }
}

// Product Card Component
function ProductCard({ product, onAddToCollection, onSelectProduct }) {
  const [isAdding, setIsAdding] = useState(false);
  const [isHovered, setIsHovered] = useState(false);
  const [inventoryCount, setInventoryCount] = useState(0);
  
  const productName = product['product-name'] || product.product_name || product.name || 'Unknown Product';
  
  // Fetch inventory count for this product
  useEffect(() => {
    const fetchInventoryCount = async () => {
      try {
        const { data, error } = await supabase
          .from('orders')
          .select('*')
          .eq('item', productName)
          .neq('status', 'sold');
        
        if (error) throw error;
        
        const count = data ? data.length : 0;
        setInventoryCount(count);
      } catch (error) {
        console.error('Error fetching inventory count:', error);
        setInventoryCount(0);
      }
    };
    
    fetchInventoryCount();
  }, [productName]);
  const consoleName = product['console-name'] || product.console_name || product.console || '';
  const loosePrice = product['loose-price'] ? parseFloat(product['loose-price']) / 100 : 0;
  const cibPrice = product['cib-price'] ? parseFloat(product['cib-price']) / 100 : 0;
  const newPrice = product['new-price'] ? parseFloat(product['new-price']) / 100 : 0;
  
  // Determine best price to display
  const bestPrice = newPrice || cibPrice || loosePrice || 0;
  const priceType = newPrice ? 'New' : cibPrice ? 'CIB' : loosePrice ? 'Loose' : '';
  
  // Determine if it's a sealed product or single
  const isSealed = !productName.includes('#');
  const isPokemon = productName.toLowerCase().includes('pokemon') || productName.toLowerCase().includes('pokémon') || consoleName.toLowerCase().includes('pokemon');
  const isMagic = productName.toLowerCase().includes('magic') || productName.toLowerCase().includes('mtg') || consoleName.toLowerCase().includes('magic');
  const isYugioh = productName.toLowerCase().includes('yugioh') || productName.toLowerCase().includes('yu-gi-oh') || consoleName.toLowerCase().includes('yugioh');
  const isSports = productName.toLowerCase().includes('baseball') || productName.toLowerCase().includes('football') || productName.toLowerCase().includes('basketball');
  const isVideoGame = productName.toLowerCase().includes('nintendo') || productName.toLowerCase().includes('playstation') || productName.toLowerCase().includes('xbox') || productName.toLowerCase().includes('game');
  
  // Get category color
  let categoryColor = 'bg-slate-500';
  if (isPokemon) categoryColor = 'bg-yellow-500';
  else if (isMagic) categoryColor = 'bg-blue-500';
  else if (isYugioh) categoryColor = 'bg-purple-500';
  else if (isSports) categoryColor = 'bg-green-500';
  else if (isVideoGame) categoryColor = 'bg-red-500';
  
  const handleAddToCollection = async () => {
    setIsAdding(true);
    try {
      await onAddToCollection({
        name: productName,
        console_name: consoleName,
        loose_price: loosePrice,
        cib_price: cibPrice,
        new_price: newPrice,
        is_sealed: isSealed,
        category: isPokemon ? 'pokemon' : isMagic ? 'magic' : isYugioh ? 'yugioh' : isSports ? 'sports' : isVideoGame ? 'video_games' : 'other'
      });
    } finally {
      setIsAdding(false);
    }
  };
  
  return (
    <div 
      className={`${card} p-4 hover:bg-slate-800/80 transition-all duration-200 cursor-pointer flex flex-col h-full`}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
      onClick={() => onSelectProduct && onSelectProduct(product)}
    >
      {/* Product Image - Fixed height */}
      <div className="relative mb-3 flex-shrink-0">
        <div className="w-full h-48 bg-slate-700 rounded-lg flex items-center justify-center relative overflow-hidden">
          {/* Category indicator */}
          <div className={`absolute top-2 left-2 px-2 py-1 rounded text-xs font-medium text-white ${categoryColor}`}>
            {isSealed ? 'Sealed' : 'Single'}
          </div>
          
          {/* Product type icon */}
          <div className="text-6xl text-slate-500">
            {isSealed ? (
              <svg viewBox="0 0 24 24" fill="currentColor">
                <path d="M12 2L2 7L12 12L22 7L12 2Z" />
                <path d="M2 17L12 22L22 17" />
                <path d="M2 12L12 17L22 12" />
              </svg>
            ) : (
              <svg viewBox="0 0 24 24" fill="currentColor">
                <rect x="3" y="4" width="18" height="12" rx="2" />
                <rect x="5" y="6" width="14" height="8" rx="1" />
                <circle cx="9" cy="10" r="1" />
                <circle cx="15" cy="10" r="1" />
              </svg>
            )}
          </div>
          
          {/* Hover overlay */}
          {isHovered && (
            <div className="absolute inset-0 bg-black/50 flex items-center justify-center">
              <div className="text-white text-center">
                <div className="text-lg font-semibold mb-1">View Details</div>
                <div className="text-sm opacity-75">Click to preview</div>
              </div>
            </div>
          )}
        </div>
      </div>
      
      {/* Product Info - Takes remaining space */}
      <div className="flex flex-col flex-1">
        {/* Product Name and Set Name - Grouped together */}
        <div className="mb-4">
          <h3 className="text-slate-200 font-medium text-xs md:text-sm leading-tight line-clamp-2 mb-1">
            {productName}
          </h3>
          {consoleName && (
            <p className="text-slate-400 text-xs hidden md:block">
              {consoleName}
            </p>
          )}
        </div>
        
        {/* Spacer to push price/button to bottom */}
        <div className="flex-1"></div>
        
        {/* Price and Button - Fixed at bottom */}
        <div className="flex items-end justify-between">
          <div className="flex-1 min-w-0">
            <p className="text-slate-100 font-semibold text-sm md:text-lg">
              ${bestPrice.toFixed(2)}
            </p>
            <p className="text-slate-400 text-xs">
              Qty: {inventoryCount}
            </p>
          </div>
          
          {/* Add to Collection Button - Always in same position */}
          <button
            onClick={(e) => {
              e.stopPropagation();
              onSelectProduct(product);
            }}
            className="flex items-center justify-center w-8 h-8 bg-blue-600 hover:bg-blue-700 rounded-lg text-slate-100 transition-colors flex-shrink-0 ml-2"
          >
            <PlusIcon />
          </button>
        </div>
      </div>
    </div>
  );
}


// Product Preview Component
function ProductPreview({ product, onAddToCollection, onClose }) {
  const [orderDate, setOrderDate] = useState(new Date().toISOString().slice(0, 10));
  const [itemName, setItemName] = useState('');
  const [retailerName, setRetailerName] = useState('');
  const [qtyStr, setQtyStr] = useState('1');
  const [buyPrice, setBuyPrice] = useState('');
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState('');
  const [isHighlighted, setIsHighlighted] = useState(false);
  const addToCollectionRef = useRef(null);
  
  // Set the full product name when component mounts or product changes
  useEffect(() => {
    const fullProductName = product['product-name'] || product.product_name || product.name || '';
    setItemName(fullProductName);
    
    // Highlight the add to collection section when component first loads
    setIsHighlighted(true);
    if (addToCollectionRef.current) {
      addToCollectionRef.current.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }
    
    // Remove highlight after 3 seconds
    const timer = setTimeout(() => {
      setIsHighlighted(false);
    }, 3000);
    
    return () => clearTimeout(timer);
  }, [product]);
  
  const productName = product['product-name'] || product.product_name || product.name || 'Unknown Product';
  const consoleName = product['console-name'] || product.console_name || product.console || '';
  const loosePrice = product['loose-price'] ? parseFloat(product['loose-price']) / 100 : 0;
  const cibPrice = product['cib-price'] ? parseFloat(product['cib-price']) / 100 : 0;
  const newPrice = product['new-price'] ? parseFloat(product['new-price']) / 100 : 0;
  
  // Determine if it's a sealed product or single
  const isSealed = !productName.includes('#');
  const isPokemon = productName.toLowerCase().includes('pokemon') || productName.toLowerCase().includes('pokémon') || consoleName.toLowerCase().includes('pokemon');
  const isMagic = productName.toLowerCase().includes('magic') || productName.toLowerCase().includes('mtg') || consoleName.toLowerCase().includes('magic');
  const isYugioh = productName.toLowerCase().includes('yugioh') || productName.toLowerCase().includes('yu-gi-oh') || consoleName.toLowerCase().includes('yugioh');
  const isSports = productName.toLowerCase().includes('baseball') || productName.toLowerCase().includes('football') || productName.toLowerCase().includes('basketball');
  const isVideoGame = productName.toLowerCase().includes('nintendo') || productName.toLowerCase().includes('playstation') || productName.toLowerCase().includes('xbox') || productName.toLowerCase().includes('game');
  
  // Get category color
  let categoryColor = 'bg-slate-500';
  if (isPokemon) categoryColor = 'bg-yellow-500';
  else if (isMagic) categoryColor = 'bg-blue-500';
  else if (isYugioh) categoryColor = 'bg-purple-500';
  else if (isSports) categoryColor = 'bg-green-500';
  else if (isVideoGame) categoryColor = 'bg-red-500';
  
  const handleSubmit = async (e) => {
    e.preventDefault();
    setSaving(true);
    setMsg('');
    
    try {
      // Parse quantity
      const qty = parseInt(qtyStr) || 1;
      const priceCents = Math.round((parseFloat(buyPrice) || 0) * 100);
      
      // Insert into orders table
      const { error } = await supabase
        .from('orders')
        .insert([{
          item: itemName,
          buy_price_cents: priceCents,
          status: 'ordered',
          order_date: orderDate,
          retailer: retailerName || 'Search Page',
          marketplace: 'OneTrack',
          fees_pct: 0,
          shipping_cents: 0
        }]);
      
      if (error) throw error;
      
      setMsg('Item added to collection successfully!');
      
      // Reset form
      setRetailerName('');
      setQtyStr('1');
      setBuyPrice('');
      
    } catch (error) {
      console.error('Error adding item to collection:', error);
      setMsg('Error adding item to collection');
    } finally {
      setSaving(false);
    }
  };
  
  return (
    <div className={`${card} p-3 md:p-4 h-full overflow-y-auto`}>
      {/* Header */}
      <div className="flex items-center justify-between mb-3 md:mb-4">
        <h3 className="text-base md:text-lg font-semibold text-slate-100">Product Details</h3>
        <button
          onClick={onClose}
          className="text-slate-400 hover:text-slate-200 transition-colors"
        >
          <svg className="w-5 h-5" viewBox="0 0 20 20" fill="currentColor">
            <path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd" />
          </svg>
        </button>
      </div>
      
      {/* Product Image */}
      <div className="relative mb-4">
        <div className="w-full h-48 bg-slate-700 rounded-lg flex items-center justify-center relative overflow-hidden">
          <div className={`absolute top-2 left-2 px-2 py-1 rounded text-xs font-medium text-white ${categoryColor}`}>
            {isSealed ? 'Sealed' : 'Single'}
          </div>
          
          <div className="text-6xl text-slate-500">
            {isSealed ? (
              <svg viewBox="0 0 24 24" fill="currentColor">
                <path d="M12 2L2 7L12 12L22 7L12 2Z" />
                <path d="M2 17L12 22L22 17" />
                <path d="M2 12L12 17L22 12" />
              </svg>
            ) : (
              <svg viewBox="0 0 24 24" fill="currentColor">
                <rect x="3" y="4" width="18" height="12" rx="2" />
                <rect x="5" y="6" width="14" height="8" rx="1" />
                <circle cx="9" cy="10" r="1" />
                <circle cx="15" cy="10" r="1" />
              </svg>
            )}
          </div>
        </div>
      </div>
      
      {/* Product Info */}
      <div className="space-y-4">
        <div>
          <h4 className="text-slate-200 font-medium text-lg leading-tight mb-1">
            {productName}
          </h4>
          {consoleName && (
            <p className="text-slate-400 text-sm">
              {consoleName}
            </p>
          )}
        </div>
        
        {/* Price Breakdown */}
        <div>
          <h5 className="text-slate-200 font-medium mb-2">Price Breakdown</h5>
          <div className="space-y-2">
            {loosePrice > 0 && (
              <div className="flex justify-between items-center p-2 bg-slate-800/50 rounded">
                <span className="text-slate-300">Loose</span>
                <span className="text-slate-100 font-medium">${loosePrice.toFixed(2)}</span>
              </div>
            )}
            {cibPrice > 0 && (
              <div className="flex justify-between items-center p-2 bg-slate-800/50 rounded">
                <span className="text-slate-300">CIB</span>
                <span className="text-slate-100 font-medium">${cibPrice.toFixed(2)}</span>
              </div>
            )}
            {newPrice > 0 && (
              <div className="flex justify-between items-center p-2 bg-slate-800/50 rounded">
                <span className="text-slate-300">New</span>
                <span className="text-slate-100 font-medium">${newPrice.toFixed(2)}</span>
              </div>
            )}
          </div>
        </div>
        
        {/* Graded Values (Mock data for now) */}
        {!isSealed && (
          <div>
            <h5 className="text-slate-200 font-medium mb-2">Graded Values</h5>
            <div className="space-y-2">
              <div className="flex justify-between items-center p-2 bg-slate-800/50 rounded">
                <span className="text-slate-300">PSA 10</span>
                <span className="text-slate-100 font-medium">${(newPrice * 2.5).toFixed(2)}</span>
              </div>
              <div className="flex justify-between items-center p-2 bg-slate-800/50 rounded">
                <span className="text-slate-300">PSA 9</span>
                <span className="text-slate-100 font-medium">${(newPrice * 1.8).toFixed(2)}</span>
              </div>
              <div className="flex justify-between items-center p-2 bg-slate-800/50 rounded">
                <span className="text-slate-300">PSA 8</span>
                <span className="text-slate-100 font-medium">${(newPrice * 1.2).toFixed(2)}</span>
              </div>
            </div>
          </div>
        )}
        
        {/* Price History Chart Placeholder */}
        <div>
          <h5 className="text-slate-200 font-medium mb-2">Price History</h5>
          <div className="h-32 bg-slate-800/50 rounded flex items-center justify-center">
            <div className="text-center text-slate-400">
              <svg className="w-8 h-8 mx-auto mb-2" viewBox="0 0 20 20" fill="currentColor">
                <path d="M2 11a1 1 0 011-1h2a1 1 0 011 1v5a1 1 0 01-1 1H3a1 1 0 01-1-1v-5zM8 7a1 1 0 011-1h2a1 1 0 011 1v9a1 1 0 01-1 1H9a1 1 0 01-1-1V7zM14 4a1 1 0 011-1h2a1 1 0 011 1v12a1 1 0 01-1 1h-2a1 1 0 01-1-1V4z" />
              </svg>
              <p className="text-xs">Price chart coming soon</p>
            </div>
          </div>
        </div>
        
        {/* Quick Add Form */}
        <div 
          ref={addToCollectionRef}
          className={`transition-all duration-1000 ${isHighlighted ? 'bg-blue-500/10 border border-blue-500/30 rounded-lg p-4' : ''}`}
        >
          <h5 className="text-slate-200 font-medium mb-2">Add to Collection</h5>
          <form onSubmit={handleSubmit} className="space-y-2 md:space-y-3">
            <div>
              <label className="block text-slate-300 text-xs md:text-sm mb-1">Order Date</label>
              <input
                type="date"
                value={orderDate}
                onChange={(e) => setOrderDate(e.target.value)}
                className={`${inputBase} w-full text-xs md:text-sm`}
              />
            </div>
            <div>
              <label className="block text-slate-300 text-xs md:text-sm mb-1">Product Name</label>
              <input
                type="text"
                value={itemName}
                onChange={(e) => setItemName(e.target.value)}
                className={`${inputBase} w-full text-xs md:text-sm`}
              />
            </div>
            <div>
              <label className="block text-slate-300 text-xs md:text-sm mb-1">Retailer</label>
              <input
                type="text"
                value={retailerName}
                onChange={(e) => setRetailerName(e.target.value)}
                placeholder="e.g., Amazon, eBay, Local Store"
                className={`${inputBase} w-full text-xs md:text-sm`}
              />
            </div>
            <div>
              <label className="block text-slate-300 text-xs md:text-sm mb-1">Quantity</label>
              <input
                type="number"
                value={qtyStr}
                onChange={(e) => setQtyStr(e.target.value)}
                className={`${inputBase} w-full text-xs md:text-sm`}
                min="1"
              />
            </div>
            <div>
              <label className="block text-slate-300 text-xs md:text-sm mb-1">Buy Price (total)</label>
              <input
                type="number"
                step="0.01"
                value={buyPrice}
                onChange={(e) => setBuyPrice(e.target.value)}
                placeholder="e.g., 25.99"
                className={`${inputBase} w-full text-xs md:text-sm`}
              />
            </div>
            <button
              type="submit"
              disabled={saving}
              className="w-full py-2 bg-blue-600 hover:bg-blue-700 disabled:bg-slate-700 disabled:cursor-not-allowed rounded-lg text-slate-100 text-sm md:text-base font-medium transition-colors"
            >
              {saving ? 'Adding...' : 'Add to Collection'}
            </button>
            {msg && (
              <div className={`text-xs md:text-sm ${msg.includes('successfully') ? 'text-green-400' : 'text-red-400'}`}>
                {msg}
              </div>
            )}
          </form>
        </div>
      </div>
    </div>
  );
}

// Main Search Page Component
export default function SearchPage() {
  const [searchQuery, setSearchQuery] = useState('');
  const [filters, setFilters] = useState({
    tcgType: 'all',
    productType: 'all',
    sortBy: 'best_match'
  });
  const [searchResults, setSearchResults] = useState([]);
  const [isSearching, setIsSearching] = useState(false);
  const [searchError, setSearchError] = useState(null);
  const [hasSearched, setHasSearched] = useState(false);
  const [selectedProduct, setSelectedProduct] = useState(null);
  
  // Sort results
  const sortedResults = useMemo(() => {
    if (!searchResults.length) return [];
    
    const sorted = [...searchResults];
    
    switch (filters.sortBy) {
      case 'price_low_high':
        return sorted.sort((a, b) => {
          const priceA = parseFloat(a['new-price'] || a['cib-price'] || a['loose-price'] || 0) / 100;
          const priceB = parseFloat(b['new-price'] || b['cib-price'] || b['loose-price'] || 0) / 100;
          return priceA - priceB;
        });
      case 'price_high_low':
        return sorted.sort((a, b) => {
          const priceA = parseFloat(a['new-price'] || a['cib-price'] || a['loose-price'] || 0) / 100;
          const priceB = parseFloat(b['new-price'] || b['cib-price'] || b['loose-price'] || 0) / 100;
          return priceB - priceA;
        });
      case 'card_number_low_high':
        return sorted.sort((a, b) => {
          const cardA = extractCardNumber(a['product-name'] || a.product_name || a.name || '');
          const cardB = extractCardNumber(b['product-name'] || b.product_name || b.name || '');
          return cardA - cardB;
        });
      case 'card_number_high_low':
        return sorted.sort((a, b) => {
          const cardA = extractCardNumber(a['product-name'] || a.product_name || a.name || '');
          const cardB = extractCardNumber(b['product-name'] || b.product_name || b.name || '');
          return cardB - cardA;
        });
      case 'name_a_z':
        return sorted.sort((a, b) => {
          const nameA = (a['product-name'] || a.product_name || a.name || '').toLowerCase();
          const nameB = (b['product-name'] || b.product_name || b.name || '').toLowerCase();
          return nameA.localeCompare(nameB);
        });
      case 'name_z_a':
        return sorted.sort((a, b) => {
          const nameA = (a['product-name'] || a.product_name || a.name || '').toLowerCase();
          const nameB = (b['product-name'] || b.product_name || b.name || '').toLowerCase();
          return nameB.localeCompare(nameA);
        });
      case 'trending_least_popular':
        return sorted.sort((a, b) => {
          // Mock trending data - in real implementation, this would use actual trending data
          const trendA = Math.random();
          const trendB = Math.random();
          return trendA - trendB;
        });
      case 'trending_most_popular':
        return sorted.sort((a, b) => {
          // Mock trending data - in real implementation, this would use actual trending data
          const trendA = Math.random();
          const trendB = Math.random();
          return trendB - trendA;
        });
      case 'date_added_oldest':
        return sorted.sort((a, b) => {
          // Mock date data - in real implementation, this would use actual date data
          const dateA = new Date(a['date-added'] || '2024-01-01');
          const dateB = new Date(b['date-added'] || '2024-01-01');
          return dateA - dateB;
        });
      case 'date_added_newest':
        return sorted.sort((a, b) => {
          // Mock date data - in real implementation, this would use actual date data
          const dateA = new Date(a['date-added'] || '2024-01-01');
          const dateB = new Date(b['date-added'] || '2024-01-01');
          return dateB - dateA;
        });
      case 'percent_change_low_high':
        return sorted.sort((a, b) => {
          // Mock percent change data - in real implementation, this would use actual price change data
          const changeA = parseFloat(a['percent-change'] || 0);
          const changeB = parseFloat(b['percent-change'] || 0);
          return changeA - changeB;
        });
      case 'percent_change_high_low':
        return sorted.sort((a, b) => {
          // Mock percent change data - in real implementation, this would use actual price change data
          const changeA = parseFloat(a['percent-change'] || 0);
          const changeB = parseFloat(b['percent-change'] || 0);
          return changeB - changeA;
        });
      default:
        return sorted; // best_match - keep original order
    }
  }, [searchResults, filters.sortBy]);

  // Helper function to extract card number from product name
  const extractCardNumber = (productName) => {
    const match = productName.match(/#(\d+)/);
    return match ? parseInt(match[1]) : 0;
  };

  // Get sort options
  const getSortOptions = () => [
    { value: 'best_match', label: 'Best Match' },
    { value: 'price_low_high', label: 'Price: Low to High' },
    { value: 'price_high_low', label: 'Price: High to Low' },
    { value: 'card_number_low_high', label: 'Card Number: Low to High' },
    { value: 'card_number_high_low', label: 'Card Number: High to Low' },
    { value: 'name_a_z', label: 'Product Name: A to Z' },
    { value: 'name_z_a', label: 'Product Name: Z to A' },
    { value: 'trending_least_popular', label: 'Trending Today: Least Popular' },
    { value: 'trending_most_popular', label: 'Trending Today: Most Popular' },
    { value: 'date_added_oldest', label: 'Date Added: Oldest First' },
    { value: 'date_added_newest', label: 'Date Added: Newest First' },
    { value: 'percent_change_low_high', label: 'Percent Change: Low to High' },
    { value: 'percent_change_high_low', label: 'Percent Change: High to Low' }
  ];

  // Get sort label
  const getSortLabel = (value) => {
    const option = getSortOptions().find(opt => opt.value === value);
    return option ? option.label : 'Best Match';
  };

  // Debounced search
  useEffect(() => {
    if (!searchQuery.trim()) {
      setSearchResults([]);
      setHasSearched(false);
      return;
    }
    
    const timeoutId = setTimeout(async () => {
      setIsSearching(true);
      setSearchError(null);
      
      try {
        const results = await searchProducts(searchQuery, filters);
        setSearchResults(results);
        setHasSearched(true);
      } catch (error) {
        setSearchError('Failed to search products. Please try again.');
        console.error('Search error:', error);
      } finally {
        setIsSearching(false);
      }
    }, 500);
    
    return () => clearTimeout(timeoutId);
  }, [searchQuery, filters]);
  
  // Add item to collection
  const handleAddToCollection = async (productData) => {
    try {
      // Insert into orders table with status 'ordered'
      const { error } = await supabase
        .from('orders')
        .insert([{
          item: productData.name,
          buy_price_cents: Math.round(productData.new_price * 100) || Math.round(productData.cib_price * 100) || Math.round(productData.loose_price * 100) || 0,
          status: 'ordered',
          order_date: new Date().toISOString().split('T')[0],
          retailer: 'Search Page',
          marketplace: 'OneTrack',
          fees_pct: 0,
          shipping_cents: 0
        }]);
      
      if (error) throw error;
      
      // Show success message (you could add a toast notification here)
      console.log('Item added to collection:', productData.name);
      
    } catch (error) {
      console.error('Error adding item to collection:', error);
      // Show error message (you could add a toast notification here)
    }
  };
  
  return (
    <div className="min-h-screen bg-slate-950">
      {/* Header */}
      <div className="bg-slate-900 border-b border-slate-800 p-3 md:p-4">
        <div className="w-full">
          <h1 className="text-xl md:text-2xl font-bold text-slate-100 mb-2">Find a Product</h1>
          
          {/* Search Bar */}
          <div className="flex gap-2 md:gap-4 items-center">
            <div className="flex-1 relative">
              <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                <SearchIcon />
              </div>
              <input
                type="text"
                placeholder="Search for Pokemon cards, Magic sets..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full min-w-0 h-10 sm:h-11 appearance-none bg-slate-900/60 border border-slate-800 rounded-xl pl-10 pr-4 py-2 sm:py-3 text-sm sm:text-base text-slate-100 placeholder-slate-400 outline-none focus:border-indigo-500"
              />
              {isSearching && (
                <div className="absolute inset-y-0 right-0 pr-3 flex items-center">
                  <LoadingSpinner />
                </div>
              )}
            </div>
            
            <button className="px-3 md:px-4 py-2 bg-slate-700 hover:bg-slate-600 rounded-lg text-slate-200 text-sm md:text-base font-medium transition-colors">
              Search
            </button>
            <button 
              onClick={() => setSearchQuery('')}
              className="px-3 md:px-4 py-2 bg-slate-700 hover:bg-slate-600 rounded-lg text-slate-200 text-sm md:text-base font-medium transition-colors"
            >
              Clear
            </button>
          </div>
          
          {/* Results Count */}
          {hasSearched && (
            <div className="mt-2">
              <span className="text-slate-400 text-sm">
                {sortedResults.length} items found
              </span>
            </div>
          )}
        </div>
        
        {/* Filter Row */}
        <div className="flex flex-col sm:flex-row gap-2 mt-3">
          {/* Category Dropdown */}
          <div className="flex-1">
            <div className="relative">
              <select 
                value={filters.tcgType || 'all'}
                onChange={(e) => setFilters({ ...filters, tcgType: e.target.value })}
                className="w-full h-8 appearance-none bg-slate-900/60 border border-slate-800 rounded-lg px-2 py-1 text-xs text-slate-100 placeholder-slate-400 outline-none focus:border-indigo-500 pr-6 cursor-pointer"
              >
                <option value="all">Category</option>
                <option value="pokemon">Pokemon</option>
                <option value="magic">Magic: The Gathering</option>
                <option value="yugioh">Yu-Gi-Oh!</option>
                <option value="video_games">Video Games</option>
              </select>
              <div className="absolute inset-y-0 right-0 flex items-center pr-2 pointer-events-none">
                <ChevronDownIcon className="w-3 h-3 text-slate-400" />
              </div>
            </div>
          </div>
          
          {/* Product Type Dropdown */}
          <div className="flex-1">
            <div className="relative">
              <select 
                value={filters.productType || 'all'}
                onChange={(e) => setFilters({ ...filters, productType: e.target.value })}
                className="w-full h-8 appearance-none bg-slate-900/60 border border-slate-800 rounded-lg px-2 py-1 text-xs text-slate-100 placeholder-slate-400 outline-none focus:border-indigo-500 pr-6 cursor-pointer"
              >
                <option value="all">Product Type</option>
                <option value="singles">Cards Only</option>
                <option value="sealed">Sealed Only</option>
              </select>
              <div className="absolute inset-y-0 right-0 flex items-center pr-2 pointer-events-none">
                <ChevronDownIcon className="w-3 h-3 text-slate-400" />
              </div>
            </div>
          </div>
          
          {/* Sort Filter */}
          <div className="flex-1">
            <div className="relative">
              <select 
                value={filters.sortBy || 'best_match'}
                onChange={(e) => setFilters({ ...filters, sortBy: e.target.value })}
                className="w-full h-8 appearance-none bg-slate-900/60 border border-slate-800 rounded-lg px-2 py-1 text-xs text-slate-100 placeholder-slate-400 outline-none focus:border-indigo-500 pr-6 cursor-pointer"
              >
                <option value="best_match">Sort Results</option>
                <option value="price_low_high">Price: Low to High</option>
                <option value="price_high_low">Price: High to Low</option>
                <option value="card_number_low_high">Card Number: Low to High</option>
                <option value="card_number_high_low">Card Number: High to Low</option>
                <option value="name_a_z">Product Name: A to Z</option>
                <option value="name_z_a">Product Name: Z to A</option>
                <option value="trending_least_popular">Trending Today: Least Popular</option>
                <option value="trending_most_popular">Trending Today: Most Popular</option>
                <option value="date_added_oldest">Date Added: Oldest First</option>
                <option value="date_added_newest">Date Added: Newest First</option>
                <option value="percent_change_low_high">Percent Change: Low to High</option>
                <option value="percent_change_high_low">Percent Change: High to Low</option>
              </select>
              <div className="absolute inset-y-0 right-0 flex items-center pr-2 pointer-events-none">
                <ChevronDownIcon className="w-3 h-3 text-slate-400" />
              </div>
            </div>
          </div>
        </div>
      </div>
      
      {/* Main Content */}
      <div className="w-full p-2 md:p-4">
        
        {/* Main Content Area */}
        <div className="flex flex-col lg:flex-row gap-4">
          {/* Search Results */}
          <div className="flex-1">
            {hasSearched ? (
              searchError ? (
                <div className={`${card} p-6 text-center`}>
                  <p className="text-red-400 mb-4">{searchError}</p>
                  <button
                    onClick={() => window.location.reload()}
                    className="px-4 py-2 bg-slate-700 hover:bg-slate-600 rounded-lg text-slate-200 transition-colors"
                  >
                    Try Again
                  </button>
                </div>
              ) : sortedResults.length === 0 ? (
                <div className={`${card} p-6 text-center`}>
                  <p className="text-slate-400">
                    No items found for "{searchQuery}". Try adjusting your search terms or filters.
                  </p>
                </div>
              ) : (
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 md:gap-4">
                  {sortedResults.map((product, index) => (
                    <ProductCard
                      key={index}
                      product={product}
                      onAddToCollection={handleAddToCollection}
                      onSelectProduct={setSelectedProduct}
                    />
                  ))}
                </div>
              )
            ) : null}
          </div>
          
          {/* Right Sidebar - Product Preview */}
          <div className="w-full lg:w-80 flex-shrink-0">
            {selectedProduct ? (
              <ProductPreview 
                product={selectedProduct} 
                onAddToCollection={handleAddToCollection}
                onClose={() => setSelectedProduct(null)}
              />
            ) : hasSearched && sortedResults.length > 0 ? (
              <div className={`${card} p-4 hidden lg:block`}>
                <h3 className="text-lg font-semibold text-slate-100 mb-4">Product Details</h3>
                <div className="space-y-3 text-slate-400 text-sm">
                  <p>Click on any product card to view detailed information including:</p>
                  <ul className="space-y-2 ml-4">
                    <li>• Price breakdown (Loose, CIB, New)</li>
                    <li>• Graded card values (PSA 8/9/10)</li>
                    <li>• Price history charts</li>
                    <li>• Quick-add to collection</li>
                  </ul>
                  <p className="text-slate-500 text-xs mt-4">
                    Select a product to see its full details and add it to your collection.
                  </p>
                </div>
              </div>
            ) : null}
          </div>
        </div>
      </div>
    </div>
  );
}