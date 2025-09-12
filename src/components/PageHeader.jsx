// src/components/PageHeader.jsx
import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { supabase } from "../lib/supabaseClient";

/**
 * Props:
 * - title: string (page title)
 * - showUserAvatar: boolean (default true)
 */
export default function PageHeader({ title = "", showUserAvatar = true }) {
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
    <div className="flex items-center justify-between mb-6">
      <h1 className="text-2xl font-semibold text-slate-100">{title}</h1>
      {showUserAvatar && (
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
      )}
    </div>
  );
}
