import { useState } from 'react';

const Header = ({ searchQuery, onSearch, onThemeToggle, isDarkMode }) => {
  const [showCurrencyDropdown, setShowCurrencyDropdown] = useState(false);

  return (
    <div className="bg-black border-b border-gray-800">
      {/* Main Header */}
      <div className="px-4 py-3">
        <div className="flex items-center justify-between mb-2">
          <div className="text-lg font-bold text-white">1T 1Track</div>
          <div className="flex items-center gap-3">
            {/* Currency Dropdown */}
            <div className="relative">
              <button
                onClick={() => setShowCurrencyDropdown(!showCurrencyDropdown)}
                className="flex items-center gap-1 text-sm text-white hover:text-gray-300"
              >
                <span>us</span>
                <span className="font-medium">USD</span>
                <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M5.293 7.293a1 1 0 011.414 0L10 10.586l3.293-3.293a1 1 0 111.414 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414z" clipRule="evenodd" />
                </svg>
              </button>
              
              {showCurrencyDropdown && (
                <div className="absolute right-0 mt-2 w-32 bg-gray-800 border border-gray-700 rounded-lg shadow-lg z-50">
                  <div className="py-1">
                    <button className="w-full px-3 py-2 text-left text-sm text-white hover:bg-gray-700">
                      USD
                    </button>
                    <button className="w-full px-3 py-2 text-left text-sm text-white hover:bg-gray-700">
                      EUR
                    </button>
                    <button className="w-full px-3 py-2 text-left text-sm text-white hover:bg-gray-700">
                      GBP
                    </button>
                  </div>
                </div>
              )}
            </div>

            {/* Share Button */}
            <button className="flex items-center gap-1 px-2 py-1 bg-gray-800 rounded text-xs text-white hover:bg-gray-700 transition-colors">
              <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M3 17a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1zm3.293-7.707a1 1 0 011.414 0L9 10.586V3a1 1 0 112 0v7.586l1.293-1.293a1 1 0 111.414 1.414l-3 3a1 1 0 01-1.414 0l-3-3a1 1 0 010-1.414z" clipRule="evenodd" />
              </svg>
              Share Collection
            </button>
          </div>
        </div>
        
        {/* Date and Total Value */}
        <div className="text-xs text-gray-400 mb-1">
          {new Date().toLocaleDateString('en-US', { 
            month: 'short', 
            day: 'numeric', 
            year: 'numeric' 
          })}
        </div>
        <div className="text-2xl font-bold text-emerald-500">$18,620.00</div>
      </div>
    </div>
  );
};

export default Header;