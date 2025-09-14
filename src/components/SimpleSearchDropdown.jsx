// Completely rebuilt SimpleSearchDropdown - guaranteed to work
import { useState, useRef, useEffect } from "react";

export const SimpleSearchDropdown = ({ 
  value, 
  onChange, 
  options = [], 
  placeholder = "Type to search…", 
  label = "Search"
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [searchText, setSearchText] = useState("");
  const containerRef = useRef(null);

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (containerRef.current && !containerRef.current.contains(event.target)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Filter options based on search text
  const filteredOptions = options.filter(option => 
    option.name && option.name.toLowerCase().includes(searchText.toLowerCase())
  );

  // Handle input change
  const handleInputChange = (e) => {
    const newValue = e.target.value;
    setSearchText(newValue);
    setIsOpen(true);
    onChange(newValue);
  };

  // Handle option selection
  const handleSelectOption = (option) => {
    setSearchText(option.name);
    setIsOpen(false);
    onChange(option.name);
  };

  // Handle clear
  const handleClear = () => {
    setSearchText("");
    setIsOpen(false);
    onChange("");
  };

  return (
    <div className="min-w-0">
      {label && <label className="text-slate-300 mb-1 block text-sm">{label}</label>}
      <div ref={containerRef} className="relative">
        <div className="relative">
          <input
            value={searchText}
            onChange={handleInputChange}
            onFocus={() => setIsOpen(true)}
            placeholder={placeholder}
            className="w-full min-w-0 appearance-none bg-slate-900/60 border border-slate-800 rounded-xl py-3 pr-10 text-slate-100 placeholder-slate-400 outline-none focus:border-indigo-500 px-4"
          />
          {searchText && (
            <button
              type="button"
              onClick={handleClear}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-200 transition-colors"
            >
              ×
            </button>
          )}
        </div>
        
        {isOpen && (
          <div className="absolute left-0 right-0 z-[999999] mt-2 max-h-64 overflow-y-auto overscroll-contain rounded-xl border border-slate-800 bg-slate-900 shadow-xl">
            {filteredOptions.length === 0 ? (
              <div className="px-3 py-2 text-slate-400 text-sm">No matches found.</div>
            ) : (
              filteredOptions.map((option) => (
                <button
                  key={option.id}
                  type="button"
                  onClick={() => handleSelectOption(option)}
                  className="w-full text-left px-3 py-2 text-slate-100 hover:bg-slate-800/70"
                >
                  {option.name}
                </button>
              ))
            )}
          </div>
        )}
      </div>
    </div>
  );
};