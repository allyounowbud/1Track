// src/routes/Login.jsx
import { useState } from 'react'
import { supabase } from '../lib/supabaseClient'

export default function Login() {
  const [email, setEmail] = useState('')
  const [sent, setSent] = useState(false)
  const [error, setError] = useState(null)

  async function signIn(e) {
    e.preventDefault()
    setError(null)

    const { error } = await supabase.auth.signInWithOtp({
      email,
      options: {
        // This makes the magic-link come back to the current app
        emailRedirectTo: `${window.location.origin}/`,
      },
    })

    if (error) setError(error.message)
    else setSent(true)
  }

  return (
    <div style={{maxWidth:420, margin:'80px auto', padding:24, border:'1px solid #ddd', borderRadius:12}}>
      <h2>Sign in</h2>
      {sent ? (
        <p>Check your email for a login link.</p>
      ) : (
        <form onSubmit={signIn}>
          <input
            value={email}
            onChange={e=>setEmail(e.target.value)}
            placeholder="you@example.com"
            type="email"
            style={{width:'100%', padding:10, margin:'12px 0'}}
            required
          />
          <button style={{padding:'10px 16px'}}>Send magic link</button>
        </form>
      )}
      {error && <p style={{color:'crimson'}}>{error}</p>}
    </div>
  )
}
