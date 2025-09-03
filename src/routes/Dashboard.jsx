import { useQuery } from '@tanstack/react-query'
import { supabase } from '../lib/supabaseClient'

async function getOrders() {
  const { data, error } = await supabase
    .from('orders')
    .select('id, order_date, external_order_id, subtotal_cents, tax_cents, shipping_cents, status')
    .order('order_date', { ascending: false })
    .limit(50)
  if (error) throw error
  return data
}

async function addFakeOrder() {
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) throw new Error('Not signed in')
  const { error } = await supabase.from('orders').insert({
    // owner_id will be auto-filled by the trigger if you omit it:
    order_date: new Date().toISOString().slice(0,10),
    external_order_id: 'TEST-123',
    subtotal_cents: 1999,
    tax_cents: 180,
    shipping_cents: 500,
    status: 'ordered',
  })
  if (error) throw error
}

export default function Dashboard() {
  const { data, isLoading, error, refetch } = useQuery({ queryKey:['orders'], queryFn:getOrders })

  async function handleAdd() {
    try {
      await addFakeOrder()
      await refetch()
    } catch (e) {
      alert(String(e))
    }
  }

  async function signOut() {
    await supabase.auth.signOut()
    window.location.href = '/login'
  }

  if (isLoading) return <div style={{padding:20}}>Loading…</div>
  if (error) return <div style={{padding:20, color:'crimson'}}>{String(error)}</div>

  return (
    <div style={{maxWidth:900, margin:'40px auto', padding:20}}>
      <div style={{display:'flex', justifyContent:'space-between', alignItems:'center'}}>
        <h2>Your recent orders</h2>
        <div>
          <button onClick={handleAdd} style={{marginRight:8}}>+ Add test order</button>
          <button onClick={signOut}>Sign out</button>
        </div>
      </div>
      <ul>
        {data?.map(o => (
          <li key={o.id} style={{padding:'10px 0', borderBottom:'1px solid #eee'}}>
            <div><b>{o.order_date}</b> • {o.external_order_id ?? '—'}</div>
            <div>
              Subtotal ${(o.subtotal_cents/100).toFixed(2)} • Tax ${(o.tax_cents/100).toFixed(2)} • Shipping ${(o.shipping_cents/100).toFixed(2)} • {o.status}
            </div>
          </li>
        ))}
      </ul>
    </div>
  )
}
