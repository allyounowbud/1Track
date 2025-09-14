// src/routes/Hub.jsx
import React, { useState } from "react";
import { Link } from "react-router-dom";
import { supabase } from "../lib/supabaseClient";
import { useAuth } from "../hooks/useAuth.js";
import { card } from "../utils/ui.js";
import LayoutWithSidebar from "../components/LayoutWithSidebar.jsx";

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
      title: "Completely Redesigned Dropdown Components for Reliable Search and Add Functionality",
      description: "Fixed critical dropdown issues that were preventing users from selecting options or adding new items. Completely redesigned both SearchDropdown and SimpleSearchDropdown components with robust state management, proper input handling, and reliable 'Add +' functionality. Users can now search through existing options, select them reliably, and add new items/products/retailers/marketplaces directly from any dropdown. Enhanced Inventory page to support adding new items through the search dropdown. All dropdowns now work consistently across QuickAdd, MarkSold, Inventory, and Stats pages with proper keyboard navigation and click-outside-to-close behavior.",
      color: "bg-blue-500/70",
      date: "2024-12-19",
      time: "23:30",
      author: "Development Team"
    },
    {
      title: "Enhanced Target Order Parsing with Complete Email Format Support",
      description: "Completely redesigned Target order parsing to handle the exact email format shown in Target order confirmations. Enhanced parsing now extracts order numbers (including '#:102002814872430' format), customer names from 'Thanks for your order, [Name]!' greetings, order dates from 'Placed [Date]' text, order totals from 'Order total $48.28' format, product names like 'Pokémon Trading Card Game:Mega Latias ex Box', quantities from 'Qty: 2' format, unit prices from '$21.99 / ea' format, and product images. This ensures Target orders are comprehensively imported alongside Amazon orders, providing complete order tracking across all major retailers.",
      color: "bg-green-500/70",
      date: "2024-12-19",
      time: "22:45",
      author: "Development Team"
    },
    {
      title: "Redesigned Changelog Layout for Better Information Display",
      description: "Completely redesigned the changelog layout to better display information with improved visual hierarchy. Removed individual version numbers from each entry and kept only the main version number below the changelog title. Added prominent date, time, and author information for each entry with intuitive icons. Enhanced the layout with better spacing, clearer typography, and more professional presentation of changelog data.",
      color: "bg-yellow-500/70",
      date: "2024-12-19",
      time: "22:45",
      author: "Development Team"
    },
    {
      title: "Enhanced Mobile Experience and UI Improvements",
      description: "Significantly improved the mobile experience with responsive design enhancements. Made header selection text smaller on mobile to match input field text size. Hidden checkboxes on mobile rows and made entire rows clickable for easier selection with ghost text indicators. Reduced button sizes on mobile (w-8 h-8) while maintaining desktop sizes (w-10 h-10). Converted grid/list view buttons into a single toggle button to save space and distinguish view controls from action buttons. Added visual cues and better spacing for mobile interactions.",
      color: "bg-yellow-500/70",
      date: "2024-12-19",
      time: "22:30",
      author: "Development Team"
    },
    {
      title: "Updated Sign Out Button to Match App Design",
      description: "Redesigned the sign out button to match the rest of the web app's design language. Changed from a text-based button to an icon-based square button with rounded edges (rounded-lg). Uses the same styling as other icon buttons throughout the app with slate color scheme, hover effects, and proper accessibility with tooltip. The button now features a logout icon with subtle scale animation on hover.",
      color: "bg-yellow-500/70",
      date: "2024-12-19",
      time: "22:20",
      author: "Development Team"
    },
    {
      title: "Implemented Changelog Pagination and Version Numbering System",
      description: "Added pagination to the changelog to show only 10 entries at a time with navigation controls. Implemented a proper version numbering system that increments by 0.0.1 for each update. Each changelog entry now displays its version number in a styled badge alongside the timestamp. Added Previous/Next buttons and page numbers for easy navigation through changelog history.",
      color: "bg-yellow-500/70",
      date: "2024-12-19",
      time: "22:15",
      author: "Development Team"
    },
    {
      title: "Reverted to Exact Version Before Input Outline Changes",
      description: "Completely reverted to the exact version from before input outline changes were made. Removed profile sections from both HeaderWithTabs and PageHeader components since they're now available in the sidebar. Reverted input focus styles from ring-based focus indicators back to simple border color changes (focus:border-indigo-500). Updated bulk action buttons from rounded-xl to rounded-lg for proper rounded square styling consistent with the site's design.",
      color: "bg-yellow-500/70",
      date: "2024-12-19",
      time: "22:00",
      author: "Development Team"
    },
    {
      title: "Fixed Sidebar Positioning and User Account Section",
      description: "Fixed two critical sidebar issues: 1) Made the sidebar fixed in place so it doesn't scroll with the page content - only the main content area scrolls now, providing a proper dashboard experience. 2) Fixed the user account section at the bottom of the sidebar to stay properly contained within the sidebar bounds instead of extending across the entire page. The profile section now correctly stays at the bottom of the sidebar with proper background and positioning.",
      color: "bg-yellow-500/70",
      date: "2024-12-19",
      time: "21:00",
      author: "Development Team"
    },
    {
      title: "Fixed Sidebar Navigation - All Pages Now Use Sidebar",
      description: "Updated all remaining pages (QuickAdd, MarkSold, Inventory, Stats, Settings) to use the new collapsible sidebar navigation instead of the old HeaderWithTabs component. Now all pages consistently use the modern sidebar layout, providing a unified navigation experience across the entire application. The sidebar shows the appropriate section-specific navigation for each page and maintains the collapsible functionality for optimal space usage.",
      color: "bg-yellow-500/70",
      date: "2024-12-19",
      time: "20:45",
      author: "Development Team"
    },
    {
      title: "Implemented Collapsible Sidebar Navigation",
      description: "Completely redesigned the navigation system with a modern collapsible left sidebar that replaces the header tabs. The sidebar includes section-specific navigation (Order Book, Emails, Profiles) with icons and labels, a collapsible toggle button, and user account information at the bottom. This provides significantly more space for content, eliminates tab wrapping issues, and creates a modern dashboard feel similar to popular applications like Notion and Linear. The sidebar can be collapsed to save even more space when needed.",
      color: "bg-yellow-500/70",
      date: "2024-12-19",
      time: "20:30",
      author: "Development Team"
    },
    {
      title: "Reverted to Original Two-Line Header Layout",
      description: "Reverted the compact single-line header layout back to the original two-line design with the title and user avatar on the first line, and navigation tabs on a separate line below. The original layout provides better visual hierarchy, clearer separation of elements, and more comfortable spacing for navigation. This maintains the familiar and proven user interface that users are accustomed to while preserving all functionality.",
      color: "bg-yellow-500/70",
      date: "2024-12-19",
      time: "20:15",
      author: "Development Team"
    },
    {
      title: "Implemented Compact Single-Line Header Layout",
      description: "Redesigned the header layout to save significant vertical space by combining the title, navigation tabs, and user avatar into a single horizontal line. Reduced title size from text-3xl to text-2xl, made tabs more compact with smaller icons and tighter spacing, and streamlined the user avatar to a smaller, more efficient design. This saves approximately 50px of vertical space while maintaining all functionality and improving the overall user experience with more content visible above the fold.",
      color: "bg-yellow-500/70",
      date: "2024-12-19",
      time: "20:00",
      author: "Development Team"
    },
    {
      title: "Removed Logo and Fine-Tuned BETA Badge Alignment",
      description: "Removed the logo image from all header components to create a cleaner, more minimal brand presentation. Adjusted the BETA badge positioning by increasing the bottom margin from mb-0.5 to mb-1 to better align with the OneTrack title baseline. This creates a more refined and focused header design that emphasizes the typography while maintaining the subtle BETA status indication.",
      color: "bg-yellow-500/70",
      date: "2024-12-19",
      time: "19:45",
      author: "Development Team"
    },
    {
      title: "Reduced BETA Badge Text Size for Subtle Branding",
      description: "Made the BETA badge text smaller (changed from text-sm to text-xs) while maintaining its perfect positioning on the bottom baseline nearly touching the OneTrack title. This creates a more subtle and refined appearance that clearly indicates the beta status without overwhelming the main brand name. The smaller size makes the BETA badge feel more like a natural typographic element while preserving the precise alignment and spacing that was previously achieved.",
      color: "bg-yellow-500/70",
      date: "2024-12-19",
      time: "19:30",
      author: "Development Team"
    },
    {
      title: "Fine-Tuned BETA Badge Positioning for Perfect Alignment",
      description: "Further refined the BETA badge positioning to achieve perfect visual alignment. Moved the BETA text even closer to the OneTrack title using negative left margin (-ml-1) so it's nearly touching, and adjusted the vertical position (mb-0.5) to perfectly align with the bottom baseline of the title text. This creates the most precise and professional typography alignment possible, ensuring the BETA badge appears as a natural extension of the OneTrack brand name.",
      color: "bg-yellow-500/70",
      date: "2024-12-19",
      time: "19:15",
      author: "Development Team"
    },
    {
      title: "Refined Header Logo and BETA Badge Positioning",
      description: "Improved the visual alignment of the header elements by pushing the logo closer to the OneTrack title (reduced gap from 3 to 2) and repositioning the BETA badge to align with the bottom baseline of the title text. The BETA text now sits lower and closer to the title, creating a more cohesive and professional appearance. This refinement enhances the overall visual hierarchy and brand presentation across all pages.",
      color: "bg-yellow-500/70",
      date: "2024-12-19",
      time: "19:00",
      author: "Development Team"
    },
    {
      title: "Added App Logo and BETA Badge to Headers",
      description: "Enhanced the application branding by adding the OneTrack logo to the left of the title in all header components. Added a subtle 'BETA' badge in ghost text styling to the right of the OneTrack title across all pages (Hub, Order Book, Emails, Shipments, and Profiles). This provides consistent branding and clearly indicates the application's beta status to users while maintaining the clean, professional appearance of the interface.",
      color: "bg-yellow-500/70",
      date: "2024-12-19",
      time: "18:45",
      author: "Development Team"
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
  const ChangelogEntry = ({ title, description, color, linkTo, date, time, author }) => {
    const content = (
      <div className="flex items-start gap-3">
        <div className={`h-2 w-2 rounded-full ${color} mt-2 flex-shrink-0`}></div>
        <div className="flex-1">
          <div className="text-sm font-medium text-slate-200 mb-2">{title}</div>
          <div className="text-xs text-slate-400 mb-3 leading-relaxed">{description}</div>
          <div className="flex items-center gap-4 text-xs text-slate-500">
            <div className="flex items-center gap-1">
              <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
              </svg>
              <span>{date}</span>
            </div>
            <div className="flex items-center gap-1">
              <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              <span>{time}</span>
            </div>
            <div className="flex items-center gap-1">
              <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
              </svg>
              <span>{author}</span>
            </div>
          </div>
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
              className="h-10 w-10 rounded-lg border border-slate-600 bg-slate-800/60 hover:bg-slate-700 hover:border-slate-500 text-slate-200 transition-all duration-200 flex items-center justify-center group"
              title="Sign out"
            >
              <svg className="w-4 h-4 transition-transform group-hover:scale-110" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
              </svg>
</button>

          </div>
        </div>

        {/* App tiles */}
        <div className={`${card} mb-6`}>
          <h2 className="text-lg font-semibold mb-4">Choose a workspace</h2>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
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

            <Link to="/profiles" className={tile}>
              <div className="h-12 w-12 rounded-xl bg-purple-600/20 grid place-items-center text-purple-300">
                <svg className="h-6 w-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                </svg>
              </div>
              <div className="flex-1">
                <div className="text-xl font-semibold">Profiles</div>
                <div className="text-slate-400 text-sm">
                  Manage customer profiles and contact information. Track customer order history, 
                  manage contact details, and build better relationships with your customers.
                </div>
                <div className="mt-3 inline-flex items-center text-purple-300 group-hover:text-purple-200">
                  Open →
                </div>
              </div>
            </Link>
          </div>
        </div>

        {/* Changelog */}
        <div className={`${card}`}>
          <div className="mb-4">
            <h2 className="text-lg font-semibold">Changelog</h2>
            <div className="text-xs text-slate-400/60">v0.1.6</div>
          </div>
          
        <div className="space-y-3">
          {/* Paginated Changelog Entries */}
          {currentEntries.map((entry, index) => (
          <ChangelogEntry
              key={`${entry.title}-${index}`}
              title={entry.title}
              description={entry.description}
              color={entry.color}
              linkTo={getChangelogLink(entry.title, entry.description)}
              date={entry.date}
              time={entry.time}
              author={entry.author}
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
