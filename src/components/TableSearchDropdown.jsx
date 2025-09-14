// Simple working dropdown that displays table data correctly
import { useState, useRef, useEffect } from "react";
import { inputBase } from "../utils/ui.js";

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

  // Debug: Log options when they change
  useEffect(() => {
    console.log(`${label} dropdown options:`, options.length, options.slice(0, 3));
  }, [options, label]);

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
          <div 
            className={`${inputBase} flex items-center justify-between cursor-pointer`}
            onClick={() => setIsOpen(!isOpen)}
          >
            <div className="flex items-center gap-2 min-w-0 flex-1">
              {icon && (
                <div className="text-slate-400 flex-shrink-0">
                  {icon}
                </div>
              )}
              <span className={displayValue ? "text-slate-100" : "text-slate-400 truncate"}>
                {displayValue || placeholder}
              </span>
            </div>
            <div className="flex items-center gap-2 flex-shrink-0">
              {displayValue && (
                <button
                  type="button"
                  onClick={handleClear}
                  className="text-slate-400 hover:text-slate-200 transition-colors"
                >
                  ×
                </button>
              )}
              <svg className="w-4 h-4 opacity-70" viewBox="0 0 20 20" fill="currentColor">
                <path fillRule="evenodd" d="M5.293 7.293a1 1 0 011.414 0L10 10.586l3.293-3.293a1 1 0 111.414 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414z" clipRule="evenodd" />
              </svg>
            </div>
          </div>
        </div>
        
        {isOpen && (
          <div className="absolute left-0 right-0 z-[999999] mt-2 max-h-64 overflow-y-auto overscroll-contain rounded-xl border border-slate-800 bg-slate-900 shadow-xl">
            {options.length === 0 ? (
              <div className="px-3 py-2 text-slate-400 text-sm">
                No options available. ({options.length} items)
              </div>
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