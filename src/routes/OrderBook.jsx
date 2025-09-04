import { useEffect, useMemo, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { NavLink } from 'react-router-dom'
import { supabase } from '../lib/supabaseClient'

/* ---------------- UI tokens to match the app ---------------- */
const tabBase =
  "inline-flex items-center justify-center h-10 px-4 rounded-xl border border-slate-800 bg-slate-900/60 text-slate-200 hover:bg-slate-900 transition"
const tabActive =
  "bg-indigo-600 text-white border-indigo-600 shadow hover:bg-indigo-600"
const card =
  "rounded-2xl border border-slate-800 bg-slate-900/60 backdrop-blur p-4 sm:p-6 shadow-[0_10px_30px_rgba(0,0,0,.35)]"
const inputBase =
  "w-full min-w-0 bg-slate-900/60 border border-slate-800 rounded-xl px-3 py-2 text-slate-100 placeholder-slate-400 focus:ring-2 focus:ring-indigo-500"
const actionBtn = "w-[92px] px-4 py-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-100"

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

/* ====================== PAGE ====================== */
export default function OrderBook(){
  const { data: orders=[], isLoading, error, refetch } = useQuery({ queryKey:['orders', 500], queryFn:() => getOrders(500) })

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
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <h1 className="text-3xl font-bold">OneTrack</h1>
          <div className="flex items-center gap-3">
            {userInfo.avatar_url ? (
              <img src={userInfo.avatar_url} alt="" className="h-8 w-8 rounded-full border border-slate-800 object-cover"/>
            ) : (
              <div className="h-8 w-8 rounded-full bg-slate-800 grid place-items-center text-slate-300 text-xs">
                {(userInfo.username || 'U').slice(0,1).toUpperCase()}
              </div>
            )}
            <div className="hidden sm:block text-sm text-slate-300 max-w-[160px] truncate">{userInfo.username}</div>
            <button onClick={signOut} className="px-4 h-10 rounded-xl border border-slate-800 bg-slate-900/60 hover:bg-slate-900">Sign out</button>
          </div>
        </div>

        {/* Tabs */}
        <div className="flex flex-wrap items-center gap-2 mb-6">
          <NavLink to="/app"     className={({isActive}) => `${tabBase} ${isActive ? tabActive : ''}`}>Quick Add</NavLink>
          <NavLink to="/sold"    className={({isActive}) => `${tabBase} ${isActive ? tabActive : ''}`}>Mark as Sold</NavLink>
          <NavLink to="/stats"   className={({isActive}) => `${tabBase} ${isActive ? tabActive : ''}`}>Stats</NavLink>
          <NavLink to="/orders"  className={({isActive}) => `${tabBase} ${isActive ? tabActive : ''}`}>Order Book</NavLink>
          <button className={tabBase}>Inventory</button>
          <button className={tabBase}>Flex</button>
          <NavLink to="/settings" className={({isActive}) => `${tabBase} ${isActive ? tabActive : ''}`}>Settings</NavLink>
        </div>

        {/* Search + meta */}
        <div className={`${card} mb-6`}>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 items-end">
            <div className="sm:col-span-2">
              <label className="text-slate-300 mb-1 block text-sm">Search</label>
              <input
                value={q}
                onChange={(e)=>setQ(e.target.value)}
                placeholder="item / retailer / marketplace / profile…"
                className={inputBase}
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

        <div className="space-y-3">
          {/* column headers (hide on mobile) */}
          <div className="hidden lg:grid grid-cols-12 gap-2 text-xs text-slate-400 px-1">
            <div className="col-span-2">Order date</div>
            <div className="col-span-3">Item</div>
            <div>Profile</div>
            <div>Retailer</div>
            <div>Buy $</div>
            <div>Sale $</div>
            <div>Sale date</div>
            <div>Marketplace</div>
            <div>Fee %</div>
            <div>Ship $</div>
            <div className="text-right">Actions</div>
          </div>

          {filtered.map(o => (
            <OrderRow key={o.id} order={o} onSaved={refetch} onDeleted={refetch} />
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
function OrderRow({ order, onSaved, onDeleted }){
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
  const [status, setStatus]             = useState(order.status || (Number(order.sale_price_cents) > 0 ? 'sold' : 'ordered'))

  const [busy, setBusy] = useState(false)
  const [msg, setMsg]   = useState('')

  async function save(){
    setBusy(true); setMsg('')
    try{
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
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-2">
        <input type="date"   value={order_date} onChange={e=>setOrderDate(e.target.value)} className={`${inputBase} lg:col-span-2`} />
        <input              value={item}        onChange={e=>setItem(e.target.value)}       placeholder="Item"          className={`${inputBase} lg:col-span-3`} />
        <input              value={profile_name}onChange={e=>setProfile(e.target.value)}    placeholder="Profile"       className={`${inputBase} lg:col-span-1`} />
        <input              value={retailer}    onChange={e=>setRetailer(e.target.value)}    placeholder="Retailer"      className={`${inputBase} lg:col-span-1`} />
        <input              value={buyPrice}    onChange={e=>setBuyPrice(e.target.value)}    placeholder="Buy $"         className={`${inputBase} lg:col-span-1`} />
        <input              value={salePrice}   onChange={e=>setSalePrice(e.target.value)}   placeholder="Sale $"        className={`${inputBase} lg:col-span-1`} />
        <input type="date"  value={sale_date}   onChange={e=>setSaleDate(e.target.value)}    className={`${inputBase} lg:col-span-1`} />
        <input              value={marketplace} onChange={e=>setMarketplace(e.target.value)} placeholder="Marketplace"   className={`${inputBase} lg:col-span-1`} />
        <input              value={feesPct}     onChange={e=>setFeesPct(e.target.value)}     placeholder="Fee %"         className={`${inputBase} lg:col-span-1`} />
        <input              value={shipping}    onChange={e=>setShipping(e.target.value)}    placeholder="Ship $"        className={`${inputBase} lg:col-span-1`} />

        <div className="flex items-center gap-2 lg:col-span-1">
          <select value={status} onChange={e=>setStatus(e.target.value)} className={`${inputBase}`}>
            <option value="ordered">ordered</option>
            <option value="sold">sold</option>
            <option value="cancelled">cancelled</option>
          </select>
        </div>

        <div className="flex gap-2 justify-end lg:col-span-12">
          <button onClick={save} disabled={busy} className={actionBtn}>{busy ? 'Saving…' : 'Save'}</button>
          <button onClick={del}  className="w-[92px] px-4 py-2 rounded-lg bg-rose-600 hover:bg-rose-500 text-white">Delete</button>
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
