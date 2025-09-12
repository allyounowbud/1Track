import React from "react";
import { Link } from "react-router-dom";
import { supabase } from "../lib/supabaseClient";
import { useAuth } from "../hooks/useAuth.js";
import { card } from "../utils/ui.js";

const tile =
  "group rounded-2xl border border-slate-800 bg-slate-900/60 hover:bg-slate-900 transition p-5 flex items-start gap-4";

export default function Hub() {
  const userInfo = useAuth();

  async function signOut() {
    await supabase.auth.signOut();
    window.location.href = "/login";
  }

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

  // Changelog entry component
  const ChangelogEntry = ({ title, description, color, linkTo, timestamp }) => {
    const content = (
      <div className="flex items-start gap-3">
        <div className={`h-2 w-2 rounded-full ${color} mt-2 flex-shrink-0`}></div>
        <div className="flex-1">
          <div className="flex items-center justify-between">
            <div className="text-sm font-medium text-slate-200">{title}</div>
            {timestamp && (
              <div className="text-xs text-slate-500 ml-2">{timestamp}</div>
            )}
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
    <div className="min-h-screen bg-slate-950 text-slate-100">
      <div className="max-w-[95vw] mx-auto p-4 sm:p-6">
        <div className="mb-6">
  <h1 className="text-3xl font-bold">OneTrack</h1>
</div>

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
            <div className="text-xs text-slate-400/60">v0.1.1</div>
          </div>
          
        <div className="space-y-3">
          <ChangelogEntry
            title="Redesigned Settings Page with OrderBook-Style Interface"
            description="Complete redesign of the Settings (Database) page with separate expandable cards for Products, Retailers, and Marketplaces. Each card has OrderBook-style row selection, bulk actions, inline editing, and independent operation. Cards expand when clicking anywhere on the header, and all buttons match OrderBook styling exactly."
            color="bg-green-500/70"
            linkTo={getChangelogLink("Redesigned Settings Page with OrderBook-Style Interface", "Complete redesign of the Settings Database page with separate expandable cards for Products Retailers and Marketplaces. Each card has OrderBook-style row selection bulk actions inline editing and independent operation.")}
          />
          <ChangelogEntry
            title="Enhanced Settings Page User Experience"
            description="Added smart button visibility logic - + add button hidden when existing rows are selected, save/cancel buttons only in header, no scroll containers to show all data, and row disabling when new rows are being added to prevent conflicts."
            color="bg-blue-500/70"
            linkTo={getChangelogLink("Enhanced Settings Page User Experience", "Added smart button visibility logic - add button hidden when existing rows are selected save/cancel buttons only in header no scroll containers and row disabling when new rows are being added.")}
          />
          <ChangelogEntry
            title="Advanced Settings Page Functionality"
            description="Implemented single card expansion (only one card open at a time), multiple row selection for bulk operations, confirmation dialogs with item previews before save/delete, and proper button placement that replaces the + add button when rows are selected."
            color="bg-purple-500/70"
            linkTo={getChangelogLink("Advanced Settings Page Functionality", "Implemented single card expansion only one card open at a time multiple row selection for bulk operations confirmation dialogs with item previews and proper button placement.")}
          />
          <ChangelogEntry
            title="Final Settings Page Polish"
            description="Removed duplicate save/cancel buttons from individual rows (only header buttons remain), hide existing rows when adding new ones to prevent conflicts, added select/deselect all checkbox in header, and ensured multiple row selection works perfectly for bulk operations."
            color="bg-indigo-500/70"
            linkTo={getChangelogLink("Final Settings Page Polish", "Removed duplicate save/cancel buttons from individual rows only header buttons remain hide existing rows when adding new ones and added select/deselect all checkbox in header.")}
          />
          <ChangelogEntry
            title="Enhanced Settings Row Actions"
            description="Added save/delete icon buttons to individual rows for easy access when scrolling, ensured header buttons properly replace + add button when rows are selected, and removed unnecessary details column from retailers rows for cleaner layout."
            color="bg-cyan-500/70"
            linkTo={getChangelogLink("Enhanced Settings Row Actions", "Added save/delete icon buttons to individual rows for easy access when scrolling ensured header buttons properly replace add button and removed unnecessary details column from retailers rows.")}
          />
          <ChangelogEntry
            title="Full Card Clickable Area"
            description="Made entire Settings card clickable for expand/collapse functionality. Previously only a small section was clickable, now the entire card from border to border responds to clicks for better user experience."
            color="bg-emerald-500/70"
            linkTo={getChangelogLink("Full Card Clickable Area", "Made entire Settings card clickable for expand/collapse functionality. Previously only a small section was clickable now the entire card from border to border responds to clicks for better user experience.")}
          />
          <ChangelogEntry
            title="Fixed Settings Page Expandable Cards"
            description="Restructured Settings page to match OrderBook behavior exactly. Header stays as card with clickable area, expanded dropdown is not clickable, bulk actions properly replace + add button when rows are selected, and list refreshes correctly after save/cancel operations."
            color="bg-blue-500/70"
            linkTo={getChangelogLink("Fixed Settings Page Expandable Cards", "Restructured Settings page to match OrderBook behavior exactly header stays as card with clickable area expanded dropdown is not clickable bulk actions properly replace add button and list refreshes correctly.")}
          />
          <ChangelogEntry
            title="Fixed Full Card Clickable Area"
            description="Made entire Settings card clickable for expand/collapse functionality, matching OrderBook behavior exactly. The whole card from border to border is now clickable, with proper event handling to prevent conflicts in the expanded content area."
            color="bg-green-500/70"
            linkTo={getChangelogLink("Fixed Full Card Clickable Area", "Made entire Settings card clickable for expand/collapse functionality matching OrderBook behavior exactly the whole card from border to border is now clickable with proper event handling.")}
          />
          <ChangelogEntry
            title="Enhanced New Row Focus Mode"
            description="When adding a new row, the select all checkbox is hidden and all other unexpanded cards are hidden. This creates a focused workspace where users can only see the new row they're working on until it's either saved or canceled, reducing distractions and improving workflow."
            color="bg-purple-500/70"
            linkTo={getChangelogLink("Enhanced New Row Focus Mode", "When adding a new row the select all checkbox is hidden and all other unexpanded cards are hidden creating a focused workspace where users can only see the new row they're working on until it's either saved or canceled.")}
          />
          <ChangelogEntry
            title="Fixed Add Button Logic for Selected Rows"
            description="When any row is selected (like in the image), the + add button is now hidden and replaced with save and delete icon buttons for bulk actions. This prevents users from adding new rows while having existing rows selected and provides convenient bulk action buttons in the header."
            color="bg-orange-500/70"
            linkTo={getChangelogLink("Fixed Add Button Logic for Selected Rows", "When any row is selected the add button is now hidden and replaced with save and delete icon buttons for bulk actions preventing users from adding new rows while having existing rows selected.")}
          />
          <ChangelogEntry
            title="Moved New Row Buttons to Individual Rows"
            description="Removed save and delete buttons from the header for new rows and moved them directly to each new row itself, just like existing rows. This provides a more consistent and intuitive interface where each row has its own action buttons, whether it's new or existing."
            color="bg-teal-500/70"
            linkTo={getChangelogLink("Moved New Row Buttons to Individual Rows", "Removed save and delete buttons from the header for new rows and moved them directly to each new row itself just like existing rows providing a more consistent and intuitive interface.")}
          />
          <ChangelogEntry
            title="Fixed Bulk Action Buttons in Header"
            description="When any row is selected (like '151 Blooming Waters' in the image), the + add button is now properly hidden and replaced with save and delete buttons for bulk actions. This provides both individual row actions (on each row) and bulk actions (in header) for a complete workflow."
            color="bg-yellow-500/70"
            linkTo={getChangelogLink("Fixed Bulk Action Buttons in Header", "When any row is selected the add button is now properly hidden and replaced with save and delete buttons for bulk actions providing both individual row actions and bulk actions for a complete workflow.")}
          />
          {/* Most Recent 10 Changelog Entries with Timestamps */}
          <ChangelogEntry
            title="Added Email Sync to Shipments Page"
            description="Added a sync button to the shipments page that fetches emails from connected Gmail accounts and uses the existing parsing logic to extract order confirmations, tracking updates, and cancellation emails. Automatically updates order statuses and refreshes the shipments list after sync completion."
            color="bg-blue-500/70"
            linkTo={getChangelogLink("Added Email Sync to Shipments Page", "Added a sync button to the shipments page that fetches emails from connected Gmail accounts and uses the existing parsing logic to extract order confirmations tracking updates and cancellation emails. Automatically updates order statuses and refreshes the shipments list after sync completion.")}
            timestamp="2024-12-19 16:15"
          />
          <ChangelogEntry
            title="Redesigned Emails Page - Clean & Focused"
            description="Completely redesigned the emails page with a cleaner, more professional layout. Removed the sync button, integrated add email functionality into the management card, removed shipments info, and added stats cards, settings panel, and how-it-works section. Now matches the app's design language perfectly."
            color="bg-indigo-500/70"
            linkTo={getChangelogLink("Redesigned Emails Page - Clean & Focused", "Completely redesigned the emails page with a cleaner more professional layout. Removed the sync button integrated add email functionality into the management card removed shipments info and added stats cards settings panel and how-it-works section.")}
            timestamp="2024-12-19 16:00"
          />
          <ChangelogEntry
            title="Cleaned Up Changelog with Timestamps"
            description="Streamlined the changelog to show only the 10 most recent entries with timestamps for better tracking. Added timestamp display to each changelog entry showing the exact date and time when changes were made, making it easier to track development progress."
            color="bg-slate-500/70"
            linkTo={getChangelogLink("Cleaned Up Changelog with Timestamps", "Streamlined the changelog to show only the 10 most recent entries with timestamps for better tracking. Added timestamp display to each changelog entry showing the exact date and time when changes were made.")}
            timestamp="2024-12-19 15:45"
          />
          <ChangelogEntry
            title="Prevented Multiple New Rows - One at a Time"
            description="Hidden the + Add button when a new row is active to prevent users from adding multiple rows simultaneously, which could cause conflicts and database issues. Now only one new row can be added at a time, ensuring a clean and controlled workflow."
            color="bg-emerald-500/70"
            linkTo={getChangelogLink("Prevented Multiple New Rows - One at a Time", "Hidden the + Add button when a new row is active to prevent users from adding multiple rows simultaneously which could cause conflicts and database issues. Now only one new row can be added at a time ensuring a clean and controlled workflow.")}
            timestamp="2024-12-19 15:30"
          />
          <ChangelogEntry
            title="Fixed Header Buttons When Adding New Row"
            description="Fixed the issue where Cancel, Save, and Delete buttons were still visible in the header when adding a new row. Now when a new row is active, the header only shows the select all checkbox and selection count - all action buttons are hidden until the new row is either saved or canceled, providing a cleaner focused interface."
            color="bg-blue-500/70"
            linkTo={getChangelogLink("Fixed Header Buttons When Adding New Row", "Fixed the issue where Cancel Save and Delete buttons were still visible in the header when adding a new row. Now when a new row is active the header only shows the select all checkbox and selection count all action buttons are hidden until the new row is either saved or canceled.")}
            timestamp="2024-12-19 15:15"
          />
          <ChangelogEntry
            title="Simplified Settings Interface - Fixed All Issues"
            description="Completely rewrote the Settings page header logic to fix auto-save issues and button positioning. New rows now have save/cancel buttons on the row itself (no auto-save), select all checkbox is always visible next to action buttons, and all buttons stay on the right side regardless of left content. Removed complex function reference system that was causing conflicts."
            color="bg-green-500/70"
            linkTo={getChangelogLink("Simplified Settings Interface - Fixed All Issues", "Completely rewrote the Settings page header logic to fix auto-save issues and button positioning. New rows now have save/cancel buttons on the row itself no auto-save select all checkbox is always visible next to action buttons and all buttons stay on the right side regardless of left content.")}
            timestamp="2024-12-19 14:45"
          />
          <ChangelogEntry
            title="Fixed New Row Auto-Save and Header Buttons"
            description="Fixed critical issues where new rows were auto-saving to database immediately upon creation (causing 409 conflicts) and header buttons were showing bulk actions instead of new row actions. New rows now only save when explicitly clicking Save button, and header correctly shows Cancel/Save buttons for new rows."
            color="bg-red-500/70"
            linkTo={getChangelogLink("Fixed New Row Auto-Save and Header Buttons", "Fixed critical issues where new rows were auto-saving to database immediately upon creation causing 409 conflicts and header buttons were showing bulk actions instead of new row actions.")}
            timestamp="2024-12-19 14:20"
          />
          <ChangelogEntry
            title="Fixed Action Buttons Always Stay on Right"
            description="Fixed the issue where action buttons and select all checkbox would move to the left side when rows were selected. Now all action buttons and the select all checkbox always remain grouped together on the right side of the header, maintaining consistent positioning regardless of selection state."
            color="bg-indigo-500/70"
            linkTo={getChangelogLink("Fixed Action Buttons Always Stay on Right", "Fixed the issue where action buttons and select all checkbox would move to the left side when rows were selected. Now all action buttons and the select all checkbox always remain grouped together on the right side of the header maintaining consistent positioning.")}
            timestamp="2024-12-19 13:55"
          />
          <ChangelogEntry
            title="New Row Header-Only Buttons"
            description="When adding a new row, removed save/cancel buttons from the row itself and moved them to the header only. The header now shows only Cancel and Save buttons (no delete button) when a new row is active, creating a cleaner interface focused on the new row action."
            color="bg-purple-500/70"
            linkTo={getChangelogLink("New Row Header-Only Buttons", "When adding a new row removed save/cancel buttons from the row itself and moved them to the header only. The header now shows only Cancel and Save buttons when a new row is active creating a cleaner interface.")}
            timestamp="2024-12-19 13:30"
          />
          <ChangelogEntry
            title="Grouped Select All with Action Buttons on Right"
            description="Moved select all checkbox to be directly to the left of action buttons, keeping both grouped together on the right side of the header. This creates a more cohesive interface where all interactive elements are clustered together on the right, with the informational text on the left."
            color="bg-cyan-500/70"
            linkTo={getChangelogLink("Grouped Select All with Action Buttons on Right", "Moved select all checkbox to be directly to the left of action buttons keeping both grouped together on the right side of the header creating a more cohesive interface.")}
            timestamp="2024-12-19 13:05"
          />
          <ChangelogEntry
            title="Improved Settings Header Layout & New Row Design"
            description="Moved select all checkbox to the left of action buttons and ensured buttons always stay on the right side of header. Removed checkbox from new rows while keeping them selected/highlighted for cleaner interface. New rows now have a more streamlined layout without unnecessary checkboxes."
            color="bg-orange-500/70"
            linkTo={getChangelogLink("Improved Settings Header Layout & New Row Design", "Moved select all checkbox to the left of action buttons and ensured buttons always stay on the right side of header. Removed checkbox from new rows while keeping them selected/highlighted for cleaner interface.")}
            timestamp="2024-12-19 12:40"
          />
          <ChangelogEntry
            title="Fixed All Selection Bulk Actions & Moved Select All"
            description="Fixed bulk save/delete buttons to appear when all rows are selected (like '54/54 selected' in the image). Also moved the select all checkbox from the left side to the right side of the header for better layout. The + add button is now properly hidden when any rows are selected."
            color="bg-pink-500/70"
            linkTo={getChangelogLink("Fixed All Selection Bulk Actions & Moved Select All", "Fixed bulk save/delete buttons to appear when all rows are selected also moved the select all checkbox from the left side to the right side of the header for better layout.")}
            timestamp="2024-12-19 12:15"
          />
          <ChangelogEntry
            title="Removed Financial Trend Chart from Stats"
            description="Removed the problematic Financial Trend Chart from the single item view on the Stats page. The chart was causing rendering issues and extending beyond boundaries. Stats page now focuses on KPI cards and other analytics without the problematic chart component."
            color="bg-red-500/70"
            linkTo={getChangelogLink("Removed Financial Trend Chart from Stats", "Removed the problematic Financial Trend Chart from the single item view on the Stats page. The chart was causing rendering issues and extending beyond boundaries. Stats page now focuses on KPI cards and other analytics without the problematic chart component.")}
            timestamp="2024-12-19 11:50"
          />
          </div>
        </div>
      </div>
    </div>
  );
}
