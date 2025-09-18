import { useState, useEffect, useRef } from "react";
import { createPortal } from "react-dom";
import { supabase } from "../lib/supabaseClient";
import { moneyToCents, centsToStr } from "../utils/money.js";

export function UnifiedNewProductRow({ row, isSelected, onToggleSelection, onSave, onCancel, existingCategories = [] }) {
  const [name, setName] = useState("");
  const [marketValue, setMarketValue] = useState("");
  const [category, setCategory] = useState(row.category || '');
  const [categoryInput, setCategoryInput] = useState(row.category || '');
  const [showDropdown, setShowDropdown] = useState(false);
  const [filteredCategories, setFilteredCategories] = useState([]);
  const [status, setStatus] = useState("");
  const [busy, setBusy] = useState(false);
  const desktopInputRef = useRef(null);
  const mobileInputRef = useRef(null);
  const [dropdownPosition, setDropdownPosition] = useState({ top: 0, left: 0, width: 0 });


  useEffect(() => {
    // When a new row is added, ensure the category is set from the row prop
    if (row.category && row.category !== category) {
      setCategory(row.category);
      setCategoryInput(row.category);
    }
  }, [row.category]);

  // Filter categories based on input
  useEffect(() => {
    if (categoryInput.trim() === '') {
      setFilteredCategories(existingCategories);
    } else {
      const filtered = existingCategories.filter(cat => 
        cat.toLowerCase().includes(categoryInput.toLowerCase())
      );
      setFilteredCategories(filtered);
    }
  }, [categoryInput, existingCategories]);

  const handleCategoryInputChange = (e) => {
    const value = e.target.value;
    setCategoryInput(value);
    setShowDropdown(true);
  };

  const handleCategorySelect = (selectedCategory) => {
    setCategory(selectedCategory);
    setCategoryInput(selectedCategory);
    setShowDropdown(false);
  };

  const handleAddNewCategory = () => {
    const newCategoryName = categoryInput.trim();
    if (newCategoryName) {
      setCategory(newCategoryName);
      setCategoryInput(newCategoryName);
      setShowDropdown(false);
    }
  };

  const handleInputFocus = (isMobile = false) => {
    console.log('Input focused, showing dropdown. Existing categories:', existingCategories);
    const inputRef = isMobile ? mobileInputRef : desktopInputRef;
    console.log('Input ref:', inputRef.current, 'isMobile:', isMobile);
    if (inputRef.current) {
      const rect = inputRef.current.getBoundingClientRect();
      console.log('Input rect:', rect);
      setDropdownPosition({
        top: rect.bottom + window.scrollY + 4,
        left: rect.left + window.scrollX,
        width: rect.width
      });
      console.log('Dropdown position set:', {
        top: rect.bottom + window.scrollY + 4,
        left: rect.left + window.scrollX,
        width: rect.width
      });
    }
    setShowDropdown(true);
  };

  const handleInputBlur = () => {
    // Delay hiding dropdown to allow clicks on dropdown items
    setTimeout(() => setShowDropdown(false), 200);
  };

  const handleDropdownMouseDown = (e) => {
    // Prevent input blur when clicking on dropdown
    e.preventDefault();
  };

  const handleSave = async () => {
    if (busy || !name.trim() || !category.trim()) return;
    setBusy(true);
    setStatus("Saving…");
    
    try {
      const market_value_cents = moneyToCents(marketValue);
      const productData = { 
        name: name.trim(), 
        product_category: category,
        market_value_cents,
        price_source: 'manual' // Always manual for backup database
      };
      
      const { error } = await supabase
        .from('items')
        .insert(productData);
      
      if (error) throw error;
      
      setStatus("Saved ✓");
      setTimeout(() => {
        onSave({ name, category, marketValue });
      }, 500);
    } catch (e) {
      setStatus(String(e.message || e));
      setTimeout(() => setStatus(""), 2000);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div 
      className={`w-full border border-gray-200 dark:border-slate-700 rounded-xl transition cursor-pointer ${
        isSelected
          ? 'border-indigo-500 bg-indigo-50 dark:bg-indigo-500/20 dark:border-indigo-400' 
          : 'hover:border-gray-300 dark:hover:border-slate-600 hover:bg-gray-50 dark:hover:bg-slate-800/30'
      }`}
      onClick={onToggleSelection}
    >
      {/* Desktop: Grid layout */}
      <div className="hidden sm:grid grid-cols-[3fr_2fr_1fr_auto] gap-4 items-center min-w-0 p-4">
        
        <div onClick={(e) => e.stopPropagation()} className="min-w-0">
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Enter product name..."
            className="w-full min-w-[150px] h-10 appearance-none bg-white dark:bg-slate-900/60 border border-gray-200 dark:border-slate-800 rounded-xl px-3 text-sm text-gray-900 dark:text-slate-100 focus:border-indigo-500 outline-none"
          />
        </div>
        
        <div onClick={(e) => e.stopPropagation()} className="min-w-0 relative">
          <input
            ref={desktopInputRef}
            type="text"
            value={categoryInput}
            onChange={handleCategoryInputChange}
            onFocus={() => handleInputFocus(false)}
            onBlur={handleInputBlur}
            placeholder="Select or type category..."
            className="w-full h-10 px-3 pr-8 text-sm bg-white dark:bg-slate-900/60 border border-gray-200 dark:border-slate-800 rounded-xl text-gray-900 dark:text-slate-100 focus:border-indigo-500 outline-none"
            onClick={(e) => e.stopPropagation()}
          />
          {/* Dropdown Arrow */}
          <div className="absolute right-3 top-1/2 transform -translate-y-1/2 pointer-events-none">
            <svg className="w-4 h-4 text-gray-400 dark:text-slate-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
            </svg>
          </div>
          
          {/* Portal-based Dropdown */}
          {showDropdown && (() => {
            console.log('Rendering desktop dropdown with showDropdown:', showDropdown, 'position:', dropdownPosition);
            return createPortal(
            <div 
              className="fixed bg-white dark:bg-slate-800 border border-gray-200 dark:border-slate-700 rounded-xl shadow-lg z-[9999] max-h-48 overflow-y-auto"
              style={{
                top: dropdownPosition.top,
                left: dropdownPosition.left,
                width: dropdownPosition.width
              }}
              onMouseDown={handleDropdownMouseDown}
            >
              {/* Show all categories when input is empty */}
              {(categoryInput.trim() === '' ? (existingCategories.length > 0 ? existingCategories : ['No categories yet']) : filteredCategories).map(cat => (
                <div
                  key={cat}
                  onClick={cat === 'No categories yet' ? undefined : (e) => {
                    e.stopPropagation();
                    handleCategorySelect(cat);
                  }}
                  className={`px-3 py-2 text-sm first:rounded-t-xl last:rounded-b-xl ${
                    cat === 'No categories yet' 
                      ? 'text-gray-500 dark:text-slate-400 cursor-default' 
                      : 'text-gray-900 dark:text-slate-100 hover:bg-gray-100 dark:hover:bg-slate-700 cursor-pointer'
                  }`}
                >
                  {cat}
                </div>
              ))}
              
              {/* Add new category option */}
              {categoryInput.trim() && !existingCategories.some(cat => cat.toLowerCase() === categoryInput.toLowerCase()) && (
                <div
                  onClick={(e) => {
                    e.stopPropagation();
                    handleAddNewCategory();
                  }}
                  className="px-3 py-2 text-sm text-indigo-600 dark:text-indigo-400 hover:bg-indigo-50 dark:hover:bg-indigo-900/20 cursor-pointer border-t border-gray-200 dark:border-slate-700 flex items-center gap-2"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
                  </svg>
                  Add "{categoryInput.trim()}"
                </div>
              )}
              
              {/* No results */}
              {filteredCategories.length === 0 && categoryInput.trim() && existingCategories.some(cat => cat.toLowerCase() === categoryInput.toLowerCase()) && (
                <div className="px-3 py-2 text-sm text-gray-500 dark:text-slate-400">
                  Category already exists
                </div>
              )}
            </div>,
            document.body
            );
          })()}
        </div>
        
        <div onClick={(e) => e.stopPropagation()} className="min-w-0 overflow-hidden">
          <input
            className="w-full h-10 appearance-none bg-white dark:bg-slate-900/60 border border-gray-200 dark:border-slate-800 rounded-xl px-3 text-sm text-gray-900 dark:text-slate-100 focus:border-indigo-500 outline-none"
            value={marketValue}
            onChange={(e) => {
              e.stopPropagation();
              setMarketValue(e.target.value);
            }}
            onClick={(e) => e.stopPropagation()}
            placeholder="Market value ($)"
          />
        </div>
        
        <div className="flex items-center gap-2">
          <button
            onClick={(e) => {
              e.stopPropagation();
              handleSave();
            }}
            disabled={busy || !name.trim() || !category.trim()}
            className="w-10 h-10 rounded-lg border border-slate-600 bg-gray-100 dark:bg-slate-800/60 hover:bg-gray-200 dark:hover:bg-slate-700 hover:border-slate-500 text-gray-800 dark:text-slate-200 transition-all duration-200 flex items-center justify-center group disabled:opacity-50 disabled:cursor-not-allowed"
            title="Save Changes"
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
            className="w-10 h-10 rounded-lg border border-slate-600 bg-gray-100 dark:bg-slate-800/60 hover:bg-gray-200 dark:hover:bg-slate-700 hover:border-slate-500 text-gray-800 dark:text-slate-200 transition-all duration-200 flex items-center justify-center group"
            title="Cancel"
          >
            <svg className="w-3 h-3 transition-transform group-hover:scale-110" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
      </div>

      {/* Mobile: Stacked layout with labels */}
      <div className="sm:hidden space-y-4 p-4">
        
        <div>
          <div className="flex items-center justify-between mb-1">
            <label className="block text-xs text-gray-600 dark:text-slate-400">Item Name</label>
          </div>
          <div onClick={(e) => e.stopPropagation()}>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Enter product name..."
              className="w-full h-10 appearance-none bg-white dark:bg-slate-900/60 border border-gray-200 dark:border-slate-800 rounded-xl px-3 text-sm text-gray-900 dark:text-slate-100 focus:border-indigo-500 outline-none"
            />
          </div>
        </div>
        
        <div>
          <label className="block text-xs text-gray-600 dark:text-slate-400 mb-1">Category</label>
          <div className="relative">
            <input
              ref={mobileInputRef}
              type="text"
              value={categoryInput}
              onChange={handleCategoryInputChange}
              onFocus={() => handleInputFocus(true)}
              onBlur={handleInputBlur}
              placeholder="Select or type category..."
              className="w-full h-10 px-3 pr-8 text-sm bg-white dark:bg-slate-900/60 border border-gray-200 dark:border-slate-800 rounded-xl text-gray-900 dark:text-slate-100 focus:border-indigo-500 outline-none"
              onClick={(e) => e.stopPropagation()}
            />
            {/* Dropdown Arrow */}
            <div className="absolute right-3 top-1/2 transform -translate-y-1/2 pointer-events-none">
              <svg className="w-4 h-4 text-gray-400 dark:text-slate-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
              </svg>
            </div>
            
            {/* Portal-based Dropdown */}
            {showDropdown && createPortal(
              <div 
                className="fixed bg-white dark:bg-slate-800 border border-gray-200 dark:border-slate-700 rounded-xl shadow-lg z-[9999] max-h-48 overflow-y-auto"
                style={{
                  top: dropdownPosition.top,
                  left: dropdownPosition.left,
                  width: dropdownPosition.width
                }}
                onMouseDown={handleDropdownMouseDown}
              >
                {/* Show all categories when input is empty */}
                {(categoryInput.trim() === '' ? (existingCategories.length > 0 ? existingCategories : ['No categories yet']) : filteredCategories).map(cat => (
                  <div
                    key={cat}
                    onClick={cat === 'No categories yet' ? undefined : (e) => {
                      e.stopPropagation();
                      handleCategorySelect(cat);
                    }}
                    className={`px-3 py-2 text-sm first:rounded-t-xl last:rounded-b-xl ${
                      cat === 'No categories yet' 
                        ? 'text-gray-500 dark:text-slate-400 cursor-default' 
                        : 'text-gray-900 dark:text-slate-100 hover:bg-gray-100 dark:hover:bg-slate-700 cursor-pointer'
                    }`}
                  >
                    {cat}
                  </div>
                ))}
                
                {/* Add new category option */}
                {categoryInput.trim() && !existingCategories.some(cat => cat.toLowerCase() === categoryInput.toLowerCase()) && (
                  <div
                    onClick={(e) => {
                      e.stopPropagation();
                      handleAddNewCategory();
                    }}
                    className="px-3 py-2 text-sm text-indigo-600 dark:text-indigo-400 hover:bg-indigo-50 dark:hover:bg-indigo-900/20 cursor-pointer border-t border-gray-200 dark:border-slate-700 flex items-center gap-2"
                  >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
                    </svg>
                    Add "{categoryInput.trim()}"
                  </div>
                )}
                
                {/* No results */}
                {filteredCategories.length === 0 && categoryInput.trim() && existingCategories.some(cat => cat.toLowerCase() === categoryInput.toLowerCase()) && (
                  <div className="px-3 py-2 text-sm text-gray-500 dark:text-slate-400">
                    Category already exists
                  </div>
                )}
              </div>,
              document.body
            )}
          </div>
        </div>
        
        <div>
          <label className="block text-xs text-gray-600 dark:text-slate-400 mb-1">Market Value</label>
          <div className="flex items-center gap-2">
            <input
              className="flex-1 h-10 appearance-none bg-white dark:bg-slate-900/60 border border-gray-200 dark:border-slate-800 rounded-xl px-3 text-sm text-gray-900 dark:text-slate-100 placeholder-slate-400 outline-none focus:border-indigo-500"
              value={marketValue}
              onChange={(e) => {
                e.stopPropagation();
                setMarketValue(e.target.value);
              }}
              onClick={(e) => e.stopPropagation()}
              placeholder="Market value ($)"
            />
            
            <div className="flex gap-2">
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  handleSave();
                }}
                disabled={busy || !name.trim() || !category.trim()}
                className="px-3 py-2 rounded-lg border border-indigo-500 bg-indigo-500 hover:bg-indigo-600 disabled:opacity-50 disabled:cursor-not-allowed text-white transition-all duration-200 flex items-center gap-1 text-sm font-medium"
                title="Save Changes"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7H5a2 2 0 00-2 2v9a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-3m-1 4l-3 3m0 0l-3-3m3 3V4" />
                </svg>
                <span>Save</span>
              </button>
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  onCancel();
                }}
                className="px-3 py-2 rounded-lg border border-gray-300 dark:border-slate-600 bg-white dark:bg-slate-800/60 hover:bg-gray-50 dark:hover:bg-slate-700 text-gray-800 dark:text-slate-200 transition-all duration-200 flex items-center gap-1 text-sm font-medium"
                title="Cancel"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
                <span>Cancel</span>
              </button>
            </div>
          </div>
        </div>
      </div>

      {status && (
        <div className="mt-2 text-sm text-gray-600 dark:text-slate-400">
          {status}
        </div>
      )}
    </div>
  );
}