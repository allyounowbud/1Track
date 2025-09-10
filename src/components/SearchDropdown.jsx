// Universal SearchDropdown component based on Mark as Sold implementation
import { useState, useRef, useEffect } from "react";
import { createPortal } from "react-dom";

export const SearchDropdown = ({ 
  value, 
  onChange, 
  options, 
  placeholder = "Type to search…", 
  label = "Search",
  getOptionLabel = (option) => option.label || option.name || option,
  getOptionValue = (option) => option.value || option.id || option,
  filterOptions = (options, search) => {
    if (!search.trim()) return options.slice(0, 20);
    return options.filter(option => 
      getOptionLabel(option).toLowerCase().includes(search.toLowerCase())
    ).slice(0, 20);
  }
}) => {
  const [search, setSearch] = useState("");
  const [selected, setSelected] = useState(null);
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const [dropdownPosition, setDropdownPosition] = useState({ top: 0, left: 0, width: 0 });
  const boxRef = useRef(null);

  // Calculate dropdown position
  const updateDropdownPosition = () => {
    if (boxRef.current) {
      const rect = boxRef.current.getBoundingClientRect();
      setDropdownPosition({
        top: rect.bottom + 8,
        left: rect.left,
        width: rect.width
      });
    }
  };

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

  // Update position when dropdown opens
  useEffect(() => {
    if (dropdownOpen) {
      updateDropdownPosition();
      const handleResize = () => updateDropdownPosition();
      const handleScroll = () => updateDropdownPosition();
      window.addEventListener('resize', handleResize);
      window.addEventListener('scroll', handleScroll);
      return () => {
        window.removeEventListener('resize', handleResize);
        window.removeEventListener('scroll', handleScroll);
      };
    }
  }, [dropdownOpen]);

  // Filter options based on search
  const filtered = filterOptions(options, search);

  // Handle selection
  const handleSelect = (option) => {
    setSelected(option);
    setSearch("");
    setDropdownOpen(false);
    onChange(getOptionValue(option));
  };

  // Handle input change
  const handleInputChange = (e) => {
    setSelected(null);
    setSearch(e.target.value);
    onChange(""); // Clear the value when typing
  };

  return (
    <div className="min-w-0">
      <label className="text-slate-300 mb-1 block text-sm">{label}</label>
      <div ref={boxRef} className="relative">
        <input
          value={selected ? getOptionLabel(selected) : search}
          onChange={handleInputChange}
          onFocus={() => setDropdownOpen(true)}
          placeholder={placeholder}
          className="w-full min-w-0 appearance-none bg-slate-900/60 border border-slate-800 rounded-xl px-4 py-3 text-slate-100 placeholder-slate-400 outline-none focus:ring-2 focus:ring-indigo-500"
        />
        {dropdownOpen && createPortal(
          <div 
            className="absolute z-[99999] max-h-64 overflow-auto overscroll-contain rounded-xl border border-slate-800 bg-slate-900/90 backdrop-blur shadow-xl"
            style={{
              top: dropdownPosition.top,
              left: dropdownPosition.left,
              width: dropdownPosition.width
            }}
          >
            {filtered.length === 0 && (
              <div className="px-3 py-2 text-slate-400 text-sm">No matches.</div>
            )}
            {filtered.map((option) => (
              <button
                type="button"
                key={getOptionValue(option)}
                onClick={() => handleSelect(option)}
                className="w-full text-left px-3 py-2 hover:bg-slate-800/70"
              >
                {getOptionLabel(option)}
              </button>
            ))}
          </div>,
          document.body
        )}
      </div>
    </div>
  );
};
