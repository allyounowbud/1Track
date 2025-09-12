import React from "react";
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

  async function signOut() {
    try {
      await supabase.auth.signOut();
      window.location.href = "/login";
    } catch (error) {
      console.log("Sign out error (expected in local testing):", error);
      window.location.href = "/login";
    }
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
            <div className="text-xs text-slate-400/60">v0.1.1</div>
          </div>
          
        <div className="space-y-3">
          {/* 10 Most Recent Changelog Entries with Proper Color Coding */}
          <ChangelogEntry
            title="Fixed Sidebar Positioning and User Account Section"
            description="Fixed two critical sidebar issues: 1) Made the sidebar fixed in place so it doesn't scroll with the page content - only the main content area scrolls now, providing a proper dashboard experience. 2) Fixed the user account section at the bottom of the sidebar to stay properly contained within the sidebar bounds instead of extending across the entire page. The profile section now correctly stays at the bottom of the sidebar with proper background and positioning."
            color="bg-yellow-500/70"
            linkTo={getChangelogLink("Fixed Sidebar Positioning and User Account Section", "Made sidebar fixed in place and fixed user account section positioning within sidebar bounds.")}
            timestamp="2024-12-19 21:00"
          />
          <ChangelogEntry
            title="Fixed Sidebar Navigation - All Pages Now Use Sidebar"
            description="Updated all remaining pages (QuickAdd, MarkSold, Inventory, Stats, Settings) to use the new collapsible sidebar navigation instead of the old HeaderWithTabs component. Now all pages consistently use the modern sidebar layout, providing a unified navigation experience across the entire application. The sidebar shows the appropriate section-specific navigation for each page and maintains the collapsible functionality for optimal space usage."
            color="bg-yellow-500/70"
            linkTo={getChangelogLink("Fixed Sidebar Navigation - All Pages Now Use Sidebar", "Updated all remaining pages to use the new collapsible sidebar navigation instead of the old HeaderWithTabs component for a unified navigation experience.")}
            timestamp="2024-12-19 20:45"
          />
          <ChangelogEntry
            title="Implemented Collapsible Sidebar Navigation"
            description="Completely redesigned the navigation system with a modern collapsible left sidebar that replaces the header tabs. The sidebar includes section-specific navigation (Order Book, Emails, Profiles) with icons and labels, a collapsible toggle button, and user account information at the bottom. This provides significantly more space for content, eliminates tab wrapping issues, and creates a modern dashboard feel similar to popular applications like Notion and Linear. The sidebar can be collapsed to save even more space when needed."
            color="bg-yellow-500/70"
            linkTo={getChangelogLink("Implemented Collapsible Sidebar Navigation", "Completely redesigned the navigation system with a modern collapsible left sidebar that replaces the header tabs. The sidebar includes section-specific navigation with icons and labels and provides significantly more space for content.")}
            timestamp="2024-12-19 20:30"
          />
          <ChangelogEntry
            title="Reverted to Original Two-Line Header Layout"
            description="Reverted the compact single-line header layout back to the original two-line design with the title and user avatar on the first line, and navigation tabs on a separate line below. The original layout provides better visual hierarchy, clearer separation of elements, and more comfortable spacing for navigation. This maintains the familiar and proven user interface that users are accustomed to while preserving all functionality."
            color="bg-yellow-500/70"
            linkTo={getChangelogLink("Reverted to Original Two-Line Header Layout", "Reverted the compact single-line header layout back to the original two-line design with the title and user avatar on the first line and navigation tabs on a separate line below.")}
            timestamp="2024-12-19 20:15"
          />
          <ChangelogEntry
            title="Implemented Compact Single-Line Header Layout"
            description="Redesigned the header layout to save significant vertical space by combining the title, navigation tabs, and user avatar into a single horizontal line. Reduced title size from text-3xl to text-2xl, made tabs more compact with smaller icons and tighter spacing, and streamlined the user avatar to a smaller, more efficient design. This saves approximately 50px of vertical space while maintaining all functionality and improving the overall user experience with more content visible above the fold."
            color="bg-yellow-500/70"
            linkTo={getChangelogLink("Implemented Compact Single-Line Header Layout", "Redesigned the header layout to save significant vertical space by combining the title navigation tabs and user avatar into a single horizontal line. This saves approximately 50px of vertical space while maintaining all functionality.")}
            timestamp="2024-12-19 20:00"
          />
          <ChangelogEntry
            title="Removed Logo and Fine-Tuned BETA Badge Alignment"
            description="Removed the logo image from all header components to create a cleaner, more minimal brand presentation. Adjusted the BETA badge positioning by increasing the bottom margin from mb-0.5 to mb-1 to better align with the OneTrack title baseline. This creates a more refined and focused header design that emphasizes the typography while maintaining the subtle BETA status indication."
            color="bg-yellow-500/70"
            linkTo={getChangelogLink("Removed Logo and Fine-Tuned BETA Badge Alignment", "Removed the logo image from all header components to create a cleaner more minimal brand presentation. Adjusted the BETA badge positioning to better align with the OneTrack title baseline.")}
            timestamp="2024-12-19 19:45"
          />
          <ChangelogEntry
            title="Reduced BETA Badge Text Size for Subtle Branding"
            description="Made the BETA badge text smaller (changed from text-sm to text-xs) while maintaining its perfect positioning on the bottom baseline nearly touching the OneTrack title. This creates a more subtle and refined appearance that clearly indicates the beta status without overwhelming the main brand name. The smaller size makes the BETA badge feel more like a natural typographic element while preserving the precise alignment and spacing that was previously achieved."
            color="bg-yellow-500/70"
            linkTo={getChangelogLink("Reduced BETA Badge Text Size for Subtle Branding", "Made the BETA badge text smaller while maintaining its perfect positioning on the bottom baseline nearly touching the OneTrack title. This creates a more subtle and refined appearance.")}
            timestamp="2024-12-19 19:30"
          />
          <ChangelogEntry
            title="Fine-Tuned BETA Badge Positioning for Perfect Alignment"
            description="Further refined the BETA badge positioning to achieve perfect visual alignment. Moved the BETA text even closer to the OneTrack title using negative left margin (-ml-1) so it's nearly touching, and adjusted the vertical position (mb-0.5) to perfectly align with the bottom baseline of the title text. This creates the most precise and professional typography alignment possible, ensuring the BETA badge appears as a natural extension of the OneTrack brand name."
            color="bg-yellow-500/70"
            linkTo={getChangelogLink("Fine-Tuned BETA Badge Positioning for Perfect Alignment", "Further refined the BETA badge positioning to achieve perfect visual alignment. Moved the BETA text even closer to the OneTrack title using negative left margin and adjusted the vertical position to perfectly align with the bottom baseline.")}
            timestamp="2024-12-19 19:15"
          />
          <ChangelogEntry
            title="Refined Header Logo and BETA Badge Positioning"
            description="Improved the visual alignment of the header elements by pushing the logo closer to the OneTrack title (reduced gap from 3 to 2) and repositioning the BETA badge to align with the bottom baseline of the title text. The BETA text now sits lower and closer to the title, creating a more cohesive and professional appearance. This refinement enhances the overall visual hierarchy and brand presentation across all pages."
            color="bg-yellow-500/70"
            linkTo={getChangelogLink("Refined Header Logo and BETA Badge Positioning", "Improved the visual alignment of the header elements by pushing the logo closer to the OneTrack title and repositioning the BETA badge to align with the bottom baseline of the title text.")}
            timestamp="2024-12-19 19:00"
          />
          <ChangelogEntry
            title="Added App Logo and BETA Badge to Headers"
            description="Enhanced the application branding by adding the OneTrack logo to the left of the title in all header components. Added a subtle 'BETA' badge in ghost text styling to the right of the OneTrack title across all pages (Hub, Order Book, Emails, Shipments, and Profiles). This provides consistent branding and clearly indicates the application's beta status to users while maintaining the clean, professional appearance of the interface."
            color="bg-yellow-500/70"
            linkTo={getChangelogLink("Added App Logo and BETA Badge to Headers", "Enhanced the application branding by adding the OneTrack logo to the left of the title in all header components. Added a subtle BETA badge in ghost text styling to the right of the OneTrack title across all pages.")}
            timestamp="2024-12-19 18:45"
          />
          <ChangelogEntry
            title="Improved Shipments Empty State Interface"
            description="Updated the shipments page to provide a cleaner interface when no shipments are found. Removed the 'Test Connection' and 'Sync Emails' buttons from the top management card when no shipments exist, reducing visual clutter. Added a prominent 'Sync Emails' button in the empty state message area below the 'No shipments found' text, making it the primary call-to-action for users to start syncing their email data. This creates a more focused and intuitive user experience for new users."
            color="bg-green-500/70"
            linkTo={getChangelogLink("Improved Shipments Empty State Interface", "Updated the shipments page to provide a cleaner interface when no shipments are found. Removed the Test Connection and Sync Emails buttons from the top management card when no shipments exist.")}
            timestamp="2024-12-19 18:30"
          />
          <ChangelogEntry
            title="Improved Email Connection Button Logic"
            description="Updated the emails page to show a cleaner interface when no Gmail accounts are connected. Removed the 'Connect Gmail' button from the top management card when no emails are connected, keeping only the main 'Connect Your First Gmail Account' button in the connected accounts section. Once an email is added, the top card now shows an 'Add Email' button for adding additional accounts. This creates a more intuitive user flow and reduces visual clutter."
            color="bg-green-500/70"
            linkTo={getChangelogLink("Improved Email Connection Button Logic", "Updated the emails page to show a cleaner interface when no Gmail accounts are connected. Removed the Connect Gmail button from the top management card when no emails are connected.")}
            timestamp="2024-12-19 18:15"
          />
          <ChangelogEntry
            title="Separated Header Components for Each Section"
            description="Created separate HeaderWithTabs components for Order Book, Emails, and Profiles sections. Each section now has its own dedicated navigation without showing irrelevant tabs. Order Book shows Quick Add, Mark as Sold, Order Book, Inventory, Stats, Database tabs. Emails section shows Emails and Shipments tabs. Profiles section is ready for future profile-related tabs. This creates a cleaner, more focused user experience where each section feels like its own application."
            color="bg-yellow-500/70"
            linkTo={getChangelogLink("Separated Header Components for Each Section", "Created separate HeaderWithTabs components for Order Book Emails and Profiles sections. Each section now has its own dedicated navigation without showing irrelevant tabs.")}
            timestamp="2024-12-19 18:00"
          />
          <ChangelogEntry
            title="Enhanced Email Sync with Debug Tools"
            description="Fixed Gmail sync issues by expanding query to include all retailers (Amazon, Target, Macy's, Nike) and extending time window to 90 days. Added comprehensive debug logging, test connection button, and better error handling to diagnose and resolve email processing problems. Now properly finds order confirmations, cancellations, and shipping updates."
            color="bg-green-500/70"
            linkTo={getChangelogLink("Enhanced Email Sync with Debug Tools", "Fixed Gmail sync issues by expanding query to include all retailers and extending time window to 90 days. Added comprehensive debug logging test connection button and better error handling.")}
            timestamp="2024-12-19 17:15"
          />
          <ChangelogEntry
            title="Simplified Emails Page Interface"
            description="Removed bulk selection functionality, search bar, and unnecessary cards from the emails page. Changed disconnect buttons to icons, removed Open Gmail button, updated button text to 'Add Email', and removed Email Settings and How It Works cards for a cleaner, more focused interface that matches the app's design language."
            color="bg-green-500/70"
            linkTo={getChangelogLink("Simplified Emails Page Interface", "Removed bulk selection functionality search bar and unnecessary cards from the emails page. Changed disconnect buttons to icons removed Open Gmail button and updated button text to Add Email.")}
            timestamp="2024-12-19 17:00"
          />
          <ChangelogEntry
            title="Fixed Card Import Error in Emails Page"
            description="Fixed a critical ReferenceError where the 'card' variable was not defined in the Emails.jsx file. Added the missing import statement for the card utility from '../utils/ui' to resolve the React Router error boundary issue that was preventing the emails page from rendering properly."
            color="bg-green-500/70"
            linkTo={getChangelogLink("Fixed Card Import Error in Emails Page", "Fixed a critical ReferenceError where the card variable was not defined in the Emails.jsx file. Added the missing import statement for the card utility from utils/ui to resolve the React Router error boundary issue.")}
            timestamp="2024-12-19 16:35"
          />
          <ChangelogEntry
            title="Fixed Emails Page Styling & Select System"
            description="Updated the emails page styling to match the shipments page design language. Removed random colors and made all elements consistent with the app's slate color scheme. Fixed the select card system layout by properly separating the management card from the connected accounts card, improving the overall visual hierarchy and user experience."
            color="bg-green-500/70"
            linkTo={getChangelogLink("Fixed Emails Page Styling & Select System", "Updated the emails page styling to match the shipments page design language. Removed random colors and made all elements consistent with the app's slate color scheme. Fixed the select card system layout by properly separating the management card from the connected accounts card.")}
            timestamp="2024-12-19 16:30"
          />
          <ChangelogEntry
            title="Added Email Sync to Shipments Page"
            description="Added a sync button to the shipments page that fetches emails from connected Gmail accounts and uses the existing parsing logic to extract order confirmations, tracking updates, and cancellation emails. Automatically updates order statuses and refreshes the shipments list after sync completion."
            color="bg-green-500/70"
            linkTo={getChangelogLink("Added Email Sync to Shipments Page", "Added a sync button to the shipments page that fetches emails from connected Gmail accounts and uses the existing parsing logic to extract order confirmations tracking updates and cancellation emails. Automatically updates order statuses and refreshes the shipments list after sync completion.")}
            timestamp="2024-12-19 16:15"
          />
          <ChangelogEntry
            title="Redesigned Emails Page - Clean & Focused"
            description="Completely redesigned the emails page with a cleaner, more professional layout. Removed the sync button, integrated add email functionality into the management card, removed shipments info, and added stats cards, settings panel, and how-it-works section. Now matches the app's design language perfectly."
            color="bg-green-500/70"
            linkTo={getChangelogLink("Redesigned Emails Page - Clean & Focused", "Completely redesigned the emails page with a cleaner more professional layout. Removed the sync button integrated add email functionality into the management card removed shipments info and added stats cards settings panel and how-it-works section.")}
            timestamp="2024-12-19 16:00"
          />
          <ChangelogEntry
            title="Cleaned Up Changelog with Timestamps"
            description="Streamlined the changelog to show only the 10 most recent entries with timestamps for better tracking. Added timestamp display to each changelog entry showing the exact date and time when changes were made, making it easier to track development progress."
            color="bg-yellow-500/70"
            linkTo={getChangelogLink("Cleaned Up Changelog with Timestamps", "Streamlined the changelog to show only the 10 most recent entries with timestamps for better tracking. Added timestamp display to each changelog entry showing the exact date and time when changes were made.")}
            timestamp="2024-12-19 15:45"
          />
          <ChangelogEntry
            title="Prevented Multiple New Rows - One at a Time"
            description="Hidden the + Add button when a new row is active to prevent users from adding multiple rows simultaneously, which could cause conflicts and database issues. Now only one new row can be added at a time, ensuring a clean and controlled workflow."
            color="bg-blue-500/70"
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
            color="bg-blue-500/70"
            linkTo={getChangelogLink("Simplified Settings Interface - Fixed All Issues", "Completely rewrote the Settings page header logic to fix auto-save issues and button positioning. New rows now have save/cancel buttons on the row itself no auto-save select all checkbox is always visible next to action buttons and all buttons stay on the right side regardless of left content.")}
            timestamp="2024-12-19 14:45"
          />
        </div>
        </div>
    </LayoutWithSidebar>
  );
}
