import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { NavLink } from 'react-router-dom'
import { supabase } from '../lib/supabaseClient'

const tabBase = "px-4 py-2 rounded-full border border-slate-800 bg-slate-900/60 hover:bg-slate-900"
const tabActive = "bg-indigo-600 text-white border-indigo-600"

async function getRetailers() {
  const { data, error } = await supabase
    .from('retailers')
    .select('id, name')
    .order('name', { ascending: true })
  if (error) throw error
  return data
}

async function getMarkets() {
  const { data, error } = await supabase
    .from('marketplaces')
    .select('id, name, default_fees_pct') // plural column in your DB
    .order('name', { ascending: true })
  if (error) throw error
  return data
}

export default function Settings() {
  const { data: retailers = [], refetch: refetchRetailers } =
    useQuery({ queryKey: ['retailers'], queryFn: getRetailers })
  const { data: markets = [], refetch: refetchMarkets } =
    useQuery({ queryKey: ['markets'], queryFn: getMarkets })

  // collapsed by default
  const [openRetailers, setOpenRetailers] = useState(false)
  const [openMarkets, setOpenMarkets] = useState(false)

  // show temp top row when adding
  const [addingRetailer, setAddingRetailer] = useState(false)
  const [addingMarket, setAddingMarket] = useState(false)

  // --- CRUD helpers ---
  async function createRetailer(name) {
    if (!name?.trim()) return false
    const { error } = await supabase.from('retailers').insert({ name: name.trim() })
    if (!error) await refetchRetailers()
    return !error
  }
  async function updateRetailer(id, name) {
    const { error } = await supabase.from('retailers').update({ name }).eq('id', id)
    if (!error) await refetchRetailers()
    return !error
  }
  async function deleteRetailer(id) {
    if (!confirm('Delete this retailer?')) return
    const { error } = await supabase.from('retailers').delete().eq('id', id)
    if (error) alert(error.message); else await refetchRetailers()
  }

  async function createMarket(name, feeStr) {
    const feeNum = Number(String(feeStr ?? '').replace('%',''))
    const default_fee_pct = isNaN(feeNum) ? 0 : (feeNum > 1 ? feeNum/100 : feeNum)
    if (!name?.trim()) return false
    const { error } = await supabase
      .from('marketplaces')
      .insert({ name: name.trim(), default_fees_pct: default_fee_pct })
    if (!error) await refetchMarkets()
    return !error
  }
  async function updateMarket(id, name, feeStr) {
    const feeNum = Number(String(feeStr ?? '').replace('%',''))
    const default_fee_pct = isNaN(feeNum) ? 0 : (feeNum > 1 ? feeNum/100 : feeNum)
    const { error } = await supabase
      .from('marketplaces')
      .update({ name, default_fees_pct: default_fee_pct })
      .eq('id', id)
    if (!error) await refetchMarkets()
    return !error
  }
  async function deleteMarket(id) {
    if (!confirm('Delete this marketplace?')) return
    const { error } = await supabase.from('marketplaces').delete().eq('id', id)
    if (error) alert(error.message); else await refetchMarkets()
  }

  const headerBtn = "px-4 py-2 rounded-xl border border-slate-700 bg-slate-800/60 hover:bg-slate-800"

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100">
      <div className="max-w-6xl mx-auto p-6">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <h1 className="text-3xl font-bold">OneTrack</h1>
          <div />
        </div>

        {/* Tabs */}
        <div className="flex flex-wrap gap-2 mb-6">
          <NavLink to="/app" className={({ isActive }) => `${tabBase} ${isActive ? tabActive : ''}`}>Quick Add</NavLink>
          <button className={tabBase}>Mark as Sold</button>
          <button className={tabBase}>Stats</button>
          <button className={tabBase}>Inventory</button>
          <button className={tabBase}>Flex</button>
          <NavLink to="/settings" className={({ isActive }) => `${tabBase} ${isActive ? tabActive : ''}`}>Settings</NavLink>
        </div>

        {/* Retailers */}
        <div className="rounded-2xl border border-slate-800 bg-slate-900/60 backdrop-blur p-6 shadow-[0_10px_30px_rgba(0,0,0,.35)] mb-6">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-lg font-semibold">Retailers</h2>
              <p className="text-xs text-slate-400">Rows: {retailers.length}</p>
            </div>
            <div className="flex gap-2">
              {openRetailers && !addingRetailer && (
                <button
                  onClick={() => { setAddingRetailer(true) }}
                  className={`${headerBtn} border-indigo-700/50`}
                >
                  Add
                </button>
              )}
              <button
                onClick={() => {
                  const next = !openRetailers
                  setOpenRetailers(next)
                  if (!next) setAddingRetailer(false)
                }}
                className={headerBtn}
              >
                {openRetailers ? 'Collapse' : 'Expand'}
              </button>
            </div>
          </div>

          {openRetailers && (
            <div className="mt-4 space-y-2">
              {addingRetailer && (
                <RetailerRow
                  isNew
                  onSave={async (name) => {
                    const ok = await createRetailer(name)
                    if (ok) setAddingRetailer(false)
                    return ok
                  }}
                  onDelete={() => setAddingRetailer(false)}
                />
              )}
              {retailers.map(r => (
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
          )}
        </div>

        {/* Marketplaces */}
        <div className="rounded-2xl border border-slate-800 bg-slate-900/60 backdrop-blur p-6 shadow-[0_10px_30px_rgba(0,0,0,.35)]">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-lg font-semibold">Sale Platforms</h2>
              <p className="text-xs text-slate-400">Rows: {markets.length}</p>
            </div>
            <div className="flex gap-2">
              {openMarkets && !addingMarket && (
                <button
                  onClick={() => { setAddingMarket(true) }}
                  className={`${headerBtn} border-indigo-700/50`}
                >
                  Add
                </button>
              )}
              <button
                onClick={() => {
                  const next = !openMarkets
                  setOpenMarkets(next)
                  if (!next) setAddingMarket(false)
                }}
                className={headerBtn}
              >
                {openMarkets ? 'Collapse' : 'Expand'}
              </button>
            </div>
          </div>

          {openMarkets && (
            <div className="mt-4 space-y-2">
              {addingMarket && (
                <MarketRow
                  isNew
                  onSave={async (name, fee) => {
                    const ok = await createMarket(name, fee)
                    if (ok) setAddingMarket(false)
                    return ok
                  }}
                  onDelete={() => setAddingMarket(false)}
                />
              )}
              {markets.map(m => (
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
          )}
        </div>
      </div>
    </div>
  )
}

/* ---------- Row components ---------- */

function RetailerRow({ r, isNew = false, onSave, onDelete }) {
  const [name, setName] = useState(r?.name ?? '')
  const [status, setStatus] = useState('') // '', 'Saving…', 'Saved ✓', 'Error'

  async function handleSave() {
    setStatus('Saving…')
    const ok = await onSave(name)
    setStatus(ok ? 'Saved ✓' : 'Error')
    if (ok) setTimeout(() => setStatus(''), 1500)
  }

  // Consistent alignment: input (grow), actions (fixed width), status (fills rest)
  return (
    <div className="grid grid-cols-1 sm:grid-cols-[1fr_200px_minmax(120px,1fr)] gap-2 items-center rounded-xl border border-slate-800 bg-slate-900/60 p-3">
      <input
        className="bg-slate-900/60 border border-slate-800 rounded-lg px-3 py-2 text-slate-100"
        value={name}
        onChange={(e) => setName(e.target.value)}
        placeholder="Retailer name…"
      />
      <div className="flex gap-2 justify-end w-[200px]">
        <button onClick={handleSave} className="px-4 py-2 rounded-lg bg-slate-800 hover:bg-slate-700 w-[92px]">Save</button>
        <button
          onClick={onDelete}
          className={`px-4 py-2 rounded-lg ${isNew ? 'bg-slate-700 hover:bg-slate-600' : 'bg-rose-600 hover:bg-rose-500 text-white'} w-[92px]`}
        >
          {isNew ? 'Cancel' : 'Delete'}
        </button>
      </div>
      {status && (
        <span className={`text-sm ${status.startsWith('Saved') ? 'text-emerald-400' : status === 'Error' ? 'text-rose-400' : 'text-slate-400'}`}>
          {status}
        </span>
      )}
    </div>
  )
}

function MarketRow({ m, isNew = false, onSave, onDelete }) {
  const [name, setName] = useState(m?.name ?? '')
  const [fee, setFee] = useState(((m?.default_fees_pct ?? 0) * 100).toString())
  const [status, setStatus] = useState('')

  async function handleSave() {
    setStatus('Saving…')
    const ok = await onSave(name, fee)
    setStatus(ok ? 'Saved ✓' : 'Error')
    if (ok) setTimeout(() => setStatus(''), 1500)
  }

  // Full-width layout: Marketplace (1fr) | Fee (fixed) | Actions (fixed) | Status (flex)
  return (
    <div className="grid grid-cols-1 sm:grid-cols-[1fr_140px_200px_minmax(120px,1fr)] gap-2 items-center rounded-xl border border-slate-800 bg-slate-900/60 p-3">
      <input
        className="bg-slate-900/60 border border-slate-800 rounded-lg px-3 py-2 text-slate-100"
        value={name}
        onChange={(e) => setName(e.target.value)}
        placeholder="Marketplace name…"
      />
      <input
        className="bg-slate-900/60 border border-slate-800 rounded-lg px-3 py-2 text-slate-100"
        value={fee}
        onChange={(e) => setFee(e.target.value)}
        placeholder="Fee % (e.g. 9 or 9%)"
      />
      <div className="flex gap-2 justify-end w-[200px]">
        <button onClick={handleSave} className="px-4 py-2 rounded-lg bg-slate-800 hover:bg-slate-700 w-[92px]">Save</button>
        <button
          onClick={onDelete}
          className={`px-4 py-2 rounded-lg ${isNew ? 'bg-slate-700 hover:bg-slate-600' : 'bg-rose-600 hover:bg-rose-500 text-white'} w-[92px]`}
        >
          {isNew ? 'Cancel' : 'Delete'}
        </button>
      </div>
      {status && (
        <span className={`text-sm ${status.startsWith('Saved') ? 'text-emerald-400' : status === 'Error' ? 'text-rose-400' : 'text-slate-400'}`}>
          {status}
        </span>
      )}
    </div>
  )
}