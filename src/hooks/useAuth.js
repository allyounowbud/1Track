import { useEffect, useState } from "react";
import { supabase } from "../lib/supabaseClient";

export function useAuth() {
  // Initialize with cached data to prevent flickering
  const [userInfo, setUserInfo] = useState(() => {
    try {
      const cached = localStorage.getItem('user-info');
      return cached ? JSON.parse(cached) : { avatar_url: "", username: "" };
    } catch {
      return { avatar_url: "", username: "" };
    }
  });

  useEffect(() => {
    async function loadUser() {
      try {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) {
          const fallback = { avatar_url: "", username: "Local User" };
          setUserInfo(fallback);
          localStorage.setItem('user-info', JSON.stringify(fallback));
          return;
        }
        const m = user.user_metadata || {};
        const username =
          m.user_name || m.preferred_username || m.full_name || m.name || user.email || "Account";
        const avatar_url = m.avatar_url || m.picture || "";
        const newUserInfo = { avatar_url, username };
        setUserInfo(newUserInfo);
        localStorage.setItem('user-info', JSON.stringify(newUserInfo));
      } catch (error) {
        console.log("Auth error (expected in local testing):", error);
        const fallback = { avatar_url: "", username: "Local User" };
        setUserInfo(fallback);
        localStorage.setItem('user-info', JSON.stringify(fallback));
      }
    }
    
    loadUser();
    
    try {
      const { data: sub } = supabase.auth.onAuthStateChange((_e, session) => {
        const user = session?.user;
        if (!user) {
          const fallback = { avatar_url: "", username: "Local User" };
          setUserInfo(fallback);
          localStorage.setItem('user-info', JSON.stringify(fallback));
          return;
        }
        const m = user.user_metadata || {};
        const username =
          m.user_name || m.preferred_username || m.full_name || m.name || user.email || "Account";
        const avatar_url = m.avatar_url || m.picture || "";
        const newUserInfo = { avatar_url, username };
        setUserInfo(newUserInfo);
        localStorage.setItem('user-info', JSON.stringify(newUserInfo));
      });
      return () => sub?.subscription?.unsubscribe();
    } catch (error) {
      console.log("Auth state change error (expected in local testing):", error);
      return () => {};
    }
  }, []);

  return userInfo;
}
