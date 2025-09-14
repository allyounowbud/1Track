// Simple searchable dropdown with "Add +" functionality
import { useState, useRef, useEffect } from "react";

export const SimpleSearchDropdown = ({ 
  value, 
  onChange, 
  options, 
  placeholder = "Type to search…", 
  label = "Search",
  onAddNew,
  addNewText = "Add"
}) => {
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const boxRef = useRef(null);

  // Click outside to close dropdown
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (boxRef.current && !boxRef.current.contains(event.target)) {
        setDropdownOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Filter options based on search
  const filtered = options.filter(option => 
    option.name.toLowerCase().includes(value.toLowerCase())
  ).slice(0, 20);

  // Check if search text matches any existing option
  const hasExactMatch = options.some(option => 
    option.name.toLowerCase() === value.toLowerCase()
  );

  // Show "Add +" option if user is typing something new
  const showAddOption = onAddNew && value.trim() && !hasExactMatch;

  // Handle selection
  const handleSelect = (optionName) => {
    onChange(optionName);
    setDropdownOpen(false);
  };

  // Handle clear button
  const handleClear = () => {
    onChange("");
    setDropdownOpen(false);
  };

  return (
    <div className="min-w-0">
      <label className="text-slate-300 mb-1 block text-sm">{label}</label>
      <div ref={boxRef} className="relative">
        <div className="relative">
          <input
            value={value}
            onChange={(e) => onChange(e.target.value)}
            onFocus={() => setDropdownOpen(true)}
            placeholder={placeholder}
            className="w-full min-w-0 appearance-none bg-slate-900/60 border border-slate-800 rounded-xl py-3 pr-10 text-slate-100 placeholder-slate-400 outline-none focus:border-indigo-500 px-4"
          />
          {value && (
            <button
              type="button"
              onClick={handleClear}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-200 transition-colors"
            >
              <svg className="w-4 h-4" viewBox="0 0 20 20" fill="currentColor">
                <path d="M6.28 5.22a.75.75 0 00-1.06 1.06L8.94 10l-3.72 3.72a.75.75 0 101.06 1.06L10 11.06l3.72 3.72a.75.75 0 101.06-1.06L11.06 10l3.72-3.72a.75.75 0 00-1.06-1.06L10 8.94 6.28 5.22z" />
              </svg>
            </button>
          )}
        </div>
        {dropdownOpen && (
          <div className="absolute left-0 right-0 z-[999999] mt-2 max-h-64 overflow-y-auto overscroll-contain rounded-xl border border-slate-800 bg-slate-900 shadow-xl">
            {/* Add new option */}
            {showAddOption && (
              <button
                type="button"
                onClick={async () => {
                  try {
                    const result = await onAddNew(value.trim());
                    if (result) {
                      onChange(result);
                      setDropdownOpen(false);
                    }
                  } catch (error) {
                    console.error('Error adding new option:', error);
                  }
                }}
                className="w-full text-left px-3 py-2 text-indigo-300 hover:bg-slate-800/70 border-b border-slate-800"
              >
                + {addNewText} "{value.trim()}"
              </button>
            )}
            
            {/* Existing options */}
            {filtered.length === 0 && !showAddOption && (
              <div className="px-3 py-2 text-slate-400 text-sm">No matches.</div>
            )}
            {filtered.map((option) => (
              <button
                type="button"
                key={option.id}
                onClick={() => handleSelect(option.name)}
                className="w-full text-left px-3 py-2 text-slate-100 hover:bg-slate-800/70"
              >
                {option.name}
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};
