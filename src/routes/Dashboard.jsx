import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { supabase } from '../lib/supabaseClient'

// --- helpers ---
const moneyToCents = (v) => {
  const n = Number(String(v).replace(/[^0-9.\-]/g, ''))
  return Math.round((isNaN(n) ? 0 : n) * 100)
}
const cents = (n) => (Number(n || 0) / 100).toFixed(2)

async function fetchOrders() {
  const { data, error } = await supabase
    .from('orders')
    .select('id, order_date, external_order_id, subtotal_cents, tax_cents, shipping_cents, status')
    .order('order_date', { ascending: false })
    .limit(25)
  if (error) throw error
  return data
}

export default function Dashboard() {
  const { data: orders, isLoading, error, refetch } = useQuery({ queryKey: ['orders'], queryFn: fetchOrders })

  // Quick Add state (UI-first; we still insert a single row to `orders`)
  const today = new Date().toISOString().slice(0, 10)
  const [orderDate, setOrderDate] = useState(today)
  const [itemTitle, setItemTitle] = useState('')
  const [retailer, setRetailer] = useState('')
  const [qty, setQty] = useState(1)
  const [buyTotal, setBuyTotal] = useState('')
  const [saleDate, setSaleDate] = useState('')
  const [saleLoc, setSaleLoc] = useState('')
  const [sellPrice, setSellPrice] = useState('')
  const [shipping, setShipping] = useState('0')
  const [saving, setSaving] = useState(false)
  const [msg, setMsg] = useState('')

  async function saveOrder(e) {
    e.preventDefault()
    setMsg('')
    setSaving(true)
    try {
      const status = moneyToCents(sellPrice) > 0 ? 'sold' : 'ordered'
      const { error } = await supabase.from('orders').insert({
        order_date: orderDate,
        external_order_id: `${itemTitle || 'Item'}${retailer ? ` @ ${retailer}` : ''}`,
        subtotal_cents: moneyToCents(buyTotal),
        tax_cents: 0,
        shipping_cents: moneyToCents(shipping),
        status,
      })
      if (error) throw error
      setMsg('Saved ✔')
      setItemTitle(''); setRetailer(''); setQty(1); setBuyTotal('')
      setSellPrice(''); setShipping('0'); setSaleDate(''); setSaleLoc('')
      await refetch()
    } catch (err) {
      setMsg(String(err.message || err))
    } finally {
      setSaving(false)
    }
  }

  async function signOut() {
    await supabase.auth.signOut()
    window.location.href = '/login'
  }

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100">
      <div className="max-w-5xl mx-auto p-6">

        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <h1 className="text-3xl font-bold">OneTrack</h1>
          <div className="flex items-center gap-2">
            <button onClick={signOut}
              className="px-4 py-2 rounded-xl border border-slate-800 bg-slate-900/60 hover:bg-slate-900">
              Sign out
            </button>
          </div>
        </div>

        {/* Tabs (static for now) */}
        <div className="flex flex-wrap gap-2 mb-6">
          <button className="px-4 py-2 rounded-full bg-indigo-600 text-white border border-indigo-600">Quick Add</button>
          <button className="px-4 py-2 rounded-full border border-slate-800 bg-slate-900/60 hover:bg-slate-900">Mark as Sold</button>
          <button className="px-4 py-2 rounded-full border border-slate-800 bg-slate-900/60 hover:bg-slate-900">Stats</button>
          <button className="px-4 py-2 rounded-full border border-slate-800 bg-slate-900/60 hover:bg-slate-900">Inventory</button>
          <button className="px-4 py-2 rounded-full border border-slate-800 bg-slate-900/60 hover:bg-slate-900">Flex</button>
          <button className="px-4 py-2 rounded-full border border-slate-800 bg-slate-900/60 hover:bg-slate-900">Settings</button>
        </div>

        {/* QUICK ADD FORM */}
        <form onSubmit={saveOrder} className="space-y-6">
          {/* Order details card */}
          <div className="rounded-2xl border border-slate-800 bg-slate-900/60 backdrop-blur p-6 shadow-[0_10px_30px_rgba(0,0,0,.35)]">
            <h2 className="text-lg font-semibold mb-4">Order details</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="text-slate-300 mb-1 block text-sm">Order Date</label>
                <input type="date" className="w-full bg-slate-900/60 border border-slate-800 rounded-xl px-4 py-3
                  text-slate-100 placeholder-slate-400 outline-none focus:ring-2 focus:ring-indigo-500"
                  value={orderDate} onChange={e => setOrderDate(e.target.value)} />
              </div>
              <div>
                <label className="text-slate-300 mb-1 block text-sm">Item</label>
                <input className="w-full bg-slate-900/60 border border-slate-800 rounded-xl px-4 py-3
                  text-slate-100 placeholder-slate-400 outline-none focus:ring-2 focus:ring-indigo-500"
                  placeholder="Start typing…" value={itemTitle} onChange={e => setItemTitle(e.target.value)} />
              </div>
              <div>
                <label className="text-slate-300 mb-1 block text-sm">Retailer (Bought From)</label>
                <input className="w-full bg-slate-900/60 border border-slate-800 rounded-xl px-4 py-3
                  text-slate-100 placeholder-slate-400 outline-none focus:ring-2 focus:ring-indigo-500"
                  placeholder="Walmart, Target…" value={retailer} onChange={e => setRetailer(e.target.value)} />
              </div>
              <div>
                <label className="text-slate-300 mb-1 block text-sm">Quantity</label>
                <input type="number" min={1} className="w-full bg-slate-900/60 border border-slate-800 rounded-xl px-4 py-3
                  text-slate-100 outline-none focus:ring-2 focus:ring-indigo-500"
                  value={qty} onChange={e => setQty(Number(e.target.value || 1))} />
              </div>
              <div className="md:col-span-2">
                <label className="text-slate-300 mb-1 block text-sm">Buy Price (total)</label>
                <input className="w-full bg-slate-900/60 border border-slate-800 rounded-xl px-4 py-3
                  text-slate-100 placeholder-slate-400 outline-none focus:ring-2 focus:ring-indigo-500"
                  placeholder="e.g. 329.95" value={buyTotal} onChange={e => setBuyTotal(e.target.value)} />
              </div>
            </div>
          </div>

          {/* Sale details card */}
          <div className="rounded-2xl border border-slate-800 bg-slate-900/60 backdrop-blur p-6 shadow-[0_10px_30px_rgba(0,0,0,.35)]">
            <h2 className="text-lg font-semibold mb-4">Sale details (optional — for already-sold items)</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="text-slate-300 mb-1 block text-sm">Sale Date</label>
                <input type="date" className="w-full bg-slate-900/60 border border-slate-800 rounded-xl px-4 py-3 text-slate-100 outline-none focus:ring-2 focus:ring-indigo-500"
                  value={saleDate} onChange={e => setSaleDate(e.target.value)} />
              </div>
              <div>
                <label className="text-slate-300 mb-1 block text-sm">Sale Location</label>
                <input className="w-full bg-slate-900/60 border border-slate-800 rounded-xl px-4 py-3 text-slate-100 placeholder-slate-400 outline-none focus:ring-2 focus:ring-indigo-500"
                  placeholder="e.g. eBay, Whatnot…" value={saleLoc} onChange={e => setSaleLoc(e.target.value)} />
              </div>
              <div>
                <label className="text-slate-300 mb-1 block text-sm">Sell Price</label>
                <input className="w-full bg-slate-900/60 border border-slate-800 rounded-xl px-4 py-3 text-slate-100 placeholder-slate-400 outline-none focus:ring-2 focus:ring-indigo-500"
                  placeholder="0 = unsold" value={sellPrice} onChange={e => setSellPrice(e.target.value)} />
              </div>
              <div>
                <label className="text-slate-300 mb-1 block text-sm">Shipping</label>
                <input className="w-full bg-slate-900/60 border border-slate-800 rounded-xl px-4 py-3 text-slate-100 outline-none focus:ring-2 focus:ring-indigo-500"
                  value={shipping} onChange={e => setShipping(e.target.value)} />
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

        {/* Recent orders list */}
        <div className="mt-10">
          <h2 className="text-xl font-semibold mb-4">Your recent orders</h2>
          {isLoading && <div className="text-slate-400">Loading…</div>}
          {error && <div className="text-rose-400">{String(error)}</div>}
          <div className="space-y-3">
            {orders?.map(o => (
              <div key={o.id} className="rounded-xl border border-slate-800 bg-slate-900/60 p-4">
                <div className="font-semibold">{o.order_date} • {o.external_order_id ?? '—'}</div>
                <div className="text-sm text-slate-300">
                  Subtotal ${cents(o.subtotal_cents)} • Tax ${cents(o.tax_cents)} • Shipping ${cents(o.shipping_cents)} • {o.status}
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
