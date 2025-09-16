import { useState } from "react";
import { createClient } from "@supabase/supabase-js";
import ProductSearchDropdown from "./ProductSearchDropdown.jsx";
import { moneyToCents, centsToStr } from "../utils/money.js";
import { rowCard } from "../utils/ui.js";

const supabase = createClient(
  import.meta.env.VITE_SUPABASE_URL,
  import.meta.env.VITE_SUPABASE_ANON_KEY
);

// Simple row component for retailers and marketplaces (name only) - matches product styling exactly
export function SimpleItemRow({ item, isSelected, onToggleSelection, onSave, disabled = false, isCheckboxDisabled = false }) {
  const [name, setName] = useState(item?.name ?? "");
  const [status, setStatus] = useState("");
  const [busy, setBusy] = useState(false);

  async function updateItem() {
    if (busy || disabled) return;
    setBusy(true);
    setStatus("Saving…");
    try {
      const { error } = await supabase
        .from(item.id < 0 ? 'retailers' : (item.type === 'retailer' ? 'retailers' : 'marketplaces'))
        .update({ name: name.trim() })
        .eq('id', item.id);
      
      if (error) throw error;
      setStatus("Saved ✓");
      setTimeout(() => setStatus(""), 1500);
      onSave();
    } catch (e) {
      setStatus(String(e.message || e));
      setTimeout(() => setStatus(""), 2000);
    } finally {
      setBusy(false);
    }
  }

  async function deleteItem() {
    if (busy || disabled) return;
    if (!confirm(`Delete "${name}"? This action cannot be undone.`)) return;
    try {
      const { error } = await supabase
        .from(item.id < 0 ? 'retailers' : (item.type === 'retailer' ? 'retailers' : 'marketplaces'))
        .delete()
        .eq('id', item.id);
      
      if (error) throw error;
      onSave();
    } catch (e) {
      alert(`Failed to delete: ${e.message}`);
    }
  }

  return (
    <div 
      className={`rounded-xl border bg-slate-900/60 p-3 overflow-visible transition cursor-pointer ${
        isSelected
          ? 'border-indigo-500 bg-indigo-500/10' 
          : 'border-slate-800 hover:bg-slate-800/50'
      }`}
      onClick={onToggleSelection}
    >
      {/* Desktop: Grid layout with checkbox - matches product layout exactly but without market value */}
      <div className="hidden sm:grid grid-cols-[auto_2fr_1fr_auto] gap-4 items-center min-w-0">
        <div className="flex items-center gap-2">
          <input
            type="checkbox"
            checked={isSelected}
            disabled={isCheckboxDisabled}
            onChange={(e) => {
              e.stopPropagation();
              onToggleSelection();
            }}
            className={`h-4 w-4 rounded border-slate-500 bg-slate-800 text-indigo-500 focus:ring-indigo-400 focus:ring-2 transition-all accent-indigo-500 ${
              isCheckboxDisabled ? 'opacity-50 cursor-not-allowed' : ''
            }`}
          />
        </div>
        
        <div onClick={(e) => e.stopPropagation()}>
          <input
            className="bg-slate-800/30 border border-slate-600/50 rounded-lg px-2 py-2 text-sm text-slate-100 focus:border-indigo-500 focus:outline-none w-full"
            value={name}
            onChange={(e) => setName(e.target.value)}
            onClick={(e) => e.stopPropagation()}
            placeholder="Name"
          />
        </div>
        
        <div className="flex items-center gap-2">
          {status && (
            <span className={`text-xs ${status.startsWith('Error') ? 'text-red-400' : 'text-green-400'}`}>
              {status}
            </span>
          )}
        </div>
        
        <div className="flex items-center gap-2">
          <button
            onClick={(e) => {
              e.stopPropagation();
              updateItem();
            }}
            disabled={busy}
            className="w-8 h-8 rounded-lg border border-slate-600 bg-slate-800/60 hover:bg-slate-700 hover:border-slate-500 text-slate-200 transition-all duration-200 flex items-center justify-center group disabled:opacity-50 disabled:cursor-not-allowed"
            title="Save Changes"
          >
            <svg className="w-3 h-3 transition-transform group-hover:scale-110" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7H5a2 2 0 00-2 2v9a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-3m-1 4l-3 3m0 0l-3-3m3 3V4" />
            </svg>
          </button>
          <button
            onClick={(e) => {
              e.stopPropagation();
              deleteItem();
            }}
            className="w-8 h-8 rounded-lg border border-slate-600 bg-slate-800/60 hover:bg-slate-700 hover:border-slate-500 text-slate-200 transition-all duration-200 flex items-center justify-center group"
            title="Delete Item"
          >
            <svg className="w-3 h-3 transition-transform group-hover:scale-110" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
            </svg>
          </button>
        </div>
      </div>

      {/* Mobile: Stacked layout with labels */}
      <div className="sm:hidden space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <input
              type="checkbox"
              checked={isSelected}
              disabled={isCheckboxDisabled}
              onChange={(e) => {
                e.stopPropagation();
                onToggleSelection();
              }}
              className={`h-4 w-4 rounded border-slate-500 bg-slate-800 text-indigo-500 focus:ring-indigo-400 focus:ring-2 transition-all accent-indigo-500 ${
                isCheckboxDisabled ? 'opacity-50 cursor-not-allowed' : ''
              }`}
            />
            <span className="text-sm text-slate-400">Name</span>
          </div>
          <div className="flex items-center gap-2">
            {status && (
              <span className={`text-xs ${status.startsWith('Error') ? 'text-red-400' : 'text-green-400'}`}>
                {status}
              </span>
            )}
            <button
              onClick={(e) => {
                e.stopPropagation();
                updateItem();
              }}
              disabled={busy}
              className="w-8 h-8 rounded-lg border border-slate-600 bg-slate-800/60 hover:bg-slate-700 hover:border-slate-500 text-slate-200 transition-all duration-200 flex items-center justify-center group disabled:opacity-50 disabled:cursor-not-allowed"
              title="Save Changes"
            >
              <svg className="w-3 h-3 transition-transform group-hover:scale-110" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7H5a2 2 0 00-2 2v9a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-3m-1 4l-3 3m0 0l-3-3m3 3V4" />
              </svg>
            </button>
            <button
              onClick={(e) => {
                e.stopPropagation();
                deleteItem();
              }}
              className="w-8 h-8 rounded-lg border border-slate-600 bg-slate-800/60 hover:bg-slate-700 hover:border-slate-500 text-slate-200 transition-all duration-200 flex items-center justify-center group"
              title="Delete Item"
            >
              <svg className="w-3 h-3 transition-transform group-hover:scale-110" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
              </svg>
            </button>
          </div>
        </div>
        <div onClick={(e) => e.stopPropagation()}>
          <input
            className="bg-slate-800/30 border border-slate-600/50 rounded-lg px-2 py-2 text-sm text-slate-100 focus:border-indigo-500 focus:outline-none w-full"
            value={name}
            onChange={(e) => setName(e.target.value)}
            onClick={(e) => e.stopPropagation()}
            placeholder="Name"
          />
        </div>
      </div>
    </div>
  );
}

export function CategoryItemRow({ item, isSelected, onToggleSelection, onSave, disabled = false, category, isCheckboxDisabled = false, gameType = null }) {
  const [name, setName] = useState(item?.name ?? "");
  const [mv, setMv] = useState(centsToStr(item?.market_value_cents ?? 0));
  const [upcCode, setUpcCode] = useState(item?.upc_code ?? "");
  const [consoleName, setConsoleName] = useState(item?.console_name ?? "");
  const [status, setStatus] = useState("");
  const [busy, setBusy] = useState(false);
  const [selectedProduct, setSelectedProduct] = useState(null);

  const handleProductSelect = (product) => {
    setSelectedProduct(product);
    
    // Create a display name that includes set information if available
    let displayName = product.product_name;
    if (product.console_name && product.console_name !== product.product_name) {
      displayName = `${product.product_name} - ${product.console_name}`;
    }
    setName(displayName);
    
    if (product.loose_price) {
      setMv(product.loose_price.toString());
    }
    if (product.upc_code) {
      setUpcCode(product.upc_code);
    }
    if (product.console_name) {
      setConsoleName(product.console_name);
    }
  };

  async function updateItem() {
    if (busy || disabled) return;
    setBusy(true);
    setStatus("Saving…");
    try {
      const market_value_cents = moneyToCents(mv);
      const updateData = { 
        name: name.trim(), 
        market_value_cents,
        upc_code: upcCode.trim() || null,
        console_name: consoleName.trim() || null
      };
      
      if (selectedProduct) {
        updateData.price_source = 'api';
        updateData.api_product_id = selectedProduct.product_id;
        updateData.api_price_cents = selectedProduct.loose_price ? Math.round(selectedProduct.loose_price * 100) : null;
        updateData.api_last_updated = new Date().toISOString();
      } else {
        updateData.price_source = 'manual';
      }
      
      const { error } = await supabase
        .from(category)
        .update(updateData)
        .eq("id", item.id);
      if (error) throw error;
      setStatus("Saved ✓");
      setTimeout(() => setStatus(""), 1500);
      onSave();
    } catch (e) {
      setStatus(String(e.message || e));
      setTimeout(() => setStatus(""), 2000);
    } finally {
      setBusy(false);
    }
  }

  async function deleteItem(id) {
    try {
      const { error } = await supabase.from(category).delete().eq("id", id);
      if (error) throw error;
      onSave();
    } catch (e) {
      alert(`Failed to delete: ${e.message}`);
    }
  }

  return (
    <div 
      className={`rounded-xl border bg-slate-900/60 p-3 overflow-visible transition cursor-pointer ${
        isSelected
          ? 'border-indigo-500 bg-indigo-500/10' 
          : 'border-slate-800 hover:bg-slate-800/50'
      }`}
      onClick={onToggleSelection}
    >
      {/* Desktop: Grid layout with checkbox */}
      <div className="hidden sm:grid grid-cols-[auto_2fr_1fr_auto] gap-4 items-center min-w-0">
        <div className="flex items-center gap-2">
        <input
          type="checkbox"
          checked={isSelected}
          disabled={isCheckboxDisabled}
          onChange={(e) => {
            e.stopPropagation();
            onToggleSelection();
          }}
          className={`h-4 w-4 rounded border-slate-500 bg-slate-800 text-indigo-500 focus:ring-indigo-400 focus:ring-2 transition-all accent-indigo-500 ${
            isCheckboxDisabled ? 'opacity-50 cursor-not-allowed' : ''
          }`}
        />
          {/* Pricing source indicator */}
          <div 
            className={`w-2 h-2 rounded-full flex-shrink-0 ${
              item?.price_source === 'api' || item?.api_product_id 
                ? 'bg-blue-400' 
                : item?.price_source === 'manual' || item?.manual_override
                  ? 'bg-slate-400'
                  : 'bg-slate-500'
            }`}
            title={
              item?.price_source === 'api' || item?.api_product_id 
                ? 'API Connected - Automatic Pricing' 
                : item?.price_source === 'manual' || item?.manual_override
                  ? 'Manual Entry - User Set Pricing'
                  : 'Unknown Pricing Source'
            }
          />
        </div>
        
        <div onClick={(e) => e.stopPropagation()}>
          <ProductSearchDropdown
            value={name}
            onChange={setName}
            onProductSelect={handleProductSelect}
            placeholder="Search products..."
            className="w-full"
          />
        </div>
        
        <input
          className="bg-slate-800/30 border border-slate-600/50 rounded-lg px-2 py-2 text-sm text-slate-100 focus:border-indigo-500 focus:outline-none w-full"
          value={mv}
          onChange={(e) => {
            e.stopPropagation();
            setMv(e.target.value);
          }}
          onClick={(e) => e.stopPropagation()}
          placeholder="Market value ($)"
        />
        
        <div className="flex items-center gap-2">
          <button
            onClick={(e) => {
              e.stopPropagation();
              updateItem();
            }}
            disabled={busy}
            className="w-8 h-8 rounded-lg border border-slate-600 bg-slate-800/60 hover:bg-slate-700 hover:border-slate-500 text-slate-200 transition-all duration-200 flex items-center justify-center group disabled:opacity-50 disabled:cursor-not-allowed"
            title="Save Changes"
          >
            <svg className="w-3 h-3 transition-transform group-hover:scale-110" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7H5a2 2 0 00-2 2v9a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-3m-1 4l-3 3m0 0l-3-3m3 3V4" />
            </svg>
          </button>
          <button
            onClick={(e) => {
              e.stopPropagation();
              if (confirm(`Delete "${name}"? This action cannot be undone.`)) {
                deleteItem(item.id);
              }
            }}
            className="w-8 h-8 rounded-lg border border-slate-600 bg-slate-800/60 hover:bg-slate-700 hover:border-slate-500 text-slate-200 transition-all duration-200 flex items-center justify-center group"
            title="Delete Item"
          >
            <svg className="w-3 h-3 transition-transform group-hover:scale-110" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
            </svg>
          </button>
        </div>
      </div>

      {/* Mobile: Stacked layout with labels - NO checkbox */}
      <div className="sm:hidden space-y-3">
        <div>
          <div className="flex items-center justify-between mb-1">
            <label className="block text-xs text-slate-400">Item Name</label>
          </div>
          <div onClick={(e) => e.stopPropagation()}>
            <ProductSearchDropdown
              value={name}
              onChange={setName}
              onProductSelect={handleProductSelect}
              placeholder="Search products..."
              className="w-full"
            />
          </div>
        </div>
        
        <div>
          <label className="block text-xs text-slate-400 mb-1">Market Value</label>
          <div className="flex items-center gap-2">
            <input
              className="flex-1 h-10 appearance-none bg-slate-900/60 border border-slate-800 rounded-xl px-3 py-2 text-sm text-slate-100 placeholder-slate-400 outline-none focus:border-indigo-500"
              value={mv}
              onChange={(e) => {
                e.stopPropagation();
                setMv(e.target.value);
              }}
              onClick={(e) => e.stopPropagation()}
              placeholder="Market value ($)"
            />
            
            <div className="flex gap-1">
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  updateItem();
                }}
                disabled={busy}
                className="w-8 h-8 rounded-lg border border-slate-600 bg-slate-800/60 hover:bg-slate-700 hover:border-slate-500 text-slate-200 transition-all duration-200 flex items-center justify-center group disabled:opacity-50 disabled:cursor-not-allowed"
                title="Save Changes"
              >
                <svg className="w-3 h-3 transition-transform group-hover:scale-110" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7H5a2 2 0 00-2 2v9a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-3m-1 4l-3 3m0 0l-3-3m3 3V4" />
                </svg>
              </button>
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  if (confirm(`Delete "${name}"? This action cannot be undone.`)) {
                    deleteItem(item.id);
                  }
                }}
                className="w-8 h-8 rounded-lg border border-slate-600 bg-slate-800/60 hover:bg-slate-700 hover:border-slate-500 text-slate-200 transition-all duration-200 flex items-center justify-center group"
                title="Delete Item"
              >
                <svg className="w-3 h-3 transition-transform group-hover:scale-110" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                </svg>
              </button>
            </div>
          </div>
        </div>
        
      </div>
      
      {/* Mobile-only ghost text for row selection */}
      <div className="sm:hidden text-xs text-slate-500 text-center mt-2 cursor-pointer select-none">
        {isSelected ? "Selected" : "Click to select row"}
      </div>
      
      {status && (
        <div
          className={`text-right text-sm mt-1 ${
            status && status.startsWith("Saved")
              ? "text-emerald-400"
              : "text-rose-400"
          }`}
        >
          {status}
        </div>
      )}
    </div>
  );
}

// Simple new row component for retailers and marketplaces (name only) - matches product styling exactly
export function NewSimpleRowComponent({ row, isSelected, onToggleSelection, onSave, onCancel }) {
  const [name, setName] = useState("");
  const [status, setStatus] = useState("");
  const [busy, setBusy] = useState(false);

  const handleSave = async () => {
    if (busy) return;
    if (!name.trim()) {
      setStatus("Name is required");
      return;
    }
    
    setBusy(true);
    setStatus("Saving…");
    try {
      const tableName = row.type === 'retailer' ? 'retailers' : 'marketplaces';
      const { error } = await supabase
        .from(tableName)
        .insert({ name: name.trim() });
      
      if (error) throw error;
      setStatus("Saved ✓");
      setTimeout(() => setStatus(""), 1500);
      onSave({ name: name.trim() });
    } catch (e) {
      setStatus(String(e.message || e));
      setTimeout(() => setStatus(""), 2000);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div 
      className={`rounded-xl border p-3 overflow-visible transition cursor-pointer ${
        isSelected 
          ? 'border-indigo-500 bg-indigo-500/10' 
          : 'border-slate-800 bg-slate-900/60 hover:bg-slate-800/50'
      }`}
    >
      {/* Desktop: Grid layout without checkbox - full width input */}
      <div className="hidden sm:grid grid-cols-[1fr_auto] gap-4 items-center min-w-0">
        <div onClick={(e) => e.stopPropagation()}>
          <input
            className="bg-slate-800/30 border border-slate-600/50 rounded-lg px-2 py-2 text-sm text-slate-100 focus:border-indigo-500 focus:outline-none w-full"
            value={name}
            onChange={(e) => setName(e.target.value)}
            onClick={(e) => e.stopPropagation()}
            placeholder="Name"
          />
        </div>
        
        <div className="flex items-center gap-2">
          {status && (
            <span className={`text-xs ${status.startsWith('Error') ? 'text-red-400' : 'text-green-400'}`}>
              {status}
            </span>
          )}
          <button
            onClick={(e) => {
              e.stopPropagation();
              handleSave();
            }}
            disabled={busy}
            className="w-8 h-8 rounded-lg border border-slate-600 bg-slate-800/60 hover:bg-slate-700 hover:border-slate-500 text-slate-200 transition-all duration-200 flex items-center justify-center group disabled:opacity-50 disabled:cursor-not-allowed"
            title="Save Changes"
          >
            <svg className="w-3 h-3 transition-transform group-hover:scale-110" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7H5a2 2 0 00-2 2v9a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-3m-1 4l-3 3m0 0l-3-3m3 3V4" />
            </svg>
          </button>
          <button
            onClick={(e) => {
              e.stopPropagation();
              onCancel();
            }}
            disabled={busy}
            className="w-8 h-8 rounded-lg border border-slate-600 bg-slate-800/60 hover:bg-slate-700 hover:border-slate-500 text-slate-200 transition-all duration-200 flex items-center justify-center group"
            title="Cancel"
          >
            <svg className="w-3 h-3 transition-transform group-hover:scale-110" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
      </div>

      {/* Mobile: Stacked layout without checkbox - full width input */}
      <div className="sm:hidden space-y-3">
        <div className="flex items-center justify-between">
          <span className="text-sm text-slate-400">Name</span>
          <div className="flex items-center gap-2">
            {status && (
              <span className={`text-xs ${status.startsWith('Error') ? 'text-red-400' : 'text-green-400'}`}>
                {status}
              </span>
            )}
            <button
              onClick={(e) => {
                e.stopPropagation();
                handleSave();
              }}
              disabled={busy}
              className="w-8 h-8 rounded-lg border border-slate-600 bg-slate-800/60 hover:bg-slate-700 hover:border-slate-500 text-slate-200 transition-all duration-200 flex items-center justify-center group disabled:opacity-50 disabled:cursor-not-allowed"
              title="Save Changes"
            >
              <svg className="w-3 h-3 transition-transform group-hover:scale-110" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7H5a2 2 0 00-2 2v9a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-3m-1 4l-3 3m0 0l-3-3m3 3V4" />
              </svg>
            </button>
            <button
              onClick={(e) => {
                e.stopPropagation();
                onCancel();
              }}
              disabled={busy}
              className="w-8 h-8 rounded-lg border border-slate-600 bg-slate-800/60 hover:bg-slate-700 hover:border-slate-500 text-slate-200 transition-all duration-200 flex items-center justify-center group"
              title="Cancel"
            >
              <svg className="w-3 h-3 transition-transform group-hover:scale-110" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
        </div>
        <div onClick={(e) => e.stopPropagation()}>
          <input
            className="bg-slate-800/30 border border-slate-600/50 rounded-lg px-2 py-2 text-sm text-slate-100 focus:border-indigo-500 focus:outline-none w-full"
            value={name}
            onChange={(e) => setName(e.target.value)}
            onClick={(e) => e.stopPropagation()}
            placeholder="Name"
          />
        </div>
      </div>
    </div>
  );
}

export function NewCategoryRowComponent({ row, isSelected, onToggleSelection, onSave, onCancel }) {
  const [name, setName] = useState("");
  const [details, setDetails] = useState("");
  const [status, setStatus] = useState("");
  const [busy, setBusy] = useState(false);
  const [selectedProduct, setSelectedProduct] = useState(null);

  const handleProductSelect = (product) => {
    setSelectedProduct(product);
    
    // Create a display name that includes set information if available
    let displayName = product.product_name;
    if (product.console_name && product.console_name !== product.product_name) {
      displayName = `${product.product_name} - ${product.console_name}`;
    }
    setName(displayName);
    
    if (product.loose_price) {
      setDetails(product.loose_price.toString());
    }
  };

  const handleSave = async () => {
    if (busy) return;
    setBusy(true);
    setStatus("Saving…");
    
    try {
      const market_value_cents = moneyToCents(details);
      const itemData = { 
        name: name.trim(), 
        market_value_cents,
        price_source: selectedProduct ? 'api' : 'manual'
      };
      
      if (selectedProduct) {
        itemData.api_product_id = selectedProduct.product_id;
        itemData.api_price_cents = selectedProduct.loose_price ? Math.round(selectedProduct.loose_price * 100) : null;
        itemData.api_last_updated = new Date().toISOString();
        itemData.upc_code = selectedProduct.upc_code || null;
        itemData.console_name = selectedProduct.console_name || null;
      }
      
      // Add game_type for TCG tables only
      if (row.type === 'tcg_sealed' || row.type === 'tcg_singles') {
        // For now, default to 'pokemon' - this could be enhanced with a game type selector
        itemData.game_type = 'pokemon';
      }
      
      const { error } = await supabase
        .from(getTableName(row.type))
        .insert(itemData);
      if (error) throw error;
      
      setStatus("Saved ✓");
      setTimeout(() => {
        onSave({ name, details });
      }, 500);
    } catch (e) {
      setStatus(String(e.message || e));
      setTimeout(() => setStatus(""), 2000);
    } finally {
      setBusy(false);
    }
  };

  const getTableName = (type) => {
    switch (type) {
      case 'item': return 'items';
      case 'tcg_sealed': return 'tcg_sealed';
      case 'tcg_singles': return 'tcg_singles';
      case 'video_game': return 'video_games';
      case 'pokemon_card': return 'pokemon_cards';
      case 'magic_card': return 'magic_cards';
      case 'yugioh_card': return 'yugioh_cards';
      default: return 'items';
    }
  };

  return (
    <div 
      className={`rounded-xl border bg-slate-900/60 p-3 overflow-visible transition cursor-pointer ${
        isSelected
          ? 'border-indigo-500 bg-indigo-500/10' 
          : 'border-slate-800 hover:bg-slate-800/50'
      }`}
      onClick={onToggleSelection}
    >
      {/* Desktop: Grid layout */}
      <div className="hidden sm:grid gap-4 items-center min-w-0 grid-cols-[2fr_1fr_auto]">
        <div onClick={(e) => e.stopPropagation()}>
          <ProductSearchDropdown
            value={name}
            onChange={setName}
            onProductSelect={handleProductSelect}
            placeholder="Search products..."
            className="w-full"
          />
        </div>
        
        <input
          className="bg-slate-800/30 border border-slate-600/50 rounded-lg px-2 py-2 text-sm text-slate-100 focus:border-indigo-500 focus:outline-none w-full"
          value={details}
          onChange={(e) => {
            e.stopPropagation();
            setDetails(e.target.value);
          }}
          onClick={(e) => e.stopPropagation()}
          placeholder="Market value ($)"
        />
        
        <div className="flex items-center gap-2">
          <button
            onClick={(e) => {
              e.stopPropagation();
              handleSave();
            }}
            disabled={busy}
            className="w-8 h-8 rounded-lg border border-slate-600 bg-slate-800/60 hover:bg-slate-700 hover:border-slate-500 text-slate-200 transition-all duration-200 flex items-center justify-center group disabled:opacity-50 disabled:cursor-not-allowed"
            title="Save New Item"
          >
            <svg className="w-3 h-3 transition-transform group-hover:scale-110" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
            </svg>
          </button>
          <button
            onClick={(e) => {
              e.stopPropagation();
              onCancel();
            }}
            className="w-8 h-8 rounded-lg border border-slate-600 bg-slate-800/60 hover:bg-slate-700 hover:border-slate-500 text-slate-200 transition-all duration-200 flex items-center justify-center group"
            title="Cancel New Row"
          >
            <svg className="w-3 h-3 transition-transform group-hover:scale-110" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
      </div>

      {/* Mobile: Stacked layout with labels - NO checkbox */}
      <div className="sm:hidden space-y-3">
        <div>
          <div className="flex items-center justify-between mb-1">
            <label className="block text-xs text-slate-400">Item Name</label>
          </div>
          <div onClick={(e) => e.stopPropagation()}>
            <ProductSearchDropdown
              value={name}
              onChange={setName}
              onProductSelect={handleProductSelect}
              placeholder="Search products..."
              className="w-full"
            />
          </div>
        </div>
        
        <div>
          <label className="block text-xs text-slate-400 mb-1">Market Value</label>
          <div className="flex items-center gap-2">
            <input
              className="flex-1 h-10 appearance-none bg-slate-900/60 border border-slate-800 rounded-xl px-3 py-2 text-sm text-slate-100 placeholder-slate-400 outline-none focus:border-indigo-500"
              value={details}
              onChange={(e) => {
                e.stopPropagation();
                setDetails(e.target.value);
              }}
              onClick={(e) => e.stopPropagation()}
              placeholder="Market value ($)"
            />
            
            <div className="flex gap-1">
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  handleSave();
                }}
                disabled={busy}
                className="w-8 h-8 rounded-lg border border-slate-600 bg-slate-800/60 hover:bg-slate-700 hover:border-slate-500 text-slate-200 transition-all duration-200 flex items-center justify-center group disabled:opacity-50 disabled:cursor-not-allowed"
                title="Save New Item"
              >
                <svg className="w-3 h-3 transition-transform group-hover:scale-110" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
              </button>
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  onCancel();
                }}
                className="w-8 h-8 rounded-lg border border-slate-600 bg-slate-800/60 hover:bg-slate-700 hover:border-slate-500 text-slate-200 transition-all duration-200 flex items-center justify-center group"
                title="Cancel New Row"
              >
                <svg className="w-3 h-3 transition-transform group-hover:scale-110" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
          </div>
        </div>
      </div>
      
      {/* Mobile-only ghost text for row selection */}
      <div className="sm:hidden text-xs text-slate-500 text-center mt-2 cursor-pointer select-none">
        {isSelected ? "Selected" : "Click to select row"}
      </div>
      
      {status && (
        <div
          className={`text-right text-sm mt-1 ${
            status && status.startsWith("Saved")
              ? "text-emerald-400"
              : "text-rose-400"
          }`}
        >
          {status}
        </div>
      )}
    </div>
  );
}
