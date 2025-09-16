// src/routes/QuickAdd.jsx
import { useEffect, useMemo, useRef, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "../lib/supabaseClient";
import LayoutWithSidebar from "../components/LayoutWithSidebar.jsx";
import PageHeader from "../components/PageHeader.jsx";
import { moneyToCents, parsePct, formatNumber } from "../utils/money.js";
import { card, inputBase, dateFix, disabledInput } from "../utils/ui.js";
import { SearchDropdown } from "../components/SearchDropdown.jsx";
import ProductSearchDropdown from "../components/ProductSearchDropdown.jsx";
import { getProductMarketData, getMarketValueFormatted } from "../services/marketDataService.js";

/* ------------------------------ queries ----------------------------- */
async function getItems() {
  console.log("Fetching items from Supabase...");
  
  // Check if user is authenticated
  const { data: { user } } = await supabase.auth.getUser();
  console.log("Current user:", user?.id || "No user");
  
  // For testing without authentication, use mock data
  if (!user) {
    console.log("No user authenticated, using mock data for testing");
    return [
      { id: 1, name: "iPhone 15 Pro" },
      { id: 2, name: "Samsung Galaxy S24" },
      { id: 3, name: "MacBook Pro M3" },
      { id: 4, name: "AirPods Pro" },
      { id: 5, name: "iPad Air" }
    ];
  }
  
  const { data, error } = await supabase
    .from("items")
    .select("id, name, user_id")
    .order("name", { ascending: true });
  
  if (error) {
    console.error("Error fetching items:", error);
    console.log("Using mock data for items due to error:", error.message);
    // Mock data for testing dropdown functionality
    return [
      { id: 1, name: "iPhone 15 Pro" },
      { id: 2, name: "Samsung Galaxy S24" },
      { id: 3, name: "MacBook Pro M3" },
      { id: 4, name: "AirPods Pro" },
      { id: 5, name: "iPad Air" }
    ];
  }
  
  console.log("Items fetched:", data?.length || 0, "items");
  console.log("Sample items:", data?.slice(0, 3));
  return data || [];
}
async function getRetailers() {
  console.log("Fetching retailers from Supabase...");
  
  // Check if user is authenticated
  const { data: { user } } = await supabase.auth.getUser();
  
  // For testing without authentication, use mock data
  if (!user) {
    console.log("No user authenticated, using mock data for retailers");
    return [
      { id: 1, name: "Target" },
      { id: 2, name: "Best Buy" },
      { id: 3, name: "Amazon" },
      { id: 4, name: "Walmart" },
      { id: 5, name: "Costco" }
    ];
  }
  
  const { data, error } = await supabase
    .from("retailers")
    .select("id, name, user_id")
    .order("name", { ascending: true });
  
  if (error) {
    console.error("Error fetching retailers:", error);
    console.log("Using mock data for retailers due to error:", error.message);
    return [
      { id: 1, name: "Target" },
      { id: 2, name: "Best Buy" },
      { id: 3, name: "Amazon" },
      { id: 4, name: "Walmart" },
      { id: 5, name: "Costco" }
    ];
  }
  
  console.log("Retailers fetched:", data?.length || 0, "retailers");
  console.log("Sample retailers:", data?.slice(0, 3));
  return data || [];
}
async function getMarketplaces() {
  console.log("Fetching marketplaces from Supabase...");
  
  // Check if user is authenticated
  const { data: { user } } = await supabase.auth.getUser();
  
  // For testing without authentication, use mock data
  if (!user) {
    console.log("No user authenticated, using mock data for marketplaces");
    return [
      { id: 1, name: "eBay", default_fees_pct: 0.13 },
      { id: 2, name: "Facebook Marketplace", default_fees_pct: 0 },
      { id: 3, name: "Mercari", default_fees_pct: 0.10 },
      { id: 4, name: "Poshmark", default_fees_pct: 0.20 },
      { id: 5, name: "OfferUp", default_fees_pct: 0 }
    ];
  }
  
  const { data, error } = await supabase
    .from("marketplaces")
    .select("id, name, default_fees_pct, user_id")
    .order("name", { ascending: true });
  
  if (error) {
    console.error("Error fetching marketplaces:", error);
    console.log("Using mock data for marketplaces due to error:", error.message);
    return [
      { id: 1, name: "eBay", default_fees_pct: 0.13 },
      { id: 2, name: "Facebook Marketplace", default_fees_pct: 0 },
      { id: 3, name: "Mercari", default_fees_pct: 0.10 },
      { id: 4, name: "Poshmark", default_fees_pct: 0.20 },
      { id: 5, name: "OfferUp", default_fees_pct: 0 }
    ];
  }
  
  console.log("Marketplaces fetched:", data?.length || 0, "marketplaces");
  console.log("Sample marketplaces:", data?.slice(0, 3));
  return data || [];
}

/* ------------------------- Use SearchDropdown directly ------------------------- */

/* ------------------------- Smooth Collapse container ------------------------ */
function Collapse({ open, children, duration = 280 }) {
  const innerRef = useRef(null);
  const [height, setHeight] = useState(0);

  // measure content height
  useEffect(() => {
    const el = innerRef.current;
    if (!el) return;
    const measure = () => setHeight(el.scrollHeight);
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    return () => ro.disconnect();
  }, [children]);

  return (
    <div
      className="overflow-hidden will-change-[height,opacity,transform]"
      style={{
        height: open ? height : 0,
        opacity: open ? 1 : 0,
        transform: open ? "translateY(0px)" : "translateY(-4px)",
        transition: `height ${duration}ms ease, opacity ${duration}ms ease, transform ${duration}ms ease`,
        pointerEvents: open ? "auto" : "none",
      }}
      aria-hidden={!open}
    >
      <div ref={innerRef}>{children}</div>
    </div>
  );
}

/* --------------------------------- page --------------------------------- */
export default function QuickAdd() {
  const { data: items = [], refetch: refetchItems, error: itemsError } = useQuery({
    queryKey: ["items-combo"],
    queryFn: getItems,
  });
  const { data: retailers = [], refetch: refetchRetailers, error: retailersError } = useQuery({
    queryKey: ["retailers-combo"],
    queryFn: getRetailers,
  });
  const { data: markets = [], refetch: refetchMarkets, error: marketsError } = useQuery({
    queryKey: ["markets-combo"],
    queryFn: getMarketplaces,
  });

  // Debug: Log data loading
  useEffect(() => {
    console.log("QuickAdd data loaded:", {
      items: items.length,
      retailers: retailers.length,
      markets: markets.length,
      errors: {
        itemsError: itemsError?.message,
        retailersError: retailersError?.message,
        marketsError: marketsError?.message
      }
    });
    
    // Debug the actual data being passed to dropdowns
    console.log("Dropdown data:", {
      itemsSample: items.slice(0, 3),
      retailersSample: retailers.slice(0, 3),
      marketsSample: markets.slice(0, 3)
    });
  }, [items, retailers, markets, itemsError, retailersError, marketsError]);


  /* ------------------------------ form state ------------------------------ */
  const today = new Date().toISOString().slice(0, 10);

  // order fields
  const [orderDate, setOrderDate] = useState(today);
  const [itemName, setItemName] = useState("");
  const [profileName, setProfile] = useState("");
  const [retailerName, setRetailerName] = useState("");
  const [qtyStr, setQtyStr] = useState(""); // <-- string input for easy backspace/edit
  const [buyPrice, setBuyPrice] = useState("");


  // sale fields
  const [sold, setSold] = useState(false);
  const [saleDate, setSaleDate] = useState("");
  const [marketName, setMarketName] = useState("");
  const [salePrice, setSalePrice] = useState("");
  const [feesPct, setFeesPct] = useState("0");
  const [feesLocked, setFeesLocked] = useState(false);
  const [shipping, setShipping] = useState("0");

  // ui
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState("");
  
  // State for temporary items that haven't been saved to database yet
  const [temporaryItems, setTemporaryItems] = useState([]);
  const [temporaryRetailers, setTemporaryRetailers] = useState([]);
  const [temporaryMarkets, setTemporaryMarkets] = useState([]);

  // Market data state
  const [selectedProductMarketData, setSelectedProductMarketData] = useState(null);
  const [marketDataLoading, setMarketDataLoading] = useState(false);

  /* -------------------------- derived lists (names) ------------------------- */
  const itemNames = useMemo(() => {
    return items.map((i) => i.name).filter(Boolean);
  }, [items]);
  const retailerNames = useMemo(() => {
    return retailers.map((r) => r.name).filter(Boolean);
  }, [retailers]);
  const marketNames = useMemo(() => {
    return markets.map((m) => m.name).filter(Boolean);
  }, [markets]);

  // Combine database items with temporary items for dropdowns
  const allItems = useMemo(() => {
    return [...items, ...temporaryItems];
  }, [items, temporaryItems]);

  const allRetailers = useMemo(() => {
    return [...retailers, ...temporaryRetailers];
  }, [retailers, temporaryRetailers]);

  const allMarkets = useMemo(() => {
    return [...markets, ...temporaryMarkets];
  }, [markets, temporaryMarkets]);

  /* ------------------------------- temporary creators -------------------------------- */
  function createTemporaryItem(name) {
    const trimmed = name.trim();
    if (!trimmed) return null;
    
    // Check if item already exists (database or temporary)
    const exists = allItems.some(item => item.name.toLowerCase() === trimmed.toLowerCase());
    if (exists) {
      setMsg("Item already exists");
      return null;
    }
    
    const tempItem = { 
      id: `temp-${Date.now()}`, // Temporary ID
      name: trimmed,
      isTemporary: true 
    };
    
    setTemporaryItems(prev => [...prev, tempItem]);
    return tempItem;
  }

  function createTemporaryRetailer(name) {
    const trimmed = name.trim();
    if (!trimmed) return null;
    
    // Check if retailer already exists (database or temporary)
    const exists = allRetailers.some(retailer => retailer.name.toLowerCase() === trimmed.toLowerCase());
    if (exists) {
      setMsg("Retailer already exists");
      return null;
    }
    
    const tempRetailer = { 
      id: `temp-${Date.now()}`, // Temporary ID
      name: trimmed,
      isTemporary: true 
    };
    
    setTemporaryRetailers(prev => [...prev, tempRetailer]);
    return tempRetailer;
  }

  function createTemporaryMarket(name) {
    const trimmed = name.trim();
    if (!trimmed) return null;
    
    // Check if marketplace already exists (database or temporary)
    const exists = allMarkets.some(market => market.name.toLowerCase() === trimmed.toLowerCase());
    if (exists) {
      setMsg("Marketplace already exists");
      return null;
    }
    
    const tempMarket = { 
      id: `temp-${Date.now()}`, // Temporary ID
      name: trimmed,
      isTemporary: true 
    };
    
    setTemporaryMarkets(prev => [...prev, tempMarket]);
    return tempMarket;
  }

  /* ------------------------------- database savers -------------------------------- */
  async function saveTemporaryItemsToDatabase() {
    // Get current user
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      throw new Error("You must be logged in to save items");
    }

    const errors = [];

    // Save temporary items
    for (const tempItem of temporaryItems) {
      const { error } = await supabase
        .from("items")
        .insert([{ name: tempItem.name, user_id: user.id }]);
      
      if (error) {
        errors.push(`Error saving item "${tempItem.name}": ${error.message}`);
      }
    }

    // Save temporary retailers
    for (const tempRetailer of temporaryRetailers) {
      const { error } = await supabase
        .from("retailers")
        .insert([{ name: tempRetailer.name, user_id: user.id }]);
      
      if (error) {
        errors.push(`Error saving retailer "${tempRetailer.name}": ${error.message}`);
      }
    }

    // Save temporary markets
    for (const tempMarket of temporaryMarkets) {
      const { error } = await supabase
        .from("marketplaces")
        .insert([{ 
          name: tempMarket.name, 
          default_fees_pct: 0,
          user_id: user.id 
        }]);
      
      if (error) {
        errors.push(`Error saving marketplace "${tempMarket.name}": ${error.message}`);
      }
    }

    if (errors.length > 0) {
      throw new Error(errors.join('; '));
    }

    // Clear temporary items after successful save
    setTemporaryItems([]);
    setTemporaryRetailers([]);
    setTemporaryMarkets([]);

    // Refetch data to get the new items with proper IDs
    await Promise.all([refetchItems(), refetchRetailers(), refetchMarkets()]);
  }

  /* -------------------- marketplace -> autofill default fee ------------------- */
  useEffect(() => {
    if (!marketName) {
      setFeesLocked(false);
      return;
    }
    const m = markets.find((x) => x.name === marketName);
    if (m && typeof m.default_fees_pct === "number") {
      setFeesPct(String((m.default_fees_pct || 0) * 100));
      setFeesLocked(true);
    } else {
      setFeesLocked(false);
    }
  }, [marketName, markets]);

  // If user toggles off "sold", ensure fee field becomes unlocked/neutral
  useEffect(() => {
    if (!sold) setFeesLocked(false);
  }, [sold]);

  /* --------------------------------- save --------------------------------- */
  async function onSave(e) {
    e.preventDefault();
    setSaving(true);
    setMsg("");
    try {
      // First, save any temporary items to the database
      if (temporaryItems.length > 0 || temporaryRetailers.length > 0 || temporaryMarkets.length > 0) {
        await saveTemporaryItemsToDatabase();
      }

      // sanitize qty (allow empty -> default 1)
      const qty = Math.max(1, parseInt((qtyStr || "1").replace(/[^\d]/g, ""), 10) || 1);

      const buyTotal = Math.abs(moneyToCents(buyPrice));
      const saleTotal = moneyToCents(salePrice);
      const shipTotal = moneyToCents(shipping);

      const perBuy = Math.round(qty ? buyTotal / qty : 0);
      const perSale = Math.round(qty ? saleTotal / qty : 0);
      const perShip = Math.round(qty ? shipTotal / qty : 0);

      const status = sold && perSale > 0 ? "sold" : "ordered";

      // Get current user
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        setMsg("You must be logged in to create orders");
        return;
      }

      const base = {
        user_id: user.id,
        order_date: orderDate,
        item: itemName || null,
        profile_name: profileName || null,
        retailer: retailerName || null,
        marketplace: sold ? marketName || null : null,
        sale_date: sold ? saleDate || null : null,
        fees_pct: sold ? parsePct(feesPct) : 0,
        status,
      };

      const rows = Array.from({ length: qty }, () => ({
        ...base,
        buy_price_cents: perBuy,
        sale_price_cents: sold ? perSale : 0,
        shipping_cents: sold ? perShip : 0,
      }));

      const { error } = await supabase.from("orders").insert(rows);
      if (error) throw error;

      setMsg(`Saved ✔ (${qty} row${qty > 1 ? "s" : ""})`);

      // reset
      setItemName("");
      setRetailerName("");
      setQtyStr(""); // back to empty placeholder
      setBuyPrice("");
      setSold(false);
      setSaleDate("");
      setMarketName("");
      setSalePrice("");
      setFeesPct("0");
      setSelectedProductMarketData(null);
      setFeesLocked(false);
      setShipping("0");
    } catch (err) {
      setMsg(String(err.message || err));
    } finally {
      setSaving(false);
      setTimeout(() => setMsg(""), 2000);
    }
  }

  /* -------------------------------- render -------------------------------- */
  return (
    <LayoutWithSidebar active="add" section="orderbook">
      <PageHeader title="Quick Add" />

        <form onSubmit={onSave} className={`${card} space-y-8`}>
          {/* ORDER */}
          <div>
            <h2 className="text-lg font-semibold">Order details</h2>
            <p className="text-slate-400 text-sm -mt-1">Add a new or existing order</p>
            <div className="border-b border-slate-800 mt-4"></div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Order Date */}
            <div className="min-w-0">
              <label htmlFor="order-date" className="text-slate-300 mb-2 block text-sm">Order Date</label>
              <input
                id="order-date"
                name="order-date"
                type="date"
                value={orderDate}
                onChange={(e) => setOrderDate(e.target.value)}
                className={`${inputBase} ${dateFix}`}
              />
            </div>

            {/* Item */}
            <div className="min-w-0">
              <label htmlFor="item" className="text-slate-300 mb-2 block text-sm">Item</label>
              <ProductSearchDropdown
                value={itemName}
                onChange={setItemName}
                placeholder="Search products..."
                onProductSelect={async (product) => {
                  // Create a display name that includes set information if available
                  let displayName = product.product_name;
                  if (product.console_name && product.console_name !== product.product_name) {
                    displayName = `${product.product_name} - ${product.console_name}`;
                  }
                  setItemName(displayName);
                  
                  // Fetch market data for the selected product
                  setMarketDataLoading(true);
                  try {
                    const marketData = await getProductMarketData(product.product_name);
                    setSelectedProductMarketData(marketData);
                    
                    // Auto-fill buy price with market value if available
                    if (marketData && marketData.loose_price) {
                      setBuyPrice(marketData.loose_price);
                    }
                  } catch (error) {
                    console.error('Error fetching market data:', error);
                    setSelectedProductMarketData(null);
                  } finally {
                    setMarketDataLoading(false);
                  }
                }}
              />
              <p className="text-xs text-slate-500 mt-1">
                Add "sealed" at the beginning of your search to filter sealed products only.
              </p>
            </div>

            {/* Profile */}
            <div className="min-w-0">
              <label htmlFor="profile" className="text-slate-300 mb-2 block text-sm">Profile (optional)</label>
              <input
                id="profile"
                name="profile"
                value={profileName}
                onChange={(e) => setProfile(e.target.value)}
                placeholder="e.g. Target 3244"
                className={inputBase}
              />
            </div>

            {/* Retailer */}
            <div className="min-w-0">
              <SearchDropdown
                value={retailerName}
                onChange={setRetailerName}
                options={allRetailers}
                placeholder="Type to search retailers…"
                label="Retailer"
                getOptionLabel={(retailer) => retailer.name}
                getOptionValue={(retailer) => retailer.name}
                onTemporaryCreate={createTemporaryRetailer}
                createNewLabel="Create new retailer"
              />
            </div>

            {/* Quantity */}
            <div className="min-w-0">
              <label htmlFor="quantity" className="text-slate-300 mb-2 block text-sm">Quantity</label>
              <input
                id="quantity"
                name="quantity"
                type="text"
                inputMode="numeric"
                pattern="[0-9]*"
                value={qtyStr}
                onChange={(e) => {
                  // allow empty while typing; keep only digits
                  const v = e.target.value.replace(/[^\d]/g, "");
                  setQtyStr(v);
                }}
                placeholder="e.g. 3"
                className={inputBase}
              />
              <p className="text-xs text-slate-500 mt-1">
                We'll insert that many rows and split totals equally.
              </p>
            </div>

            {/* Buy Price */}
            <div className="min-w-0">
              <label htmlFor="buy-price" className="text-slate-300 mb-2 block text-sm">Buy Price (total)</label>
              <input
                id="buy-price"
                name="buy-price"
                value={buyPrice}
                onChange={(e) => setBuyPrice(e.target.value)}
                placeholder="e.g. 67.70"
                className={inputBase}
              />
              {/* Market Price Suggestion */}
              {marketDataLoading && (
                <p className="text-xs text-slate-500 mt-1">Loading market data...</p>
              )}
              {selectedProductMarketData && !marketDataLoading && (
                <div className="mt-2 p-2 bg-slate-800/50 rounded-lg border border-slate-700">
                  <p className="text-xs text-slate-400 mb-1">Market Price Suggestion:</p>
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-medium text-green-400">
                      {getMarketValueFormatted(selectedProductMarketData)}
                    </span>
                    <button
                      type="button"
                      onClick={() => setBuyPrice(selectedProductMarketData.loose_price || '')}
                      className="text-xs text-blue-400 hover:text-blue-300 underline"
                    >
                      Use this price
                    </button>
                  </div>
                  {selectedProductMarketData.console_name && (
                    <p className="text-xs text-slate-500 mt-1">
                      {selectedProductMarketData.console_name}
                    </p>
                  )}
                </div>
              )}
            </div>
          </div>

          {/* SALE (header + toggle) */}
          <div className="mt-2">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-lg font-semibold">
                  Sale details</h2>
                <p className="text-slate-400 text-sm -mt-1">If an order has already sold</p>
              </div>
              <Toggle value={sold} onChange={setSold} label="Sold" />
            </div>
            <div className="border-b border-slate-800 mt-4"></div>
          </div>

          {/* Smoothly collapsing sale fields */}
          <Collapse open={sold}>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {/* Sale Date */}
              <div className="min-w-0">
                <label className="text-slate-300 mb-2 block text-sm">Sale Date</label>
                <input
                  type="date"
                  value={saleDate}
                  onChange={(e) => setSaleDate(e.target.value)}
                  className={`${inputBase} ${dateFix}`}
                />
              </div>

              {/* Sell Price */}
              <div className="min-w-0">
                <label className="text-slate-300 mb-2 block text-sm">Sell Price (total)</label>
                <input
                  value={salePrice}
                  onChange={(e) => setSalePrice(e.target.value)}
                  placeholder="0"
                  className={inputBase}
                />
                <p className="text-xs text-slate-500 mt-1">
                  If qty &gt; 1 we'll split this total across rows.
                </p>
              </div>

              {/* Marketplace */}
              <div className="min-w-0 md:col-span-2">
                <SearchDropdown
                  value={marketName}
                  onChange={setMarketName}
                  options={allMarkets}
                  placeholder="Type to search marketplaces…"
                  label="Marketplace"
                  getOptionLabel={(market) => market.name}
                  getOptionValue={(market) => market.name}
                  onTemporaryCreate={createTemporaryMarket}
                  createNewLabel="Create new marketplace"
                />
              </div>

              {/* Fees */}
              <div className="min-w-0">
                <label className="text-slate-300 mb-2 block text-sm">Fees (%)</label>
                <input
                  value={feesPct}
                  onChange={(e) => !feesLocked && setFeesPct(e.target.value)}
                  placeholder="e.g. 9 or 9%"
                  disabled={feesLocked}
                  className={`${inputBase} ${feesLocked ? disabledInput : ""}`}
                />
                <p className="text-xs text-slate-500 mt-1">
                  Auto filled once a marketplace is selected..
                </p>
                {feesLocked && (
                  <p className="text-xs text-slate-500 mt-1">Locked from marketplace default.</p>
                )}
              </div>

              {/* Shipping */}
              <div className="min-w-0">
                <label className="text-slate-300 mb-2 block text-sm">Shipping (total)</label>
                <input
                  value={shipping}
                  onChange={(e) => setShipping(e.target.value)}
                  className={inputBase}
                  placeholder="0"
                />
                <p className="text-xs text-slate-500 mt-1">
                  If qty &gt; 1 we'll split shipping across rows.
                </p>
              </div>
            </div>
          </Collapse>

          {/* Save */}
          <div className="pt-2">
            <button
              type="submit"
              disabled={saving}
              className="w-full h-12 rounded-2xl bg-indigo-600 hover:bg-indigo-500 text-white font-medium"
            >
              {saving ? "Saving…" : "Add Order"}
            </button>
            {msg && (
              <div
                className={`mt-2 text-sm ${
                  msg && msg.startsWith("Saved") ? "text-emerald-400" : "text-rose-400"
                }`}
              >
                {msg}
              </div>
            )}
          </div>
        </form>
    </LayoutWithSidebar>
  );
}

/* ------------------------------- small UI ------------------------------- */
function Toggle({ value, onChange, label }) {
  return (
    <button
      type="button"
      onClick={() => onChange(!value)}
      className="inline-flex items-center gap-2 select-none"
      aria-pressed={value}
    >
      <span
        className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
          value ? "bg-indigo-600" : "bg-slate-700"
        }`}
      >
        <span
          className={`h-5 w-5 rounded-full bg-white shadow transform transition-transform ${
            value ? "translate-x-[22px]" : "translate-x-[3px]"
          }`}
        />
      </span>
      <span className="text-slate-200 text-sm">{label}</span>
    </button>
  );
}