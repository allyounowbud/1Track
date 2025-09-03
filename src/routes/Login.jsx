// src/routes/Login.jsx
import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabaseClient'

export default function Login() {
  const nav = useNavigate()
  const [email, setEmail] = useState('')
  const [sent, setSent] = useState(false)
  const [error, setError] = useState(null)
  const [busy, setBusy] = useState(false)

  // If already signed in, bounce to /app
  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      if (data.session) nav('/app')
    })
  }, [nav])

  async function signIn(e) {
    e.preventDefault()
    setError(null)
    setBusy(true)
    const { error } = await supabase.auth.signInWithOtp({
      email,
      options: { emailRedirectTo: `${window.location.origin}/` }, // dev + prod
    })
    setBusy(false)
    if (error) setError(error.message)
    else setSent(true)
  }

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex items-center justify-center p-4">
      <div className="card w-full max-w-md p-6 md:p-8">
        <div className="mb-6">
          <h1 className="text-2xl md:text-3xl font-bold">OneTrack</h1>
          <p className="text-slate-400 mt-1">Sign in to continue</p>
        </div>

        {sent ? (
          <div className="rounded-xl border border-emerald-700/40 bg-emerald-900/20 p-4 text-emerald-300">
            Check your email for a magic link.
          </div>
        ) : (
          <form onSubmit={signIn} className="space-y-4">
            <div>
              <label className="label">Email</label>
              <input
                type="email"
                required
                className="input"
                placeholder="you@example.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
              />
            </div>

            {error && (
              <div className="rounded-xl border border-rose-700/40 bg-rose-900/20 p-3 text-rose-300 text-sm">
                {error}
              </div>
            )}

            <button
              className="btn btn-primary w-full py-3 rounded-2xl text-base"
              disabled={busy}
            >
              {busy ? 'Sending…' : 'Send magic link'}
            </button>

            <p className="text-xs text-slate-400 text-center">
              We’ll email you a secure sign-in link.
            </p>
          </form>
        )}
      </div>
    </div>
  )
}