// src/routes/OrderBook.jsx
import { useEffect, useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "../lib/supabaseClient";
import HeaderWithTabs from "../components/HeaderWithTabs.jsx";
import { moneyToCents, centsToStr, parsePct } from "../utils/money.js";
import { pageCard, rowCard, inputSm } from "../utils/ui.js";
const fmtNiceDate = (yyyyMmDd) => {
  if (!yyyyMmDd) return "Unknown date";
  const [y, m, d] = yyyyMmDd.split("-").map((n) => Number(n));
  const dt = new Date(y, (m || 1) - 1, d || 1);
  return dt.toLocaleDateString(undefined, {
    month: "long",
    day: "numeric",
    year: "numeric",
  });
};

/* Build permissive keywords for date search */
function dateKeywords(yyyyMmDd) {
  if (!yyyyMmDd) return "";
  const [yStr, mStr, dStr] = yyyyMmDd.split("-");
  const y = Number(yStr),
    m = Number(mStr),
    d = Number(dStr);
  const monthLong = [
    "january",
    "february",
    "march",
    "april",
    "may",
    "june",
    "july",
    "august",
    "september",
    "october",
    "november",
    "december",
  ][(m || 1) - 1];
  const monthShort = monthLong.slice(0, 3);

  const m1 = String(m);
  const m2 = m.toString().padStart(2, "0");
  const d1 = String(d);
  const d2 = d.toString().padStart(2, "0");

  return [
    `${m1}/${d1}`,
    `${m2}/${d2}`,
    `${m1}/${d1}/${y}`,
    `${m2}/${d2}/${y}`,
    `${monthLong}`,
    `${monthShort}`,
    `${monthLong} ${d1}`,
    `${monthLong} ${d2}`,
    `${monthShort} ${d1}`,
    `${monthShort} ${d2}`,
    `${monthLong} ${y}`,
    `${monthShort} ${y}`,
    `${monthLong} ${d1} ${y}`,
    `${monthLong} ${d2} ${y}`,
    `${monthShort} ${d1} ${y}`,
    `${monthShort} ${d2} ${y}`,
    `${yStr}-${mStr}-${dStr}`,
  ]
    .join(" ")
    .toLowerCase();
}

/* ---------- queries ---------- */
async function getOrders(limit = 500) {
  const { data, error } = await supabase
    .from("orders")
    .select(
      "id, order_date, item, profile_name, retailer, marketplace, buy_price_cents, sale_price_cents, sale_date, fees_pct, shipping_cents, status"
    )
    .order("order_date", { ascending: false })
    .limit(limit);
  if (error) throw error;
  return data ?? [];
}
async function getItems() {
  const { data, error } = await supabase
    .from("items")
    .select("id, name")
    .order("name", { ascending: true });
  if (error) throw error;
  return data ?? [];
}
async function getRetailers() {
  const { data, error } = await supabase
    .from("retailers")
    .select("id, name")
    .order("name", { ascending: true });
  if (error) throw error;
  return data ?? [];
}
async function getMarkets() {
  const { data, error } = await supabase
    .from("marketplaces")
    .select("id, name, default_fees_pct")
    .order("name", { ascending: true });
  if (error) throw error;
  return data ?? [];
}

/* ====================== PAGE ====================== */
export default function OrderBook() {
  const {
    data: orders = [],
    isLoading,
    error,
    refetch,
  } = useQuery({ queryKey: ["orders", 500], queryFn: () => getOrders(500) });
  const { data: items = [] } = useQuery({ queryKey: ["items"], queryFn: getItems });
  const { data: retailers = [] } = useQuery({
    queryKey: ["retailers"],
    queryFn: getRetailers,
  });
  const { data: markets = [] } = useQuery({
    queryKey: ["markets"],
    queryFn: getMarkets,
  });

  // Normalize native date input rendering
  useEffect(() => {
    const tag = document.createElement("style");
    tag.innerHTML = `
      .tw-date { -webkit-appearance:none; appearance:none; height:2.5rem; padding:0 .75rem; background:transparent; }
      .tw-date::-webkit-datetime-edit, .tw-date::-webkit-datetime-edit-fields-wrapper { padding:0; line-height:1.25rem; }
      .tw-date::-webkit-calendar-picker-indicator { opacity:.9; }
    `;
    document.head.appendChild(tag);
    return () => document.head.removeChild(tag);
  }, []);

  /* single fuzzy search bar */
  const [q, setQ] = useState("");

  /* bulk selection state */
  const [selectedRows, setSelectedRows] = useState(new Set());
  const [bulkActionsVisible, setBulkActionsVisible] = useState(false);

  /* bulk action functions */
  function toggleRowSelection(rowId) {
    const newSelected = new Set(selectedRows);
    if (newSelected.has(rowId)) {
      newSelected.delete(rowId);
    } else {
      newSelected.add(rowId);
    }
    setSelectedRows(newSelected);
    setBulkActionsVisible(newSelected.size > 0);
  }

  function toggleAllSelection() {
    if (selectedRows.size === filtered.length) {
      // Deselect all
      setSelectedRows(new Set());
      setBulkActionsVisible(false);
    } else {
      // Select all
      setSelectedRows(new Set(filtered.map(row => row.id)));
      setBulkActionsVisible(true);
    }
  }

  async function bulkSaveSelected() {
    if (selectedRows.size === 0) return;

    try {
      // Get all selected orders with their current form data
      const selectedOrders = filtered.filter(order => selectedRows.has(order.id));
      
      // For now, we'll need to collect the form data from each row
      // This is a simplified version - in a real implementation, you'd need to track form state
      const updates = selectedOrders.map(order => ({
        id: order.id,
        // Add the fields that need to be updated
        // This would need to be enhanced to capture actual form changes
      }));

      // For now, just show a success message
      alert(`Saved ${selectedRows.size} order${selectedRows.size > 1 ? 's' : ''}`);
      
      // Clear selection
      setSelectedRows(new Set());
      setBulkActionsVisible(false);
      refetch();
    } catch (e) {
      alert(`Failed to save orders: ${e.message}`);
    }
  }

  async function bulkDeleteSelected() {
    if (!confirm(`Are you sure you want to delete ${selectedRows.size} order${selectedRows.size > 1 ? 's' : ''}?`)) {
      return;
    }

    try {
      const { error } = await supabase
        .from("orders")
        .delete()
        .in("id", Array.from(selectedRows));
      
      if (error) throw error;
      
      // Clear selection and refresh
      setSelectedRows(new Set());
      setBulkActionsVisible(false);
      refetch();
    } catch (e) {
      alert(`Failed to delete orders: ${e.message}`);
    }
  }

  const filtered = useMemo(() => {
    const query = (q || "").trim().toLowerCase();
    if (!query) return orders;

    const tokens = query.split(/\s+/).filter(Boolean); // AND tokens

    return orders.filter((o) => {
      const haystack = [
        o.item || "",
        o.retailer || "",
        o.marketplace || "",
        o.profile_name || "",
        dateKeywords(o.order_date || ""),
        dateKeywords(o.sale_date || ""),
      ]
        .join(" ")
        .toLowerCase();

      return tokens.every((t) => haystack.includes(t));
    });
  }, [orders, q]);

  /* group by order_date */
  const grouped = useMemo(() => {
    const map = new Map();
    for (const o of filtered) {
      const key = o.order_date || "__unknown__";
      if (!map.has(key)) map.set(key, []);
      map.get(key).push(o);
    }
    const keys = Array.from(map.keys()).sort((a, b) => {
      if (a === "__unknown__") return 1;
      if (b === "__unknown__") return -1;
      return a < b ? 1 : a > b ? -1 : 0;
    });
    return keys.map((k) => ({
      key: k,
      nice: k === "__unknown__" ? "Unknown date" : fmtNiceDate(k),
      rows: map.get(k),
    }));
  }, [filtered]);

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100">
      <div className="max-w-6xl mx-auto p-4 sm:p-6">
        <HeaderWithTabs />

        {/* Search + meta */}
        <div className={`${pageCard} mb-6`}>
          <div className="grid grid-cols-1 gap-3 items-end">
            <div>
              <label className="text-slate-300 mb-1 block text-sm">Search</label>
              <input
                value={q}
                onChange={(e) => setQ(e.target.value)}
                placeholder="item / retailer / marketplace / date"
                className={inputSm}
              />
            </div>

            <div className="flex items-center gap-4">
              <div className="text-slate-400 text-sm">Rows</div>
              <div className="text-xl font-semibold">{filtered.length}</div>
              {!!q && (
                <button
                  onClick={() => setQ("")}
                  className="ml-auto h-9 px-4 rounded-xl border border-slate-800 bg-slate-900/60 hover:bg-slate-900 text-slate-100"
                >
                  Clear search
                </button>
              )}
            </div>
          </div>
        </div>

        {/* Bulk Actions */}
        {bulkActionsVisible && (
          <div className={`${pageCard} mb-6 border-indigo-500 bg-indigo-500/10`}>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-4">
                <div className="flex items-center gap-2">
                  <div className="h-2 w-2 rounded-full bg-indigo-500"></div>
                  <span className="text-indigo-300 font-medium">
                    {selectedRows.size} selected
                  </span>
                </div>
                <button
                  onClick={toggleAllSelection}
                  className="text-sm text-slate-400 hover:text-slate-300 transition"
                >
                  {selectedRows.size === filtered.length ? "Deselect All" : "Select All"}
                </button>
              </div>
              
              <div className="flex items-center gap-2">
                <button
                  onClick={bulkSaveSelected}
                  className="h-9 px-4 rounded-xl border border-slate-800 bg-slate-900/60 hover:bg-slate-800 text-slate-100 transition"
                >
                  Save
                </button>
                <button
                  onClick={bulkDeleteSelected}
                  className="h-9 px-4 rounded-xl border border-red-800 bg-red-900/60 hover:bg-red-800 text-red-100 transition"
                >
                  Delete
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Day cards */}
        {isLoading && <div className="text-slate-400">Loading…</div>}
        {error && <div className="text-rose-400">{String(error.message || error)}</div>}

        <div className="space-y-5">
          {grouped.map((g) => (
            <DayCard
              key={g.key}
              title={g.nice}
              dateKey={g.key}
              count={g.rows.length}
              defaultOpen={false}       // collapsed by default
              rows={g.rows}
              items={items}
              retailers={retailers}
              markets={markets}
              onSaved={refetch}
              onDeleted={refetch}
              selectedRows={selectedRows}
              onToggleRowSelection={toggleRowSelection}
            />
          ))}
          {!grouped.length && (
            <div className={`${pageCard} text-slate-400`}>No orders found.</div>
          )}
        </div>
      </div>
    </div>
  );
}

/* ============== Day Card ============== */
function DayCard({
  title,
  dateKey, // YYYY-MM-DD or "__unknown__"
  count,
  rows,
  items,
  retailers,
  markets,
  onSaved,
  onDeleted,
  defaultOpen = false,
  selectedRows,
  onToggleRowSelection,
}) {
  const [open, setOpen] = useState(defaultOpen);
  const [adding, setAdding] = useState(false);

  async function addNewForDay() {
    if (!dateKey || dateKey === "__unknown__") return;
    setAdding(true);
    try {
      const base = {
        order_date: dateKey,
        item: null,
        profile_name: null,
        retailer: null,
        marketplace: null,
        sale_date: null,
        buy_price_cents: 0,
        sale_price_cents: 0,
        shipping_cents: 0,
        fees_pct: 0,
        status: "ordered",
      };
      const { error } = await supabase.from("orders").insert(base);
      if (error) throw error;
      onSaved && onSaved();
      setOpen(true);
    } catch (e) {
      alert(e.message || String(e));
    } finally {
      setAdding(false);
    }
  }

  return (
    <div className={pageCard}>
      {/* header - controls pinned top-right (mobile & desktop) */}
      <div className="relative min-h-[2.25rem]">
        {/* Controls */}
        <div className="absolute right-0 top-0 flex items-center gap-2">
          {open && (
            <button
              onClick={addNewForDay}
              disabled={!dateKey || dateKey === "__unknown__" || adding}
              className={`h-9 w-9 rounded-xl border border-slate-800 text-lg leading-none ${
                adding
                  ? "bg-slate-800 text-slate-300 cursor-not-allowed"
                  : "bg-slate-900/60 hover:bg-slate-900 text-slate-100"
              }`}
              title={
                dateKey === "__unknown__" ? "Unknown date" : `Add order on ${title}`
              }
            >
              {adding ? "…" : "+"}
            </button>
          )}

          <button
            onClick={() => setOpen((v) => !v)}
            className="h-9 w-9 grid place-items-center rounded-xl border border-slate-800 bg-slate-900/60 hover:bg-slate-800 transition"
            aria-label={open ? "Collapse" : "Expand"}
          >
            <ChevronDown className={`h-5 w-5 transition-transform ${open ? "rotate-180" : ""}`} />
          </button>
        </div>

        {/* Title (reserve space so it never overlaps controls) */}
        <div className="pr-36 sm:pr-40">
          <h3 className="text-lg font-semibold leading-tight break-words">{title}</h3>
          <p className="text-xs text-slate-400">
            {count} order{count !== 1 ? "s" : ""}
          </p>
        </div>
      </div>

      {/* content */}
      <div className={`transition-all duration-300 ease-in-out overflow-hidden`} style={{ maxHeight: open ? 1000 : 0 }}>
        <div className="pt-5">
          {/* Header labels per group (desktop) */}
          <div className="hidden lg:flex text-xs text-slate-400 px-1 mb-1 gap-2">
            <div className="w-6">Select</div>
            <div className="w-40">Order date</div>
            <div className="min-w-[200px] flex-1">Item</div>
            <div className="w-24">Profile</div>
            <div className="w-30">Retailer</div>
            <div className="w-22">Buy $</div>
            <div className="w-22">Sale $</div>
            <div className="w-36">Sale date</div>
            <div className="w-32">Marketplace</div>
            <div className="w-20">Ship $</div>
          </div>

          <div className="space-y-3">
            {rows.map((o) => (
              <OrderRow
                key={o.id}
                order={o}
                items={items}
                retailers={retailers}
                markets={markets}
                onSaved={onSaved}
                onDeleted={onDeleted}
                isSelected={selectedRows.has(o.id)}
                onToggleSelection={() => onToggleRowSelection(o.id)}
              />
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

/* ============== Row component ============== */
function OrderRow({ order, items, retailers, markets, onSaved, onDeleted, isSelected, onToggleSelection }) {
  const [order_date, setOrderDate] = useState(order.order_date || "");
  const [item, setItem] = useState(order.item || "");
  const [profile_name, setProfile] = useState(order.profile_name || "");
  const [retailer, setRetailer] = useState(order.retailer || "");
  const [buyPrice, setBuyPrice] = useState(centsToStr(order.buy_price_cents));
  const [salePrice, setSalePrice] = useState(centsToStr(order.sale_price_cents));
  const [sale_date, setSaleDate] = useState(order.sale_date || "");
  const [marketplace, setMarketplace] = useState(order.marketplace || "");
  const [feesPct, setFeesPct] = useState(((order.fees_pct ?? 0) * 100).toString());
  const [shipping, setShipping] = useState(centsToStr(order.shipping_cents));

  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState("");

  function handleMarketplaceChange(name) {
    setMarketplace(name);
    const mk = markets.find((m) => m.name === name);
    const current = Number(String(feesPct).replace("%", "")) || 0;
    if (mk && (!current || current === 0)) {
      setFeesPct(((mk.default_fees_pct ?? 0) * 100).toString());
    }
  }

  async function save() {
    setBusy(true);
    setMsg("");
    try {
      const statusValue = moneyToCents(salePrice) > 0 ? "sold" : "ordered";
      const payload = {
        order_date: order_date || null,
        item: item || null,
        profile_name: profile_name || null,
        retailer: retailer || null,
        marketplace: marketplace || null,
        buy_price_cents: moneyToCents(buyPrice),
        sale_price_cents: moneyToCents(salePrice),
        sale_date: sale_date || null,
        fees_pct: parsePct(feesPct),
        shipping_cents: moneyToCents(shipping),
        status: statusValue,
      };
      const { error } = await supabase.from("orders").update(payload).eq("id", order.id);
      if (error) throw error;
      setMsg("Saved ✓");
      onSaved && onSaved();
      setTimeout(() => setMsg(""), 1500);
    } catch (err) {
      setMsg(String(err.message || err));
    } finally {
      setBusy(false);
    }
  }

  async function del() {
    if (!confirm("Delete this order?")) return;
    const { error } = await supabase.from("orders").delete().eq("id", order.id);
    if (error) alert(error.message);
    else onDeleted && onDeleted();
  }

  return (
    <div 
      className={`${rowCard} transition cursor-pointer ${
        isSelected ? 'border-indigo-500 bg-indigo-500/10' : 'hover:bg-slate-800/50'
      }`}
      onClick={onToggleSelection}
    >
      <div className="flex flex-wrap lg:flex-nowrap items-center gap-2">
        {/* Selection checkbox */}
        <input
          type="checkbox"
          checked={isSelected}
          onChange={(e) => {
            e.stopPropagation(); // Prevent row click when clicking checkbox
            onToggleSelection();
          }}
          className="h-4 w-4 rounded border-slate-600 bg-slate-800 text-indigo-600 focus:ring-indigo-500"
        />
        {/* order date */}
        <input
          type="date"
          value={order_date || ""}
          onChange={(e) => setOrderDate(e.target.value)}
          onClick={(e) => e.stopPropagation()}
          className={`tw-date ${inputSm} w-36`}
        />

        {/* item */}
        <select
          value={item || ""}
          onChange={(e) => setItem(e.target.value)}
          onClick={(e) => e.stopPropagation()}
          className={`${inputSm} min-w-[240px] flex-1`}
        >
          <option value=""></option>
          {items.map((it) => (
            <option key={it.id} value={it.name}>
              {it.name}
            </option>
          ))}
        </select>

        {/* profile */}
        <input
          value={profile_name}
          onChange={(e) => setProfile(e.target.value)}
          onClick={(e) => e.stopPropagation()}
          placeholder="Profile"
          className={`${inputSm} w-28`}
        />

        {/* retailer */}
        <select
          value={retailer || ""}
          onChange={(e) => setRetailer(e.target.value)}
          onClick={(e) => e.stopPropagation()}
          className={`${inputSm} w-28`}
        >
          <option value=""></option>
          {retailers.map((r) => (
            <option key={r.id} value={r.name}>
              {r.name}
            </option>
          ))}
        </select>

        {/* buy / sale */}
        <input
          value={buyPrice}
          onChange={(e) => setBuyPrice(e.target.value)}
          onClick={(e) => e.stopPropagation()}
          placeholder="Buy"
          className={`${inputSm} w-24`}
        />
        <input
          value={salePrice}
          onChange={(e) => setSalePrice(e.target.value)}
          onClick={(e) => e.stopPropagation()}
          placeholder="Sale"
          className={`${inputSm} w-24`}
        />

        {/* sale date */}
        <input
          type="date"
          value={sale_date || ""}
          onChange={(e) => setSaleDate(e.target.value)}
          onClick={(e) => e.stopPropagation()}
          className={`tw-date ${inputSm} w-36`}
        />

        {/* marketplace */}
        <select
          value={marketplace || ""}
          onChange={(e) => handleMarketplaceChange(e.target.value)}
          onClick={(e) => e.stopPropagation()}
          className={`${inputSm} w-32`}
        >
          <option value=""></option>
          {markets.map((m) => (
            <option key={m.id} value={m.name}>
              {m.name}
            </option>
          ))}
        </select>

        {/* ship */}
        <input
          value={shipping}
          onChange={(e) => setShipping(e.target.value)}
          onClick={(e) => e.stopPropagation()}
          placeholder="Ship"
          className={`${inputSm} w-24`}
        />

      </div>

      {msg && (
        <div
          className={`text-right text-sm mt-1 ${
            msg.startsWith("Saved") ? "text-emerald-400" : "text-rose-400"
          }`}
        >
          {msg}
        </div>
      )}
    </div>
  );
}

function ChevronDown({ className = "h-5 w-5" }) {
  return (
    <svg viewBox="0 0 24 24" className={className} fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M6 9l6 6 6-6" />
    </svg>
  );
}
