// src/routes/Hub.jsx
import React, { useState } from "react";
import { Link } from "react-router-dom";
import { supabase } from "../lib/supabaseClient";
import { useAuth } from "../hooks/useAuth.js";
import { card } from "../utils/ui.js";
import LayoutWithSidebar from "../components/LayoutWithSidebar.jsx";
import PageHeader from "../components/PageHeader.jsx";

const tile =
  "group rounded-2xl border border-slate-800 bg-slate-900/60 hover:bg-slate-900 transition p-5 flex items-start gap-4";

export default function Hub() {
  const userInfo = useAuth();
  const [currentPage, setCurrentPage] = useState(1);
  const entriesPerPage = 10;

  async function signOut() {
    try {
      await supabase.auth.signOut();
      window.location.href = "/login";
    } catch (error) {
      console.log("Sign out error (expected in local testing):", error);
      window.location.href = "/login";
    }
  }

  // Changelog data with version numbers
  const changelogData = [
    {
      version: "0.1.1",
      title: "Reverted to Exact Version Before Input Outline Changes",
      description: "Completely reverted to the exact version from before input outline changes were made. Removed profile sections from both HeaderWithTabs and PageHeader components since they're now available in the sidebar. Reverted input focus styles from ring-based focus indicators back to simple border color changes (focus:border-indigo-500). Updated bulk action buttons from rounded-xl to rounded-lg for proper rounded square styling consistent with the site's design.",
      color: "bg-yellow-500/70",
      timestamp: "2024-12-19 22:00"
    },
    {
      version: "0.1.0",
      title: "Fixed Sidebar Positioning and User Account Section",
      description: "Fixed two critical sidebar issues: 1) Made the sidebar fixed in place so it doesn't scroll with the page content - only the main content area scrolls now, providing a proper dashboard experience. 2) Fixed the user account section at the bottom of the sidebar to stay properly contained within the sidebar bounds instead of extending across the entire page. The profile section now correctly stays at the bottom of the sidebar with proper background and positioning.",
      color: "bg-yellow-500/70",
      timestamp: "2024-12-19 21:00"
    },
    {
      version: "0.0.9",
      title: "Fixed Sidebar Navigation - All Pages Now Use Sidebar",
      description: "Updated all remaining pages (QuickAdd, MarkSold, Inventory, Stats, Settings) to use the new collapsible sidebar navigation instead of the old HeaderWithTabs component. Now all pages consistently use the modern sidebar layout, providing a unified navigation experience across the entire application. The sidebar shows the appropriate section-specific navigation for each page and maintains the collapsible functionality for optimal space usage.",
      color: "bg-yellow-500/70",
      timestamp: "2024-12-19 20:45"
    },
    {
      version: "0.0.8",
      title: "Implemented Collapsible Sidebar Navigation",
      description: "Completely redesigned the navigation system with a modern collapsible left sidebar that replaces the header tabs. The sidebar includes section-specific navigation (Order Book, Emails, Profiles) with icons and labels, a collapsible toggle button, and user account information at the bottom. This provides significantly more space for content, eliminates tab wrapping issues, and creates a modern dashboard feel similar to popular applications like Notion and Linear. The sidebar can be collapsed to save even more space when needed.",
      color: "bg-yellow-500/70",
      timestamp: "2024-12-19 20:30"
    },
    {
      version: "0.0.7",
      title: "Reverted to Original Two-Line Header Layout",
      description: "Reverted the compact single-line header layout back to the original two-line design with the title and user avatar on the first line, and navigation tabs on a separate line below. The original layout provides better visual hierarchy, clearer separation of elements, and more comfortable spacing for navigation. This maintains the familiar and proven user interface that users are accustomed to while preserving all functionality.",
      color: "bg-yellow-500/70",
      timestamp: "2024-12-19 20:15"
    },
    {
      version: "0.0.6",
      title: "Implemented Compact Single-Line Header Layout",
      description: "Redesigned the header layout to save significant vertical space by combining the title, navigation tabs, and user avatar into a single horizontal line. Reduced title size from text-3xl to text-2xl, made tabs more compact with smaller icons and tighter spacing, and streamlined the user avatar to a smaller, more efficient design. This saves approximately 50px of vertical space while maintaining all functionality and improving the overall user experience with more content visible above the fold.",
      color: "bg-yellow-500/70",
      timestamp: "2024-12-19 20:00"
    },
    {
      version: "0.0.5",
      title: "Removed Logo and Fine-Tuned BETA Badge Alignment",
      description: "Removed the logo image from all header components to create a cleaner, more minimal brand presentation. Adjusted the BETA badge positioning by increasing the bottom margin from mb-0.5 to mb-1 to better align with the OneTrack title baseline. This creates a more refined and focused header design that emphasizes the typography while maintaining the subtle BETA status indication.",
      color: "bg-yellow-500/70",
      timestamp: "2024-12-19 19:45"
    },
    {
      version: "0.0.4",
      title: "Reduced BETA Badge Text Size for Subtle Branding",
      description: "Made the BETA badge text smaller (changed from text-sm to text-xs) while maintaining its perfect positioning on the bottom baseline nearly touching the OneTrack title. This creates a more subtle and refined appearance that clearly indicates the beta status without overwhelming the main brand name. The smaller size makes the BETA badge feel more like a natural typographic element while preserving the precise alignment and spacing that was previously achieved.",
      color: "bg-yellow-500/70",
      timestamp: "2024-12-19 19:30"
    },
    {
      version: "0.0.3",
      title: "Fine-Tuned BETA Badge Positioning for Perfect Alignment",
      description: "Further refined the BETA badge positioning to achieve perfect visual alignment. Moved the BETA text even closer to the OneTrack title using negative left margin (-ml-1) so it's nearly touching, and adjusted the vertical position (mb-0.5) to perfectly align with the bottom baseline of the title text. This creates the most precise and professional typography alignment possible, ensuring the BETA badge appears as a natural extension of the OneTrack brand name.",
      color: "bg-yellow-500/70",
      timestamp: "2024-12-19 19:15"
    },
    {
      version: "0.0.2",
      title: "Refined Header Logo and BETA Badge Positioning",
      description: "Improved the visual alignment of the header elements by pushing the logo closer to the OneTrack title (reduced gap from 3 to 2) and repositioning the BETA badge to align with the bottom baseline of the title text. The BETA text now sits lower and closer to the title, creating a more cohesive and professional appearance. This refinement enhances the overall visual hierarchy and brand presentation across all pages.",
      color: "bg-yellow-500/70",
      timestamp: "2024-12-19 19:00"
    },
    {
      version: "0.0.1",
      title: "Added App Logo and BETA Badge to Headers",
      description: "Enhanced the application branding by adding the OneTrack logo to the left of the title in all header components. Added a subtle 'BETA' badge in ghost text styling to the right of the OneTrack title across all pages (Hub, Order Book, Emails, Shipments, and Profiles). This provides consistent branding and clearly indicates the application's beta status to users while maintaining the clean, professional appearance of the interface.",
      color: "bg-yellow-500/70",
      timestamp: "2024-12-19 18:45"
    }
  ];

  // Helper function to determine which page a changelog entry should link to
  const getChangelogLink = (title, description) => {
    const titleLower = title.toLowerCase();
    const descLower = description.toLowerCase();
    
    // Order Book related
    if (titleLower.includes('order book') || titleLower.includes('mark as sold') || 
        descLower.includes('order book') || descLower.includes('orders')) {
      return '/orders';
    }
    
    // Stats related
    if (titleLower.includes('stats') || titleLower.includes('analytics') || 
        titleLower.includes('kpi') || titleLower.includes('financial trend') ||
        descLower.includes('stats') || descLower.includes('analytics') || 
        descLower.includes('kpi') || descLower.includes('chart')) {
      return '/stats';
    }
    
    // Inventory related
    if (titleLower.includes('inventory') || descLower.includes('inventory')) {
      return '/inventory';
    }
    
    // Emails related
    if (titleLower.includes('email') || titleLower.includes('gmail') || 
        descLower.includes('email') || descLower.includes('gmail')) {
      return '/emails';
    }
    
    // Shipments related
    if (titleLower.includes('shipment') || descLower.includes('shipment')) {
      return '/shipments';
    }
    
    // Settings/Database related
    if (titleLower.includes('database') || titleLower.includes('settings') || 
        descLower.includes('database') || descLower.includes('settings')) {
      return '/database';
    }
    
    // Default to hub for general app updates
    return null;
  };

  // Pagination logic
  const totalPages = Math.ceil(changelogData.length / entriesPerPage);
  const startIndex = (currentPage - 1) * entriesPerPage;
  const endIndex = startIndex + entriesPerPage;
  const currentEntries = changelogData.slice(startIndex, endIndex);

  // Changelog entry component
  const ChangelogEntry = ({ title, description, color, linkTo, timestamp, version }) => {
    const content = (
      <div className="flex items-start gap-3">
        <div className={`h-2 w-2 rounded-full ${color} mt-2 flex-shrink-0`}></div>
        <div className="flex-1">
          <div className="flex items-center justify-between">
            <div className="text-sm font-medium text-slate-200">{title}</div>
            <div className="flex items-center gap-2">
              {version && (
                <div className="text-xs text-slate-400 bg-slate-800/50 px-2 py-1 rounded">
                  v{version}
                </div>
              )}
              {timestamp && (
                <div className="text-xs text-slate-500">{timestamp}</div>
              )}
            </div>
          </div>
          <div className="text-xs text-slate-400">{description}</div>
        </div>
      </div>
    );

    if (linkTo) {
      return (
        <Link to={linkTo} className="block hover:bg-slate-800/30 rounded-lg p-2 -m-2 transition-colors">
          {content}
        </Link>
      );
    }

    return content;
  };

  return (
    <LayoutWithSidebar active="hub" section="orderbook">
      <PageHeader title="Home" showUserAvatar={false} />

        {/* Welcome / account (Sign out button lives here) */}
        <div className={`${card} mb-6`}>
          <div className="flex items-center gap-4">
            {userInfo.avatar_url ? (
              <img
                src={userInfo.avatar_url}
                alt=""
                className="h-12 w-12 rounded-full border border-slate-800 object-cover"
              />
            ) : (
              <div className="h-12 w-12 rounded-full bg-slate-800 grid place-items-center text-slate-300">
                {(userInfo.username || "U").slice(0, 1).toUpperCase()}
              </div>
            )}
            <div className="flex-1">
              <div className="text-lg font-semibold">Welcome, {userInfo.username}</div>
              {userInfo.email && (
                <div className="text-slate-400 text-sm">{userInfo.email}</div>
              )}
            </div>

            <button
  type="button"
  onClick={signOut}
  className="h-10 px-4 inline-flex items-center justify-center leading-none rounded-xl
             bg-rose-600 hover:bg-rose-500 text-white cursor-pointer
             focus:outline-none focus:ring-2 focus:ring-rose-400/50
             active:scale-[.99] transition"
>
  Sign out
</button>

          </div>
        </div>

        {/* App tiles */}
        <div className={`${card} mb-6`}>
          <h2 className="text-lg font-semibold mb-4">Choose a workspace</h2>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            <Link to="/orders" className={tile}>
              <div className="h-12 w-12 rounded-xl bg-indigo-600/20 grid place-items-center text-indigo-300">
                🧾
              </div>
              <div className="flex-1">
                <div className="text-xl font-semibold">Order Book</div>
                <div className="text-slate-400 text-sm">
                  Track purchases, sales, and inventory. Quickly add new orders, mark existing orders as sold, 
                  and track your stats from anywhere!
                </div>
                <div className="mt-3 inline-flex items-center text-indigo-300 group-hover:text-indigo-200">
                  Open →
                </div>
              </div>
            </Link>

            <Link to="/emails" className={tile}>
              <div className="h-12 w-12 rounded-xl bg-emerald-600/20 grid place-items-center text-emerald-300">
                <svg className="h-6 w-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <rect x="3" y="5" width="18" height="14" rx="2" />
                  <path d="M3 7l9 6 9-6" />
                </svg>
              </div>
              <div className="flex-1">
                <div className="text-xl font-semibold">Emails</div>
                <div className="text-slate-400 text-sm">
                  Auto-import orders & shipping updates. Connect your Gmail to automatically sync order confirmations, 
                  track shipments, and add orders to your order book.
                </div>
                <div className="mt-3 inline-flex items-center text-emerald-300 group-hover:text-emerald-200">
                  Open →
                </div>
              </div>
            </Link>

            <div className={tile}>
              <div className="h-12 w-12 rounded-xl bg-purple-600/20 grid place-items-center text-purple-300">
                <svg className="h-6 w-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                </svg>
              </div>
              <div className="flex-1">
                <div className="text-xl font-semibold">Profiles</div>
                <div className="text-slate-400 text-sm">
                  Manage your profiles and seller marketplaces. Track performance across different platforms, 
                  manage inventory distribution, and optimize your selling strategy.
                </div>
                <div className="mt-3 inline-flex items-center text-purple-300">
                  Coming soon
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Changelog */}
        <div className={`${card}`}>
          <div className="mb-4">
            <h2 className="text-lg font-semibold">Changelog</h2>
            <div className="text-xs text-slate-400/60">v{changelogData[0]?.version || "0.1.1"}</div>
          </div>
          
        <div className="space-y-3">
          {/* Paginated Changelog Entries */}
          {currentEntries.map((entry, index) => (
            <ChangelogEntry
              key={`${entry.version}-${index}`}
              title={entry.title}
              description={entry.description}
              color={entry.color}
              linkTo={getChangelogLink(entry.title, entry.description)}
              timestamp={entry.timestamp}
              version={entry.version}
            />
          ))}
        </div>

        {/* Pagination Controls */}
        {totalPages > 1 && (
          <div className="flex items-center justify-between mt-6 pt-4 border-t border-slate-800">
            <div className="text-sm text-slate-400">
              Showing {startIndex + 1}-{Math.min(endIndex, changelogData.length)} of {changelogData.length} entries
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
                disabled={currentPage === 1}
                className="px-3 py-1 text-sm rounded-lg border border-slate-700 bg-slate-800/50 text-slate-300 hover:bg-slate-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                Previous
              </button>
              <div className="flex items-center gap-1">
                {Array.from({ length: totalPages }, (_, i) => i + 1).map(page => (
                  <button
                    key={page}
                    onClick={() => setCurrentPage(page)}
                    className={`px-3 py-1 text-sm rounded-lg border transition-colors ${
                      currentPage === page
                        ? 'border-indigo-600 bg-indigo-600 text-white'
                        : 'border-slate-700 bg-slate-800/50 text-slate-300 hover:bg-slate-700'
                    }`}
                  >
                    {page}
                  </button>
                ))}
              </div>
              <button
                onClick={() => setCurrentPage(prev => Math.min(totalPages, prev + 1))}
                disabled={currentPage === totalPages}
                className="px-3 py-1 text-sm rounded-lg border border-slate-700 bg-slate-800/50 text-slate-300 hover:bg-slate-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                Next
              </button>
            </div>
          </div>
        )}
        </div>
    </LayoutWithSidebar>
  );
}
