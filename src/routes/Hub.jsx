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
  const ChangelogEntry = ({ title, description, color, linkTo }) => {
    const content = (
      <div className="flex items-start gap-3">
        <div className={`h-2 w-2 rounded-full ${color} mt-2 flex-shrink-0`}></div>
        <div>
          <div className="text-sm font-medium text-slate-200">{title}</div>
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
            <div className="text-xs text-slate-400/60">v0.0.8</div>
          </div>
          
        <div className="space-y-3">
          <ChangelogEntry
            title="Implemented Comprehensive Theme System"
            description="Created a unified theme system with consistent colors, components, and styling utilities. Includes pre-built themed components, semantic color mappings, and comprehensive documentation. Ensures all pages have identical styling and makes creating new pages much easier."
            color="bg-blue-500/70"
            linkTo={getChangelogLink("Implemented Comprehensive Theme System", "Created a unified theme system with consistent colors, components, and styling utilities. Includes pre-built themed components, semantic color mappings, and comprehensive documentation. Ensures all pages have identical styling and makes creating new pages much easier.")}
          />
          <ChangelogEntry
            title="Added Icons to Filter Components"
            description="Enhanced Stats page filter inputs with intuitive icons - calendar icon for date/time filters and package icon for product search. Improved visual clarity and user experience across filter components."
            color="bg-blue-500/70"
            linkTo={getChangelogLink("Added Icons to Filter Components", "Enhanced Stats page filter inputs with intuitive icons - calendar icon for date/time filters and package icon for product search. Improved visual clarity and user experience across filter components.")}
          />
          <ChangelogEntry
            title="Fixed Financial Trend Chart Display"
            description="Resolved chart rendering issues - chart now correctly displays COGS (red), Revenue (blue), and Profit (green) lines with proper date ranges and positive values. Chart shows monthly financial trends from first order to last sale date."
            color="bg-blue-500/70"
            linkTo={getChangelogLink("Fixed Financial Trend Chart Display", "Resolved chart rendering issues - chart now correctly displays COGS red Revenue blue and Profit green lines with proper date ranges and positive values. Chart shows monthly financial trends from first order to last sale date.")}
          />
          <ChangelogEntry
            title="Made Changelog Entries Clickable"
            description="Added navigation functionality to changelog entries - click any entry to go directly to the page where the changes were made. Smart routing based on content type (stats, orders, emails, etc.)"
            color="bg-yellow-400/70"
            linkTo={getChangelogLink("Made Changelog Entries Clickable", "Added navigation functionality to changelog entries - click any entry to go directly to the page where the changes were made. Smart routing based on content type stats orders emails etc.")}
          />
          <ChangelogEntry
            title="Fixed Single Item Stats Display"
            description="Corrected data flow in SingleItemChart and FinancialTrendChart to use properly filtered data, added Items Bought to Quick Stats, and fixed filtering logic for dropdown selection"
            color="bg-blue-500/70"
            linkTo={getChangelogLink("Fixed Single Item Stats Display", "Corrected data flow in SingleItemChart and FinancialTrendChart to use properly filtered data, added Items Bought to Quick Stats, and fixed filtering logic for dropdown selection")}
          />
          <ChangelogEntry
            title="Accurate Single Item Analytics"
            description="KPI pills now use actual order book data instead of filtered results, added proper monthly line graph showing COGS (red), Revenue (blue), and Profit (green) trends over time"
            color="bg-blue-500/70"
            linkTo={getChangelogLink("Accurate Single Item Analytics", "KPI pills now use actual order book data instead of filtered results, added proper monthly line graph showing COGS red Revenue blue and Profit green trends over time")}
          />
          <ChangelogEntry
            title="Enhanced Stats Page Interface"
            description="Combined filters with analytics, live search filtering, improved mobile grid layout (2 columns), and better spacing throughout the page"
            color="bg-blue-500/70"
            linkTo={getChangelogLink("Enhanced Stats Page Interface", "Combined filters with analytics, live search filtering, improved mobile grid layout 2 columns and better spacing throughout the page")}
          />
          <ChangelogEntry
            title="Redesigned Emails Tab with Modern Interface"
            description="Complete redesign with selectable rows, bulk actions, search functionality, and consistent styling matching the rest of the app"
            color="bg-green-500/70"
            linkTo={getChangelogLink("Redesigned Emails Tab with Modern Interface", "Complete redesign with selectable rows, bulk actions, search functionality, and consistent styling matching the rest of the app")}
          />
          <ChangelogEntry
            title="Enhanced Shipments Page with Optimized Layout"
            description="Improved expandable cards with smaller images, better space utilization, and organized information display in responsive grid layout"
            color="bg-green-500/70"
            linkTo={getChangelogLink("Enhanced Shipments Page with Optimized Layout", "Improved expandable cards with smaller images, better space utilization, and organized information display in responsive grid layout")}
          />
          <ChangelogEntry
            title="Added Active Tab Highlighting"
            description="Implemented active tab highlighting for emails and shipments navigation with consistent visual feedback"
            color="bg-green-500/70"
            linkTo={getChangelogLink("Added Active Tab Highlighting", "Implemented active tab highlighting for emails and shipments navigation with consistent visual feedback")}
          />
          <ChangelogEntry
            title="Added Cross-Navigation Between Emails and Shipments"
            description="Implemented navigation tabs on both emails and shipments pages for seamless switching between email management and shipment tracking"
            color="bg-green-500/70"
            linkTo={getChangelogLink("Added Cross-Navigation Between Emails and Shipments", "Implemented navigation tabs on both emails and shipments pages for seamless switching between email management and shipment tracking")}
          />
          <ChangelogEntry
            title="Split Emails and Shipments into Separate Tabs"
            description="Created new /shipments tab for managing order shipments and tracking, while keeping /emails focused on Gmail account management and connection"
            color="bg-green-500/70"
            linkTo={getChangelogLink("Split Emails and Shipments into Separate Tabs", "Created new shipments tab for managing order shipments and tracking, while keeping emails focused on Gmail account management and connection")}
          />
          <ChangelogEntry
            title="Enhanced Multiple Gmail Account Support"
            description="Updated OAuth callback and sync functions to properly support multiple Gmail accounts from different users, allowing comprehensive email organization from all connected accounts"
            color="bg-green-500/70"
            linkTo={getChangelogLink("Enhanced Multiple Gmail Account Support", "Updated OAuth callback and sync functions to properly support multiple Gmail accounts from different users, allowing comprehensive email organization from all connected accounts")}
          />
          <ChangelogEntry
            title="Enhanced Mark as Sold Page"
            description="Added consistent title section with Sale details header and Mark an existing order as sold subtitle to match Quick Add page styling"
            color="bg-blue-500/70"
            linkTo={getChangelogLink("Enhanced Mark as Sold Page", "Added consistent title section with Sale details header and Mark an existing order as sold subtitle to match Quick Add page styling")}
          />
          <ChangelogEntry
            title="Optimized Application Width"
            description="Increased application width from 60% to 95% of browser width across all pages for better desktop utilization and improved data display"
            color="bg-yellow-400/70"
            linkTo={getChangelogLink("Optimized Application Width", "Increased application width from 60% to 95% of browser width across all pages for better desktop utilization and improved data display")}
          />
          <ChangelogEntry
            title="Enhanced Order Book Interface"
            description="Integrated search, fixed input heights, replaced dropdowns with native selects, improved button layout, and added a mutual exclusion between search and add operations."
            color="bg-blue-500/70"
            linkTo={getChangelogLink("Enhanced Order Book Interface", "Integrated search, fixed input heights, replaced dropdowns with native selects, improved button layout, and added a mutual exclusion between search and add operations.")}
          />
            
            <ChangelogEntry
              title="Added Profiles Card to Hub"
              description="New Profiles card added to main hub with Coming soon status for future user profile management"
              color="bg-pink-500/70"
              linkTo={getChangelogLink("Added Profiles Card to Hub", "New Profiles card added to main hub with Coming soon status for future user profile management")}
            />
            
            <ChangelogEntry
              title="Enhanced Inventory Dashboard"
              description="Added 8 comprehensive KPI pills with live filtering, improved search functionality, and better visual hierarchy"
              color="bg-blue-500/70"
              linkTo={getChangelogLink("Enhanced Inventory Dashboard", "Added 8 comprehensive KPI pills with live filtering, improved search functionality, and better visual hierarchy")}
            />
            
            <ChangelogEntry
              title="Universal Search Dropdown"
              description="Standardized all dropdowns across the app with consistent styling, proper layering, and live filtering"
              color="bg-yellow-400/70"
              linkTo={getChangelogLink("Universal Search Dropdown", "Standardized all dropdowns across the app with consistent styling, proper layering, and live filtering")}
            />
            
            <ChangelogEntry
              title="Improved Header Design"
              description="Replaced dashboard button with clickable avatar/username button for better navigation and visual balance"
              color="bg-yellow-400/70"
              linkTo={getChangelogLink("Improved Header Design", "Replaced dashboard button with clickable avatar/username button for better navigation and visual balance")}
            />
            
          <ChangelogEntry
            title="Fixed Financial Trend Chart Date Logic"
            description="Corrected chart to use order_date for COGS/buys, sale_date for revenue/sales, and calculate monthly profit as revenue minus COGS. Chart now shows accurate financial trends over time."
            color="bg-blue-500/70"
            linkTo={getChangelogLink("Fixed Financial Trend Chart Date Logic", "Corrected chart to use order_date for COGS/buys, sale_date for revenue/sales, and calculate monthly profit as revenue minus COGS. Chart now shows accurate financial trends over time.")}
          />
          <ChangelogEntry
            title="Enhanced Order Book"
            description="Added bulk edit/delete functionality, improved form persistence, and better mobile responsiveness"
            color="bg-blue-500/70"
            linkTo={getChangelogLink("Enhanced Order Book", "Added bulk edit/delete functionality, improved form persistence, and better mobile responsiveness")}
          />
          </div>
        </div>
      </div>
    </div>
  );
}
