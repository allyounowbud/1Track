import { useEffect, useState } from "react";
import { supabase } from "../lib/supabaseClient";

export function useAuth() {
  const [userInfo, setUserInfo] = useState({ avatar_url: "", username: "" });

  useEffect(() => {
    async function loadUser() {
      try {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) return setUserInfo({ avatar_url: "", username: "Local User" });
        const m = user.user_metadata || {};
        const username =
          m.user_name || m.preferred_username || m.full_name || m.name || user.email || "Account";
        const avatar_url = m.avatar_url || m.picture || "";
        setUserInfo({ avatar_url, username });
      } catch (error) {
        console.log("Auth error (expected in local testing):", error);
        setUserInfo({ avatar_url: "", username: "Local User" });
      }
    }
    
    loadUser();
    
    try {
      const { data: sub } = supabase.auth.onAuthStateChange((_e, session) => {
        const user = session?.user;
        if (!user) return setUserInfo({ avatar_url: "", username: "Local User" });
        const m = user.user_metadata || {};
        const username =
          m.user_name || m.preferred_username || m.full_name || m.name || user.email || "Account";
        const avatar_url = m.avatar_url || m.picture || "";
        setUserInfo({ avatar_url, username });
      });
      return () => sub?.subscription?.unsubscribe();
    } catch (error) {
      console.log("Auth state change error (expected in local testing):", error);
      return () => {};
    }
  }, []);

  return userInfo;
}
