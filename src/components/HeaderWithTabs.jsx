// src/components/HeaderWithTabs.jsx
import { useEffect, useState } from "react";
import { NavLink, Link } from "react-router-dom";
import { supabase } from "../lib/supabaseClient";

/**
 * Props:
 * - active: "orders" | "add" | "sold" | "stats" | "settings"
 * - showTabs: boolean (default true)
 */
export default function HeaderWithTabs({ active = "", showTabs = true }) {
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

  // Base + variants (so we never have two conflicting bg- classes)
  const tabBase =
    "inline-flex items-center justify-center h-10 px-4 rounded-xl border transition";
  const tabIdle =
    "border-slate-800 bg-slate-900/60 text-slate-200 hover:bg-slate-900";
  const tabActive =
    "border-indigo-600 bg-indigo-600 text-white shadow-[0_8px_24px_rgba(79,70,229,.35)] hover:bg-indigo-600";

  const tabClass = (key) => ({ isActive }) =>
    `${tabBase} ${isActive || active === key ? tabActive : tabIdle}`;

  return (
    <>
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-3xl font-bold">OneTrack</h1>
        <div className="flex items-center gap-3">
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
          <div className="hidden sm:block text-sm text-slate-300 max-w-[160px] truncate">
            {userInfo.username}
          </div>
          <Link
            to="/"
            className="h-10 px-4 inline-flex items-center justify-center leading-none
                       rounded-xl border border-slate-800 bg-slate-900/60 hover:bg-slate-900
                       text-slate-100 cursor-pointer"
          >
            Dashboard
          </Link>
        </div>
      </div>

      {/* Tabs */}
      {showTabs && (
        <div className="relative z-20 flex flex-wrap items-center gap-2 mb-6">
          <NavLink to="/orders" end className={tabClass("orders")}>
            Order Book
          </NavLink>
          <NavLink to="/add" end className={tabClass("add")}>
            Quick Add
          </NavLink>
          <NavLink to="/sold" end className={tabClass("sold")}>
            Mark as Sold
          </NavLink>
          <NavLink to="/stats" end className={tabClass("stats")}>
            Stats
          </NavLink>
          <button className={`${tabBase} ${tabIdle}`}>Inventory</button>
          <button className={`${tabBase} ${tabIdle}`}>Flex</button>
          <NavLink to="/settings" end className={tabClass("settings")}>
            Settings
          </NavLink>
        </div>
      )}
    </>
  );
}
