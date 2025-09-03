import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { NavLink } from 'react-router-dom'
import { supabase } from '../lib/supabaseClient'

/* ---------- helpers ---------- */
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

/* ---------- queries ---------- */
async function getOrders() {
  const { data, error } = await supabase
    .from('orders')
    .select('id, order_date, item, profile_name, retailer, marketplace, buy_price_cents, sale_price_cents, sale_date, fees_pct, shipping_cents, pl_cents, status')
    .order('order_date', { ascending: false })
    .limit(25)
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

async function getMarketplaces() {
  const { data, error } = await supabase
    .from('marketplaces')
    .select('id, name, default_fee_pct')
    .order('name', { ascending: true })
  if (error) throw error
  return data
}

export default function Dashboard() {
  const { data: orders, isLoading, error, refetch } = useQuery({ queryKey:['orders'], queryFn:getOrders })
  const { data: retailers = [] } = useQuery({ queryKey:['retailers'], queryFn:getRetailers })
  const { data: markets = [] } = useQuery({ queryKey:['markets'],  queryFn:getMarketplaces })

  // ---- Quick Add form state ----
  const today = new Date().toISOString().slice(0,10)
  const [orderDate, setOrderDate]   = useState(today)
  const [item, setItem]             = useState('')
  const [profileName, setProfile]   = useState('')   // optional
  const [retailerId, setRetailerId] = useState('')
  const [retailerName, setRetailerName] = useState('')

  const [qty, setQty]               = useState(1)
  const [buyPrice, setBuyPrice]     = useState('')

  const [salePrice, setSalePrice]   = useState('')
  const [saleDate, setSaleDate]     = useState('')
  const [marketId, setMarketId]     = useState('')
  const [marketName, setMarketName] = useState('')
  const [feesPct, setFeesPct]       = useState('0')
  const [feesLocked, setFeesLocked] = useState(false)
  const [shipping, setShipping]     = useState('0')

  const [saving, setSaving] = useState(false)
  const [msg, setMsg] = useState('')

  /* ---------- save rows (multi-qty split) ---------- */
  async function saveOrder(e){
    e.preventDefault()
    setSaving(true); setMsg('')
    try {
      const n = Math.max(1, parseInt(qty || '1', 10))
      const buyTotal  = Math.abs(moneyToCents(buyPrice))
      const saleTotal = moneyToCents(salePrice)
      const shipTotal = moneyToCents(shipping)

      // Per-unit values (rounded to cents)
      const perBuy  = Math.round(buyTotal  / n)
      const perSale = Math.round(saleTotal / n)
      const perShip = Math.round(shipTotal / n)

      const status = perSale > 0 ? 'sold' : 'ordered'
      const fee = parsePct(feesPct)

      const base = {
        order_date: orderDate,
        item,
        profile_name: profileName || null,
        retailer: retailerName || null,
        marketplace: marketName || null,
        sale_date: saleDate || null,
        fees_pct: fee,
        status,
      }

      const rows = Array.from({ length: n }, () => ({
        ...base,
        buy_price_cents: perBuy,
        sale_price_cents: perSale,
        shipping_cents: perShip,
      }))

      const { error } = await supabase.from('orders').insert(rows)
      if (error) throw error

      setMsg(`Saved ✔ (${n} row${n>1?'s':''})`)
      // reset form
      setItem(''); setProfile(''); setRetailerId(''); setRetailerName('')
      setQty(1); setBuyPrice(''); setSalePrice(''); setSaleDate('')
      // keep marketplace selection/fee if you want; for now we reset
      setMarketId(''); setMarketName(''); setFeesPct('0'); setFeesLocked(false)
      setShipping('0')
      await refetch()
    } catch (err) {
      setMsg(String(err.message || err))
    } finally {
      setSaving(false)
    }
  }

  /* ---------- sign out ---------- */
  async function signOut(){
    await supabase.auth.signOut()
    window.location.href = '/login'
  }

  /* ---------- UI ---------- */
  const tabBase = "px-4 py-2 rounded-full border border-slate-800 bg-slate-900/60 hover:bg-slate-900"
  const tabActive = "bg-indigo-600 text-white border-indigo-600"

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100">
      <div className="max-w-6xl mx-auto p-6">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <h1 className="text-3xl font-bold">OneTrack</h1>
          <button onClick={signOut} className="px-4 py-2 rounded-xl border border-slate-800 bg-slate-900/60 hover:bg-slate-900">
            Sign out
          </button>
        </div>

        {/* Tabs */}
        <div className="flex flex-wrap gap-2 mb-6">
          <NavLink to="/app" className={({isActive}) => `${tabBase} ${isActive ? tabActive : ''}`}>Quick Add</NavLink>
          <button className={tabBase}>Mark as Sold</button>
          <button className={tabBase}>Stats</button>
          <button className={tabBase}>Inventory</button>
          <button className={tabBase}>Flex</button>
          <NavLink to="/settings" className={({isActive}) => `${tabBase} ${isActive ? tabActive : ''}`}>Settings</NavLink>
        </div>

        {/* QUICK ADD */}
        <form onSubmit={saveOrder} className="space-y-6">
          {/* Order details */}
          <div className="rounded-2xl border border-slate-800 bg-slate-900/60 backdrop-blur p-6 shadow-[0_10px_30px_rgba(0,0,0,.35)]">
            <h2 className="text-lg font-semibold mb-4">Order details</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="text-slate-300 mb-1 block text-sm">Order Date</label>
                <input type="date" value={orderDate} onChange={e=>setOrderDate(e.target.value)}
                  className="w-full bg-slate-900/60 border border-slate-800 rounded-xl px-4 py-3 text-slate-100 focus:ring-2 focus:ring-indigo-500"/>
              </div>

              <div>
                <label className="text-slate-300 mb-1 block text-sm">Item</label>
                <input value={item} onChange={e=>setItem(e.target.value)} placeholder="Start typing…"
                  className="w-full bg-slate-900/60 border border-slate-800 rounded-xl px-4 py-3 text-slate-100 placeholder-slate-400 focus:ring-2 focus:ring-indigo-500"/>
              </div>

              <div>
                <label className="text-slate-300 mb-1 block text-sm">Profile name (optional)</label>
                <input value={profileName} onChange={e=>setProfile(e.target.value)} placeholder="name / Testing 1"
                  className="w-full bg-slate-900/60 border border-slate-800 rounded-xl px-4 py-3 text-slate-100 focus:ring-2 focus:ring-indigo-500"/>
              </div>

              <div>
                <label className="text-slate-300 mb-1 block text-sm">Retailer</label>
                <select
                  value={retailerId}
                  onChange={e=>{
                    const id = e.target.value
                    setRetailerId(id)
                    const r = retailers.find(x=>x.id===id)
                    setRetailerName(r?.name || '')
                  }}
                  className="w-full bg-slate-900/60 border border-slate-800 rounded-xl px-4 py-3 text-slate-100 focus:ring-2 focus:ring-indigo-500"
                >
                  <option value="">— Select retailer —</option>
                  {retailers.map(r => <option key={r.id} value={r.id}>{r.name}</option>)}
                </select>
                {!retailers.length && (
                  <p className="text-xs text-slate-400 mt-1">No retailers yet. Add some in <NavLink className="underline" to="/settings">Settings</NavLink>.</p>
                )}
              </div>

              <div>
                <label className="text-slate-300 mb-1 block text-sm">Quantity</label>
                <input type="number" min={1} value={qty} onChange={e=>setQty(parseInt(e.target.value || '1',10))}
                  className="w-full bg-slate-900/60 border border-slate-800 rounded-xl px-4 py-3 text-slate-100 focus:ring-2 focus:ring-indigo-500"/>
                <p className="text-xs text-slate-500 mt-1">We’ll insert that many rows and split totals equally.</p>
              </div>

              <div>
                <label className="text-slate-300 mb-1 block text-sm">Buy Price (total)</label>
                <input value={buyPrice} onChange={e=>setBuyPrice(e.target.value)} placeholder="e.g. 67.70"
                  className="w-full bg-slate-900/60 border border-slate-800 rounded-xl px-4 py-3 text-slate-100 placeholder-slate-400 focus:ring-2 focus:ring-indigo-500"/>
              </div>
            </div>
          </div>

          {/* Sale details */}
          <div className="rounded-2xl border border-slate-800 bg-slate-900/60 backdrop-blur p-6 shadow-[0_10px_30px_rgba(0,0,0,.35)]">
            <h2 className="text-lg font-semibold mb-4">Sale details (optional — for already-sold items)</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="text-slate-300 mb-1 block text-sm">Sale Date</label>
                <input type="date" value={saleDate} onChange={e=>setSaleDate(e.target.value)}
                  className="w-full bg-slate-900/60 border border-slate-800 rounded-xl px-4 py-3 text-slate-100 focus:ring-2 focus:ring-indigo-500"/>
              </div>

              <div>
                <label className="text-slate-300 mb-1 block text-sm">Sale Location / Marketplace</label>
                <select
                  value={marketId}
                  onChange={e=>{
                    const id = e.target.value
                    const m = markets.find(x=>x.id===id)
                    setMarketId(id)
                    setMarketName(m?.name || '')
                    if (m) {
                      setFeesPct((m.default_fee_pct ?? 0).toString())
                      setFeesLocked(true)
                    } else {
                      setFeesPct('0'); setFeesLocked(false)
                    }
                  }}
                  className="w-full bg-slate-900/60 border border-slate-800 rounded-xl px-4 py-3 text-slate-100 focus:ring-2 focus:ring-indigo-500"
                >
                  <option value="">— Select marketplace —</option>
                  {markets.map(m => <option key={m.id} value={m.id}>{m.name}</option>)}
                </select>
                {!markets.length && (
                  <p className="text-xs text-slate-400 mt-1">No marketplaces yet. Add some in <NavLink className="underline" to="/settings">Settings</NavLink>.</p>
                )}
              </div>

              <div>
                <label className="text-slate-300 mb-1 block text-sm">Sell Price (total)</label>
                <input value={salePrice} onChange={e=>setSalePrice(e.target.value)} placeholder="0 = unsold"
                  className="w-full bg-slate-900/60 border border-slate-800 rounded-xl px-4 py-3 text-slate-100 placeholder-slate-400 focus:ring-2 focus:ring-indigo-500"/>
                <p className="text-xs text-slate-500 mt-1">If qty &gt; 1 we’ll split this total across rows.</p>
              </div>

              <div>
                <label className="text-slate-300 mb-1 block text-sm">Fees (%)</label>
                <input value={feesPct} onChange={e=>!feesLocked && setFeesPct(e.target.value)} placeholder="e.g. 9 or 9%"
                  disabled={feesLocked}
                  className={`w-full bg-slate-900/60 border border-slate-800 rounded-xl px-4 py-3 text-slate-100 placeholder-slate-400 focus:ring-2 focus:ring-indigo-500 ${feesLocked ? 'opacity-60 cursor-not-allowed' : ''}`}/>
                {feesLocked && <p className="text-xs text-slate-500 mt-1">Locked from marketplace default.</p>}
              </div>

              <div>
                <label className="text-slate-300 mb-1 block text-sm">Shipping (total)</label>
                <input value={shipping} onChange={e=>setShipping(e.target.value)}
                  className="w-full bg-slate-900/60 border border-slate-800 rounded-xl px-4 py-3 text-slate-100 focus:ring-2 focus:ring-indigo-500"/>
                <p className="text-xs text-slate-500 mt-1">If qty &gt; 1 we’ll split shipping across rows.</p>
              </div>
            </div>

            <div className="mt-6 flex items-center justify-between">
              <div className={`text-sm ${msg.startsWith('Saved') ? 'text-emerald-400' : 'text-rose-400'}`}>{msg}</div>
              <button className="px-6 py-3 rounded-2xl bg-indigo-600 hover:bg-indigo-500 text-white" disabled={saving}>
                {saving ? 'Saving…' : 'Save'}
              </button>
            </div>
          </div>
        </form>

        {/* Recent orders */}
        <div className="mt-10">
          <h2 className="text-xl font-semibold mb-4">Your recent orders</h2>
          {isLoading && <div className="text-slate-400">Loading…</div>}
          {error && <div className="text-rose-400">{String(error)}</div>}

          <div className="grid gap-3">
            {orders?.map(o => (
              <div key={o.id} className="rounded-xl border border-slate-800 bg-slate-900/60 p-4">
                <div className="flex items-center justify-between">
                  <div className="font-semibold">
                    {o.order_date} • {o.item ?? '—'} {o.retailer ? `@ ${o.retailer}` : ''}
                  </div>
                  <div className={`text-sm font-semibold ${Number(o.pl_cents) >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
                    P/L ${centsToStr(o.pl_cents)}
                  </div>
                </div>
                <div className="text-sm text-slate-300">
                  Buy ${centsToStr(o.buy_price_cents)} • Sell ${centsToStr(o.sale_price_cents)} • Ship ${centsToStr(o.shipping_cents)}
                  {o.fees_pct ? ` • Fees ${(Number(o.fees_pct)*100).toFixed(2)}%` : ''} • {o.marketplace || '—'} • {o.status}
                </div>
              </div>
            ))}
            {orders?.length === 0 && <div className="text-slate-400">No orders yet.</div>}
          </div>
        </div>
      </div>
    </div>
  )
}