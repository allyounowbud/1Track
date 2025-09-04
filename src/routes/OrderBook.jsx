// src/routes/OrderBook.jsx
import { useMemo, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { supabase } from '../lib/supabaseClient'
import HeaderWithTabs from '../components/HeaderWithTabs.jsx'

/* ---------- UI tokens ---------- */
const card =
  "rounded-2xl border border-slate-800 bg-slate-900/60 backdrop-blur p-4 sm:p-6 shadow-[0_10px_30px_rgba(0,0,0,.35)]"
const inputSm =
  "h-10 text-sm w-full min-w-0 bg-slate-900/60 border border-slate-800 rounded-xl px-3 py-2 text-slate-100 placeholder-slate-400 focus:ring-2 focus:ring-indigo-500"

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

/* 
   Fixed grid for lg+ so columns keep identical widths across rows.
   Chosen to fit comfortably inside a 6xl container (72rem) including gaps/padding.
*/
const GRID_COLS =
  '9rem minmax(14rem,1fr) 7rem 6rem 5.5rem 5.5rem 9rem 8rem 5rem 5rem'

export default function OrderBook(){
  const { data: orders=[], isLoading, error, refetch } = useQuery({ queryKey:['orders', 500], queryFn:() => getOrders(500) })
  const { data: items=[] }      = useQuery({ queryKey:['items'],      queryFn:getItems })
  const { data: retailers=[] }  = useQuery({ queryKey:['retailers'],  queryFn:getRetailers })
  const { data: markets=[] }    = useQuery({ queryKey:['markets'],    queryFn:getMarkets })

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
        <HeaderWithTabs />

        {/* Search + rows meta (input stretches full width of card) */}
        <div className={`${card} mb-6`}>
          <div className="grid grid-cols-1 md:grid-cols-[minmax(0,1fr)_auto] gap-3 items-end">
            <div className="w-full">
              <label className="text-slate-300 mb-1 block text-sm">Search</label>
              <input
                value={q}
                onChange={(e)=>setQ(e.target.value)}
                placeholder="item / retailer / marketplace / profile…"
                className={`${inputSm} w-full`}
              />
            </div>
            <div className="md:pl-3 md:pb-0">
              <div className="text-slate-400 text-sm">Rows</div>
              <div className="text-xl font-semibold">{filtered.length}</div>
            </div>
          </div>
        </div>

        {isLoading && <div className="text-slate-400">Loading…</div>}
        {error && <div className="text-rose-400">{String(error.message || error)}</div>}

        {/* Header labels on lg+, aligned by the same grid */}
        <div
          className="hidden lg:grid text-xs text-slate-400 px-1 mb-1 gap-2"
          style={{ gridTemplateColumns: GRID_COLS }}
        >
          <div>Order date</div>
          <div>Item</div>
          <div>Profile</div>
          <div>Retailer</div>
          <div>Buy $</div>
          <div>Sale $</div>
          <div>Sale date</div>
          <div>Marketplace</div>
          <div>Ship $</div>
          <div className="text-right">Actions</div>
        </div>

        {/* Rows */}
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

/* ---------------- Row ---------------- */
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
        status: statusValue,
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
    <div className="rounded-xl border border-slate-800 bg-slate-900/60 p-3 overflow-hidden">
      {/* Mobile: stack; Desktop: fixed grid (columns identical across rows) */}
      <div
        className="grid gap-2 lg:gap-2 grid-cols-1 lg:grid-cols-[9rem_minmax(14rem,1fr)_7rem_6rem_5.5rem_5.5rem_9rem_8rem_5rem_5rem] items-center"
      >
        {/* Order date */}
        <div className="w-full">
          <input
            type="date"
            value={order_date || ''}
            onChange={e=>setOrderDate(e.target.value)}
            className={`${inputSm} w-full`}
          />
        </div>

        {/* Item */}
        <div className="w-full">
          <select
            value={item || ''}
            onChange={e=>setItem(e.target.value)}
            className={`${inputSm} w-full`}
          >
            <option value=""></option>
            {items.map(it => <option key={it.id} value={it.name}>{it.name}</option>)}
          </select>
        </div>

        {/* Profile */}
        <div className="w-full">
          <input
            value={profile_name}
            onChange={e=>setProfile(e.target.value)}
            placeholder="Profile"
            className={`${inputSm} w-full`}
          />
        </div>

        {/* Retailer */}
        <div className="w-full">
          <select
            value={retailer || ''}
            onChange={e=>setRetailer(e.target.value)}
            className={`${inputSm} w-full`}
          >
            <option value=""></option>
            {retailers.map(r => <option key={r.id} value={r.name}>{r.name}</option>)}
          </select>
        </div>

        {/* Buy / Sale */}
        <div className="w-full">
          <input value={buyPrice}  onChange={e=>setBuyPrice(e.target.value)}  placeholder="Buy $"  className={`${inputSm} w-full`} />
        </div>
        <div className="w-full">
          <input value={salePrice} onChange={e=>setSalePrice(e.target.value)} placeholder="Sale $" className={`${inputSm} w-full`} />
        </div>

        {/* Sale date with ghost label when empty (never overflows) */}
        <div className="relative w-full">
          <input
            type="date"
            value={sale_date || ''}
            onChange={e=>setSaleDate(e.target.value)}
            className={`${inputSm} w-full`}
          />
          {!sale_date && (
            <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 text-sm">
              Sale date
            </span>
          )}
        </div>

        {/* Marketplace */}
        <div className="w-full">
          <select
            value={marketplace || ''}
            onChange={e=>handleMarketplaceChange(e.target.value)}
            className={`${inputSm} w-full`}
          >
            <option value="">Marketplace</option>
            {markets.map(m => <option key={m.id} value={m.name}>{m.name}</option>)}
          </select>
        </div>

        {/* Shipping */}
        <div className="w-full">
          <input value={shipping}  onChange={e=>setShipping(e.target.value)}  placeholder="Ship $"  className={`${inputSm} w-full`} />
        </div>

        {/* Actions (right-aligned on all sizes, fixed column width on lg+) */}
        <div className="flex items-center justify-end gap-2">
          {/* Save */}
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
            <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M20 6L9 17l-5-5" />
            </svg>
          </button>

          {/* Delete */}
          <button
            type="button"
            onClick={del}
            aria-label="Delete"
            title="Delete"
            className="inline-flex items-center justify-center h-9 w-9 rounded-lg
                       bg-rose-600 hover:bg-rose-500 text-white border border-rose-700
                       focus:outline-none focus:ring-2 focus:ring-rose-500"
          >
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
