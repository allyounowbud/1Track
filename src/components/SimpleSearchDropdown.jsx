// Simple working SimpleSearchDropdown - basic functionality only
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
  const [isOpen, setIsOpen] = useState(false);
  const [inputValue, setInputValue] = useState(value || "");
  const containerRef = useRef(null);

  // Update input value when value prop changes
  useEffect(() => {
    setInputValue(value || "");
  }, [value]);

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

  // Filter options based on current input
  const filteredOptions = options.filter(option => 
    option.name.toLowerCase().includes(inputValue.toLowerCase())
  ).slice(0, 20);

  // Debug: Log when options change
  useEffect(() => {
    if (options.length > 0) {
      console.log(`${label} dropdown loaded ${options.length} options:`, options.slice(0, 3));
    }
  }, [options, label]);

  // Handle input changes
  const handleInputChange = (e) => {
    const newValue = e.target.value;
    setInputValue(newValue);
    setIsOpen(true);
    onChange(newValue);
  };

  // Handle option selection
  const handleSelectOption = (optionName) => {
    setInputValue(optionName);
    setIsOpen(false);
    onChange(optionName);
  };

  // Handle clear
  const handleClear = () => {
    setInputValue("");
    setIsOpen(false);
    onChange("");
  };

  return (
    <div className="min-w-0">
      {label && <label className="text-slate-300 mb-1 block text-sm">{label}</label>}
      <div ref={containerRef} className="relative">
        <div className="relative">
          <input
            value={inputValue}
            onChange={handleInputChange}
            onFocus={() => setIsOpen(true)}
            placeholder={placeholder}
            className="w-full min-w-0 appearance-none bg-slate-900/60 border border-slate-800 rounded-xl py-3 pr-10 text-slate-100 placeholder-slate-400 outline-none focus:border-indigo-500 px-4"
          />
          {inputValue && (
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
        
        {isOpen && (
          <div className="absolute left-0 right-0 z-[999999] mt-2 max-h-64 overflow-y-auto overscroll-contain rounded-xl border border-slate-800 bg-slate-900 shadow-xl">
            {filteredOptions.length === 0 && (
              <div className="px-3 py-2 text-slate-400 text-sm">No matches.</div>
            )}
            {filteredOptions.map((option) => (
              <button
                type="button"
                key={option.id}
                onClick={() => handleSelectOption(option.name)}
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