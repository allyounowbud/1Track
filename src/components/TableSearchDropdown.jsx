// Simple working dropdown that displays table data correctly
import { useState, useRef, useEffect } from "react";

export const TableSearchDropdown = ({ 
  value, 
  onChange, 
  options = [], 
  placeholder = "Select an option…", 
  label = "Select",
  icon,
  getOptionLabel = (option) => option.name,
  getOptionValue = (option) => option.name
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [displayValue, setDisplayValue] = useState("");
  const containerRef = useRef(null);

  // Update display value when value prop changes
  useEffect(() => {
    if (value) {
      const option = options.find(opt => getOptionValue(opt) === value);
      if (option) {
        setDisplayValue(getOptionLabel(option));
      } else {
        setDisplayValue(value);
      }
    } else {
      setDisplayValue("");
    }
  }, [value, options, getOptionLabel, getOptionValue]);

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

  // Handle option selection
  const handleSelectOption = (option) => {
    const optionValue = getOptionValue(option);
    const optionLabel = getOptionLabel(option);
    setDisplayValue(optionLabel);
    setIsOpen(false);
    onChange(optionValue);
  };

  // Handle clear
  const handleClear = () => {
    setDisplayValue("");
    setIsOpen(false);
    onChange("");
  };

  return (
    <div className="min-w-0">
      {label && <label className="text-slate-300 mb-1 block text-sm">{label}</label>}
      <div ref={containerRef} className="relative">
        <div className="relative">
          {icon && (
            <div className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none">
              {icon}
            </div>
          )}
          <input
            value={displayValue}
            readOnly
            onClick={() => setIsOpen(!isOpen)}
            placeholder={placeholder}
            className={`w-full min-w-0 appearance-none bg-slate-900/60 border border-slate-800 rounded-xl py-3 pr-10 text-slate-100 placeholder-slate-400 outline-none focus:border-indigo-500 cursor-pointer ${icon ? 'pl-10' : 'px-4'}`}
          />
          {displayValue && (
            <button
              type="button"
              onClick={handleClear}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-200 transition-colors"
            >
              ×
            </button>
          )}
          <button
            type="button"
            onClick={() => setIsOpen(!isOpen)}
            className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-200 transition-colors"
          >
            <svg className="w-4 h-4" viewBox="0 0 20 20" fill="currentColor">
              <path fillRule="evenodd" d="M5.293 7.293a1 1 0 011.414 0L10 10.586l3.293-3.293a1 1 0 111.414 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414z" clipRule="evenodd" />
            </svg>
          </button>
        </div>
        
        {isOpen && (
          <div className="absolute left-0 right-0 z-[999999] mt-2 max-h-64 overflow-y-auto overscroll-contain rounded-xl border border-slate-800 bg-slate-900 shadow-xl">
            {options.length === 0 ? (
              <div className="px-3 py-2 text-slate-400 text-sm">No options available.</div>
            ) : (
              options.map((option) => (
                <button
                  key={getOptionValue(option)}
                  type="button"
                  onClick={() => handleSelectOption(option)}
                  className="w-full text-left px-3 py-2 text-slate-100 hover:bg-slate-800/70"
                >
                  {getOptionLabel(option)}
                </button>
              ))
            )}
          </div>
        )}
      </div>
    </div>
  );
};