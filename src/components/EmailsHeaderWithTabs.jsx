// src/components/EmailsHeaderWithTabs.jsx
import { useEffect, useState } from "react";
import { NavLink, Link } from "react-router-dom";
import { supabase } from "../lib/supabaseClient";

/**
 * Props:
 * - active: "emails" | "shipments"
 * - showTabs: boolean (default true)
 * - showHubTab: boolean (default false) - adds Hub tab as first tab
 */
export default function EmailsHeaderWithTabs({ active = "", showTabs = true, showHubTab = false }) {
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
    "border-emerald-600 bg-emerald-600 text-white shadow-[0_8px_24px_rgba(16,185,129,.35)] hover:bg-emerald-600";

  const tabClass = (key) => ({ isActive }) =>
    `${tabBase} ${isActive || active === key ? tabActive : tabIdle}`;

  return (
    <>
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-end gap-2">
          <h1 className="text-3xl font-bold">OneTrack</h1>
          <span className="text-xs text-slate-500 font-medium mb-1 -ml-1">BETA</span>
        </div>
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
          {showHubTab && (
            <Link to="/" className={tabClass("hub")({ isActive: false })}>
              <svg className="h-4 w-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
              </svg>
              Hub
            </Link>
          )}
          <NavLink to="/emails" end className={tabClass("emails")}>
            <svg className="h-4 w-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 4.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
            </svg>
            Emails
          </NavLink>
          <NavLink to="/shipments" end className={tabClass("shipments")}>
            <svg className="h-4 w-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7h12m0 0l-4-4m4 4l-4 4m0 6H4m0 0l4 4m-4-4l4-4" />
            </svg>
            Shipments
          </NavLink>
        </div>
      )}
    </>
  );
}
