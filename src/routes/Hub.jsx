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
          {/* 10 Most Recent Changelog Entries with Proper Color Coding */}
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
      </div>
    </div>
  );
}
