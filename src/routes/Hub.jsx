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
            <div className="text-xs text-slate-400/60">v0.0.3</div>
          </div>
          
        <div className="space-y-3">
          <div className="flex items-start gap-3">
            <div className="h-2 w-2 rounded-full bg-blue-500/70 mt-2 flex-shrink-0"></div>
            <div>
              <div className="text-sm font-medium text-slate-200">Refined Stats Page Interface</div>
              <div className="text-xs text-slate-400">Removed row counts, reordered filters, added item-specific analytics charts with dropdown selection, and improved spacing and layout</div>
            </div>
          </div>
          <div className="flex items-start gap-3">
            <div className="h-2 w-2 rounded-full bg-blue-500/70 mt-2 flex-shrink-0"></div>
            <div>
              <div className="text-sm font-medium text-slate-200">Enhanced Stats Page with Live Filtering</div>
              <div className="text-xs text-slate-400">Combined filters with analytics, live search filtering, simplified charts, list-only view, and improved card content with last purchase/sale dates</div>
            </div>
          </div>
          <div className="flex items-start gap-3">
            <div className="h-2 w-2 rounded-full bg-green-500/70 mt-2 flex-shrink-0"></div>
            <div>
              <div className="text-sm font-medium text-slate-200">Redesigned Emails Tab with Modern Interface</div>
              <div className="text-xs text-slate-400">Complete redesign with selectable rows, bulk actions, search functionality, and consistent styling matching the rest of the app</div>
            </div>
          </div>
          <div className="flex items-start gap-3">
            <div className="h-2 w-2 rounded-full bg-green-500/70 mt-2 flex-shrink-0"></div>
            <div>
              <div className="text-sm font-medium text-slate-200">Enhanced Shipments Page with Optimized Layout</div>
              <div className="text-xs text-slate-400">Improved expandable cards with smaller images, better space utilization, and organized information display in responsive grid layout</div>
            </div>
          </div>
          <div className="flex items-start gap-3">
            <div className="h-2 w-2 rounded-full bg-green-500/70 mt-2 flex-shrink-0"></div>
            <div>
              <div className="text-sm font-medium text-slate-200">Added Active Tab Highlighting</div>
              <div className="text-xs text-slate-400">Implemented active tab highlighting for emails and shipments navigation with consistent visual feedback</div>
            </div>
          </div>
          <div className="flex items-start gap-3">
            <div className="h-2 w-2 rounded-full bg-green-500/70 mt-2 flex-shrink-0"></div>
            <div>
              <div className="text-sm font-medium text-slate-200">Added Cross-Navigation Between Emails and Shipments</div>
              <div className="text-xs text-slate-400">Implemented navigation tabs on both emails and shipments pages for seamless switching between email management and shipment tracking</div>
            </div>
          </div>
          <div className="flex items-start gap-3">
            <div className="h-2 w-2 rounded-full bg-green-500/70 mt-2 flex-shrink-0"></div>
            <div>
              <div className="text-sm font-medium text-slate-200">Split Emails and Shipments into Separate Tabs</div>
              <div className="text-xs text-slate-400">Created new /shipments tab for managing order shipments and tracking, while keeping /emails focused on Gmail account management and connection</div>
            </div>
          </div>
          <div className="flex items-start gap-3">
            <div className="h-2 w-2 rounded-full bg-green-500/70 mt-2 flex-shrink-0"></div>
            <div>
              <div className="text-sm font-medium text-slate-200">Enhanced Multiple Gmail Account Support</div>
              <div className="text-xs text-slate-400">Updated OAuth callback and sync functions to properly support multiple Gmail accounts from different users, allowing comprehensive email organization from all connected accounts</div>
            </div>
          </div>
          <div className="flex items-start gap-3">
            <div className="h-2 w-2 rounded-full bg-blue-500/70 mt-2 flex-shrink-0"></div>
            <div>
              <div className="text-sm font-medium text-slate-200">Enhanced Mark as Sold Page</div>
              <div className="text-xs text-slate-400">Added consistent title section with "Sale details" header and "Mark an existing order as sold" subtitle to match Quick Add page styling</div>
            </div>
          </div>
          <div className="flex items-start gap-3">
            <div className="h-2 w-2 rounded-full bg-yellow-400/70 mt-2 flex-shrink-0"></div>
            <div>
              <div className="text-sm font-medium text-slate-200">Optimized Application Width</div>
              <div className="text-xs text-slate-400">Increased application width from 60% to 95% of browser width across all pages for better desktop utilization and improved data display</div>
            </div>
          </div>
          <div className="flex items-start gap-3">
            <div className="h-2 w-2 rounded-full bg-blue-500/70 mt-2 flex-shrink-0"></div>
            <div>
              <div className="text-sm font-medium text-slate-200">Enhanced Order Book Interface</div>
              <div className="text-xs text-slate-400">Integrated search, fixed input heights, replaced dropdowns with native selects, improved button layout, and added a mutual exclusion between search and add operations.</div>
            </div>
          </div>
            
            <div className="flex items-start gap-3">
              <div className="h-2 w-2 rounded-full bg-pink-500/70 mt-2 flex-shrink-0"></div>
              <div>
                <div className="text-sm font-medium text-slate-200">Added Profiles Card to Hub</div>
                <div className="text-xs text-slate-400">New "Profiles" card added to main hub with "Coming soon" status for future user profile management</div>
              </div>
            </div>
            
            <div className="flex items-start gap-3">
              <div className="h-2 w-2 rounded-full bg-blue-500/70 mt-2 flex-shrink-0"></div>
              <div>
                <div className="text-sm font-medium text-slate-200">Enhanced Inventory Dashboard</div>
                <div className="text-xs text-slate-400">Added 8 comprehensive KPI pills with live filtering, improved search functionality, and better visual hierarchy</div>
              </div>
            </div>
            
            <div className="flex items-start gap-3">
              <div className="h-2 w-2 rounded-full bg-yellow-400/70 mt-2 flex-shrink-0"></div>
              <div>
                <div className="text-sm font-medium text-slate-200">Universal Search Dropdown</div>
                <div className="text-xs text-slate-400">Standardized all dropdowns across the app with consistent styling, proper layering, and live filtering</div>
              </div>
            </div>
            
            <div className="flex items-start gap-3">
              <div className="h-2 w-2 rounded-full bg-yellow-400/70 mt-2 flex-shrink-0"></div>
              <div>
                <div className="text-sm font-medium text-slate-200">Improved Header Design</div>
                <div className="text-xs text-slate-400">Replaced dashboard button with clickable avatar/username button for better navigation and visual balance</div>
              </div>
            </div>
            
            <div className="flex items-start gap-3">
              <div className="h-2 w-2 rounded-full bg-blue-500/70 mt-2 flex-shrink-0"></div>
              <div>
                <div className="text-sm font-medium text-slate-200">Enhanced Order Book</div>
                <div className="text-xs text-slate-400">Added bulk edit/delete functionality, improved form persistence, and better mobile responsiveness</div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
