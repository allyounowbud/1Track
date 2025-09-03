import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { supabase } from '../lib/supabaseClient'

// ---------- helpers ----------
const parseMoney = (v) => {
  const n = Number(String(v ?? '').replace(/[^0-9.\-]/g, ''))
  return isNaN(n) ? 0 : n
}
const moneyToCents = (v) => Math.round(parseMoney(v) * 100)
const centsToStr  = (c) => (Number(c || 0) / 100).toFixed(2)
const parsePct = (v) => {
  // accepts "9", "9%", "0.09"
  if (v === '' || v == null) return 0
  const n = Number(String(v).replace('%',''))
  if (isNaN(n)) return 0
  return n > 1 ? n / 100 : n
}

async function getOrders() {
  const { data, error } = await supabase
    .from('orders')
    .select('id, order_date, item, profile_name, retailer, marketplace, buy_price_cents, sale_price_cents, sale_date, fees_pct, shipping_cents, pl_cents, status')
    .order('order_date', { ascending: false })
    .limit(25)
  if (error) throw error
  return data
}

export default function Dashboard() {
  const { data: orders, isLoading, error, refetch } = useQuery({ queryKey:['orders'], queryFn:getOrders })

  // ---- Quick Add form state (matches your sheet) ----
  const today = new Date().toISOString().slice(0,10)
  const [orderDate, setOrderDate]   = useState(today)
  const [item, setItem]             = useState('')
  const [profileName, setProfile]   = useState('')        // optional label
  const [retailer, setRetailer]     = useState('')
  const [buyPrice, setBuyPrice]     = useState('')
  const [salePrice, setSalePrice]   = useState('')
  const [saleDate, setSaleDate]     = useState('')
  const [marketplace, setMarket]    = useState('')
  const [feesPct, setFeesPct]       = useState('0')
  const [shipping, setShipping]     = useState('0')

  const [saving, setSaving] = useState(false)
  const [msg, setMsg] = useState('')

  async function saveOrder(e){
    e.preventDefault()
    setSaving(true); setMsg('')
    try {
      const sale_cents = moneyToCents(salePrice)
      const status = sale_cents > 0 ? 'sold' : 'ordered'
      const { error } = await supabase.from('orders').insert({
        order_date: orderDate,
        item,
        profile_name: profileName || null,
        retailer,
        marketplace,
        buy_price_cents: Math.abs(moneyToCents(buyPrice)),   // store as positive cost
        sale_price_cents: sale_cents,
        sale_date: saleDate || null,
        fees_pct: parsePct(feesPct),
        shipping_cents: moneyToCents(shipping),
        status,
      })
      if (error) throw error
      setMsg('Saved ✔')
      // reset some fields
      setItem(''); setProfile(''); setRetailer(''); setBuyPrice('')
      setSalePrice(''); setSaleDate(''); setMarket(''); setFeesPct('0'); setShipping('0')
      await refetch()
    } catch (err) {
      setMsg(String(err.message || err))
    } finally {
      setSaving(false)
    }
  }

  async function signOut(){
    await supabase.auth.signOut()
    window.location.href = '/login'
  }

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

        {/* Tabs (visual only for now) */}
        <div className="flex flex-wrap gap-2 mb-6">
          <button className="px-4 py-2 rounded-full bg-indigo-600 text-white border border-indigo-600">Quick Add</button>
          <button className="px-4 py-2 rounded-full border border-slate-800 bg-slate-900/60 hover:bg-slate-900">Mark as Sold</button>
          <button className="px-4 py-2 rounded-full border border-slate-800 bg-slate-900/60 hover:bg-slate-900">Stats</button>
          <button className="px-4 py-2 rounded-full border border-slate-800 bg-slate-900/60 hover:bg-slate-900">Inventory</button>
          <button className="px-4 py-2 rounded-full border border-slate-800 bg-slate-900/60 hover:bg-slate-900">Flex</button>
          <button className="px-4 py-2 rounded-full border border-slate-800 bg-slate-900/60 hover:bg-slate-900">Settings</button>
        </div>

        {/* QUICK ADD (two cards like your old UI) */}
        <form onSubmit={saveOrder} className="space-y-6">
          {/* Order details */}
          <div className="rounded-2xl border border-slate-800 bg-slate-900/60 backdrop-blur p-6 shadow-[0_10px_30px_rgba(0,0,0,.35)]">
            <h2 className="text-lg font-semibold mb-4">Order details</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="text-slate-300 mb-1 block text-sm">Order Date</label>
                <input type="date" className="w-full bg-slate-900/60 border border-slate-800 rounded-xl px-4 py-3 text-slate-100 focus:ring-2 focus:ring-indigo-500"
                  value={orderDate} onChange={(e)=>setOrderDate(e.target.value)} />
              </div>
              <div>
                <label className="text-slate-300 mb-1 block text-sm">Item</label>
                <input className="w-full bg-slate-900/60 border border-slate-800 rounded-xl px-4 py-3 text-slate-100 placeholder-slate-400 focus:ring-2 focus:ring-indigo-500"
                  placeholder="Start typing…" value={item} onChange={(e)=>setItem(e.target.value)} />
              </div>
              <div>
                <label className="text-slate-300 mb-1 block text-sm">Profile name (optional)</label>
                <input className="w-full bg-slate-900/60 border border-slate-800 rounded-xl px-4 py-3 text-slate-100 focus:ring-2 focus:ring-indigo-500"
                  placeholder="name / Testing 1" value={profileName} onChange={(e)=>setProfile(e.target.value)} />
              </div>
              <div>
                <label className="text-slate-300 mb-1 block text-sm">Retailer</label>
                <input className="w-full bg-slate-900/60 border border-slate-800 rounded-xl px-4 py-3 text-slate-100 focus:ring-2 focus:ring-indigo-500"
                  placeholder="Walmart, Target…" value={retailer} onChange={(e)=>setRetailer(e.target.value)} />
              </div>
              <div>
                <label className="text-slate-300 mb-1 block text-sm">Quantity</label>
                <input type="number" min={1} className="w-full bg-slate-900/60 border border-slate-800 rounded-xl px-4 py-3 text-slate-100 focus:ring-2 focus:ring-indigo-500"
                  value={1} readOnly />
                <p className="text-xs text-slate-500 mt-1">We’ll add multi-qty later (order_items). For now this is 1.</p>
              </div>
              <div>
                <label className="text-slate-300 mb-1 block text-sm">Buy Price (total)</label>
                <input className="w-full bg-slate-900/60 border border-slate-800 rounded-xl px-4 py-3 text-slate-100 placeholder-slate-400 focus:ring-2 focus:ring-indigo-500"
                  placeholder="e.g. 67.70" value={buyPrice} onChange={(e)=>setBuyPrice(e.target.value)} />
              </div>
            </div>
          </div>

          {/* Sale details */}
          <div className="rounded-2xl border border-slate-800 bg-slate-900/60 backdrop-blur p-6 shadow-[0_10px_30px_rgba(0,0,0,.35)]">
            <h2 className="text-lg font-semibold mb-4">Sale details (optional — for already-sold items)</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="text-slate-300 mb-1 block text-sm">Sale Date</label>
                <input type="date" className="w-full bg-slate-900/60 border border-slate-800 rounded-xl px-4 py-3 text-slate-100 focus:ring-2 focus:ring-indigo-500"
                  value={saleDate} onChange={(e)=>setSaleDate(e.target.value)} />
              </div>
              <div>
                <label className="text-slate-300 mb-1 block text-sm">Sale Location / Marketplace</label>
                <input className="w-full bg-slate-900/60 border border-slate-800 rounded-xl px-4 py-3 text-slate-100 placeholder-slate-400 focus:ring-2 focus:ring-indigo-500"
                  placeholder="eBay, Whatnot, Local/Cash…" value={marketplace} onChange={(e)=>setMarket(e.target.value)} />
              </div>
              <div>
                <label className="text-slate-300 mb-1 block text-sm">Sell Price</label>
                <input className="w-full bg-slate-900/60 border border-slate-800 rounded-xl px-4 py-3 text-slate-100 placeholder-slate-400 focus:ring-2 focus:ring-indigo-500"
                  placeholder="0 = unsold" value={salePrice} onChange={(e)=>setSalePrice(e.target.value)} />
              </div>
              <div>
                <label className="text-slate-300 mb-1 block text-sm">Fees (%)</label>
                <input className="w-full bg-slate-900/60 border border-slate-800 rounded-xl px-4 py-3 text-slate-100 placeholder-slate-400 focus:ring-2 focus:ring-indigo-500"
                  placeholder="e.g. 9 or 9%" value={feesPct} onChange={(e)=>setFeesPct(e.target.value)} />
              </div>
              <div>
                <label className="text-slate-300 mb-1 block text-sm">Shipping</label>
                <input className="w-full bg-slate-900/60 border border-slate-800 rounded-xl px-4 py-3 text-slate-100 focus:ring-2 focus:ring-indigo-500"
                  value={shipping} onChange={(e)=>setShipping(e.target.value)} />
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

        {/* Recent orders (styled list) */}
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