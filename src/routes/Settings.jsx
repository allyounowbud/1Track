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
    .select('id, name, default_fees_pct') // <-- plural from your DB
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

  // Local form state
  const [rName, setRName] = useState('')
  const [mName, setMName] = useState('')
  const [mFee, setMFee] = useState('0')

  async function addRetailer(e) {
    e.preventDefault()
    if (!rName.trim()) return
    const { error } = await supabase.from('retailers').insert({ name: rName.trim() })
    if (error && error.code !== '23505') alert(error.message)
    setRName('')
    await refetchRetailers()
  }

  async function addMarket(e) {
    e.preventDefault()
    if (!mName.trim()) return
    const feeNum = Number(String(mFee).replace('%', ''))
    const default_fee_pct = isNaN(feeNum) ? 0 : (feeNum > 1 ? feeNum / 100 : feeNum)
    const { error } = await supabase
      .from('marketplaces')
      .insert({ name: mName.trim(), default_fees_pct: default_fee_pct })
    if (error && error.code !== '23505') alert(error.message)
    setMName(''); setMFee('0')
    await refetchMarkets()
  }

  // Return boolean so rows can show Saved/Error
  async function saveRetailer(id, name) {
    const { error } = await supabase.from('retailers').update({ name }).eq('id', id)
    if (!error) await refetchRetailers()
    return !error
  }
  async function deleteRetailer(id) {
    if (!confirm('Delete this retailer?')) return
    const { error } = await supabase.from('retailers').delete().eq('id', id)
    if (error) alert(error.message); else await refetchRetailers()
  }

  async function saveMarket(id, name, feeStr) {
    const feeNum = Number(String(feeStr).replace('%', ''))
    const default_fee_pct = isNaN(feeNum) ? 0 : (feeNum > 1 ? feeNum / 100 : feeNum)
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

        {/* Retailers card */}
        <div className="rounded-2xl border border-slate-800 bg-slate-900/60 backdrop-blur p-6 shadow-[0_10px_30px_rgba(0,0,0,.35)] mb-6">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-lg font-semibold">Retailers</h2>
              <p className="text-xs text-slate-400">Rows: {retailers.length}</p>
            </div>
            <button
              onClick={() => setOpenRetailers(v => !v)}
              className="px-4 py-2 rounded-xl border border-slate-700 bg-slate-800/60 hover:bg-slate-800"
            >
              {openRetailers ? 'Collapse' : 'Expand'}
            </button>
          </div>

          {openRetailers && (
            <>
              <form onSubmit={addRetailer} className="flex gap-2 my-4">
                <input
                  className="flex-1 bg-slate-900/60 border border-slate-800 rounded-xl px-4 py-3 text-slate-100"
                  placeholder="Add retailer…" value={rName} onChange={(e) => setRName(e.target.value)}
                />
                <button className="px-4 py-3 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white">Add</button>
              </form>

              <div className="space-y-2">
                {retailers.map(r => (
                  <RetailerRow key={r.id} r={r} onSave={saveRetailer} onDelete={deleteRetailer} />
                ))}
                {!retailers.length && <div className="text-slate-400">No retailers yet.</div>}
              </div>
            </>
          )}
        </div>

        {/* Marketplaces card */}
        <div className="rounded-2xl border border-slate-800 bg-slate-900/60 backdrop-blur p-6 shadow-[0_10px_30px_rgba(0,0,0,.35)]">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-lg font-semibold">Sale Platforms</h2>
              <p className="text-xs text-slate-400">Rows: {markets.length}</p>
            </div>
            <button
              onClick={() => setOpenMarkets(v => !v)}
              className="px-4 py-2 rounded-xl border border-slate-700 bg-slate-800/60 hover:bg-slate-800"
            >
              {openMarkets ? 'Collapse' : 'Expand'}
            </button>
          </div>

          {openMarkets && (
            <>
              <form onSubmit={addMarket} className="grid grid-cols-1 sm:grid-cols-3 gap-2 my-4">
                <input
                  className="bg-slate-900/60 border border-slate-800 rounded-xl px-4 py-3 text-slate-100"
                  placeholder="Marketplace name…" value={mName} onChange={(e) => setMName(e.target.value)}
                />
                <input
                  className="bg-slate-900/60 border border-slate-800 rounded-xl px-4 py-3 text-slate-100"
                  placeholder="Default fee % (e.g. 9 or 9%)" value={mFee} onChange={(e) => setMFee(e.target.value)}
                />
                <button className="px-4 py-3 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white">Add</button>
              </form>

              <div className="space-y-2">
                {markets.map(m => (
                  <MarketRow key={m.id} m={m} onSave={saveMarket} onDelete={deleteMarket} />
                ))}
                {!markets.length && <div className="text-slate-400">No marketplaces yet.</div>}
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  )
}

function RetailerRow({ r, onSave, onDelete }) {
  const [name, setName] = useState(r.name)
  const [status, setStatus] = useState('') // '', 'Saving…', 'Saved ✓', 'Error'
  async function handleSave() {
    setStatus('Saving…')
    const ok = await onSave(r.id, name)
    setStatus(ok ? 'Saved ✓' : 'Error')
    if (ok) setTimeout(() => setStatus(''), 1500)
  }
  return (
    <div className="flex gap-2 items-center rounded-xl border border-slate-800 bg-slate-900/60 p-3">
      <input
        className="flex-1 bg-slate-900/60 border border-slate-800 rounded-lg px-3 py-2 text-slate-100"
        value={name} onChange={(e) => setName(e.target.value)}
      />
      <button onClick={handleSave} className="px-3 py-2 rounded-lg bg-slate-800 hover:bg-slate-700">Save</button>
      <button onClick={() => onDelete(r.id)} className="px-3 py-2 rounded-lg bg-rose-600 hover:bg-rose-500 text-white">Delete</button>
      {status && (
        <span className={`ml-2 text-sm ${status.startsWith('Saved') ? 'text-emerald-400' : status==='Error' ? 'text-rose-400' : 'text-slate-400'}`}>
          {status}
        </span>
      )}
    </div>
  )
}

function MarketRow({ m, onSave, onDelete }) {
  const [name, setName] = useState(m.name)
  const [fee, setFee] = useState(((m.default_fees_pct ?? 0) * 100).toString())
  const [status, setStatus] = useState('')
  async function handleSave() {
    setStatus('Saving…')
    const ok = await onSave(m.id, name, fee)
    setStatus(ok ? 'Saved ✓' : 'Error')
    if (ok) setTimeout(() => setStatus(''), 1500)
  }
  return (
    <div className="grid grid-cols-1 sm:grid-cols-[1fr_180px_auto_minmax(0,1fr)] gap-2 items-center rounded-xl border border-slate-800 bg-slate-900/60 p-3">
      <input
        className="bg-slate-900/60 border border-slate-800 rounded-lg px-3 py-2 text-slate-100"
        value={name} onChange={(e) => setName(e.target.value)}
      />
      <input
        className="bg-slate-900/60 border border-slate-800 rounded-lg px-3 py-2 text-slate-100"
        value={fee} onChange={(e) => setFee(e.target.value)} placeholder="Fee %"
      />
      <div className="flex gap-2">
        <button onClick={handleSave} className="px-3 py-2 rounded-lg bg-slate-800 hover:bg-slate-700">Save</button>
        <button onClick={() => onDelete(m.id)} className="px-3 py-2 rounded-lg bg-rose-600 hover:bg-rose-500 text-white">Delete</button>
      </div>
      {status && (
        <span className={`text-sm ${status.startsWith('Saved') ? 'text-emerald-400' : status==='Error' ? 'text-rose-400' : 'text-slate-400'}`}>
          {status}
        </span>
      )}
    </div>
  )
}