import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabaseClient'

export default function AuthGuard() {
  const nav = useNavigate()
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      if (data.session) nav('/app')
      else nav('/login')
      setLoading(false)
    })
  }, [nav])

  return loading ? <div style={{padding:20}}>Loading…</div> : null
}
