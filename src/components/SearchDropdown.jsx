// Universal SearchDropdown component - completely redesigned for reliability
import { useState, useRef, useEffect } from "react";

export const SearchDropdown = ({ 
  value, 
  onChange, 
  options, 
  placeholder = "Type to search…", 
  label = "Search",
  icon,
  getOptionLabel = (option) => option.label || option.name || option,
  getOptionValue = (option) => option.value || option.id || option,
  filterOptions = (options, search) => {
    if (!search.trim()) return options.slice(0, 20);
    return options.filter(option => 
      getOptionLabel(option).toLowerCase().includes(search.toLowerCase())
    ).slice(0, 20);
  },
  onAddNew,
  addNewText = "Add"
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [inputValue, setInputValue] = useState("");
  const [selectedOption, setSelectedOption] = useState(null);
  const containerRef = useRef(null);
  const inputRef = useRef(null);

  // Initialize input value from props
  useEffect(() => {
    if (value && !inputValue) {
      // Find the option that matches the current value
      const option = options.find(opt => getOptionValue(opt) === value);
      if (option) {
        setSelectedOption(option);
        setInputValue(getOptionLabel(option));
      } else {
        // If no matching option found, treat as free text
        setInputValue(value);
        setSelectedOption(null);
      }
    } else if (!value && inputValue) {
      // Clear everything when value is cleared
      setInputValue("");
      setSelectedOption(null);
    }
  }, [value, options, getOptionLabel, getOptionValue]);

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (containerRef.current && !containerRef.current.contains(event.target)) {
        setIsOpen(false);
        // If we have a selected option, restore its label
        if (selectedOption) {
          setInputValue(getOptionLabel(selectedOption));
        }
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [selectedOption, getOptionLabel]);

  // Filter options based on current input
  const filteredOptions = filterOptions(options, inputValue);
  
  // Check if current input exactly matches an existing option
  const hasExactMatch = options.some(option => 
    getOptionLabel(option).toLowerCase() === inputValue.toLowerCase()
  );
  
  // Show "Add +" option if we have onAddNew, user is typing, and no exact match
  const showAddOption = onAddNew && inputValue.trim() && !hasExactMatch;

  // Handle input changes
  const handleInputChange = (e) => {
    const newValue = e.target.value;
    setInputValue(newValue);
    setSelectedOption(null); // Clear selection when typing
    setIsOpen(true);
    
    // Pass the raw input value to parent
    onChange(newValue);
  };

  // Handle option selection
  const handleSelectOption = (option) => {
    const optionValue = getOptionValue(option);
    const optionLabel = getOptionLabel(option);
    
    setSelectedOption(option);
    setInputValue(optionLabel);
    setIsOpen(false);
    
    // Pass the option value to parent
    onChange(optionValue);
  };

  // Handle adding new option
  const handleAddNew = async () => {
    if (!onAddNew || !inputValue.trim()) return;
    
    try {
      const result = await onAddNew(inputValue.trim());
      if (result) {
        // If onAddNew returns a value, use it; otherwise use the input
        const newValue = typeof result === 'string' ? result : inputValue.trim();
        setInputValue(newValue);
        setSelectedOption(null);
        setIsOpen(false);
        onChange(newValue);
      }
    } catch (error) {
      console.error('Error adding new option:', error);
    }
  };

  // Handle clear
  const handleClear = () => {
    setInputValue("");
    setSelectedOption(null);
    setIsOpen(false);
    onChange("");
  };

  // Handle input focus
  const handleFocus = () => {
    setIsOpen(true);
  };

  // Handle keyboard navigation
  const handleKeyDown = (e) => {
    if (e.key === 'Escape') {
      setIsOpen(false);
      if (selectedOption) {
        setInputValue(getOptionLabel(selectedOption));
      }
    } else if (e.key === 'Enter' && showAddOption) {
      e.preventDefault();
      handleAddNew();
    }
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
            ref={inputRef}
            value={inputValue}
            onChange={handleInputChange}
            onFocus={handleFocus}
            onKeyDown={handleKeyDown}
            placeholder={placeholder}
            className={`w-full min-w-0 appearance-none bg-slate-900/60 border border-slate-800 rounded-xl py-3 pr-10 text-slate-100 placeholder-slate-400 outline-none focus:border-indigo-500 ${icon ? 'pl-10' : 'px-4'}`}
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
          <div className="absolute left-0 right-0 z-[99999] mt-2 max-h-64 overflow-y-auto overscroll-contain rounded-xl border border-slate-800 bg-slate-900 shadow-xl">
            {/* Add new option */}
            {showAddOption && (
              <button
                type="button"
                onClick={handleAddNew}
                className="w-full text-left px-3 py-2 text-indigo-300 hover:bg-slate-800/70 border-b border-slate-800"
              >
                + {addNewText} "{inputValue.trim()}"
              </button>
            )}
            
            {/* Existing options */}
            {filteredOptions.length === 0 && !showAddOption && (
              <div className="px-3 py-2 text-slate-400 text-sm">No matches.</div>
            )}
            {filteredOptions.map((option) => (
              <button
                type="button"
                key={getOptionValue(option)}
                onClick={() => handleSelectOption(option)}
                className="w-full text-left px-3 py-2 text-slate-100 hover:bg-slate-800/70"
              >
                {getOptionLabel(option)}
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};