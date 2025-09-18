import { useState, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';

export default function ProductSearchDropdown({ 
  value = "", 
  onChange, 
  placeholder = "Search for a product...", 
  className = "",
  onProductSelect,
  disabled = false
}) {
  const [searchQuery, setSearchQuery] = useState(value);
  const [searchResults, setSearchResults] = useState([]);
  const [isSearching, setIsSearching] = useState(false);
  const [isOpen, setIsOpen] = useState(false);
  const [selectedIndex, setSelectedIndex] = useState(-1);
  const [error, setError] = useState('');
  const [dropdownPosition, setDropdownPosition] = useState({ top: 0, left: 0, width: 0 });
  const [showAllResults, setShowAllResults] = useState(false);
  
  const searchTimeoutRef = useRef(null);
  const dropdownRef = useRef(null);
  const inputRef = useRef(null);

  // Function to update dropdown position
  const updateDropdownPosition = () => {
    if (dropdownRef.current) {
      const rect = dropdownRef.current.getBoundingClientRect();
      setDropdownPosition({
        top: rect.bottom + 8,
        left: rect.left,
        width: rect.width
      });
    }
  };

  // Debounced search
  useEffect(() => {
    if (searchTimeoutRef.current) {
      clearTimeout(searchTimeoutRef.current);
    }

    if (searchQuery.trim().length < 2) {
      setSearchResults([]);
      setIsSearching(false);
      return;
    }

    setIsSearching(true);
    setError('');

    searchTimeoutRef.current = setTimeout(async () => {
      try {
        const response = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/price-charting/search?q=${encodeURIComponent(searchQuery)}`, {
          headers: {
            'Authorization': `Bearer ${import.meta.env.VITE_SUPABASE_ANON_KEY}`,
            'Content-Type': 'application/json',
          },
        });
        const data = await response.json();
        console.log('API Response:', data);
        
        if (data.success && data.data) {
          // Handle different possible response structures
          let products = [];
          
          if (data.data.products && Array.isArray(data.data.products)) {
            products = data.data.products;
          } else if (Array.isArray(data.data)) {
            products = data.data;
          } else if (data.data.product) {
            products = [data.data.product];
          }
          
                 console.log('Products found:', products.length);
                 
                 // Debug: Log the first product to see its structure
                 if (products.length > 0) {
                   console.log('First product structure:', products[0]);
                   console.log('First product keys:', Object.keys(products[0]));
                 }
                 
                 if (products.length > 0) {
                   // Format the results to match the expected structure
                   const formattedResults = products.map(product => {
                     // Add null checks to prevent trim() errors
                     // Use the correct field names from PriceCharting API documentation
                     const productName = product['product-name'] || product.product_name || product.name || product.title || 'Unknown Product';
                     const consoleName = product['console-name'] || product.console_name || product.console || product.platform || '';
                     const loosePrice = product['loose-price'] || product.loose_price || product.price || product.loose || '';
                     const cibPrice = product['cib-price'] || product.cib_price || product.complete_price || product.complete || '';
                     const newPrice = product['new-price'] || product.new_price || product.sealed_price || product.sealed || '';
                     const imageUrl = product['image-url'] || product.image_url || product.image || product.thumbnail || '';
                     
                     return {
                       product_id: product.id || product['product-id'] || product.product_id || '',
                       product_name: productName,
                       console_name: consoleName,
                       loose_price: loosePrice ? (parseFloat(loosePrice) / 100).toFixed(2) : '',
                       cib_price: cibPrice ? (parseFloat(cibPrice) / 100).toFixed(2) : '',
                       new_price: newPrice ? (parseFloat(newPrice) / 100).toFixed(2) : '',
                       image_url: imageUrl,
                       similarity_score: 1.0 // Price Charting API doesn't provide similarity scores
                     };
                   });
            
            console.log('Formatted results:', formattedResults);
            setSearchResults(formattedResults);
          } else {
            setError('No products found');
            setSearchResults([]);
          }
        } else {
          console.error('API Error:', data.error || 'Search failed');
          setError(data.error || 'Search failed');
          setSearchResults([]);
        }
      } catch (err) {
        console.error('Search error:', err);
        setError('Search failed');
        setSearchResults([]);
      } finally {
        setIsSearching(false);
      }
    }, 300);

    return () => {
      if (searchTimeoutRef.current) {
        clearTimeout(searchTimeoutRef.current);
      }
    };
  }, [searchQuery]);

  // Handle input change
  const handleInputChange = (e) => {
    const newValue = e.target.value;
    setSearchQuery(newValue);
    onChange?.(newValue);
    setIsOpen(true);
    setSelectedIndex(-1);
  };

  // Handle product selection
  const handleProductSelect = (product) => {
    // Create a display name that includes set information if available
    let displayName = product.product_name;
    if (product.console_name && product.console_name !== product.product_name) {
      displayName = `${product.product_name} - ${product.console_name}`;
    }
    
    setSearchQuery(displayName);
    onChange?.(displayName);
    onProductSelect?.(product);
    setIsOpen(false);
    setSelectedIndex(-1);
    setSearchResults([]);
    setShowAllResults(false);
  };

  // Handle keyboard navigation
  const handleKeyDown = (e) => {
    if (!isOpen || searchResults.length === 0) return;

    switch (e.key) {
      case 'ArrowDown':
        e.preventDefault();
        setSelectedIndex(prev => 
          prev < searchResults.length - 1 ? prev + 1 : prev
        );
        break;
      case 'ArrowUp':
        e.preventDefault();
        setSelectedIndex(prev => prev > 0 ? prev - 1 : -1);
        break;
      case 'Enter':
        e.preventDefault();
        if (selectedIndex >= 0 && selectedIndex < searchResults.length) {
          handleProductSelect(searchResults[selectedIndex]);
        }
        break;
      case 'Escape':
        setIsOpen(false);
        setSelectedIndex(-1);
        inputRef.current?.blur();
        break;
    }
  };

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event) => {
      const isInsideContainer = dropdownRef.current && dropdownRef.current.contains(event.target);
      const isInsideDropdown = event.target.closest('[data-dropdown-portal]');
      
      if (!isInsideContainer && !isInsideDropdown) {
        setIsOpen(false);
        setSelectedIndex(-1);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Update dropdown position on scroll and resize
  useEffect(() => {
    if (isOpen) {
      updateDropdownPosition();
      
      const handleScroll = () => updateDropdownPosition();
      const handleResize = () => updateDropdownPosition();
      
      window.addEventListener('scroll', handleScroll, true);
      window.addEventListener('resize', handleResize);
      
      return () => {
        window.removeEventListener('scroll', handleScroll, true);
        window.removeEventListener('resize', handleResize);
      };
    }
  }, [isOpen]);

  // Format price for display
  const formatPrice = (price) => {
    if (!price || price === 0) return 'N/A';
    return `$${parseFloat(price).toFixed(2)}`;
  };

  // Check if a product is sealed (not an individual card)
  const isSealedProduct = (productName) => {
    if (!productName) return false;
    
    // Single cards always have # in their name (e.g., "Pikachu #25", "Charizard #150")
    // If it has #, it's definitely a single card, not sealed
    if (productName.includes('#')) {
      return false;
    }
    
    const sealedKeywords = [
      'booster', 'bundle', 'box', 'collection', 'pack', 'tin', 'case', 'display',
      'booster box', 'booster bundle', 'booster pack', 'theme deck', 'starter deck',
      'elite trainer box', 'etb', 'premium collection', 'v box', 'vmax box',
      'mini tin', 'pin collection', 'build & battle box', 'champions path',
      'hidden fates', 'shining fates', 'celebrations', 'pokemon go', 'go'
    ];
    
    const name = productName.toLowerCase();
    return sealedKeywords.some(keyword => name.includes(keyword));
  };

  return (
    <div ref={dropdownRef} className={`relative z-[99999] ${className}`}>
      {/* Input Field */}
      <div className="relative">
        <input
          ref={inputRef}
          type="text"
          value={searchQuery}
          onChange={handleInputChange}
          onKeyDown={handleKeyDown}
          onFocus={() => setIsOpen(true)}
          placeholder={placeholder}
          disabled={disabled}
          className={`w-full h-10 appearance-none bg-white dark:bg-slate-900/60 border border-gray-200 dark:border-slate-800 rounded-xl px-3 py-2 text-sm text-gray-900 dark:text-slate-100 focus:border-blue-500 dark:focus:border-indigo-500 outline-none placeholder-slate-400 ${
            disabled ? 'opacity-50 cursor-not-allowed' : ''
          }`}
        />
        
        {/* Search/Loading Icon */}
        <div className="absolute right-3 top-1/2 transform -translate-y-1/2">
          {isSearching ? (
            <svg className="w-4 h-4 text-gray-600 dark:text-slate-400 animate-spin" fill="none" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
            </svg>
          ) : (
            <svg className="w-4 h-4 text-gray-600 dark:text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
          )}
        </div>
      </div>

      {/* Dropdown Results */}
      {isOpen && (searchResults.length > 0 || error || isSearching) && createPortal(
        <div 
          data-dropdown-portal
          className="fixed z-[999999] bg-white dark:bg-slate-800 border border-gray-200 dark:border-slate-700 rounded-lg shadow-lg max-h-60 overflow-y-auto"
          style={{ 
            position: 'fixed',
            top: `${dropdownPosition.top}px`,
            left: `${dropdownPosition.left}px`,
            width: `${dropdownPosition.width}px`,
            zIndex: 999999
          }}
        >
          {error && (
            <div className="px-3 py-2 text-sm text-red-400 border-b border-gray-200 dark:border-slate-700">
              {error}
            </div>
          )}
          
          {isSearching && (
            <div className="px-3 py-2 text-sm text-gray-600 dark:text-slate-400 border-b border-gray-200 dark:border-slate-700">
              Searching...
            </div>
          )}
          
          {searchResults.length === 0 && !isSearching && !error && searchQuery.trim().length >= 2 && (
            <div className="px-3 py-2 text-sm text-gray-600 dark:text-slate-400 border-b border-gray-200 dark:border-slate-700">
              No products found for "{searchQuery}"
            </div>
          )}
          
          {(showAllResults ? searchResults : searchResults.slice(0, 20)).map((product, index) => (
            <div
              key={product.product_id}
              onClick={() => handleProductSelect(product)}
              className={`px-3 py-2 cursor-pointer border-b border-gray-200 dark:border-slate-700 last:border-b-0 transition-colors ${
                index === selectedIndex 
                  ? 'bg-indigo-100 dark:bg-indigo-600/20 text-indigo-800 dark:text-indigo-200' 
                  : 'hover:bg-gray-100 dark:hover:bg-slate-700 text-gray-900 dark:text-slate-200'
              }`}
            >
              <div className="flex justify-between items-start">
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-medium truncate">
                    {product.product_name}
                    {isSealedProduct(product.product_name) && (
                      <span className="ml-1 text-xs bg-green-100 dark:bg-green-600/20 text-green-700 dark:text-green-300 px-1 rounded">
                        Sealed
                      </span>
                    )}
                  </div>
                  {product.console_name && (
                    <div className="text-xs text-gray-600 dark:text-slate-400 truncate">
                      {product.console_name}
                    </div>
                  )}
                </div>
                <div className="ml-2 text-right flex-shrink-0">
                  <div className="text-xs font-medium text-green-600 dark:text-green-400">
                    {formatPrice(product.loose_price)}
                  </div>
                </div>
              </div>
            </div>
          ))}
          
          {/* Show More button when there are more than 20 results */}
          {searchResults.length > 20 && !showAllResults && (
            <div className="px-3 py-2 border-t border-gray-200 dark:border-slate-700">
              <button
                onClick={() => setShowAllResults(true)}
                className="w-full text-center text-sm text-indigo-600 dark:text-indigo-400 hover:text-indigo-700 dark:hover:text-indigo-300 transition-colors"
              >
                Show {searchResults.length - 20} more results ({searchResults.length} total)
              </button>
            </div>
          )}
          
          {/* Show Less button when showing all results */}
          {searchResults.length > 20 && showAllResults && (
            <div className="px-3 py-2 border-t border-gray-200 dark:border-slate-700">
              <button
                onClick={() => setShowAllResults(false)}
                className="w-full text-center text-sm text-gray-600 dark:text-slate-400 hover:text-gray-700 dark:hover:text-slate-300 transition-colors"
              >
                Show less (top 20 results)
              </button>
            </div>
          )}
        </div>,
        document.body
      )}
    </div>
  );
}
