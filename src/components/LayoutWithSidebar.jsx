// src/components/LayoutWithSidebar.jsx
import { useState } from "react";
import Sidebar from "./Sidebar";

/**
 * Props:
 * - children: React.ReactNode
 * - active: string (current active section)
 * - section: "orderbook" | "emails" | "profiles"
 */
export default function LayoutWithSidebar({ children, active, section }) {
  // Initialize from localStorage, default to collapsed (true)
  const [sidebarCollapsed, setSidebarCollapsed] = useState(() => {
    const saved = localStorage.getItem('sidebar-collapsed');
    return saved !== null ? JSON.parse(saved) : true;
  });

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100">
      {/* Sidebar */}
      <Sidebar active={active} section={section} onCollapseChange={setSidebarCollapsed} />
      
      {/* Main Content */}
      <div className={`flex-1 flex flex-col transition-all duration-300 ${
        sidebarCollapsed ? 'ml-20' : 'ml-64'
      }`}>
        <div className="flex-1 max-w-[95vw] mx-auto p-4 sm:p-6 w-full">
          {children}
        </div>
      </div>
    </div>
  );
}
