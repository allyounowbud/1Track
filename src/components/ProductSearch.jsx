import { useState, useEffect, useRef } from 'react';

// Search for products in Price Charting database
async function searchProducts(query, limit = 10) {
  const response = await fetch(`/.netlify/functions/search-products?q=${encodeURIComponent(query)}&limit=${limit}`);
  const data = await response.json();
  if (!response.ok) throw new Error(data.error || 'Search failed');
  return data;
}

export default function ProductSearch({ onProductSelect, placeholder = "Search for products..." }) {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState([]);
  const [isSearching, setIsSearching] = useState(false);
  const [isOpen, setIsOpen] = useState(false);
  const [selectedIndex, setSelectedIndex] = useState(-1);
  
  const searchRef = useRef(null);
  const dropdownRef = useRef(null);
  
  // Debounced search
  useEffect(() => {
    if (query.length < 2) {
      setResults([]);
      setIsOpen(false);
      return;
    }
    
    const timeoutId = setTimeout(async () => {
      setIsSearching(true);
      try {
        const data = await searchProducts(query);
        setResults(data.results || []);
        setIsOpen(true);
        setSelectedIndex(-1);
      } catch (error) {
        console.error('Search error:', error);
        setResults([]);
        setIsOpen(false);
      } finally {
        setIsSearching(false);
      }
    }, 300);
    
    return () => clearTimeout(timeoutId);
  }, [query]);
  
  // Handle keyboard navigation
  const handleKeyDown = (e) => {
    if (!isOpen || results.length === 0) return;
    
    switch (e.key) {
      case 'ArrowDown':
        e.preventDefault();
        setSelectedIndex(prev => 
          prev < results.length - 1 ? prev + 1 : prev
        );
        break;
      case 'ArrowUp':
        e.preventDefault();
        setSelectedIndex(prev => prev > 0 ? prev - 1 : -1);
        break;
      case 'Enter':
        e.preventDefault();
        if (selectedIndex >= 0 && selectedIndex < results.length) {
          handleProductSelect(results[selectedIndex]);
        }
        break;
      case 'Escape':
        setIsOpen(false);
        setSelectedIndex(-1);
        break;
    }
  };
  
  // Handle product selection
  const handleProductSelect = (product) => {
    if (onProductSelect) {
      onProductSelect({
        name: product.product_name,
        marketValue: product.loose_price || product.cib_price || product.new_price || 0,
        consoleName: product.console_name,
        category: product.category,
        productId: product.product_id,
        priceSource: 'price_charting'
      });
    }
    
    setQuery('');
    setResults([]);
    setIsOpen(false);
    setSelectedIndex(-1);
    searchRef.current?.focus();
  };
  
  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
        setIsOpen(false);
        setSelectedIndex(-1);
      }
    };
    
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);
  
  return (
    <div className="relative w-full" ref={dropdownRef}>
      <div className="relative">
        <input
          ref={searchRef}
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onKeyDown={handleKeyDown}
          onFocus={() => query.length >= 2 && results.length > 0 && setIsOpen(true)}
          placeholder={placeholder}
          className="w-full px-4 py-2 bg-slate-800 border border-slate-600 rounded-lg text-slate-100 placeholder-slate-400 focus:border-indigo-500 focus:outline-none"
        />
        
        {isSearching && (
          <div className="absolute right-3 top-1/2 transform -translate-y-1/2">
            <div className="w-4 h-4 border-2 border-slate-400 border-t-indigo-500 rounded-full animate-spin"></div>
          </div>
        )}
      </div>
      
      {/* Search Results Dropdown */}
      {isOpen && results.length > 0 && (
        <div className="absolute z-50 w-full mt-1 bg-slate-800 border border-slate-600 rounded-lg shadow-lg max-h-60 overflow-y-auto">
          {results.map((product, index) => (
            <div
              key={product.product_id}
              onClick={() => handleProductSelect(product)}
              className={`px-4 py-3 cursor-pointer border-b border-slate-700 last:border-b-0 transition-colors ${
                index === selectedIndex
                  ? 'bg-indigo-600 text-white'
                  : 'hover:bg-slate-700 text-slate-100'
              }`}
            >
              <div className="flex justify-between items-start">
                <div className="flex-1 min-w-0">
                  <div className="font-medium truncate">
                    {product.product_name}
                  </div>
                  <div className="text-sm text-slate-400 truncate">
                    {product.console_name && `${product.console_name} • `}
                    {product.category.replace('_', ' ').replace(/\b\w/g, l => l.toUpperCase())}
                  </div>
                </div>
                <div className="ml-4 text-right">
                  <div className="text-sm font-medium text-green-400">
                    ${(product.loose_price || 0).toFixed(2)}
                  </div>
                  {product.cib_price && product.cib_price !== product.loose_price && (
                    <div className="text-xs text-slate-400">
                      CIB: ${product.cib_price.toFixed(2)}
                    </div>
                  )}
                </div>
              </div>
              
              {/* Similarity Score (for debugging) */}
              {product.similarity_score && (
                <div className="text-xs text-slate-500 mt-1">
                  Match: {Math.round(product.similarity_score * 100)}%
                </div>
              )}
            </div>
          ))}
        </div>
      )}
      
      {/* No Results */}
      {isOpen && !isSearching && results.length === 0 && query.length >= 2 && (
        <div className="absolute z-50 w-full mt-1 bg-slate-800 border border-slate-600 rounded-lg shadow-lg">
          <div className="px-4 py-3 text-slate-400 text-center">
            No products found for "{query}"
          </div>
        </div>
      )}
    </div>
  );
}
