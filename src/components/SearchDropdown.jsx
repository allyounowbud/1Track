// Universal SearchDropdown component - simple and reliable
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
  }
}) => {
  const [search, setSearch] = useState("");
  const [selected, setSelected] = useState(null);
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
    onChange(e.target.value); // Pass the search value for live filtering
  };

  // Handle clear button
  const handleClear = () => {
    setSelected(null);
    setSearch("");
    onChange("");
    setDropdownOpen(false);
  };

  return (
    <div className="min-w-0">
      <label className="text-slate-300 mb-1 block text-sm">{label}</label>
      <div ref={boxRef} className="relative">
        <div className="relative">
          {icon && (
            <div className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none">
              {icon}
            </div>
          )}
          <input
            value={selected ? getOptionLabel(selected) : search}
            onChange={handleInputChange}
            onFocus={() => setDropdownOpen(true)}
            placeholder={placeholder}
            className={`w-full min-w-0 appearance-none bg-slate-900/60 border border-slate-800 rounded-xl py-3 pr-10 text-slate-100 placeholder-slate-400 outline-none focus:ring-2 focus:ring-indigo-500 ${icon ? 'pl-10' : 'px-4'}`}
          />
          {(search || selected) && (
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
          <div className="absolute left-0 right-0 z-[99999] mt-2 max-h-64 overflow-auto overscroll-contain rounded-xl border border-slate-800 bg-slate-900 shadow-xl">
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
          </div>
        )}
      </div>
    </div>
  );
};