import { useEffect, useMemo, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { NavLink, Link } from 'react-router-dom' // <- you can remove NavLink/Link later if you want
import { supabase } from '../lib/supabaseClient'
import HeaderWithTabs from '../components/HeaderWithTabs.jsx' // <-- ADDED

/* ---------------- UI tokens to match the app ---------------- */
const tabBase =
  "inline-flex items-center justify-center h-10 px-4 rounded-xl border border-slate-800 bg-slate-900/60 text-slate-200 hover:bg-slate-900 transition"
const tabActive =
  "bg-indigo-600 text-white border-indigo-600 shadow hover:bg-indigo-600"
const card =
  "rounded-2xl border border-slate-800 bg-slate-900/60 backdrop-blur p-4 sm:p-6 shadow-[0_10px_30px_rgba(0,0,0,.35)]"
const inputSm =
  "h-10 text-sm w-full min-w-0 bg-slate-900/60 border border-slate-800 rounded-xl px-3 py-2 text-slate-100 placeholder-slate-400 focus:ring-2 focus:ring-indigo-500"
const btnSm  = "h-10 px-4 rounded-lg text-sm"

/* ---------------- helpers ---------------- */
const parseMoney = (v) => {
  const n = Number(String(v ?? '').replace(/[^0-9.\-]/g, ''))
  return isNaN(n) ? 0 : n
}
const moneyToCents = (v) => Math.round(parseMoney(v) * 100)
const centsToStr  = (c) => (Number(c || 0) / 100).toFixed(2)
const parsePct = (v) => {
  if (v === '' || v == null) return 0
  const n = Number(String(v).replace('%',''))
  if (isNaN(n)) return 0
  return n > 1 ? n / 100 : n
}

/* --------------- queries --------------- */
async function getOrders(limit=500){
  const { data, error } = await supabase
    .from('orders')
    .select('id, order_date, item, profile_name, retailer, marketplace, buy_price_cents, sale_price_cents, sale_date, fees_pct, shipping_cents, status')
    .order('order_date', { ascending:false })
    .limit(limit)
  if (error) throw error
  return data ?? []
}
async function getItems() {
  const { data, error } = await supabase.from('items').select('id, name').order('name', { ascending:true })
  if (error) throw error
  return data ?? []
}
async function getRetailers() {
  const { data, error } = await supabase.from('retailers').select('id, name').order('name', { ascending:true })
  if (error) throw error
  return data ?? []
}
async function getMarkets() {
  const { data, error } = await supabase.from('marketplaces').select('id, name, default_fees_pct').order('name', { ascending:true })
  if (error) throw error
  return data ?? []
}

/* ====================== PAGE ====================== */
export default function OrderBook(){
  const { data: orders=[], isLoading, error, refetch } = useQuery({ queryKey:['orders', 500], queryFn:() => getOrders(500) })
  const { data: items=[] }      = useQuery({ queryKey:['items'],      queryFn:getItems })
  const { data: retailers=[] }  = useQuery({ queryKey:['retailers'],  queryFn:getRetailers })
  const { data: markets=[] }    = useQuery({ queryKey:['markets'],    queryFn:getMarkets })

  /* current user (Discord avatar/name) */
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

  async function signOut(){
    await supabase.auth.signOut()
    window.location.href = '/login'
  }

  /* search */
  const [q, setQ] = useState('')
  const filtered = useMemo(() => {
    const t = (q || '').trim().toLowerCase()
    if (!t) return orders
    return orders.filter(o =>
      (o.item||'').toLowerCase().includes(t) ||
      (o.retailer||'').toLowerCase().includes(t) ||
      (o.marketplace||'').toLowerCase().includes(t) ||
      (o.profile_name||'').toLowerCase().includes(t)
    )
  }, [orders, q])

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100">
      <div className="max-w-6xl mx-auto p-4 sm:p-6">

        {/* ======= SHARED HEADER + TABS ======= */}
        <HeaderWithTabs />
        {/* ==================================== */}

        {/* Search + meta */}
        <div className={`${card} mb-6`}>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 items-end">
            <div className="sm:col-span-2">
              <label className="text-slate-300 mb-1 block text-sm">Search</label>
              <input
                value={q}
                onChange={(e)=>setQ(e.target.value)}
                placeholder="item / retailer / marketplace / profile…"
                className={inputSm}
              />
            </div>
            <div>
              <div className="text-slate-400 text-sm">Rows</div>
              <div className="text-xl font-semibold">{filtered.length}</div>
            </div>
          </div>
        </div>

        {/* Orders list */}
        {isLoading && <div className="text-slate-400">Loading…</div>}
        {error && <div className="text-rose-400">{String(error.message || error)}</div>}

        {/* Header labels (hide on small) */}
        <div className="hidden lg:flex text-xs text-slate-400 px-1 mb-1 gap-2">
          <div className="w-36">Order date</div>
          <div className="min-w-[240px] flex-1">Item</div>
          <div className="w-28">Profile</div>
          <div className="w-28">Retailer</div>
          <div className="w-24">Buy $</div>
          <div className="w-24">Sale $</div>
          <div className="w-36">Sale date</div>
          <div className="w-32">Marketplace</div>
          <div className="w-24">Ship $</div>
          <div className="w-20 text-right">Actions</div>
        </div>

        <div className="space-y-3">
          {filtered.map(o => (
            <OrderRow
              key={o.id}
              order={o}
              items={items}
              retailers={retailers}
              markets={markets}
              onSaved={refetch}
              onDeleted={refetch}
            />
          ))}
          {filtered.length === 0 && (
            <div className={`${card} text-slate-400`}>No orders found.</div>
          )}
        </div>
      </div>
    </div>
  )
}

/* ============== Row component ============== */
function OrderRow({ order, items, retailers, markets, onSaved, onDeleted }){
  const [order_date, setOrderDate]     = useState(order.order_date || '')
  const [item, setItem]                 = useState(order.item || '')
  const [profile_name, setProfile]      = useState(order.profile_name || '')
  const [retailer, setRetailer]         = useState(order.retailer || '')
  const [buyPrice, setBuyPrice]         = useState(centsToStr(order.buy_price_cents))
  const [salePrice, setSalePrice]       = useState(centsToStr(order.sale_price_cents))
  const [sale_date, setSaleDate]        = useState(order.sale_date || '')
  const [marketplace, setMarketplace]   = useState(order.marketplace || '')
  const [feesPct, setFeesPct]           = useState(((order.fees_pct ?? 0) * 100).toString())
  const [shipping, setShipping]         = useState(centsToStr(order.shipping_cents))

  const [busy, setBusy] = useState(false)
  const [msg, setMsg]   = useState('')

  function handleMarketplaceChange(name) {
    setMarketplace(name)
    const mk = markets.find(m => m.name === name)
    const current = Number(String(feesPct).replace('%','')) || 0
    if (mk && (!current || current === 0)) {
      setFeesPct(((mk.default_fees_pct ?? 0) * 100).toString())
    }
  }

  async function save(){
    setBusy(true); setMsg('')
    try{
      // derive status from current sale price (sold if > 0, else ordered)
      const statusValue = moneyToCents(salePrice) > 0 ? 'sold' : 'ordered'
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
        status: status || null,
      }
      const { error } = await supabase.from('orders').update(payload).eq('id', order.id)
      if (error) throw error
      setMsg('Saved ✓')
      onSaved && onSaved()
      setTimeout(()=>setMsg(''), 1500)
    } catch(err){
      setMsg(String(err.message || err))
    } finally {
      setBusy(false)
    }
  }

  async function del(){
    if (!confirm('Delete this order?')) return
    const { error } = await supabase.from('orders').delete().eq('id', order.id)
    if (error) alert(error.message)
    else onDeleted && onDeleted()
  }

  return (
    <div className="rounded-xl border border-slate-800 bg-slate-900/60 p-3">
      {/* One line on xl; wraps on small */}
      <div className="flex flex-wrap lg:flex-nowrap items-center gap-2">
        <input type="date" value={order_date} onChange={e=>setOrderDate(e.target.value)} className={`${inputSm} w-36`} />

        {/* Item dropdown (by name) */}
        <select
          value={item || ''}
          onChange={e=>setItem(e.target.value)}
          className={`${inputSm} min-w-[240px] flex-1`}
        >
          <option value=""></option>
          {items.map(it => <option key={it.id} value={it.name}>{it.name}</option>)}
        </select>

        <input value={profile_name} onChange={e=>setProfile(e.target.value)} placeholder="Profile" className={`${inputSm} w-28`} />

        {/* Retailer dropdown */}
        <select
          value={retailer || ''}
          onChange={e=>setRetailer(e.target.value)}
          className={`${inputSm} w-28`}
        >
          <option value=""></option>
          {retailers.map(r => <option key={r.id} value={r.name}>{r.name}</option>)}
        </select>

        <input value={buyPrice}  onChange={e=>setBuyPrice(e.target.value)}  placeholder="Buy"  className={`${inputSm} w-24`} />
        <input value={salePrice} onChange={e=>setSalePrice(e.target.value)} placeholder="Sale" className={`${inputSm} w-24`} />

        <input type="date" value={sale_date} onChange={e=>setSaleDate(e.target.value)} className={`${inputSm} w-36`} />

        {/* Marketplace dropdown */}
        <select
          value={marketplace || ''}
          onChange={e=>handleMarketplaceChange(e.target.value)}
          className={`${inputSm} w-32`}
        >
          <option value=""></option>
          {markets.map(m => <option key={m.id} value={m.name}>{m.name}</option>)}
        </select>
        <input value={shipping}  onChange={e=>setShipping(e.target.value)}  placeholder="Ship"  className={`${inputSm} w-24`} />

        <div className="ml-auto flex items-center gap-2">
  {/* Save (check) */}
  <button
    type="button"
    onClick={save}
    disabled={busy}
    aria-label={busy ? "Saving…" : "Save"}
    title={busy ? "Saving…" : "Save"}
    className={`inline-flex items-center justify-center h-9 w-9 rounded-lg
                ${busy ? 'bg-slate-700 text-slate-300 cursor-not-allowed' : 'bg-slate-800 hover:bg-slate-700 text-slate-100'}
                border border-slate-800 focus:outline-none focus:ring-2 focus:ring-indigo-500`}
  >
    {/* check icon */}
    <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M20 6L9 17l-5-5" />
    </svg>
  </button>

  {/* Delete (trash) */}
  <button
    type="button"
    onClick={del}
    aria-label="Delete"
    title="Delete"
    className="inline-flex items-center justify-center h-9 w-9 rounded-lg
               bg-rose-600 hover:bg-rose-500 text-white border border-rose-700
               focus:outline-none focus:ring-2 focus:ring-rose-500"
  >
    {/* trash icon */}
    <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M3 6h18" />
      <path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6" />
      <path d="M10 11v6M14 11v6" />
      <path d="M9 6V4a2 2 0 0 1 2-2h2a2 2 0 0 1 2 2v2" />
    </svg>
  </button>
</div>

      </div>

      {msg && (
        <div className={`text-right text-sm mt-1 ${msg.startsWith('Saved') ? 'text-emerald-400' : 'text-rose-400'}`}>
          {msg}
        </div>
      )}
    </div>
  )
}