// Shared UI token constants used across the app
import { useState, useRef, useEffect } from "react";

export const card = "rounded-2xl border border-slate-800 bg-slate-900/60 backdrop-blur p-4 sm:p-6 shadow-[0_10px_30px_rgba(0,0,0,.35)] overflow-hidden";

export const inputBase = "w-full min-w-0 appearance-none bg-slate-900/60 border border-slate-800 rounded-xl px-4 py-3 text-slate-100 placeholder-slate-400 outline-none focus:ring-2 focus:ring-indigo-500";

export const inputSm = "h-10 text-sm w-full min-w-0 bg-slate-900/60 border border-slate-800 rounded-xl px-3 py-2 text-slate-100 placeholder-slate-400 focus:ring-2 focus:ring-indigo-500";

export const rowCard = "rounded-xl border border-slate-800 bg-slate-900/60 p-3 overflow-hidden";

export const pageCard = "rounded-2xl border border-slate-800 bg-slate-900/60 backdrop-blur p-4 sm:p-6 shadow-[0_10px_30px_rgba(0,0,0,.35)]";

export const pill = "inline-flex items-center gap-1 px-2.5 h-7 rounded-full text-xs font-medium";

export const dateFix = "w-full max-w-full min-w-0 box-border [field-sizing:content]";

export const disabledInput = "opacity-40 cursor-not-allowed disabled:pointer-events-none bg-slate-900/30 border-slate-800/50 text-slate-400 placeholder-slate-500";

// Tab styles
export const tabBase = "inline-flex items-center justify-center h-10 px-4 rounded-xl border transition";
export const tabIdle = "border-slate-800 bg-slate-900/60 text-slate-200 hover:bg-slate-900";
export const tabActive = "border-indigo-600 bg-indigo-600 text-white shadow-[0_8px_24px_rgba(79,70,229,.35)] hover:bg-indigo-600";

// Button styles
export const headerIconBtn = "h-9 w-9 inline-flex items-center justify-center rounded-xl border border-slate-800 bg-slate-900/60 hover:bg-slate-900 text-slate-100";
export const headerGhostBtn = "h-9 px-4 rounded-xl border border-slate-800 bg-slate-900/60 hover:bg-slate-900 text-slate-100";
export const iconSave = "inline-flex items-center justify-center h-9 w-9 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-100 border border-slate-800 focus:outline-none focus:ring-2 focus:ring-indigo-500";
export const iconSaveBusy = "inline-flex items-center justify-center h-9 w-9 rounded-lg bg-slate-700 text-slate-300 cursor-not-allowed border border-slate-800";
export const iconDelete = "inline-flex items-center justify-center h-9 w-9 rounded-lg bg-rose-600 hover:bg-rose-500 text-white border border-rose-700 focus:outline-none focus:ring-2 focus:ring-rose-500";

// Reusable Select component
export const Select = ({ value, onChange, options, placeholder = "Select…", className = "" }) => {
  const [open, setOpen] = useState(false);
  const rootRef = useRef(null);

  useEffect(() => {
    function onDoc(e) {
      if (!rootRef.current?.contains(e.target)) setOpen(false);
    }
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, []);

  const current = options.find((o) => o.value === value);

  return (
    <div ref={rootRef} className={`relative w-full ${className}`}>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className={`${inputBase} flex items-center justify-between`}
      >
        <span className={current ? "" : "text-slate-400"}>
          {current ? current.label : placeholder}
        </span>
        <svg className="w-4 h-4 opacity-70" viewBox="0 0 20 20" fill="currentColor">
          <path d="M5.23 7.21a.75.75 0 011.06.02L10 10.94l3.71-3.71a.75.75 0 111.06 1.06l-4.24 4.24a.75.75 0 01-1.06 0L5.21 8.29a.75.75 0 01.02-1.08z" />
        </svg>
      </button>

      {open && (
        <div className="absolute left-0 right-0 mt-2 z-50 rounded-xl border border-slate-800 bg-slate-900/95 backdrop-blur shadow-xl">
          <ul className="max-h-64 overflow-auto py-1">
            {options.map((opt) => (
              <li key={opt.value}>
                <button
                  type="button"
                  onClick={() => { onChange(opt.value); setOpen(false); }}
                  className={`w-full text-left px-3 py-2 hover:bg-slate-800 ${
                    opt.value === value ? "text-white" : "text-slate-200"
                  }`}
                >
                  {opt.label}
                </button>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
};
