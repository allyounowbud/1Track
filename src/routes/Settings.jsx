import { useState, useEffect } from 'react'
import { useQuery } from '@tanstack/react-query'
import { NavLink, Link } from 'react-router-dom'
import { supabase } from '../lib/supabaseClient'

const tabBase = "inline-flex items-center justify-center h-10 px-4 rounded-xl border border-slate-800 bg-slate-900/60 text-slate-200 hover:bg-slate-900 transition"
const tabActive = "bg-indigo-600 text-white border-indigo-600 shadow hover:bg-indigo-600"
const actionBtn = "w-full sm:w-[92px] h-10 px-4 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-100"

// money helpers
const parseMoney = (v) => {
  const n = Number(String(v ?? '').replace(/[^0-9.\-]/g, ''))
  return isNaN(n) ? 0 : n
}
const moneyToCents = (v) => Math.round(parseMoney(v) * 100)
const centsToStr = (c) => (Number(c || 0) / 100).toString()

/* -------- queries -------- */
async function getItems() {
  const { data, error } = await supabase
    .from('items')
    .select('id, name, market_value_cents')
    .order('name', { ascending: true })
  if (error) throw error
  return data
}
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
    .select('id, name, default_fees_pct')
    .order('name', { ascending: true })
  if (error) throw error
  return data
}

export default function Settings() {
  const { data: items = [], refetch: refetchItems } = useQuery({ queryKey: ['items'],      queryFn: getItems })
  const { data: retailers = [], refetch: refetchRetailers } = useQuery({ queryKey: ['retailers'],  queryFn: getRetailers })
  const { data: markets = [], refetch: refetchMarkets } = useQuery({ queryKey: ['markets'],   queryFn: getMarkets })

  // current user (avatar/name)
  const [userInfo, setUserInfo] = useState({ avatar_url: '', username: '' })
  useEffect(() => {
    async function loadUser() {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return setUserInfo({ avatar_url: '', username: '' })
      const m = user.user_metadata || {}
      const username = m.user_name || m.preferred_username || m.full_name || m.name || user.email || 'Account'
      const avatar_url = m.avatar_url || m.picture || ''
      setUserInfo({ avatar_url, username })
    }
    loadUser()
    const { data: sub } = supabase.auth.onAuthStateChange((_e, session) => {
      const user = session?.user
      if (!user) return setUserInfo({ avatar_url: '', username: '' })
      const m = user.user_metadata || {}
      const username = m.user_name || m.preferred_username || m.full_name || m.name || user.email || 'Account'
      const avatar_url = m.avatar_url || m.picture || ''
      setUserInfo({ avatar_url, username })
    })
    return () => sub.subscription.unsubscribe()
  }, [])

  // collapsed by default
  const [openItems, setOpenItems] = useState(false)
  const [openRetailers, setOpenRetailers] = useState(false)
  const [openMarkets, setOpenMarkets] = useState(false)

  // temp rows when adding
  const [addingItem, setAddingItem] = useState(false)
  const [addingRetailer, setAddingRetailer] = useState(false)
  const [addingMarket, setAddingMarket] = useState(false)

  /* ----- CRUD: Items ----- */
  async function createItem(name, mvStr) {
    if (!name?.trim()) return false
    const market_value_cents = moneyToCents(mvStr)
    const { error } = await supabase.from('items').insert({ name: name.trim(), market_value_cents })
    if (!error) await refetchItems()
    return !error
  }
  async function updateItem(id, name, mvStr) {
    const market_value_cents = moneyToCents(mvStr)
    const { error } = await supabase.from('items').update({ name, market_value_cents }).eq('id', id)
    if (!error) await refetchItems()
    return !error
  }
  async function deleteItem(id) {
    if (!confirm('Delete this item?')) return
    const { error } = await supabase.from('items').delete().eq('id', id)
    if (error) alert(error.message); else await refetchItems()
  }

  /* ----- CRUD: Retailers ----- */
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

  /* ----- CRUD: Marketplaces ----- */
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

  async function signOut() {
    await supabase.auth.signOut()
    window.location.href = '/login'
  }

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100">
      <div className="max-w-6xl mx-auto p-4 sm:p-6">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <h1 className="text-3xl font-bold">OneTrack</h1>
          <div className="flex items-center gap-3">
            {userInfo.avatar_url ? (
              <img src={userInfo.avatar_url} alt="" className="h-8 w-8 rounded-full border border-slate-800 object-cover" />
            ) : (
              <div className="h-8 w-8 rounded-full bg-slate-800 grid place-items-center text-slate-300 text-xs">
                {(userInfo.username || 'U').slice(0,1).toUpperCase()}
              </div>
            )}
            <div className="hidden sm:block text-sm text-slate-300 max-w-[160px] truncate">
              {userInfo.username}
            </div>
            <Link
  to="/"
  className="h-10 px-4 inline-flex items-center justify-center leading-none
             rounded-xl border border-slate-800 bg-slate-900/60 hover:bg-slate-900
             text-slate-100 cursor-pointer"
>
  Dashboard
</Link>
          </div>
        </div>

        {/* Tabs */}
        <div className="flex flex-wrap items-center gap-2 mb-6">
          <NavLink to="/orders"  className={({isActive}) => `${tabBase} ${isActive ? tabActive : ''}`}>Order Book</NavLink>
          <NavLink to="/add" className={({isActive}) => `${tabBase} ${isActive ? tabActive : ''}`}>Quick Add</NavLink>
          <NavLink to="/sold" className={({isActive}) => `${tabBase} ${isActive ? tabActive : ''}`}>Mark as Sold</NavLink>
          <NavLink to="/stats" className={({isActive}) => `${tabBase} ${isActive ? tabActive : ''}`}>Stats</NavLink>
          <button className={tabBase}>Inventory</button>
          <button className={tabBase}>Flex</button>
          <NavLink to="/settings" className={({isActive}) => `${tabBase} ${isActive ? tabActive : ''}`}>Settings</NavLink>
        </div>

        {/* ---------- Items ---------- */}
        <div className="rounded-2xl border border-slate-800 bg-slate-900/60 backdrop-blur p-4 sm:p-6 shadow-[0_10px_30px_rgba(0,0,0,.35)] mb-6 overflow-hidden">
          <div className="flex flex-wrap items-center gap-3 justify-between">
            <div>
              <h2 className="text-lg font-semibold">Items</h2>
              <p className="text-xs text-slate-400">Total: {items.length}</p>
            </div>
            <div className="flex flex-col sm:flex-row gap-2 w-full sm:w-auto sm:justify-end">
              {openItems && !addingItem && (
                <button onClick={() => setAddingItem(true)} className={actionBtn}>Add</button>
              )}
              <button
                onClick={() => { const n = !openItems; setOpenItems(n); if (!n) setAddingItem(false) }}
                className={actionBtn}
              >
                {openItems ? 'Collapse' : 'Expand'}
              </button>
            </div>
          </div>

          {openItems && (
            <>
              {/* Column header */}
              <div className="hidden sm:grid sm:grid-cols-[1fr_160px_200px] gap-2 px-1 pt-4 pb-2 text-xs text-slate-400">
                <div>Item</div>
                <div>Market value ($)</div>
                <div className="text-right">Actions</div>
              </div>

              <div className="space-y-3">
                {addingItem && (
                  <ItemRow
                    isNew
                    onSave={async (name, mv) => {
                      const ok = await createItem(name, mv)
                      if (ok) setAddingItem(false)
                      return ok
                    }}
                    onDelete={() => setAddingItem(false)}
                  />
                )}
                {items.map(it => (
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
            </>
          )}
        </div>

        {/* ---------- Retailers ---------- */}
        <div className="rounded-2xl border border-slate-800 bg-slate-900/60 backdrop-blur p-4 sm:p-6 shadow-[0_10px_30px_rgba(0,0,0,.35)] mb-6 overflow-hidden">
          <div className="flex flex-wrap items-center gap-3 justify-between">
            <div>
              <h2 className="text-lg font-semibold">Retailers</h2>
              <p className="text-xs text-slate-400">Total: {retailers.length}</p>
            </div>
            <div className="flex flex-col sm:flex-row gap-2 w-full sm:w-auto sm:justify-end">
              {openRetailers && !addingRetailer && (
                <button onClick={() => setAddingRetailer(true)} className={actionBtn}>Add</button>
              )}
              <button
                onClick={() => { const n = !openRetailers; setOpenRetailers(n); if (!n) setAddingRetailer(false) }}
                className={actionBtn}
              >
                {openRetailers ? 'Collapse' : 'Expand'}
              </button>
            </div>
          </div>

          {openRetailers && (
            <>
              <div className="hidden sm:grid sm:grid-cols-[1fr_200px] gap-2 px-1 pt-4 pb-2 text-xs text-slate-400">
                <div>Retailer</div>
                <div className="text-right">Actions</div>
              </div>

              <div className="space-y-3">
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
            </>
          )}
        </div>

        {/* ---------- Marketplaces ---------- */}
        <div className="rounded-2xl border border-slate-800 bg-slate-900/60 backdrop-blur p-4 sm:p-6 shadow-[0_10px_30px_rgba(0,0,0,.35)] overflow-hidden">
          <div className="flex flex-wrap items-center gap-3 justify-between">
            <div>
              <h2 className="text-lg font-semibold">Marketplaces</h2>
              <p className="text-xs text-slate-400">Total: {markets.length}</p>
            </div>
            <div className="flex flex-col sm:flex-row gap-2 w-full sm:w-auto sm:justify-end">
              {openMarkets && !addingMarket && (
                <button onClick={() => setAddingMarket(true)} className={actionBtn}>Add</button>
              )}
              <button
                onClick={() => { const n = !openMarkets; setOpenMarkets(n); if (!n) setAddingMarket(false) }}
                className={actionBtn}
              >
                {openMarkets ? 'Collapse' : 'Expand'}
              </button>
            </div>
          </div>

          {openMarkets && (
            <>
              <div className="hidden sm:grid sm:grid-cols-[1fr_140px_200px] gap-2 px-1 pt-4 pb-2 text-xs text-slate-400">
                <div>Marketplace</div>
                <div>Fee %</div>
                <div className="text-right">Actions</div>
              </div>

              <div className="space-y-3">
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
            </>
          )}
        </div>
      </div>
    </div>
  )
}

/* ---------- Row components ---------- */

function ItemRow({ it, isNew=false, onSave, onDelete }) {
  const [name, setName] = useState(it?.name ?? '')
  const [mv, setMv] = useState(centsToStr(it?.market_value_cents ?? 0))
  const [status, setStatus] = useState('')

  async function handleSave() {
    setStatus('Saving…')
    const ok = await onSave(name, mv)
    setStatus(ok ? 'Saved ✓' : 'Error')
    if (ok) setTimeout(() => setStatus(''), 1500)
  }

  return (
    <div className="rounded-xl border border-slate-800 bg-slate-900/60 p-3 overflow-hidden">
      <div className="grid grid-cols-1 sm:grid-cols-[1fr_160px_auto] gap-2 items-center min-w-0">
        <input
          className="w-full min-w-0 bg-slate-900/60 border border-slate-800 rounded-lg px-3 py-2 text-slate-100"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Item name…"
        />
        <input
          className="w-full sm:w-[160px] bg-slate-900/60 border border-slate-800 rounded-lg px-3 py-2 text-slate-100"
          value={mv}
          onChange={(e) => setMv(e.target.value)}
          placeholder="e.g. 129.99"
        />
        <div className="flex flex-col sm:flex-row gap-2 sm:justify-end">
          <button onClick={handleSave} className="w-full sm:w-[92px] h-10 px-4 rounded-lg bg-slate-800 hover:bg-slate-700">Save</button>
          <button
            onClick={onDelete}
            className={`w-full sm:w-[92px] h-10 px-4 rounded-lg ${isNew ? 'bg-slate-700 hover:bg-slate-600' : 'bg-rose-600 hover:bg-rose-500 text-white'}`}
          >
            {isNew ? 'Cancel' : 'Delete'}
          </button>
        </div>
      </div>
      {status && (
        <div className={`text-right text-sm mt-1 ${status.startsWith('Saved') ? 'text-emerald-400' : status==='Error' ? 'text-rose-400' : 'text-slate-400'}`}>
          {status}
        </div>
      )}
    </div>
  )
}

function RetailerRow({ r, isNew=false, onSave, onDelete }) {
  const [name, setName] = useState(r?.name ?? '')
  const [status, setStatus] = useState('')

  async function handleSave() {
    setStatus('Saving…')
    const ok = await onSave(name)
    setStatus(ok ? 'Saved ✓' : 'Error')
    if (ok) setTimeout(() => setStatus(''), 1500)
  }

  return (
    <div className="rounded-xl border border-slate-800 bg-slate-900/60 p-3 overflow-hidden">
      <div className="grid grid-cols-1 sm:grid-cols-[1fr_auto] gap-2 items-center min-w-0">
        <input
          className="w-full min-w-0 bg-slate-900/60 border border-slate-800 rounded-lg px-3 py-2 text-slate-100"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Retailer name…"
        />
        <div className="flex flex-col sm:flex-row gap-2 sm:justify-end">
          <button onClick={handleSave} className="w-full sm:w-[92px] h-10 px-4 rounded-lg bg-slate-800 hover:bg-slate-700">Save</button>
          <button
            onClick={onDelete}
            className={`w-full sm:w-[92px] h-10 px-4 rounded-lg ${isNew ? 'bg-slate-700 hover:bg-slate-600' : 'bg-rose-600 hover:bg-rose-500 text-white'}`}
          >
            {isNew ? 'Cancel' : 'Delete'}
          </button>
        </div>
      </div>
      {status && (
        <div className={`text-right text-sm mt-1 ${status.startsWith('Saved') ? 'text-emerald-400' : status==='Error' ? 'text-rose-400' : 'text-slate-400'}`}>
          {status}
        </div>
      )}
    </div>
  )
}

function MarketRow({ m, isNew=false, onSave, onDelete }) {
  const [name, setName] = useState(m?.name ?? '')
  const [fee, setFee] = useState(((m?.default_fees_pct ?? 0) * 100).toString())
  const [status, setStatus] = useState('')

  async function handleSave() {
    setStatus('Saving…')
    const ok = await onSave(name, fee)
    setStatus(ok ? 'Saved ✓' : 'Error')
    if (ok) setTimeout(() => setStatus(''), 1500)
  }

  return (
    <div className="rounded-xl border border-slate-800 bg-slate-900/60 p-3 overflow-hidden">
      <div className="grid grid-cols-1 sm:grid-cols-[1fr_140px_auto] gap-2 items-center min-w-0">
        <input
          className="w-full min-w-0 bg-slate-900/60 border border-slate-800 rounded-lg px-3 py-2 text-slate-100"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Marketplace name…"
        />
        <input
          className="w-full sm:w-[140px] bg-slate-900/60 border border-slate-800 rounded-lg px-3 py-2 text-slate-100"
          value={fee}
          onChange={(e) => setFee(e.target.value)}
          placeholder="Fee %"
        />
        <div className="flex flex-col sm:flex-row gap-2 sm:justify-end">
          <button onClick={handleSave} className="w-full sm:w-[92px] h-10 px-4 rounded-lg bg-slate-800 hover:bg-slate-700">Save</button>
          <button
            onClick={onDelete}
            className={`w-full sm:w-[92px] h-10 px-4 rounded-lg ${isNew ? 'bg-slate-700 hover:bg-slate-600' : 'bg-rose-600 hover:bg-rose-500 text-white'}`}
          >
            {isNew ? 'Cancel' : 'Delete'}
          </button>
        </div>
      </div>
      {status && (
        <div className={`text-right text-sm mt-1 ${status.startsWith('Saved') ? 'text-emerald-400' : status==='Error' ? 'text-rose-400' : 'text-slate-400'}`}>
          {status}
        </div>
      )}
    </div>
  )
}