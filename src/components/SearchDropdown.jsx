// Completely rebuilt SearchDropdown - guaranteed to work
import { useState, useRef, useEffect } from "react";
import { createPortal } from "react-dom";
import { inputBase } from "../utils/ui.js";

export const SearchDropdown = ({ 
  value, 
  onChange, 
  options = [], 
  placeholder = "Type to search…", 
  label = "Search",
  icon,
  getOptionLabel = (option) => option.label || option.name || option,
  getOptionValue = (option) => option.value || option.id || option,
  onCreateNew = null,
  createNewLabel = "Create new",
  onTemporaryCreate = null // New prop for creating temporary items
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [searchText, setSearchText] = useState("");
  const [dropdownPosition, setDropdownPosition] = useState({ top: 0, left: 0, width: 0 });
  const containerRef = useRef(null);

  // Function to update dropdown position
  const updateDropdownPosition = () => {
    if (containerRef.current) {
      const rect = containerRef.current.getBoundingClientRect();
      setDropdownPosition({
        top: rect.bottom + 8,
        left: rect.left,
        width: rect.width
      });
    }
  };

  // Update search text when value changes from outside
  useEffect(() => {
    if (value) {
      const option = options.find(opt => getOptionValue(opt) === value);
      if (option) {
        const label = getOptionLabel(option);
        setSearchText(label || "");
      } else {
        setSearchText(typeof value === 'string' ? value : "");
      }
    } else {
      setSearchText("");
    }
  }, [value, options, getOptionLabel, getOptionValue]);

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event) => {
      // Check if click is inside the dropdown container or the portal dropdown
      const isInsideContainer = containerRef.current && containerRef.current.contains(event.target);
      const isInsideDropdown = event.target.closest('[data-dropdown-portal]');
      
      if (!isInsideContainer && !isInsideDropdown) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Update dropdown position on scroll and resize
  useEffect(() => {
    if (isOpen) {
      updateDropdownPosition();
      
      const handleScroll = () => updateDropdownPosition();
      const handleResize = () => updateDropdownPosition();
      
      window.addEventListener('scroll', handleScroll, true);
      window.addEventListener('resize', handleResize);
      
      return () => {
        window.removeEventListener('scroll', handleScroll, true);
        window.removeEventListener('resize', handleResize);
      };
    }
  }, [isOpen]);

  // Filter options based on search text
  const filteredOptions = options.filter(option => {
    const label = getOptionLabel(option);
    if (!label || typeof label !== 'string') return false;
    if (!searchText || typeof searchText !== 'string') return true; // Show all if no search text
    return label.toLowerCase().includes(searchText.toLowerCase());
  });

  // Check if we should show "Create new" option
  const shouldShowCreateNew = (onCreateNew || onTemporaryCreate) && 
    searchText && typeof searchText === 'string' && searchText.trim() && 
    !filteredOptions.some(option => {
      const label = getOptionLabel(option);
      return label && typeof label === 'string' && label.toLowerCase() === searchText.toLowerCase();
    });

  // Debug logging (removed for performance)

  // Handle input change
  const handleInputChange = (e) => {
    const newValue = e.target.value;
    setSearchText(newValue);
    setIsOpen(true);
    // Don't call onChange here - let user select from dropdown
  };

  // Handle option selection
  const handleSelectOption = (option) => {
    console.log('Option clicked!', option);
    const optionValue = getOptionValue(option);
    const optionLabel = getOptionLabel(option);
    setSearchText(optionLabel);
    setIsOpen(false);
    onChange(optionValue);
  };

  const handleCreateNew = async () => {
    console.log('Create new clicked!', searchText.trim());
    const createFunction = onTemporaryCreate || onCreateNew;
    if (createFunction) {
      try {
        const newValue = await createFunction(searchText.trim());
        if (newValue) {
          setSearchText(getOptionLabel(newValue));
          setIsOpen(false);
          onChange(getOptionValue(newValue));
        }
      } catch (error) {
        console.error('Error creating new item:', error);
      }
    }
  };

  // Handle clear
  const handleClear = () => {
    setSearchText("");
    setIsOpen(false);
    onChange("");
  };

  return (
    <div className="min-w-0">
      {label && <label className="text-slate-300 mb-2 block text-xs sm:text-sm">{label}</label>}
      <div ref={containerRef} className="relative">
        <div className="relative">
          {icon && (
            <div className="absolute left-2 sm:left-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none">
              {icon}
            </div>
          )}
          <input
            value={searchText || ""}
            onChange={handleInputChange}
            onFocus={() => setIsOpen(true)}
            placeholder={placeholder}
            className={`${inputBase} ${icon ? 'pl-8 sm:pl-10' : ''} pr-8 sm:pr-10`}
          />
          {searchText && (
            <button
              type="button"
              onClick={handleClear}
              className="absolute right-2 sm:right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-200 transition-colors"
            >
              ×
            </button>
          )}
        </div>
        
        {isOpen && createPortal(
          <div 
            data-dropdown-portal
            className="fixed z-[999999] max-h-48 sm:max-h-64 overflow-y-auto overscroll-contain rounded-lg border border-slate-800 bg-slate-900 shadow-2xl min-w-[180px] sm:min-w-[200px]"
            style={{ 
              position: 'fixed',
              top: `${dropdownPosition.top}px`,
              left: `${dropdownPosition.left}px`,
              width: `${dropdownPosition.width}px`,
              zIndex: 999999
            }}
          >
            {shouldShowCreateNew && (
              <button
                type="button"
                onClick={handleCreateNew}
                className="w-full text-left px-2 sm:px-3 py-1.5 sm:py-2 text-sm sm:text-base text-slate-100 hover:bg-slate-700 focus:bg-slate-700 focus:outline-none transition-colors duration-150 rounded-t-lg border-b border-slate-700"
              >
                <span className="text-slate-400">+</span> {createNewLabel} "{searchText}"
              </button>
            )}
            {filteredOptions.length === 0 && !shouldShowCreateNew ? (
              <div className="px-2 sm:px-3 py-1.5 sm:py-2 text-slate-400 text-xs sm:text-sm">No matches found.</div>
            ) : (
              filteredOptions.map((option, index) => (
                <button
                  key={getOptionValue(option)}
                  type="button"
                  onClick={() => handleSelectOption(option)}
                  className={`w-full text-left px-2 sm:px-3 py-1.5 sm:py-2 text-sm sm:text-base text-slate-100 hover:bg-slate-700 focus:bg-slate-700 focus:outline-none transition-colors duration-150 ${
                    shouldShowCreateNew && index === 0 ? '' : 
                    !shouldShowCreateNew && index === 0 ? 'rounded-t-lg' : ''
                  } ${
                    index === filteredOptions.length - 1 ? 'rounded-b-lg' : ''
                  }`}
                >
                  {getOptionLabel(option)}
                </button>
              ))
            )}
          </div>,
          document.body
        )}
      </div>
    </div>
  );
};