// src/components/Sidebar.jsx
import { useState, useEffect } from "react";
import { NavLink, Link } from "react-router-dom";
import { supabase } from "../lib/supabaseClient";
import ThemeToggle from "./ThemeToggle";

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
  const [apiStatus, setApiStatus] = useState("connecting"); // "connected", "connecting", "disconnected"
  const [isSmallScreen, setIsSmallScreen] = useState(() => {
    // Initialize with immediate check to prevent flash
    if (typeof window !== 'undefined') {
      const width = window.innerWidth || document.documentElement.clientWidth || document.body.clientWidth;
      return width < 650;
    }
    return false;
  });
  const [isLargeScreen, setIsLargeScreen] = useState(() => {
    // Initialize with immediate check to prevent flash
    if (typeof window !== 'undefined') {
      const width = window.innerWidth || document.documentElement.clientWidth || document.body.clientWidth;
      return width >= 1024; // lg breakpoint
    }
    return false;
  });

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

  // Check API status
  useEffect(() => {
    const checkApiStatus = async () => {
      try {
        setApiStatus("connecting");
        // Test the Price Charting API endpoint
        const response = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/price-charting`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${import.meta.env.VITE_SUPABASE_ANON_KEY}`
          },
          body: JSON.stringify({ query: 'test' })
        });
        
        if (response.ok) {
          setApiStatus("connected");
        } else {
          setApiStatus("disconnected");
        }
      } catch (error) {
        console.error('API status check failed:', error);
        setApiStatus("disconnected");
      }
    };

    // Check immediately and then every 30 seconds
    checkApiStatus();
    const interval = setInterval(checkApiStatus, 30000);

    return () => clearInterval(interval);
  }, []);

  // Handle responsive behavior
  useEffect(() => {
    const checkScreenSize = () => {
      const width = window.innerWidth || document.documentElement.clientWidth || document.body.clientWidth;
      const small = width < 650; // Custom breakpoint for mobile bottom bar
      const large = width >= 1024; // lg breakpoint
      setIsSmallScreen(small);
      setIsLargeScreen(large);
      // Force collapse on small screens
      if (small && !isCollapsed) {
        setIsCollapsed(true);
        localStorage.setItem('sidebar-collapsed', JSON.stringify(true));
        onCollapseChange?.(true);
      }
      // Force collapse on mid-size screens (not large screens)
      if (!small && !large && !isCollapsed) {
        setIsCollapsed(true);
        localStorage.setItem('sidebar-collapsed', JSON.stringify(true));
        onCollapseChange?.(true);
      }
    };

    checkScreenSize();
    window.addEventListener('resize', checkScreenSize);
    window.addEventListener('orientationchange', checkScreenSize);
    return () => {
      window.removeEventListener('resize', checkScreenSize);
      window.removeEventListener('orientationchange', checkScreenSize);
    };
  }, [isCollapsed, onCollapseChange]);

  // Base + variants for sidebar items
  const itemBase = isCollapsed 
    ? "flex items-center justify-center w-10 h-10 rounded-lg transition-colors"
    : "flex items-center gap-3 px-3 py-2 rounded-lg transition-colors";
  const itemIdle = "text-gray-600 dark:text-slate-300 hover:text-gray-900 dark:hover:text-slate-100 hover:bg-gray-100 dark:hover:bg-slate-800/50";
  const itemActive = "text-gray-900 dark:text-white bg-gray-100 dark:bg-slate-800 shadow-sm";

  const getItemClass = (key) => {
    const isActive = active === key;
    return `${itemBase} ${isActive ? itemActive : itemIdle}`;
  };

  // Section-specific navigation items
  const getNavigationItems = () => {
    // Home is always first
    const homeItem = { key: "hub", label: "Home", icon: "M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6", to: "/" };
    
    // Check if we're on the homepage (active is "hub")
      if (active === "hub") {
        // On homepage, show workspace tabs
        return [
          homeItem,
          { key: "orderbook", label: "Order Book", icon: "M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z", to: "/add" },
          { key: "portfolio", label: "Portfolio", icon: "M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z", to: "/portfolio" },
          { key: "emails", label: "Emails", icon: "M3 8l7.89 4.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z", to: "/emails" },
          { key: "profiles", label: "Profiles", icon: "M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z", to: "/profiles" },
          { key: "database", label: "Database", icon: "M4 7v10c0 2.21 3.582 4 8 4s8-1.79 8-4V7M4 7c0 2.21 3.582 4 8 4s8-1.79 8-4M4 7c0-2.21 3.582-4 8-4s8 1.79 8 4", to: "/database" }
        ];
      }
    
    // When in a specific section, show section-specific items
    switch (section) {
      case "orderbook":
        return [
          homeItem,
          { key: "add", label: "Quick Add", icon: "M12 4.5v15m7.5-7.5h-15", to: "/add" },
          { key: "sold", label: "Mark as Sold", icon: "M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z", to: "/sold" },
          { key: "orders", label: "Order Book", icon: "M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z", to: "/orders" }
        ];
      case "emails":
        return [
          homeItem,
          { key: "emails", label: "Emails", icon: "M3 8l7.89 4.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z", to: "/emails" },
          { key: "shipments", label: "Shipments", icon: "M8 7h12m0 0l-4-4m4 4l-4 4m0 6H4m0 0l4 4m-4-4l4-4", to: "/shipments" }
        ];
      case "profiles":
        return [
          homeItem,
          { key: "profiles", label: "Profiles", icon: "M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z", to: "/profiles" }
        ];
      case "database":
        return [
          homeItem,
          { key: "products", label: "Products", icon: "M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4", to: "/database/products" },
          { key: "retailers", label: "Retailers", icon: "M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4", to: "/database/retailers" },
          { key: "marketplaces", label: "Marketplaces", icon: "M13 7h8m0 0v8m0-8l-8 8-4-4-6 6", to: "/database/marketplaces" }
        ];
      case "portfolio":
        return [
          homeItem,
          { key: "portfolio-overview", label: "Overview", icon: "M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z", to: "/portfolio" },
          { key: "portfolio-collection", label: "Collection", icon: "M4 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2V6zM14 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2V6zM4 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2v-2zM14 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2v-2z", to: "/portfolio/collection" },
          { key: "portfolio-search", label: "Search", icon: "M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z", to: "/portfolio/search" },
          { key: "portfolio-stats", label: "Stats", icon: "M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z", to: "/portfolio/stats" }
        ];
      default:
        return [homeItem];
    }
  };

  const navigationItems = getNavigationItems();

  // Mobile bottom bar layout
  if (isSmallScreen) {
    return (
      <div className="mobile-bottom-bar fixed bottom-0 left-0 right-0 bg-white dark:bg-slate-900 border-t border-gray-200 dark:border-slate-800 h-16 pb-safe transition-colors duration-300">
        {/* Navigation - horizontal layout for mobile */}
        <nav className="flex items-center justify-around px-2 py-2 h-full">
          {navigationItems.map((item) => {
            const isActive = active === item.key;
            return (
              <NavLink
                key={item.key}
                to={item.to}
                end
                className={`flex flex-col items-center justify-center p-2 rounded-lg transition-colors min-w-0 flex-1 h-full ${
                  isActive 
                    ? 'text-gray-900 dark:text-white bg-gray-100 dark:bg-slate-800 shadow-sm' 
                    : 'text-gray-600 dark:text-slate-300'
                }`}
              >
                <svg className="h-5 w-5 mb-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d={item.icon} />
                </svg>
                <span className="text-xs font-medium truncate text-center leading-tight hidden xs:block">
                  {item.label}
                </span>
              </NavLink>
            );
          })}
        </nav>
      </div>
    );
  }

  // Desktop sidebar layout
  return (
    <div 
      className={`sidebar-fixed bg-white dark:bg-slate-900 border-r border-gray-200 dark:border-slate-800 transition-all duration-300 ${
        isCollapsed ? 'w-16' : 'w-64'
      }`}
    >
      {/* Header */}
      <div className={`${isCollapsed ? 'flex justify-center py-3' : 'p-4'} border-b border-gray-200 dark:border-slate-800`}>
        <div className={`${isCollapsed ? 'flex items-center justify-center' : 'flex items-center justify-between'}`}>
          {!isCollapsed && (
            <div className="flex items-end gap-2">
              <h1 className="text-xl font-bold text-gray-900 dark:text-white">OneTrack</h1>
              <span className="text-xs text-gray-500 dark:text-slate-400 font-medium mb-1 -ml-1">BETA</span>
            </div>
          )}
          {/* Show expand/collapse button and theme toggle only on large screens */}
          {isLargeScreen && (
            <div className={`flex items-center ${isCollapsed ? 'flex-col gap-2' : 'gap-2'}`}>
              <ThemeToggle />
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
                } text-gray-600 dark:text-slate-300 hover:text-gray-900 dark:hover:text-slate-100 hover:bg-gray-100 dark:hover:bg-slate-800/50`}
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
            </div>
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

      {/* API Status Indicator */}
      <div className={`flex-shrink-0 ${isCollapsed ? 'flex justify-center py-2' : 'flex justify-center py-2'}`}>
        {isCollapsed ? (
          <div className="flex items-center justify-center">
            <div 
              className={`w-3 h-3 rounded-full ${
                apiStatus === 'connected' ? 'bg-green-500 animate-pulse' :
                apiStatus === 'connecting' ? 'bg-yellow-500 animate-pulse' :
                'bg-red-500 animate-pulse'
              }`}
              title={`API Status: ${apiStatus}`}
            />
          </div>
        ) : (
          <div className="flex items-center justify-center gap-2 text-xs text-gray-500 dark:text-slate-400">
            <div 
              className={`w-2 h-2 rounded-full ${
                apiStatus === 'connected' ? 'bg-green-500 animate-pulse' :
                apiStatus === 'connecting' ? 'bg-yellow-500 animate-pulse' :
                'bg-red-500 animate-pulse'
              }`}
            />
            <span className="capitalize">API {apiStatus}</span>
          </div>
        )}
      </div>

      {/* User Section */}
      <div className={`border-t border-gray-200 dark:border-slate-800 bg-white dark:bg-slate-900 flex-shrink-0 ${isCollapsed ? 'flex justify-center py-4' : 'p-4'}`}>
        {isCollapsed ? (
          // Collapsed: Profile image fills entire button
          <Link
            to="/"
            className="flex items-center justify-center w-10 h-10 rounded-lg transition-colors text-gray-600 dark:text-slate-300 hover:text-gray-900 dark:hover:text-slate-100 hover:bg-gray-100 dark:hover:bg-slate-800/50"
          >
            {userInfo.avatar_url ? (
              <img
                src={userInfo.avatar_url}
                alt=""
                className="w-full h-full rounded-lg object-cover"
              />
            ) : (
              <div className="w-full h-full rounded-lg bg-gray-100 dark:bg-slate-800 flex items-center justify-center text-gray-600 dark:text-slate-300 text-base font-semibold">
                {(userInfo.username || "U").slice(0, 1).toUpperCase()}
              </div>
            )}
          </Link>
        ) : (
          // Expanded: Profile image + text
          <Link
            to="/"
            className="flex items-center gap-3 px-3 py-2 rounded-lg hover:bg-gray-100 dark:hover:bg-slate-800/50 transition-colors"
          >
            {userInfo.avatar_url ? (
              <img
                src={userInfo.avatar_url}
                alt=""
                className="h-8 w-8 rounded-lg object-cover flex-shrink-0"
              />
            ) : (
              <div className="h-8 w-8 rounded-lg bg-gray-100 dark:bg-slate-800 grid place-items-center text-gray-600 dark:text-slate-300 text-sm flex-shrink-0">
                {(userInfo.username || "U").slice(0, 1).toUpperCase()}
              </div>
            )}
            <div className="min-w-0">
              <div className="text-sm font-medium text-gray-900 dark:text-slate-100 truncate">
                {userInfo.username}
              </div>
              <div className="text-xs text-gray-500 dark:text-slate-400 truncate">
                Beta User
              </div>
            </div>
          </Link>
        )}
      </div>
    </div>
  );
}
