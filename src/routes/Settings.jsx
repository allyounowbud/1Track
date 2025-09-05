// src/routes/Settings.jsx
import { useState, useEffect, useRef } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "../lib/supabaseClient";
import HeaderWithTabs from "../components/HeaderWithTabs.jsx";

/* ---------- UI tokens (match Order Book) ---------- */
const pageCard =
  "rounded-2xl border border-slate-800 bg-slate-900/60 backdrop-blur p-4 sm:p-6 shadow-[0_10px_30px_rgba(0,0,0,.35)]";
const rowCard =
  "rounded-xl border border-slate-800 bg-slate-900/60 p-3 overflow-hidden";
const inputSm =
  "h-10 text-sm w-full min-w-0 bg-slate-900/60 border border-slate-800 rounded-lg px-3 py-2 text-slate-100 placeholder-slate-400 focus:ring-2 focus:ring-indigo-500";

/* header buttons (same as Order Book) */
const headerIconBtn =
  "h-9 w-9 inline-flex items-center justify-center rounded-xl border border-slate-800 bg-slate-900/60 hover:bg-slate-900 text-slate-100";
const headerGhostBtn =
  "h-9 px-4 rounded-xl border border-slate-800 bg-slate-900/60 hover:bg-slate-900 text-slate-100";

/* small icon buttons used in rows (same as Order Book) */
const iconSave =
  "inline-flex items-center justify-center h-9 w-9 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-100 border border-slate-800 focus:outline-none focus:ring-2 focus:ring-indigo-500";
const iconSaveBusy =
  "inline-flex items-center justify-center h-9 w-9 rounded-lg bg-slate-700 text-slate-300 cursor-not-allowed border border-slate-800";
const iconDelete =
  "inline-flex items-center justify-center h-9 w-9 rounded-lg bg-rose-600 hover:bg-rose-500 text-white border border-rose-700 focus:outline-none focus:ring-2 focus:ring-rose-500";

/* ---------- money helpers ---------- */
const parseMoney = (v) => {
  const n = Number(String(v ?? "").replace(/[^0-9.\-]/g, ""));
  return isNaN(n) ? 0 : n;
};
const moneyToCents = (v) => Math.round(parseMoney(v) * 100);
const centsToStr = (c) => (Number(c || 0) / 100).toString();

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

/* --------- duplicate helpers for import --------- */
function normalizeTokens(str) {
  return new Set(
    String(str)
      .toLowerCase()
      .replace(/[^a-z0-9\s]/g, " ")
      .split(/\s+/)
      .filter((w) => w.length > 1)
  );
}
function isSubset(sub, sup) {
  for (const t of sub) if (!sup.has(t)) return false;
  return true;
}

/* --------- OCR → extract item titles + market prices --------- */
function extractProductsFromText(text) {
  // Parse line-by-line, look for "Market Price: $x.xx", pair with most recent title above it.
  const lines = String(text)
    .split(/\r?\n/)
    .map((s) => s.trim())
    .filter(Boolean);

  const found = [];
  for (let i = 0; i < lines.length; i++) {
    const m = lines[i].match(
      /market\s*price[:\s]*\$?\s*([0-9]+(?:\.[0-9]{2})?)/i
    );
    if (!m) continue;
    const priceStr = m[1];

    // find the nearest reasonable title upward
    let title = "";
    for (let j = i - 1; j >= 0; j--) {
      const L = lines[j];
      if (/^sv[:\s]/i.test(L)) continue; // "SV: Black Bolt"
      if (/listings?\s+from/i.test(L)) continue;
      if (/^\$?\d+(?:\.\d{2})?$/.test(L)) continue; // big price
      if (/market\s*price/i.test(L)) continue;
      if (/[a-z]/i.test(L) && L.length >= 3) {
        title = L;
        break;
      }
    }
    if (!title) continue;

    found.push({
      name: title,
      marketValue: parseMoney(priceStr),
    });
  }

  // de-dupe identical names within this import
  const seen = new Set();
  return found.filter((f) => {
    const key = f.name.toLowerCase();
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
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

  // current user (avatar/name)
  const [userInfo, setUserInfo] = useState({ avatar_url: "", username: "" });
  useEffect(() => {
    async function loadUser() {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) return setUserInfo({ avatar_url: "", username: "" });
      const m = user.user_metadata || {};
      const username =
        m.user_name ||
        m.preferred_username ||
        m.full_name ||
        m.name ||
        user.email ||
        "Account";
      const avatar_url = m.avatar_url || m.picture || "";
      setUserInfo({ avatar_url, username });
    }
    loadUser();
    const { data: sub } = supabase.auth.onAuthStateChange((_e, session) => {
      const user = session?.user;
      if (!user) return setUserInfo({ avatar_url: "", username: "" });
      const m = user.user_metadata || {};
      const username =
        m.user_name ||
        m.preferred_username ||
        m.full_name ||
        m.name ||
        user.email ||
        "Account";
      const avatar_url = m.avatar_url || m.picture || "";
      setUserInfo({ avatar_url, username });
    });
    return () => sub.subscription.unsubscribe();
  }, []);

  // collapsed by default
  const [openItems, setOpenItems] = useState(false);
  const [openRetailers, setOpenRetailers] = useState(false);
  const [openMarkets, setOpenMarkets] = useState(false);

  // temp rows when adding
  const [addingItem, setAddingItem] = useState(false);
  const [addingRetailer, setAddingRetailer] = useState(false);
  const [addingMarket, setAddingMarket] = useState(false);

  /* ---------- NEW: import-from-image state ---------- */
  const [importedItems, setImportedItems] = useState([]); // [{name, market_value_cents}]
  const [importWarnings, setImportWarnings] = useState([]);
  const [importing, setImporting] = useState(false);
  const fileInputRef = useRef(null);

  function askImportImage() {
    fileInputRef.current?.click();
  }

  async function handleImportImage(ev) {
    const file = ev.target.files?.[0];
    if (!file) return;
    setImportWarnings([]);
    setImporting(true);
    try {
      // lazy-load tesseract so it doesn't affect first paint
      const Tesseract = await import("tesseract.js");
      const { data } = await Tesseract.recognize(file, "eng");
      const found = extractProductsFromText(data.text);

      // build token sets for duplicate detection
      const existingTokens = items.map((i) => normalizeTokens(i.name));
      const stagedTokens = importedItems.map((i) => normalizeTokens(i.name));

      const next = [];
      const warns = [];
      for (const f of found) {
        const name = f.name.trim();
        const tokens = normalizeTokens(name);

        // duplicate if all words already contained in any existing/staged name
        let dup = false;
        for (let t of existingTokens) {
          if (isSubset(tokens, t)) {
            dup = true;
            break;
          }
        }
        if (!dup) {
          for (let t of stagedTokens) {
            if (isSubset(tokens, t)) {
              dup = true;
              break;
            }
          }
        }
        if (dup) {
          warns.push(`Skipped duplicate: "${name}"`);
          continue;
        }

        next.push({
          name,
          market_value_cents: Math.round((f.marketValue || 0) * 100),
        });
      }

      if (next.length) {
        if (!openItems) setOpenItems(true);
        setImportedItems((prev) => [...next, ...prev]);
      }
      if (warns.length) setImportWarnings(warns);
    } catch (err) {
      setImportWarnings([
        `Import failed: ${err?.message || String(err)}`,
      ]);
    } finally {
      setImporting(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  }

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
              <h2 className="text-lg font-semibold leading-[2.25rem]">Items</h2>
              <p className="text-xs text-slate-400 -mt-1">Total: {items.length}</p>
            </div>

            <div className="flex items-center gap-2 ml-auto self-center -mt-2 sm:mt-0">
              {/* hidden file input for image import */}
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                className="hidden"
                onChange={handleImportImage}
              />
              {openItems && (
                <button
                  onClick={askImportImage}
                  className={headerIconBtn}
                  aria-label={importing ? "Importing…" : "Import from image"}
                  title={importing ? "Importing…" : "Import from image"}
                  disabled={importing}
                >
                  {/* image/import icon */}
                  <svg
                    viewBox="0 0 24 24"
                    className="h-5 w-5"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  >
                    <path d="M4 7a2 2 0 0 1 2-2h2l1-2h6l1 2h2a2 2 0 0 1 2 2v10a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2z" />
                    <circle cx="12" cy="13" r="3" />
                  </svg>
                </button>
              )}
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
                  if (!n) {
                    setAddingItem(false);
                    setImportWarnings([]);
                  }
                }}
                className={headerGhostBtn}
              >
                {openItems ? "Collapse" : "Expand"}
              </button>
            </div>
          </div>

          {/* import warnings */}
          {!!importWarnings.length && openItems && (
            <div className="mt-3 rounded-lg border border-amber-600/50 bg-amber-500/10 text-amber-300 text-sm px-3 py-2">
              {importWarnings.map((w, i) => (
                <div key={i}>{w}</div>
              ))}
            </div>
          )}

          {openItems && (
            <div className="pt-5">
              <div className="hidden sm:grid sm:grid-cols-[1fr_160px_200px] gap-2 px-1 pb-2 text-xs text-slate-400">
                <div>Item</div>
                <div>Market value ($)</div>
                <div className="text-right">Actions</div>
              </div>

              <div className="space-y-3">
                {/* NEW: staged imported rows (unsaved) */}
                {importedItems.map((it, idx) => (
                  <ItemRow
                    key={`imp-${idx}-${it.name}`}
                    it={it}
                    isNew
                    onSave={async (name, mv) => {
                      const ok = await createItem(name, mv);
                      if (ok)
                        setImportedItems((prev) =>
                          prev.filter((_, i) => i !== idx)
                        );
                      return ok;
                    }}
                    onDelete={() =>
                      setImportedItems((prev) => prev.filter((_, i) => i !== idx))
                    }
                  />
                ))}

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
                {!items.length && !addingItem && !importedItems.length && (
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
