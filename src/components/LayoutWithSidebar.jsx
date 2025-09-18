// src/components/LayoutWithSidebar.jsx
import { useState, useEffect, useRef } from "react";
import { useLocation } from "react-router-dom";
import Sidebar from "./Sidebar";

/**
 * Props:
 * - children: React.ReactNode
 * - active: string (current active section)
 * - section: "orderbook" | "shipments" | "emails"
 */
export default function LayoutWithSidebar({ children, active, section }) {
  // Initialize from localStorage, default to collapsed (true)
  const [sidebarCollapsed, setSidebarCollapsed] = useState(() => {
    const saved = localStorage.getItem('sidebar-collapsed');
    return saved !== null ? JSON.parse(saved) : true;
  });
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
  const contentRef = useRef(null);
  const location = useLocation();

  // Handle responsive behavior
  useEffect(() => {
    const checkScreenSize = () => {
      const width = window.innerWidth || document.documentElement.clientWidth || document.body.clientWidth;
      const small = width < 650; // Custom breakpoint for mobile bottom bar
      const large = width >= 1024; // lg breakpoint
      setIsSmallScreen(small);
      setIsLargeScreen(large);
    };

    checkScreenSize();
    window.addEventListener('resize', checkScreenSize);
    window.addEventListener('orientationchange', checkScreenSize);
    return () => {
      window.removeEventListener('resize', checkScreenSize);
      window.removeEventListener('orientationchange', checkScreenSize);
    };
  }, []);

  // Scroll to top when route changes
  useEffect(() => {
    if (contentRef.current) {
      contentRef.current.scrollTop = 0;
    }
  }, [location.pathname]);

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-slate-950 text-gray-900 dark:text-slate-100">
      {/* Sidebar */}
      <Sidebar active={active} section={section} onCollapseChange={setSidebarCollapsed} />
      
      {/* Main Content */}
      <div className={`flex-1 flex flex-col ${
        isSmallScreen 
          ? 'main-content min-h-screen' // Use CSS class for bottom bar isolation
          : `transition-all duration-300 ${(sidebarCollapsed || !isLargeScreen) ? 'ml-16' : 'ml-64'}`
      }`}>
        
        <div ref={contentRef} className="flex-1 w-full p-4 sm:p-6">
          {children}
        </div>
      </div>
    </div>
  );
}
