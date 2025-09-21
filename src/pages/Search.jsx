import { useState, useEffect, useRef } from 'react';
import { marketDataService } from '../services/marketDataService';
import ProductPreviewModal from '../components/ProductPreviewModal';

const Search = () => {
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState(null);
  const [apiStatus, setApiStatus] = useState(null);
  const [searchType, setSearchType] = useState('all'); // 'all', 'cards', 'products'
  const [totalResults, setTotalResults] = useState(0);
  const [selectedProduct, setSelectedProduct] = useState(null);
  const [isPreviewOpen, setIsPreviewOpen] = useState(false);
  const [trendingProducts, setTrendingProducts] = useState([]);
  const [isLoadingTrending, setIsLoadingTrending] = useState(false);
  const [sortBy, setSortBy] = useState('relevance');
  const [filterBy, setFilterBy] = useState('all');
  const [showSortDropdown, setShowSortDropdown] = useState(false);
  const [showFilterDropdown, setShowFilterDropdown] = useState(false);
  const [allResults, setAllResults] = useState([]);
  const [displayedResults, setDisplayedResults] = useState([]);
  const [currentPage, setCurrentPage] = useState(1);
  const [hasMoreResults, setHasMoreResults] = useState(false);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const sortDropdownRef = useRef(null);
  const filterDropdownRef = useRef(null);
  const searchTimeoutRef = useRef(null);
  const resultsPerPage = 30;
  const maxResults = 100; // Reduced max results to prevent API spam

  // Handle click outside dropdowns
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (sortDropdownRef.current && !sortDropdownRef.current.contains(event.target)) {
        setShowSortDropdown(false);
      }
      if (filterDropdownRef.current && !filterDropdownRef.current.contains(event.target)) {
        setShowFilterDropdown(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, []);

  // Live search with debouncing and pagination
  useEffect(() => {
    // Clear existing timeout
    if (searchTimeoutRef.current) {
      clearTimeout(searchTimeoutRef.current);
    }

    // If search query is empty, show trending products
    if (!searchQuery.trim()) {
      setSearchResults([]);
      setAllResults([]);
      setDisplayedResults([]);
      setTotalResults(0);
      setCurrentPage(1);
      setHasMoreResults(false);
      return;
    }

    // Set loading state
    setIsLoading(true);
    setError(null);
    setCurrentPage(1);

    // Debounce the search - wait 500ms after user stops typing
    searchTimeoutRef.current = setTimeout(async () => {
      try {
        console.log(`🔍 Live searching for: "${searchQuery}"`);
        
        let result;
        
        // Check if this looks like an expansion search (contains common expansion keywords)
        const isExpansionSearch = searchQuery.toLowerCase().includes('evolutions') || 
                                 searchQuery.toLowerCase().includes('base') ||
                                 searchQuery.toLowerCase().includes('jungle') ||
                                 searchQuery.toLowerCase().includes('fossil') ||
                                 searchQuery.toLowerCase().includes('team rocket') ||
                                 searchQuery.toLowerCase().includes('gym') ||
                                 searchQuery.toLowerCase().includes('neo') ||
                                 searchQuery.toLowerCase().includes('ex') ||
                                 searchQuery.toLowerCase().includes('diamond') ||
                                 searchQuery.toLowerCase().includes('pearl') ||
                                 searchQuery.toLowerCase().includes('platinum') ||
                                 searchQuery.toLowerCase().includes('heartgold') ||
                                 searchQuery.toLowerCase().includes('soulsilver') ||
                                 searchQuery.toLowerCase().includes('black') ||
                                 searchQuery.toLowerCase().includes('white') ||
                                 searchQuery.toLowerCase().includes('xy') ||
                                 searchQuery.toLowerCase().includes('sun') ||
                                 searchQuery.toLowerCase().includes('moon') ||
                                 searchQuery.toLowerCase().includes('sword') ||
                                 searchQuery.toLowerCase().includes('shield') ||
                                 searchQuery.toLowerCase().includes('brilliant') ||
                                 searchQuery.toLowerCase().includes('astral') ||
                                 searchQuery.toLowerCase().includes('lost') ||
                                 searchQuery.toLowerCase().includes('paldea') ||
                                 searchQuery.toLowerCase().includes('obsidian') ||
                                 searchQuery.toLowerCase().includes('151') ||
                                 searchQuery.toLowerCase().includes('crown') ||
                                 searchQuery.toLowerCase().includes('rebel') ||
                                 searchQuery.toLowerCase().includes('temporal') ||
                                 searchQuery.toLowerCase().includes('prismatic');
        
        if (isExpansionSearch) {
          console.log(`🎯 Detected expansion search for: "${searchQuery}"`);
          result = await marketDataService.searchCardMarketExpansion(searchQuery, maxResults);
        } else {
          // Use different search functions based on type - fetch more results for pagination
          switch (searchType) {
            case 'cards':
              result = await marketDataService.searchCardMarketCards(searchQuery, maxResults);
              break;
            case 'products':
              result = await marketDataService.searchCardMarketProducts(searchQuery, maxResults);
              break;
            case 'all':
            default:
              result = await marketDataService.searchCardMarketAll(searchQuery, maxResults);
              break;
          }
        }
        
        if (result && result.cards) {
          // Apply filtering based on filterBy
          let filteredResults = result.cards;
          if (filterBy !== 'all') {
            filteredResults = result.cards.filter(card => {
              if (filterBy === 'sealed') return card.type === 'product';
              if (filterBy === 'graded') return card.rarity === 'graded';
              if (filterBy === 'ungraded') return card.rarity !== 'graded' && card.type !== 'product';
              return true;
            });
          }

          // Apply sorting based on sortBy
          filteredResults = sortResults(filteredResults, sortBy);

          // Store all results and show first page
          setAllResults(filteredResults);
          setTotalResults(filteredResults.length);
          
          // Show first page of results
          const firstPageResults = filteredResults.slice(0, resultsPerPage);
          setDisplayedResults(firstPageResults);
          setSearchResults(firstPageResults);
          
          // Check if there are more results to load
          setHasMoreResults(filteredResults.length > resultsPerPage);
          
          console.log(`✅ Live search complete: ${filteredResults.length} total results, showing ${firstPageResults.length}`);
        } else {
          setSearchResults([]);
          setAllResults([]);
          setDisplayedResults([]);
          setTotalResults(0);
          setHasMoreResults(false);
        }
      } catch (error) {
        console.error('❌ Live search error:', error);
        setError('Search failed. Please try again.');
        setSearchResults([]);
        setAllResults([]);
        setDisplayedResults([]);
        setTotalResults(0);
        setHasMoreResults(false);
      } finally {
        setIsLoading(false);
      }
    }, 500); // 500ms debounce

    // Cleanup function
    return () => {
      if (searchTimeoutRef.current) {
        clearTimeout(searchTimeoutRef.current);
      }
    };
  }, [searchQuery, searchType, filterBy, sortBy]);

  // Test API connection and load trending products on component mount
  useEffect(() => {
    const testAPI = async () => {
      try {
        const status = marketDataService.getApiStatus();
        setApiStatus(status);
        console.log('🔧 API Status:', status);
      } catch (error) {
        console.error('❌ API Status Error:', error);
      }
    };
    
    const loadTrendingProducts = async () => {
      setIsLoadingTrending(true);
      try {
        // Load trending products using popular search terms
        const trendingTerms = [
          'Charizard',
          'Pikachu', 
          'Prismatic Evolutions',
          'Elite Trainer Box',
          'Black Lotus',
          'Blue Eyes White Dragon'
        ];
        
        const allTrendingProducts = [];
        
        // Search for each trending term and get top results
        for (const term of trendingTerms.slice(0, 3)) { // Limit to 3 terms to avoid API spam
          try {
            const result = await marketDataService.searchCardMarketAll(term, 3);
            if (result.cards && result.cards.length > 0) {
              allTrendingProducts.push(...result.cards.slice(0, 2)); // Take top 2 from each
            }
          } catch (error) {
            console.warn(`Failed to load trending for ${term}:`, error);
          }
        }
        
        // Remove duplicates and limit to 6 products
        const uniqueProducts = allTrendingProducts.filter((product, index, self) => 
          index === self.findIndex(p => p.name === product.name)
        ).slice(0, 6);
        
        setTrendingProducts(uniqueProducts);
        console.log('🔥 Loaded trending products:', uniqueProducts);
      } catch (error) {
        console.error('❌ Error loading trending products:', error);
      } finally {
        setIsLoadingTrending(false);
      }
    };
    
    testAPI();
    loadTrendingProducts();
  }, []);

  // Sort results based on sortBy option
  const sortResults = (results, sortOption) => {
    if (!results || results.length === 0) return results;

    const sortedResults = [...results];

    switch (sortOption) {
      case 'price-high':
        return sortedResults.sort((a, b) => (b.marketValue || 0) - (a.marketValue || 0));
      case 'price-low':
        return sortedResults.sort((a, b) => (a.marketValue || 0) - (b.marketValue || 0));
      case 'alphabetical':
        return sortedResults.sort((a, b) => (a.name || '').localeCompare(b.name || ''));
      case 'recent':
        // For now, just return as-is since we don't have date data
        return sortedResults;
      case 'relevance':
      default:
        // Default relevance sorting (API already provides this)
        return sortedResults;
    }
  };

  const handleSearch = async () => {
    // This function is now mainly for manual search triggers
    // The live search useEffect handles most of the functionality
    if (!searchQuery.trim()) return;
    
    // Clear any existing timeout and trigger immediate search
    if (searchTimeoutRef.current) {
      clearTimeout(searchTimeoutRef.current);
    }
    
    // The useEffect will handle the actual search
  };

  // Load more results function
  const loadMoreResults = () => {
    if (isLoadingMore || !hasMoreResults) return;

    setIsLoadingMore(true);
    
    // Calculate next page results
    const nextPage = currentPage + 1;
    const startIndex = currentPage * resultsPerPage;
    const endIndex = startIndex + resultsPerPage;
    
    // Get next batch of results
    const nextBatch = allResults.slice(startIndex, endIndex);
    
    // Add to displayed results
    setDisplayedResults(prev => [...prev, ...nextBatch]);
    setSearchResults(prev => [...prev, ...nextBatch]);
    setCurrentPage(nextPage);
    
    // Check if there are more results
    setHasMoreResults(endIndex < allResults.length);
    
    setIsLoadingMore(false);
    
    console.log(`📄 Loaded page ${nextPage}: ${nextBatch.length} more results (${displayedResults.length + nextBatch.length}/${allResults.length} total)`);
  };

  // Infinite scroll handler
  useEffect(() => {
    const handleScroll = () => {
      if (window.innerHeight + document.documentElement.scrollTop >= document.documentElement.offsetHeight - 1000) {
        loadMoreResults();
      }
    };

    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, [currentPage, hasMoreResults, isLoadingMore, allResults, displayedResults]);


  const formatPrice = (value) => {
    if (!value) return 'Unavailable';
    // Handle both dollars and cents values
    if (value > 1000) {
      // Likely in cents, convert to dollars
      return `$${(value / 100).toFixed(2)}`;
    } else {
      // Likely already in dollars
      return `$${value.toFixed(2)}`;
    }
  };

  const clearCache = () => {
    marketDataService.clearCache();
    setSearchResults([]);
    setTotalResults(0);
    console.log('🗑️ Cache cleared, try searching again');
  };

  const handleProductClick = (product) => {
    setSelectedProduct(product);
    setIsPreviewOpen(true);
  };

  const handleClosePreview = () => {
    setIsPreviewOpen(false);
    setSelectedProduct(null);
  };

  const handleAddToCollection = (product) => {
    // TODO: Implement actual add to collection functionality
    console.log('Adding to collection:', product);
    // For now, just show a success message
    alert(`Added ${product.quantity}x ${product.name} to collection!`);
    handleClosePreview();
  };

  return (
    <div className="min-h-screen bg-black text-white">
      {/* Search Interface */}
      <div className="px-3 py-2">
        <div className="p-3">
          {/* Search Bar */}
          <div className="relative mb-3">
            <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
              <svg className="h-3 w-3 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
              </svg>
            </div>
            <input
              type="text"
              placeholder="Search your items..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-8 pr-3 py-2 bg-gray-800 border border-gray-700 rounded-lg text-xs text-white placeholder-gray-400 focus:outline-none focus:ring-1 focus:ring-indigo-500 focus:border-transparent"
            />
          </div>

          {/* Filter Buttons */}
          <div className="flex gap-2 mb-3">
            {/* Sort By Dropdown */}
            <div className="relative" ref={sortDropdownRef}>
              <button 
                onClick={() => setShowSortDropdown(!showSortDropdown)}
                className="flex items-center gap-1 px-2 py-1 bg-gray-800 border border-gray-700 rounded-lg text-xs text-white hover:bg-gray-700 transition-colors"
              >
                <svg className="h-3 w-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 4a1 1 0 011-1h16a1 1 0 011 1v2.586a1 1 0 01-.293.707l-6.414 6.414a1 1 0 00-.293.707V17l-4 4v-6.586a1 1 0 00-.293-.707L3.293 7.293A1 1 0 013 6.586V4z" />
                </svg>
                Sort By {sortBy === 'relevance' ? 'Relevance' : sortBy === 'price-high' ? 'Highest Price' : sortBy === 'price-low' ? 'Lowest Price' : sortBy === 'alphabetical' ? 'A-Z' : 'Recent'}
                <svg className="h-3 w-3 ml-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                </svg>
              </button>
              
              {/* Sort Dropdown */}
              {showSortDropdown && (
                <div className="absolute top-full left-0 mt-1 w-40 bg-gray-900 border border-gray-700 rounded-lg shadow-xl z-20">
                  <div className="py-1">
                    {[
                      { value: 'relevance', label: 'Relevance' },
                      { value: 'price-high', label: 'Highest Price' },
                      { value: 'price-low', label: 'Lowest Price' },
                      { value: 'alphabetical', label: 'A-Z' },
                      { value: 'recent', label: 'Most Recent' }
                    ].map((option) => (
                      <button
                        key={option.value}
                        onClick={() => {
                          setSortBy(option.value);
                          setShowSortDropdown(false);
                        }}
                        className={`w-full text-left px-3 py-2 text-xs transition-colors ${
                          sortBy === option.value
                            ? 'bg-indigo-500/20 text-indigo-400'
                            : 'text-white hover:bg-gray-800'
                        }`}
                      >
                        {option.label}
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>

            {/* Filter By Dropdown */}
            <div className="relative" ref={filterDropdownRef}>
              <button 
                onClick={() => setShowFilterDropdown(!showFilterDropdown)}
                className="flex items-center gap-1 px-2 py-1 bg-gray-800 border border-gray-700 rounded-lg text-xs text-white hover:bg-gray-700 transition-colors"
              >
                <svg className="h-3 w-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                {filterBy === 'all' ? 'All Items' : filterBy === 'sealed' ? 'Sealed' : filterBy === 'graded' ? 'Graded' : 'Ungraded'}
                <svg className="h-3 w-3 ml-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                </svg>
              </button>
              
              {/* Filter Dropdown */}
              {showFilterDropdown && (
                <div className="absolute top-full left-0 mt-1 w-32 bg-gray-900 border border-gray-700 rounded-lg shadow-xl z-20">
                  <div className="py-1">
                    {[
                      { value: 'all', label: 'All Items' },
                      { value: 'sealed', label: 'Sealed' },
                      { value: 'graded', label: 'Graded' },
                      { value: 'ungraded', label: 'Ungraded' }
                    ].map((option) => (
                      <button
                        key={option.value}
                        onClick={() => {
                          setFilterBy(option.value);
                          setShowFilterDropdown(false);
                        }}
                        className={`w-full text-left px-3 py-2 text-xs transition-colors ${
                          filterBy === option.value
                            ? 'bg-indigo-500/20 text-indigo-400'
                            : 'text-white hover:bg-gray-800'
                        }`}
                      >
                        {option.label}
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>


      {/* Error Message */}
      {error && (
        <div className="mb-4 p-3 bg-red-900/20 border border-red-500/30 rounded-lg">
          <div className="text-red-300">{error}</div>
        </div>
      )}

      {/* Search Results */}
      {searchQuery.trim() && searchResults.length > 0 && (
        <div className="px-4">
          {/* Results Header */}
          <div className="flex items-center justify-between mb-4">
            <div>
              <h2 className="text-sm font-semibold text-white">All Cards & Products</h2>
              <p className="text-xs text-gray-400">{totalResults.toLocaleString()} Total Results</p>
            </div>
            <div className="text-right">
              <div className="text-xs text-gray-400">
                Showing {displayedResults.length} of {totalResults.toLocaleString()}
              </div>
              {hasMoreResults && (
                <div className="text-xs text-indigo-400 mt-1">
                  Scroll down for more
                </div>
              )}
            </div>
          </div>
          
          {/* Card Grid - 2 columns matching collection page styling */}
          <div className="grid grid-cols-2 gap-3 pb-20">
            {searchResults
              .filter(card => card && typeof card === 'object') // Filter out null/undefined results
              .map((card, index) => {
                return (
                  <div 
                    key={index} 
                    className="relative border border-gray-700 rounded-lg overflow-hidden hover:border-gray-600 transition-all duration-200 cursor-pointer"
                    onClick={() => handleProductClick(card)}
                  >
                    {/* Card Image */}
                    <div className="aspect-[4/3] flex items-center justify-center py-2 relative">
                      {card?.imageUrl ? (
                        <img
                          src={card.imageUrl}
                          alt={card?.name || 'Card'}
                          className="w-full h-full object-contain"
                          onError={(e) => {
                            e.target.style.display = 'none';
                            e.target.nextSibling.style.display = 'flex';
                          }}
                        />
                      ) : null}
                      <div className={`w-full h-full flex items-center justify-center bg-gray-800 ${card?.imageUrl ? 'hidden' : 'flex'}`}>
                        <div className="text-center">
                          <div className="text-2xl mb-1">📦</div>
                          <div className="text-gray-400 text-xs">No Image</div>
                        </div>
                      </div>
                    </div>
                    
                    {/* Card Details */}
                    <div className="p-2 space-y-1">
                      {/* Item Name - First Line */}
                      <div>
                        <h3 className="text-white leading-tight line-clamp-2 font-bold" style={{fontSize: '12px'}}>
                          {card?.name || 'Unknown Card'}
                        </h3>
                      </div>
                      
                      {/* Set Name - Ghost Text */}
                      <div className="text-xs text-gray-400 truncate" style={{fontSize: '12px'}}>
                        {card?.set || 'Unknown Set'}
                      </div>
                      
                      {/* Type Pill - Below Set Name */}
                      <div className="inline-block px-2 py-0.5 rounded-full text-xs font-medium bg-blue-500/60 text-blue-100">
                        {card?.type === 'product' ? 'Sealed' : (card?.rarity || 'Card')}
                      </div>
                      
                      {/* Spacing */}
                      <div className="h-1"></div>
                      
                      {/* Financial Details */}
                      <div className="space-y-0.5">
                        <div className="text-xs text-white" style={{fontSize: '12px'}}>
                          {card?.marketValue ? formatPrice(card.marketValue) : 'Unavailable'} Value
                        </div>
                        <div className="flex items-center justify-between">
                          <div className="text-xs text-gray-400" style={{fontSize: '12px'}}>
                            Last 7 days: {card.trend ? (
                              <span className={card.trend.direction === 'up' ? 'text-green-400' : card.trend.direction === 'down' ? 'text-red-400' : 'text-gray-400'}>
                                {card.trend.direction === 'up' ? '+' : card.trend.direction === 'down' ? '-' : ''}{card.trend.value}%
                              </span>
                            ) : (
                              <span className="text-gray-400">N/A</span>
                            )}
                          </div>
                          
                          {/* Add Button - Bottom Right */}
                          <button 
                            className="w-6 h-6 bg-white rounded flex items-center justify-center hover:bg-gray-100 transition-colors"
                            onClick={(e) => {
                              e.stopPropagation();
                              handleAddToCollection({ ...card, quantity: 1 });
                            }}
                          >
                            <svg className="w-3 h-3 text-gray-800" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
                            </svg>
                          </button>
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })}
          </div>

          {/* Load More Indicator */}
          {isLoadingMore && (
            <div className="flex justify-center py-4">
              <div className="flex items-center gap-2 text-gray-400">
                <div className="w-4 h-4 border-2 border-gray-400 border-t-transparent rounded-full animate-spin"></div>
                <span className="text-xs">Loading more results...</span>
              </div>
            </div>
          )}

          {/* End of Results Indicator */}
          {!hasMoreResults && displayedResults.length > 0 && (
            <div className="flex justify-center py-4">
              <div className="text-xs text-gray-500">
                All {totalResults.toLocaleString()} results loaded
              </div>
            </div>
          )}
        </div>
      )}

      {/* Loading State */}
      {isLoading && (
        <div className="px-4 py-8">
          <div className="text-center">
            <div className="text-gray-400 mb-2">Searching for "{searchQuery}"...</div>
            <div className="text-sm text-gray-500">This may take a few seconds</div>
          </div>
        </div>
      )}

      {/* Empty State */}
      {!isLoading && searchResults.length === 0 && !error && searchQuery && (
        <div className="px-4 py-8">
          <div className="text-center">
            <div className="text-gray-400 mb-2">No results found</div>
            <div className="text-sm text-gray-500">Try different search terms</div>
          </div>
        </div>
      )}

      {/* Help Text */}
      {!searchQuery && (
        <div className="px-4 py-8">
          {/* Trending Products Section */}
          {trendingProducts.length > 0 && (
            <div className="mb-8">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-lg font-semibold text-white">🔥 Trending Now</h2>
                <div className="text-xs text-gray-400">Popular products</div>
              </div>
              
              <div className="grid grid-cols-2 gap-3 pb-20">
                {trendingProducts.map((product, index) => {
                  return (
                    <div 
                      key={`trending-${index}`} 
                      className="relative border border-gray-700 rounded-lg overflow-hidden hover:border-gray-600 transition-all duration-200 cursor-pointer"
                      onClick={() => handleProductClick(product)}
                    >
                      {/* Card Image */}
                      <div className="aspect-[4/3] flex items-center justify-center py-2 relative">
                        {product?.imageUrl ? (
                          <img
                            src={product.imageUrl}
                            alt={product?.name || 'Card'}
                            className="w-full h-full object-contain"
                            onError={(e) => {
                              e.target.style.display = 'none';
                              e.target.nextSibling.style.display = 'flex';
                            }}
                          />
                        ) : null}
                        <div className={`w-full h-full flex items-center justify-center bg-gray-800 ${product?.imageUrl ? 'hidden' : 'flex'}`}>
                          <div className="text-center">
                            <div className="text-2xl mb-1">📦</div>
                            <div className="text-gray-400 text-xs">No Image</div>
                          </div>
                        </div>
                      </div>
                      
                      {/* Card Details */}
                      <div className="p-2 space-y-1">
                        {/* Item Name - First Line */}
                        <div>
                          <h3 className="text-white leading-tight line-clamp-2 font-bold" style={{fontSize: '12px'}}>
                            {product?.name || 'Unknown Card'}
                          </h3>
                        </div>
                        
                        {/* Set Name - Ghost Text */}
                        <div className="text-xs text-gray-400 truncate" style={{fontSize: '12px'}}>
                          {product?.set || 'Unknown Set'}
                        </div>
                        
                        {/* Type Pill - Below Set Name */}
                        <div className="inline-block px-2 py-0.5 rounded-full text-xs font-medium bg-blue-500/60 text-blue-100">
                          {product?.type === 'product' ? 'Sealed' : (product?.rarity || 'Card')}
                        </div>
                        
                        {/* Spacing */}
                        <div className="h-1"></div>
                        
                        {/* Financial Details */}
                        <div className="space-y-0.5">
                          <div className="text-xs text-white" style={{fontSize: '12px'}}>
                            {product?.marketValue ? formatPrice(product.marketValue) : 'Unavailable'} Value
                          </div>
                          <div className="flex items-center justify-between">
                            <div className="text-xs text-gray-400" style={{fontSize: '12px'}}>
                              Last 7 days: {product.trend ? (
                              <span className={product.trend.direction === 'up' ? 'text-green-400' : product.trend.direction === 'down' ? 'text-red-400' : 'text-gray-400'}>
                                {product.trend.direction === 'up' ? '+' : product.trend.direction === 'down' ? '-' : ''}{product.trend.value}%
                              </span>
                            ) : (
                              <span className="text-gray-400">N/A</span>
                            )}
                            </div>
                            
                            {/* Add Button - Bottom Right */}
                            <button 
                              className="w-6 h-6 bg-white rounded flex items-center justify-center hover:bg-gray-100 transition-colors"
                              onClick={(e) => {
                                e.stopPropagation();
                                handleAddToCollection({ ...product, quantity: 1 });
                              }}
                            >
                              <svg className="w-3 h-3 text-gray-800" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
                              </svg>
                            </button>
                          </div>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Loading State for Trending */}
          {isLoadingTrending && (
            <div className="mb-8">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-lg font-semibold text-white">🔥 Trending Now</h2>
                <div className="text-xs text-gray-400">Loading...</div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                {[1, 2, 3, 4].map((i) => (
                  <div key={i} className="border border-gray-700 rounded-lg overflow-hidden animate-pulse">
                    <div className="aspect-[4/3] bg-gray-800"></div>
                    <div className="p-2 space-y-1">
                      <div className="h-3 bg-gray-700 rounded w-3/4"></div>
                      <div className="h-2 bg-gray-700 rounded w-1/2"></div>
                      <div className="h-2 bg-gray-700 rounded w-1/3"></div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Search Tips */}
          <div className="text-center">
            <div className="text-gray-400 mb-4">Search for trading cards</div>
            <div className="text-sm text-gray-500 space-y-1">
              <div>• Try card names like "Charizard" or "Pikachu"</div>
              <div>• Search for sets like "Prismatic Evolutions"</div>
              <div>• Look for products like "Elite Trainer Box"</div>
            </div>
          </div>
        </div>
      )}

      {/* Product Preview Modal */}
      <ProductPreviewModal
        product={selectedProduct}
        isOpen={isPreviewOpen}
        onClose={handleClosePreview}
        onAddToCollection={handleAddToCollection}
      />
    </div>
  );
};

export default Search;
