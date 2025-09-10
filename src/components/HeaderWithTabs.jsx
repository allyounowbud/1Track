// src/components/HeaderWithTabs.jsx
import { useEffect, useState } from "react";
import { NavLink, Link } from "react-router-dom";
import { supabase } from "../lib/supabaseClient";

/**
 * Props:
 * - active: "orders" | "add" | "sold" | "stats" | "database" | "emails"
 * - showTabs: boolean (default true)
 * - section: "orderbook" | "automations" (default "orderbook")
 * - showHubTab: boolean (default false) - adds Hub tab as first tab
 */
export default function HeaderWithTabs({ active = "", showTabs = true, section = "orderbook", showHubTab = false }) {
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
        <Link
          to="/"
          className="h-10 px-3 inline-flex items-center gap-3 leading-none
                     rounded-xl border border-slate-800 bg-slate-900/60 hover:bg-slate-900
                     text-slate-100 cursor-pointer transition-colors"
        >
          {userInfo.avatar_url ? (
            <img
              src={userInfo.avatar_url}
              alt=""
              className="h-6 w-6 rounded-md border border-slate-800 object-cover"
            />
          ) : (
            <div className="h-6 w-6 rounded-md bg-slate-800 grid place-items-center text-slate-300 text-xs">
              {(userInfo.username || "U").slice(0, 1).toUpperCase()}
            </div>
          )}
          <div className="text-sm text-slate-100 font-medium">
            {userInfo.username}
          </div>
        </Link>
      </div>

      {/* Tabs */}
      {showTabs && (
        <div className="relative z-20 flex flex-wrap items-center gap-2 mb-6">
          {section === "orderbook" ? (
            <>
              {showHubTab && (
                <Link to="/" className={tabClass("hub")({ isActive: false })}>
                  <svg className="h-4 w-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                  </svg>
                  Hub
                </Link>
              )}
              <NavLink to="/add" end className={tabClass("add")}>
                Quick Add
              </NavLink>
              <NavLink to="/sold" end className={tabClass("sold")}>
                Mark as Sold
              </NavLink>
              <NavLink to="/orders" end className={tabClass("orders")}>
                Order Book
              </NavLink>
              <NavLink to="/inventory" end className={tabClass("inventory")}>
                Inventory
              </NavLink>
              <NavLink to="/stats" end className={tabClass("stats")}>
                Stats
              </NavLink>
              <NavLink to="/database" end className={tabClass("database")}>
                Database
              </NavLink>
            </>
          ) : (
            <>
              <NavLink to="/emails" end className={tabClass("emails")}>
                Emails
              </NavLink>
            </>
          )}
        </div>
      )}
    </>
  );
}
