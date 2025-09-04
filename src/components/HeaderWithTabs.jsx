import { useEffect, useState } from "react";
import { NavLink, Link } from "react-router-dom";
import { supabase } from "../lib/supabaseClient";

const tabBase =
  "inline-flex items-center justify-center h-10 px-4 rounded-xl border border-slate-800 bg-slate-900/60 text-slate-200 hover:bg-slate-900 transition";
const tabActive =
  "bg-indigo-600 text-white border-indigo-600 shadow hover:bg-indigo-600";

export default function HeaderWithTabs() {
  // current user (Discord avatar/name)
  const [userInfo, setUserInfo] = useState({ avatar_url: "", username: "" });

  useEffect(() => {
    async function loadUser() {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return setUserInfo({ avatar_url: "", username: "" });
      const m = user.user_metadata || {};
      const username =
        m.user_name ||
        m.preferred_username ||
        m.full_name ||
        m.name ||
        user.email ||
        "Account";
      const avatar_url = m.avatar_url || m.picture || "";
      setUserInfo({ avatar_url, username });
    }
    loadUser();

    const { data: sub } = supabase.auth.onAuthStateChange((_e, session) => {
      const user = session?.user;
      if (!user) return setUserInfo({ avatar_url: "", username: "" });
      const m = user.user_metadata || {};
      const username =
        m.user_name ||
        m.preferred_username ||
        m.full_name ||
        m.name ||
        user.email ||
        "Account";
      const avatar_url = m.avatar_url || m.picture || "";
      setUserInfo({ avatar_url, username });
    });
    return () => sub.subscription.unsubscribe();
  }, []);

  return (
    <>
      {/* Header bar */}
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-3xl font-bold">OneTrack</h1>

        <div className="flex items-center gap-3">
          {/* avatar */}
          {userInfo.avatar_url ? (
            <img
              src={userInfo.avatar_url}
              alt=""
              className="h-8 w-8 rounded-full border border-slate-800 object-cover"
            />
          ) : (
            <div className="h-8 w-8 rounded-full bg-slate-800 grid place-items-center text-slate-300 text-xs">
              {(userInfo.username || "U").slice(0, 1).toUpperCase()}
            </div>
          )}

          {/* username (hide on very small screens) */}
          <div className="hidden sm:block text-sm text-slate-300 max-w-[160px] truncate">
            {userInfo.username}
          </div>

          {/* Dashboard button (text centered) */}
          <Link
            to="/"
            className="inline-flex items-center justify-center px-4 h-10 rounded-xl border border-slate-800 bg-slate-900/60 hover:bg-slate-900"
          >
            Dashboard
          </Link>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex flex-wrap items-center gap-2 mb-6">
        <NavLink to="/orders"   className={({isActive}) => `${tabBase} ${isActive ? tabActive : ""}`}>Order Book</NavLink>
        <NavLink to="/app"      className={({isActive}) => `${tabBase} ${isActive ? tabActive : ""}`}>Quick Add</NavLink>
        <NavLink to="/sold"     className={({isActive}) => `${tabBase} ${isActive ? tabActive : ""}`}>Mark as Sold</NavLink>
        <NavLink to="/stats"    className={({isActive}) => `${tabBase} ${isActive ? tabActive : ""}`}>Stats</NavLink>
        <NavLink to="/settings" className={({isActive}) => `${tabBase} ${isActive ? tabActive : ""}`}>Settings</NavLink>
        {/* Add more when routes exist:
        <NavLink to="/inventory" className={({isActive}) => `${tabBase} ${isActive ? tabActive : ""}`}>Inventory</NavLink>
        <NavLink to="/flex"       className={({isActive}) => `${tabBase} ${isActive ? tabActive : ""}`}>Flex</NavLink>
        */}
      </div>
    </>
  );
}
