// src/components/Sidebar.jsx
import { useState, useEffect } from "react";
import { NavLink, Link } from "react-router-dom";
import { supabase } from "../lib/supabaseClient";

/**
 * Props:
 * - active: string (current active section)
 * - section: "orderbook" | "emails" | "profiles"
 * - onCollapseChange: function (isCollapsed: boolean) => void
 */
export default function Sidebar({ active = "", section = "orderbook", onCollapseChange }) {
  // Initialize from localStorage, default to collapsed (true)
  const [isCollapsed, setIsCollapsed] = useState(() => {
    const saved = localStorage.getItem('sidebar-collapsed');
    return saved !== null ? JSON.parse(saved) : true;
  });
  const [userInfo, setUserInfo] = useState({ avatar_url: "", username: "" });
  const [isSmallScreen, setIsSmallScreen] = useState(false);

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

  // Handle responsive behavior
  useEffect(() => {
    const checkScreenSize = () => {
      const small = window.innerWidth < 1024; // lg breakpoint
      setIsSmallScreen(small);
      // Force collapse on small screens
      if (small && !isCollapsed) {
        setIsCollapsed(true);
        localStorage.setItem('sidebar-collapsed', JSON.stringify(true));
        onCollapseChange?.(true);
      }
    };

    checkScreenSize();
    window.addEventListener('resize', checkScreenSize);
    return () => window.removeEventListener('resize', checkScreenSize);
  }, [isCollapsed, onCollapseChange]);

  // Base + variants for sidebar items
  const itemBase = isCollapsed 
    ? "flex items-center justify-center w-10 h-10 rounded-lg transition-colors"
    : "flex items-center gap-3 px-3 py-2 rounded-lg transition-colors";
  const itemIdle = "text-slate-300 hover:text-slate-100 hover:bg-slate-800/50";
  const itemActive = "text-white bg-slate-800 shadow-sm";

  const getItemClass = (key) => {
    const isActive = active === key;
    return `${itemBase} ${isActive ? itemActive : itemIdle}`;
  };

  // Section-specific navigation items
  const getNavigationItems = () => {
    switch (section) {
      case "orderbook":
        return [
          { key: "hub", label: "Home", icon: "M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6", to: "/" },
          { key: "add", label: "Quick Add", icon: "M12 6v6m0 0v6m0-6h6m-6 0H6", to: "/add" },
          { key: "sold", label: "Mark as Sold", icon: "M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z", to: "/sold" },
          { key: "orders", label: "Order Book", icon: "M9 5H7a2 2 0 00-2 2v10a2 2 0 002 2h8a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2", to: "/orders" },
          { key: "inventory", label: "Inventory", icon: "M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4", to: "/inventory" },
          { key: "stats", label: "Stats", icon: "M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z", to: "/stats" },
          { key: "database", label: "Database", icon: "M4 7v10c0 2.21 3.582 4 8 4s8-1.79 8-4V7M4 7c0 2.21 3.582 4 8 4s8-1.79 8-4M4 7c0-2.21 3.582-4 8-4s8 1.79 8 4", to: "/database" }
        ];
      case "emails":
        return [
          { key: "hub", label: "Home", icon: "M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6", to: "/" },
          { key: "emails", label: "Emails", icon: "M3 8l7.89 4.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z", to: "/emails" },
          { key: "shipments", label: "Shipments", icon: "M8 7h12m0 0l-4-4m4 4l-4 4m0 6H4m0 0l4 4m-4-4l4-4", to: "/shipments" }
        ];
      case "profiles":
        return [
          { key: "hub", label: "Home", icon: "M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6", to: "/" },
          { key: "profiles", label: "Profiles", icon: "M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z", to: "/profiles" }
        ];
      default:
        return [];
    }
  };

  const navigationItems = getNavigationItems();

  return (
    <div 
      className={`sidebar-fixed bg-slate-900 border-r border-slate-800 transition-all duration-300 ${
        isCollapsed ? 'w-16' : 'w-64'
      }`}
    >
      {/* Header */}
      <div className={`${isCollapsed ? 'flex justify-center py-3' : 'p-4'} border-b border-slate-800`}>
        <div className={`${isCollapsed ? 'flex items-center justify-center' : 'flex items-center justify-between'}`}>
          {!isCollapsed && (
            <div className="flex items-end gap-2">
              <h1 className="text-xl font-bold">OneTrack</h1>
              <span className="text-xs text-slate-500 font-medium mb-1 -ml-1">BETA</span>
            </div>
          )}
          {isSmallScreen ? (
            // Show logo on small screens
            <div className="flex items-center justify-center w-10 h-10 rounded-lg">
              <img 
                src="/otlogo.svg" 
                alt="OneTrack" 
                className="h-8 w-8 object-contain"
              />
            </div>
          ) : (
            // Show expand/collapse button on large screens
            <button
              onClick={() => {
                const newCollapsed = !isCollapsed;
                setIsCollapsed(newCollapsed);
                // Save to localStorage to persist across page navigation
                localStorage.setItem('sidebar-collapsed', JSON.stringify(newCollapsed));
                onCollapseChange?.(newCollapsed);
              }}
              className={`${isCollapsed 
                ? "flex items-center justify-center w-10 h-10 rounded-lg transition-colors" 
                : "flex items-center gap-3 px-3 py-2 rounded-lg transition-colors"
              } text-slate-300 hover:text-slate-100 hover:bg-slate-800/50`}
            >
              <svg 
                className={`h-5 w-5 transition-transform ${isCollapsed ? 'rotate-180' : ''}`} 
                fill="none" 
                stroke="currentColor" 
                viewBox="0 0 24 24"
              >
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
              </svg>
            </button>
          )}
        </div>
      </div>

      {/* Navigation - flex-1 to take available space */}
      <nav className={`flex-1 ${isCollapsed ? 'flex flex-col items-center py-4 space-y-1' : 'p-4 space-y-1'}`}>
        {navigationItems.map((item) => (
          <NavLink
            key={item.key}
            to={item.to}
            end
            className={getItemClass(item.key)}
          >
            <svg className={`${isCollapsed ? 'h-5 w-5' : 'h-5 w-5 flex-shrink-0'}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d={item.icon} />
            </svg>
            {!isCollapsed && (
              <span className="text-sm font-medium truncate">{item.label}</span>
            )}
          </NavLink>
        ))}
      </nav>

      {/* User Section */}
      <div className="p-4 border-t border-slate-800 bg-slate-900 flex-shrink-0 flex justify-center">
        {isCollapsed ? (
          // Collapsed: Profile image fills entire button
          <Link
            to="/"
            className="flex items-center justify-center w-10 h-10 rounded-lg transition-colors text-slate-300 hover:text-slate-100 hover:bg-slate-800/50"
          >
            {userInfo.avatar_url ? (
              <img
                src={userInfo.avatar_url}
                alt=""
                className="w-10 h-10 rounded-lg object-cover"
              />
            ) : (
              <div className="w-10 h-10 rounded-lg bg-slate-800 flex items-center justify-center text-slate-300 text-base font-semibold">
                {(userInfo.username || "U").slice(0, 1).toUpperCase()}
              </div>
            )}
          </Link>
        ) : (
          // Expanded: Profile image + text
          <Link
            to="/"
            className="flex items-center gap-3 p-2 rounded-lg hover:bg-slate-800/50 transition-colors"
          >
            {userInfo.avatar_url ? (
              <img
                src={userInfo.avatar_url}
                alt=""
                className="h-8 w-8 rounded-lg object-cover flex-shrink-0"
              />
            ) : (
              <div className="h-8 w-8 rounded-lg bg-slate-800 grid place-items-center text-slate-300 text-sm flex-shrink-0">
                {(userInfo.username || "U").slice(0, 1).toUpperCase()}
              </div>
            )}
            <div className="min-w-0">
              <div className="text-sm font-medium text-slate-100 truncate">
                {userInfo.username}
              </div>
              <div className="text-xs text-slate-400 truncate">
                Account
              </div>
            </div>
          </Link>
        )}
      </div>
    </div>
  );
}
