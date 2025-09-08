// src/routes/Settings.jsx
import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "../lib/supabaseClient";
import HeaderWithTabs from "../components/HeaderWithTabs.jsx";
import { moneyToCents, centsToStr } from "../utils/money.js";
import { pageCard, rowCard, inputSm, headerIconBtn, headerGhostBtn, iconSave, iconSaveBusy, iconDelete } from "../utils/ui.js";

/* ---------- queries ---------- */
async function getItems() {
  const { data, error } = await supabase
    .from("items")
    .select("id, name, market_value_cents")
    .order("name", { ascending: true });
  if (error) throw error;
  return data;
}
async function getRetailers() {
  const { data, error } = await supabase
    .from("retailers")
    .select("id, name")
    .order("name", { ascending: true });
  if (error) throw error;
  return data;
}
async function getMarkets() {
  const { data, error } = await supabase
    .from("marketplaces")
    .select("id, name, default_fees_pct")
    .order("name", { ascending: true });
  if (error) throw error;
  return data;
}

export default function Settings() {
  const { data: items = [], refetch: refetchItems } = useQuery({
    queryKey: ["items"],
    queryFn: getItems,
  });
  const { data: retailers = [], refetch: refetchRetailers } = useQuery({
    queryKey: ["retailers"],
    queryFn: getRetailers,
  });
  const { data: markets = [], refetch: refetchMarkets } = useQuery({
    queryKey: ["markets"],
    queryFn: getMarkets,
  });


  // collapsed by default
  const [openItems, setOpenItems] = useState(false);
  const [openRetailers, setOpenRetailers] = useState(false);
  const [openMarkets, setOpenMarkets] = useState(false);

  // temp rows when adding
  const [addingItem, setAddingItem] = useState(false);
  const [addingRetailer, setAddingRetailer] = useState(false);
  const [addingMarket, setAddingMarket] = useState(false);

  /* ----- CRUD: Items ----- */
  async function createItem(name, mvStr) {
    if (!name?.trim()) return false;
    const market_value_cents = moneyToCents(mvStr);
    const { error } = await supabase
      .from("items")
      .insert({ name: name.trim(), market_value_cents });
    if (!error) await refetchItems();
    return !error;
  }
  async function updateItem(id, name, mvStr) {
    const market_value_cents = moneyToCents(mvStr);
    const { error } = await supabase
      .from("items")
      .update({ name, market_value_cents })
      .eq("id", id);
    if (!error) await refetchItems();
    return !error;
  }
  async function deleteItem(id) {
    if (!confirm("Delete this item?")) return;
    const { error } = await supabase.from("items").delete().eq("id", id);
    if (error) alert(error.message);
    else await refetchItems();
  }

  /* ----- CRUD: Retailers ----- */
  async function createRetailer(name) {
    if (!name?.trim()) return false;
    const { error } = await supabase
      .from("retailers")
      .insert({ name: name.trim() });
    if (!error) await refetchRetailers();
    return !error;
  }
  async function updateRetailer(id, name) {
    const { error } = await supabase
      .from("retailers")
      .update({ name })
      .eq("id", id);
    if (!error) await refetchRetailers();
    return !error;
  }
  async function deleteRetailer(id) {
    if (!confirm("Delete this retailer?")) return;
    const { error } = await supabase.from("retailers").delete().eq("id", id);
    if (error) alert(error.message);
    else await refetchRetailers();
  }

  /* ----- CRUD: Marketplaces ----- */
  async function createMarket(name, feeStr) {
    const feeNum = Number(String(feeStr ?? "").replace("%", ""));
    const default_fee_pct = isNaN(feeNum) ? 0 : feeNum > 1 ? feeNum / 100 : feeNum;
    if (!name?.trim()) return false;
    const { error } = await supabase
      .from("marketplaces")
      .insert({ name: name.trim(), default_fees_pct: default_fee_pct });
    if (!error) await refetchMarkets();
    return !error;
  }
  async function updateMarket(id, name, feeStr) {
    const feeNum = Number(String(feeStr ?? "").replace("%", ""));
    const default_fee_pct = isNaN(feeNum) ? 0 : feeNum > 1 ? feeNum / 100 : feeNum;
    const { error } = await supabase
      .from("marketplaces")
      .update({ name, default_fees_pct: default_fee_pct })
      .eq("id", id);
    if (!error) await refetchMarkets();
    return !error;
  }
  async function deleteMarket(id) {
    if (!confirm("Delete this marketplace?")) return;
    const { error } = await supabase.from("marketplaces").delete().eq("id", id);
    if (error) alert(error.message);
    else await refetchMarkets();
  }

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100">
      <div className="max-w-6xl mx-auto p-4 sm:p-6">
        <HeaderWithTabs active="settings" showTabs />

        {/* ---------- Items ---------- */}
        <section className={`${pageCard} mb-6`}>
          <div className="flex items-center justify-between gap-3 flex-wrap sm:flex-nowrap">
            <div className="min-w-0">
              <h2 className="text-lg font-semibold leading-[2.25rem]">Products</h2>
              <p className="text-xs text-slate-400 -mt-1">Total: {items.length}</p>
            </div>

            <div className="flex items-center gap-2 ml-auto self-center -mt-2 sm:mt-0">
              {openItems && !addingItem && (
                <button
                  onClick={() => setAddingItem(true)}
                  className={headerIconBtn}
                  aria-label="Add item"
                  title="Add item"
                >
                  <svg
                    viewBox="0 0 24 24"
                    className="h-5 w-5"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  >
                    <path d="M12 5v14M5 12h14" />
                  </svg>
                </button>
              )}
              <button
                onClick={() => {
                  const n = !openItems;
                  setOpenItems(n);
                  if (!n) setAddingItem(false);
                }}
                className={headerGhostBtn}
              >
                {openItems ? "Collapse" : "Expand"}
              </button>
            </div>
          </div>

          {openItems && (
            <div className="pt-5">
              <div className="hidden sm:grid sm:grid-cols-[1fr_160px_200px] gap-2 px-1 pb-2 text-xs text-slate-400">
                <div>Item</div>
                <div>Market value ($)</div>
                <div className="text-right">Actions</div>
              </div>

              <div className="space-y-3">
                {addingItem && (
                  <ItemRow
                    isNew
                    onSave={async (name, mv) => {
                      const ok = await createItem(name, mv);
                      if (ok) setAddingItem(false);
                      return ok;
                    }}
                    onDelete={() => setAddingItem(false)}
                  />
                )}
                {items.map((it) => (
                  <ItemRow
                    key={it.id}
                    it={it}
                    onSave={(name, mv) => updateItem(it.id, name, mv)}
                    onDelete={() => deleteItem(it.id)}
                  />
                ))}
                {!items.length && !addingItem && (
                  <div className="text-slate-400">No items yet.</div>
                )}
              </div>
            </div>
          )}
        </section>

        {/* ---------- Retailers ---------- */}
        <section className={`${pageCard} mb-6`}>
          <div className="flex items-center justify-between gap-3 flex-wrap sm:flex-nowrap">
            <div className="min-w-0">
              <h2 className="text-lg font-semibold leading-[2.25rem]">Retailers</h2>
              <p className="text-xs text-slate-400 -mt-1">Total: {retailers.length}</p>
            </div>

            <div className="flex items-center gap-2 ml-auto self-center -mt-2 sm:mt-0">
              {openRetailers && !addingRetailer && (
                <button
                  onClick={() => setAddingRetailer(true)}
                  className={headerIconBtn}
                  aria-label="Add retailer"
                  title="Add retailer"
                >
                  <svg
                    viewBox="0 0 24 24"
                    className="h-5 w-5"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  >
                    <path d="M12 5v14M5 12h14" />
                  </svg>
                </button>
              )}
              <button
                onClick={() => {
                  const n = !openRetailers;
                  setOpenRetailers(n);
                  if (!n) setAddingRetailer(false);
                }}
                className={headerGhostBtn}
              >
                {openRetailers ? "Collapse" : "Expand"}
              </button>
            </div>
          </div>

          {openRetailers && (
            <div className="pt-5">
              <div className="hidden sm:grid sm:grid-cols-[1fr_200px] gap-2 px-1 pb-2 text-xs text-slate-400">
                <div>Retailer</div>
                <div className="text-right">Actions</div>
              </div>

              <div className="space-y-3">
                {addingRetailer && (
                  <RetailerRow
                    isNew
                    onSave={async (name) => {
                      const ok = await createRetailer(name);
                      if (ok) setAddingRetailer(false);
                      return ok;
                    }}
                    onDelete={() => setAddingRetailer(false)}
                  />
                )}
                {retailers.map((r) => (
                  <RetailerRow
                    key={r.id}
                    r={r}
                    onSave={(name) => updateRetailer(r.id, name)}
                    onDelete={() => deleteRetailer(r.id)}
                  />
                ))}
                {!retailers.length && !addingRetailer && (
                  <div className="text-slate-400">No retailers yet.</div>
                )}
              </div>
            </div>
          )}
        </section>

        {/* ---------- Marketplaces ---------- */}
        <section className={`${pageCard}`}>
          <div className="flex items-center justify-between gap-3 flex-wrap sm:flex-nowrap">
            <div className="min-w-0">
              <h2 className="text-lg font-semibold leading-[2.25rem]">Marketplaces</h2>
              <p className="text-xs text-slate-400 -mt-1">Total: {markets.length}</p>
            </div>

            <div className="flex items-center gap-2 ml-auto self-center -mt-2 sm:mt-0">
              {openMarkets && !addingMarket && (
                <button
                  onClick={() => setAddingMarket(true)}
                  className={headerIconBtn}
                  aria-label="Add marketplace"
                  title="Add marketplace"
                >
                  <svg
                    viewBox="0 0 24 24"
                    className="h-5 w-5"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  >
                    <path d="M12 5v14M5 12h14" />
                  </svg>
                </button>
              )}
              <button
                onClick={() => {
                  const n = !openMarkets;
                  setOpenMarkets(n);
                  if (!n) setAddingMarket(false);
                }}
                className={headerGhostBtn}
              >
                {openMarkets ? "Collapse" : "Expand"}
              </button>
            </div>
          </div>

          {openMarkets && (
            <div className="pt-5">
              <div className="hidden sm:grid sm:grid-cols-[1fr_140px_200px] gap-2 px-1 pb-2 text-xs text-slate-400">
                <div>Marketplace</div>
                <div>Fee %</div>
                <div className="text-right">Actions</div>
              </div>

              <div className="space-y-3">
                {addingMarket && (
                  <MarketRow
                    isNew
                    onSave={async (name, fee) => {
                      const ok = await createMarket(name, fee);
                      if (ok) setAddingMarket(false);
                      return ok;
                    }}
                    onDelete={() => setAddingMarket(false)}
                  />
                )}
                {markets.map((m) => (
                  <MarketRow
                    key={m.id}
                    m={m}
                    onSave={(name, fee) => updateMarket(m.id, name, fee)}
                    onDelete={() => deleteMarket(m.id)}
                  />
                ))}
                {!markets.length && !addingMarket && (
                  <div className="text-slate-400">No marketplaces yet.</div>
                )}
              </div>
            </div>
          )}
        </section>
      </div>
    </div>
  );
}

/* ---------- Row components ---------- */

function ItemRow({ it, isNew = false, onSave, onDelete }) {
  const [name, setName] = useState(it?.name ?? "");
  const [mv, setMv] = useState(centsToStr(it?.market_value_cents ?? 0));
  const [status, setStatus] = useState("");
  const [busy, setBusy] = useState(false);

  async function handleSave() {
    setBusy(true);
    setStatus("Saving…");
    const ok = await onSave(name, mv);
    setStatus(ok ? "Saved ✓" : "Error");
    if (ok) setTimeout(() => setStatus(""), 1500);
    setBusy(false);
  }

  return (
    <div className={rowCard}>
      <div className="grid grid-cols-1 sm:grid-cols-[1fr_160px_auto] gap-2 items-center min-w-0">
        <input
          className={inputSm}
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Item name…"
        />
        <input
          className={`${inputSm} sm:w-[160px]`}
          value={mv}
          onChange={(e) => setMv(e.target.value)}
          placeholder="e.g. 129.99"
        />
        <div className="flex justify-end gap-2">
          <button
            onClick={handleSave}
            className={busy ? iconSaveBusy : iconSave}
            title={busy ? "Saving…" : "Save"}
            aria-label={busy ? "Saving…" : "Save"}
            disabled={busy}
          >
            <svg
              viewBox="0 0 24 24"
              className="h-5 w-5"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <path d="M20 6L9 17l-5-5" />
            </svg>
          </button>
          <button
            onClick={onDelete}
            className={isNew ? iconSave : iconDelete}
            title={isNew ? "Cancel" : "Delete"}
            aria-label={isNew ? "Cancel" : "Delete"}
          >
            {isNew ? (
              // small X for cancel
              <svg
                viewBox="0 0 24 24"
                className="h-5 w-5"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <path d="M18 6L6 18M6 6l12 12" />
              </svg>
            ) : (
              <svg
                viewBox="0 0 24 24"
                className="h-5 w-5"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <path d="M3 6h18" />
                <path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6" />
                <path d="M10 11v6M14 11v6" />
                <path d="M9 6V4a2 2 0 0 1 2-2h2a2 2 0 0 1 2 2v2" />
              </svg>
            )}
          </button>
        </div>
      </div>
      {status && (
        <div
          className={`text-right text-sm mt-1 ${
            status.startsWith("Saved")
              ? "text-emerald-400"
              : status === "Error"
              ? "text-rose-400"
              : "text-slate-400"
          }`}
        >
          {status}
        </div>
      )}
    </div>
  );
}

function RetailerRow({ r, isNew = false, onSave, onDelete }) {
  const [name, setName] = useState(r?.name ?? "");
  const [status, setStatus] = useState("");
  const [busy, setBusy] = useState(false);

  async function handleSave() {
    setBusy(true);
    setStatus("Saving…");
    const ok = await onSave(name);
    setStatus(ok ? "Saved ✓" : "Error");
    if (ok) setTimeout(() => setStatus(""), 1500);
    setBusy(false);
  }

  return (
    <div className={rowCard}>
      <div className="grid grid-cols-1 sm:grid-cols-[1fr_auto] gap-2 items-center min-w-0">
        <input
          className={inputSm}
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Retailer name…"
        />
        <div className="flex justify-end gap-2">
          <button
            onClick={handleSave}
            className={busy ? iconSaveBusy : iconSave}
            title={busy ? "Saving…" : "Save"}
            aria-label={busy ? "Saving…" : "Save"}
            disabled={busy}
          >
            <svg
              viewBox="0 0 24 24"
              className="h-5 w-5"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <path d="M20 6L9 17l-5-5" />
            </svg>
          </button>
          <button
            onClick={onDelete}
            className={isNew ? iconSave : iconDelete}
            title={isNew ? "Cancel" : "Delete"}
            aria-label={isNew ? "Cancel" : "Delete"}
          >
            {isNew ? (
              <svg
                viewBox="0 0 24 24"
                className="h-5 w-5"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <path d="M18 6L6 18M6 6l12 12" />
              </svg>
            ) : (
              <svg
                viewBox="0 0 24 24"
                className="h-5 w-5"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <path d="M3 6h18" />
                <path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6" />
                <path d="M10 11v6M14 11v6" />
                <path d="M9 6V4a2 2 0 0 1 2-2h2a2 2 0 0 1 2 2v2" />
              </svg>
            )}
          </button>
        </div>
      </div>
      {status && (
        <div
          className={`text-right text-sm mt-1 ${
            status.startsWith("Saved")
              ? "text-emerald-400"
              : status === "Error"
              ? "text-rose-400"
              : "text-slate-400"
          }`}
        >
          {status}
        </div>
      )}
    </div>
  );
}

function MarketRow({ m, isNew = false, onSave, onDelete }) {
  const [name, setName] = useState(m?.name ?? "");
  const [fee, setFee] = useState(((m?.default_fees_pct ?? 0) * 100).toString());
  const [status, setStatus] = useState("");
  const [busy, setBusy] = useState(false);

  async function handleSave() {
    setBusy(true);
    setStatus("Saving…");
    const ok = await onSave(name, fee);
    setStatus(ok ? "Saved ✓" : "Error");
    if (ok) setTimeout(() => setStatus(""), 1500);
    setBusy(false);
  }

  return (
    <div className={rowCard}>
      <div className="grid grid-cols-1 sm:grid-cols-[1fr_140px_auto] gap-2 items-center min-w-0">
        <input
          className={inputSm}
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Marketplace name…"
        />
        <input
          className={`${inputSm} sm:w-[140px]`}
          value={fee}
          onChange={(e) => setFee(e.target.value)}
          placeholder="Fee %"
        />
        <div className="flex justify-end gap-2">
          <button
            onClick={handleSave}
            className={busy ? iconSaveBusy : iconSave}
            title={busy ? "Saving…" : "Save"}
            aria-label={busy ? "Saving…" : "Save"}
            disabled={busy}
          >
            <svg
              viewBox="0 0 24 24"
              className="h-5 w-5"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <path d="M20 6L9 17l-5-5" />
            </svg>
          </button>
          <button
            onClick={onDelete}
            className={isNew ? iconSave : iconDelete}
            title={isNew ? "Cancel" : "Delete"}
            aria-label={isNew ? "Cancel" : "Delete"}
          >
            {isNew ? (
              <svg
                viewBox="0 0 24 24"
                className="h-5 w-5"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <path d="M18 6L6 18M6 6l12 12" />
              </svg>
            ) : (
              <svg
                viewBox="0 0 24 24"
                className="h-5 w-5"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <path d="M3 6h18" />
                <path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6" />
                <path d="M10 11v6M14 11v6" />
                <path d="M9 6V4a2 2 0 0 1 2-2h2a2 2 0 0 1 2 2v2" />
              </svg>
            )}
          </button>
        </div>
      </div>
      {status && (
        <div
          className={`text-right text-sm mt-1 ${
            status.startsWith("Saved")
              ? "text-emerald-400"
              : status === "Error"
              ? "text-rose-400"
              : "text-slate-400"
          }`}
        >
          {status}
        </div>
      )}
    </div>
  );
}
