import { useEffect, useState } from "react";
import { Link, NavLink } from "react-router-dom";
import { supabase } from "../lib/supabaseClient";

const tabBase =
  "inline-flex items-center justify-center h-10 px-4 rounded-xl border border-slate-800 bg-slate-900/60 text-slate-200 hover:bg-slate-900 transition";
const tabActive = "bg-indigo-600 text-white border-indigo-600 shadow hover:bg-indigo-600";
const card =
  "rounded-2xl border border-slate-800 bg-slate-900/60 backdrop-blur p-4 sm:p-6 shadow-[0_10px_30px_rgba(0,0,0,.35)]";

export default function Automation() {
  const [userInfo, setUserInfo] = useState({ avatar_url: "", username: "" });

  useEffect(() => {
    async function loadUser() {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return setUserInfo({ avatar_url: "", username: "" });
      const m = user.user_metadata || {};
      const username =
        m.user_name || m.preferred_username || m.full_name || m.name || user.email || "Account";
      const avatar_url = m.avatar_url || m.picture || "";
      setUserInfo({ avatar_url, username });
    }
    loadUser();
  }, []);

  async function signOut() {
    await supabase.auth.signOut();
    window.location.href = "/login";
  }

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100">
      <div className="max-w-6xl mx-auto p-4 sm:p-6">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <Link to="/" className="text-3xl font-bold hover:opacity-90">OneTrack</Link>
          <div className="flex items-center gap-3">
            {userInfo.avatar_url ? (
              <img src={userInfo.avatar_url} alt="" className="h-8 w-8 rounded-full border border-slate-800 object-cover"/>
            ) : (
              <div className="h-8 w-8 rounded-full bg-slate-800 grid place-items-center text-slate-300 text-xs">
                {(userInfo.username || "U").slice(0,1).toUpperCase()}
              </div>
            )}
            <div className="hidden sm:block text-sm text-slate-300 max-w-[160px] truncate">{userInfo.username}</div>
            <button onClick={signOut} className="px-4 h-10 rounded-xl border border-slate-800 bg-slate-900/60 hover:bg-slate-900">Sign out</button>
          </div>
        </div>

        {/* Tabs for order-book area + link back to hub */}
        <div className="flex flex-wrap items-center gap-2 mb-6">
          <Link to="/" className={tabBase}>← Hub</Link>
          <NavLink to="/app"     className={({isActive}) => `${tabBase} ${isActive ? tabActive : ''}`}>Order Book</NavLink>
          <span className={`${tabBase} ${tabActive}`}>Automations</span>
        </div>

        <div className={card}>
          <h2 className="text-lg font-semibold mb-2">Automations</h2>
          <p className="text-slate-300">
            Nothing here yet. This area will host alerts, rules, and scheduled actions.
          </p>
          <p className="text-slate-400 mt-3">
            Tip: head to the <Link className="underline" to="/app">Order Book</Link> to keep tracking purchases and sales.
          </p>
        </div>
      </div>
    </div>
  );
}
