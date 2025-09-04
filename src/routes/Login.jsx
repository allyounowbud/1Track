import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "../lib/supabaseClient";

export default function Login() {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState("");

  // If already signed in, bounce to /
  useEffect(() => {
    (async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (session) navigate("/");
    })();

    const { data: sub } = supabase.auth.onAuthStateChange((_evt, session) => {
      if (session) navigate("/");
    });
    return () => sub.subscription.unsubscribe();
  }, [navigate]);

  async function signInWithDiscord() {
    try {
      setErr("");
      setLoading(true);
      const redirectTo = `${window.location.origin}/`; // after Supabase finishes OAuth
      const { error } = await supabase.auth.signInWithOAuth({
        provider: "discord",
        options: { redirectTo }
      });
      if (error) throw error;
      // Redirect happens automatically by Supabase
    } catch (e) {
      setErr(e.message || String(e));
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 grid place-items-center p-6">
      <div className="card max-w-md w-full p-6">
        <h1 className="text-2xl font-bold mb-2">OneTrack</h1>
        <p className="text-slate-400 mb-6">Sign in to continue</p>

        {err && <div className="mb-4 text-rose-400 text-sm">{err}</div>}

        <button
          onClick={signInWithDiscord}
          disabled={loading}
          className="w-full h-11 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-medium disabled:opacity-60"
        >
          {loading ? "Redirecting…" : "Sign in with Discord"}
        </button>

        <p className="text-xs text-slate-400 mt-4">
          You’ll be redirected to Discord to authorize, then back here.
        </p>
      </div>
    </div>
  );
}