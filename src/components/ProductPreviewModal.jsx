import { useState, useEffect } from 'react';

const ProductPreviewModal = ({ product, isOpen, onClose, onAddToCollection }) => {
  const [quantity, setQuantity] = useState(1);
  const [selectedTimeRange, setSelectedTimeRange] = useState('1M');

  const formatPrice = (value) => {
    if (!value) return 'Unavailable';
    if (value > 1000) {
      return `$${(value / 100).toFixed(2)}`;
    } else {
      return `$${value.toFixed(2)}`;
    }
  };

  // Parse product name to separate set name from item name
  const parseProductName = (fullName) => {
    if (!fullName) return { setName: 'Unknown', itemName: 'Product' };
    
    // Common expansion names to look for
    const expansions = [
      'Prismatic Evolutions', 'Base Set', 'Jungle', 'Fossil', 'Team Rocket',
      'Gym Heroes', 'Gym Challenge', 'Neo Genesis', 'Neo Discovery', 'Neo Destiny',
      'Expedition', 'Aquapolis', 'Skyridge', 'Ruby & Sapphire', 'Sandstorm',
      'Dragon', 'Team Magma vs Team Aqua', 'Hidden Legends', 'FireRed & LeafGreen',
      'Team Rocket Returns', 'Deoxys', 'Emerald', 'Unseen Forces', 'Delta Species',
      'Legend Maker', 'Holon Phantoms', 'Crystal Guardians', 'Dragon Frontiers',
      'Power Keepers', 'Diamond & Pearl', 'Mysterious Treasures', 'Secret Wonders',
      'Great Encounters', 'Majestic Dawn', 'Legends Awakened', 'Stormfront',
      'Platinum', 'Rising Rivals', 'Supreme Victors', 'Arceus', 'HeartGold SoulSilver',
      'Unleashed', 'Undaunted', 'Triumphant', 'Call of Legends', 'Black & White',
      'Emerging Powers', 'Noble Victories', 'Next Destinies', 'Dark Explorers',
      'Dragons Exalted', 'Boundaries Crossed', 'Plasma Storm', 'Plasma Freeze',
      'Plasma Blast', 'Legendary Treasures', 'XY', 'Flashfire', 'Furious Fists',
      'Phantom Forces', 'Primal Clash', 'Roaring Skies', 'Ancient Origins',
      'BREAKthrough', 'BREAKpoint', 'Fates Collide', 'Steam Siege', 'Evolutions',
      'Sun & Moon', 'Guardians Rising', 'Burning Shadows', 'Crimson Invasion',
      'Ultra Prism', 'Forbidden Light', 'Celestial Storm', 'Lost Thunder',
      'Team Up', 'Detective Pikachu', 'Unbroken Bonds', 'Unified Minds',
      'Hidden Fates', 'Cosmic Eclipse', 'Sword & Shield', 'Rebel Clash',
      'Darkness Ablaze', 'Vivid Voltage', 'Battle Styles', 'Chilling Reign',
      'Evolving Skies', 'Fusion Strike', 'Brilliant Stars', 'Astral Radiance',
      'Lost Origin', 'Silver Tempest', 'Crown Zenith', 'Scarlet & Violet',
      'Paldea Evolved', 'Obsidian Flames', '151', 'Paradox Rift', 'Temporal Forces'
    ];

    // Try to find expansion name in the full name
    for (const expansion of expansions) {
      if (fullName.toLowerCase().includes(expansion.toLowerCase())) {
        const itemName = fullName.replace(expansion, '').trim();
        return { setName: expansion, itemName: itemName || 'Product' };
      }
    }

    // If no expansion found, try to split on common patterns
    const words = fullName.split(' ');
    if (words.length > 2) {
      // Try to find where the set name ends and item name begins
      for (let i = 1; i < words.length - 1; i++) {
        const potentialSet = words.slice(0, i).join(' ');
        const potentialItem = words.slice(i).join(' ');
        
        // Check if potential set looks like an expansion name
        if (potentialSet.length > 3 && potentialItem.length > 2) {
          return { setName: potentialSet, itemName: potentialItem };
        }
      }
    }

    // Fallback: return the full name as item name
    return { setName: 'Unknown', itemName: fullName };
  };

  const handleAddToCollection = () => {
    if (onAddToCollection) {
      onAddToCollection({
        ...product,
        quantity: quantity
      });
    }
  };

  // Prevent body scroll when modal is open
  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = 'unset';
    }
    
    return () => {
      document.body.style.overflow = 'unset';
    };
  }, [isOpen]);

  if (!isOpen || !product) return null;

  // Debug: Log the product data being passed to the modal
  console.log('🔍 Modal received product data:', product);

  // Parse the product name
  const { setName, itemName } = parseProductName(product.name);

  // Mock data for price change
  const priceChange = Math.random() > 0.5 ? Math.random() * 2 - 1 : 0;
  const isPositive = priceChange > 0;
  const priceChangeAmount = Math.abs(priceChange);


  // Generate price history data from API or mock data
  const generatePriceHistory = (timeRange) => {
    const data = [];
    const basePrice = product.marketValue ? (product.marketValue > 1000 ? product.marketValue / 100 : product.marketValue) : 10;
    
    let days;
    switch (timeRange) {
      case '7D': days = 7; break;
      case '1M': days = 30; break;
      case '3M': days = 90; break;
      case '6M': days = 180; break;
      case '1Y': days = 365; break;
      default: days = 30;
    }
    
    // If we have historical data from the API, use it for more realistic trends
    if (product?.historicalData) {
      const historical = product.historicalData;
      const avg7d = historical.average7d || basePrice;
      const avg30d = historical.average30d || basePrice;
      
      for (let i = 0; i < days; i++) {
        const date = new Date();
        date.setDate(date.getDate() - (days - 1 - i));
        
        // Interpolate between 30d and 7d averages for realistic curve
        let price;
        if (i < days - 30) {
          // Use 30d average as base for older data
          const variation = (Math.random() - 0.5) * 0.15;
          price = avg30d * (1 + variation);
        } else if (i < days - 7) {
          // Interpolate between 30d and 7d
          const ratio = (days - 7 - i) / (days - 7 - (days - 30));
          const interpolated = avg30d + (avg7d - avg30d) * ratio;
          const variation = (Math.random() - 0.5) * 0.1;
          price = interpolated * (1 + variation);
        } else {
          // Use 7d average for recent data
          const variation = (Math.random() - 0.5) * 0.05;
          price = avg7d * (1 + variation);
        }
        
        data.push({
          date: date.toISOString().split('T')[0],
          price: Math.max(price, basePrice * 0.6)
        });
      }
    } else {
      // Fallback to mock data with realistic trends
      for (let i = 0; i < days; i++) {
        const date = new Date();
        date.setDate(date.getDate() - (days - 1 - i));
        
        // Create a more realistic price trend with some volatility
        const trend = Math.sin(i / (days / 4)) * 0.3; // Long-term trend
        const volatility = (Math.random() - 0.5) * 0.4; // Short-term volatility
        const price = basePrice * (1 + trend + volatility);
        
        data.push({
          date: date.toISOString().split('T')[0],
          price: Math.max(price, basePrice * 0.6) // Ensure price doesn't go too low
        });
      }
    }
    
    return data;
  };

  const priceHistory = generatePriceHistory(selectedTimeRange);
  const minPrice = Math.min(...priceHistory.map(d => d.price));
  const maxPrice = Math.max(...priceHistory.map(d => d.price));
  const currentPrice = priceHistory[priceHistory.length - 1].price;
  const currentDate = new Date(priceHistory[priceHistory.length - 1].date).toLocaleDateString('en-US', { 
    month: 'short', 
    day: 'numeric', 
    year: 'numeric' 
  });

  // Generate X-axis labels based on time range
  const getXAxisLabels = () => {
    const labels = [];
    const totalPoints = priceHistory.length;
    const labelCount = Math.min(4, totalPoints);
    
    for (let i = 0; i < labelCount; i++) {
      const index = Math.floor((i / (labelCount - 1)) * (totalPoints - 1));
      const date = new Date(priceHistory[index].date);
      const label = date.toLocaleDateString('en-US', { 
        month: 'short', 
        day: 'numeric' 
      });
      labels.push({ index, label });
    }
    return labels;
  };

  const xAxisLabels = getXAxisLabels();

  return (
    <div className="fixed inset-0 z-[9999] bg-black">
      {/* Top Navigation Bar */}
      <div className="flex items-center justify-between p-4 bg-black">
        <button
          onClick={onClose}
          className="w-10 h-10 bg-black rounded-full flex items-center justify-center border border-gray-700"
        >
          <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
        </button>
        
        <div className="flex items-center gap-3">
          <button className="w-8 h-8 bg-black rounded-full flex items-center justify-center">
            <svg className="w-4 h-4 text-white" fill="currentColor" viewBox="0 0 24 24">
              <path d="M12 8c1.1 0 2-.9 2-2s-.9-2-2-2-2 .9-2 2 .9 2 2 2zm0 2c-1.1 0-2 .9-2 2s.9 2 2 2 2-.9 2-2-.9-2-2-2zm0 6c-1.1 0-2 .9-2 2s.9 2 2 2 2-.9 2-2-.9-2-2-2z"/>
            </svg>
          </button>
          <button className="w-8 h-8 bg-black rounded-full flex items-center justify-center">
            <svg className="w-4 h-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8.684 13.342C8.886 12.938 9 12.482 9 12c0-.482-.114-.938-.316-1.342m0 2.684a3 3 0 110-2.684m0 2.684l6.632 3.316m-6.632-6l6.632-3.316m0 0a3 3 0 105.367-2.684 3 3 0 00-5.367 2.684zm0 9.316a3 3 0 105.367 2.684 3 3 0 00-5.367-2.684z" />
            </svg>
          </button>
          <button className="w-8 h-8 bg-black rounded-full flex items-center justify-center">
            <svg className="w-4 h-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 8V4m0 0h4M4 4l5 5m11-1V4m0 0h-4m4 0l-5 5M4 16v4m0 0h4m-4 0l5-5m11 5l-5-5m5 5v-4m0 4h-4" />
            </svg>
          </button>
        </div>
      </div>

      {/* Scrollable Content */}
      <div className="h-full overflow-y-auto bg-black pb-20">
        {/* Product Image - moved up and no background */}
        <div className="flex justify-center pt-4 pb-2">
          <div className="w-80 h-96 overflow-hidden">
            {product.imageUrl ? (
              <img
                src={product.imageUrl}
                alt={product.name || 'Product'}
                className="w-full h-full object-contain"
                onError={(e) => {
                  e.target.style.display = 'none';
                  e.target.nextSibling.style.display = 'flex';
                }}
              />
            ) : null}
            <div className="hidden w-full h-full items-center justify-center text-gray-400">
              <svg className="w-16 h-16" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
              </svg>
            </div>
          </div>
        </div>

        {/* Product Information */}
        <div className="px-6 pb-6">
          {/* Product Title - smaller */}
          <h1 className="text-lg font-semibold text-white mb-2">
            {itemName}
          </h1>
          
          {/* Product Type and Condition - with parsed set name */}
          <div className="text-gray-400 mb-4">
            {setName} • {product.type === 'product' ? 'Sealed' : (product.rarity || 'Card')}
          </div>

          {/* Price and Trend */}
          <div className="flex items-center justify-between mb-6">
            <div>
              <div className="text-2xl font-bold text-white">
                {formatPrice(product.marketValue)}
              </div>
              {product.marketValue && priceChange !== 0 && (
                <div className={`flex items-center gap-1 text-sm ${isPositive ? 'text-green-400' : 'text-red-400'}`}>
                  <svg className={`w-4 h-4 ${isPositive ? 'rotate-0' : 'rotate-180'}`} fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M5.293 7.707a1 1 0 010-1.414l4-4a1 1 0 011.414 0l4 4a1 1 0 01-1.414 1.414L11 5.414V17a1 1 0 11-2 0V5.414L6.707 7.707a1 1 0 01-1.414 0z" clipRule="evenodd" />
                  </svg>
                  <span>
                    {isPositive ? '+' : ''}${priceChangeAmount.toFixed(2)} ({priceChange.toFixed(2)}%)
                  </span>
                  <span className="text-gray-400">Last 7 days</span>
                </div>
              )}
            </div>
          </div>

          {/* Action Buttons */}
          <div className="space-y-3 mb-6">
            <button
              onClick={handleAddToCollection}
              className="w-full bg-green-600 hover:bg-green-700 text-white font-medium py-4 px-6 rounded-lg transition-colors flex items-center justify-center gap-3"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" />
              </svg>
              Add To Collection
            </button>
            
            <button className="w-full bg-black border border-gray-700 hover:bg-gray-800 text-white font-medium py-3 px-4 rounded-lg transition-colors flex items-center justify-center gap-2">
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 3h2l.4 2M7 13h10l4-8H5.4m0 0L7 13m0 0l-2.5 5M7 13l2.5 5m6-5v6a2 2 0 01-2 2H9a2 2 0 01-2-2v-6m8 0V9a2 2 0 00-2-2H9a2 2 0 00-2 2v4.01" />
              </svg>
              View Sold On eBay
              <svg className="w-3 h-3 ml-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
              </svg>
            </button>
          </div>

          {/* Price History Section */}
          <div className="bg-gray-900 rounded-xl p-4">
            <h3 className="text-sm font-semibold text-white mb-3">Price History</h3>
            
            {/* Price Range and Current Price */}
            <div className="flex justify-between items-center mb-3">
              <div className="flex gap-3 text-xs">
                <span className="text-white">Min {formatPrice(minPrice * 100)}</span>
                <span className="text-white">Max {formatPrice(maxPrice * 100)}</span>
              </div>
              <div className="text-xs">
                <span className="text-white">{currentDate}</span>
                <span className="text-teal-400 ml-1">{formatPrice(currentPrice * 100)}</span>
              </div>
            </div>
            
            {/* Chart Container */}
            <div className="h-40 mb-3">
              <svg width="100%" height="100%" viewBox="0 0 400 160" className="overflow-visible">
                <defs>
                  {/* Gradient definition */}
                  <linearGradient id="priceGradient" x1="0%" y1="0%" x2="0%" y2="100%">
                    <stop offset="0%" stopColor="#14B8A6" stopOpacity="0.3"/>
                    <stop offset="100%" stopColor="#14B8A6" stopOpacity="0"/>
                  </linearGradient>
                </defs>
                
                {/* Generate smooth curve points */}
                {(() => {
                  const points = priceHistory.map((point, index) => {
                    const x = (index / (priceHistory.length - 1)) * 360 + 20;
                    const y = 140 - ((point.price - minPrice) / (maxPrice - minPrice)) * 120;
                    return { x, y };
                  });
                  
                  // Create smooth curve using quadratic Bézier curves
                  let pathData = `M ${points[0].x} ${points[0].y}`;
                  for (let i = 1; i < points.length; i++) {
                    const prev = points[i - 1];
                    const curr = points[i];
                    const next = points[i + 1];
                    
                    if (next) {
                      const cp1x = prev.x + (curr.x - prev.x) / 2;
                      const cp1y = prev.y;
                      const cp2x = curr.x - (next.x - curr.x) / 2;
                      const cp2y = curr.y;
                      pathData += ` C ${cp1x} ${cp1y}, ${cp2x} ${cp2y}, ${curr.x} ${curr.y}`;
                    } else {
                      pathData += ` L ${curr.x} ${curr.y}`;
                    }
                  }
                  
                  return (
                    <>
                      {/* Gradient area */}
                      <path
                        d={`${pathData} L ${points[points.length - 1].x} 160 L 20 160 Z`}
                        fill="url(#priceGradient)"
                      />
                      {/* Smooth line */}
                      <path
                        d={pathData}
                        fill="none"
                        stroke="#14B8A6"
                        strokeWidth="2"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      />
                    </>
                  );
                })()}
                
                {/* Current point - teal circle */}
                <circle
                  cx={(priceHistory.length - 1) / (priceHistory.length - 1) * 360 + 20}
                  cy={140 - ((currentPrice - minPrice) / (maxPrice - minPrice)) * 120}
                  r="3"
                  fill="#14B8A6"
                />
              </svg>
              
              {/* X-axis labels */}
              <div className="flex justify-between mt-2 px-5">
                {xAxisLabels.map((label, index) => (
                  <span key={index} className="text-xs text-gray-400">
                    {label.label}
                  </span>
                ))}
              </div>
            </div>
            
            {/* Time Range Selectors */}
            <div className="flex justify-center gap-2 mb-4 mt-8">
              {['7D', '1M', '3M', '6M', '1Y'].map((period) => (
                <button
                  key={period}
                  onClick={() => setSelectedTimeRange(period)}
                  className={`px-3 py-1.5 text-xs rounded transition-colors ${
                    period === selectedTimeRange
                      ? 'bg-yellow-400 text-black'
                      : 'text-white hover:bg-gray-700'
                  }`}
                >
                  {period}
                </button>
              ))}
            </div>
            
            {/* Footer */}
            <div className="text-xs text-gray-500 text-center">
              <button className="text-gray-500 underline hover:text-gray-400 opacity-60 hover:opacity-80">
                View market data sources
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ProductPreviewModal;
