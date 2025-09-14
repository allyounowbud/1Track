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
      title: "Fixed Retailer and Marketplace Ghost Text Display Logic",
      description: "Corrected the display logic for Retailer and Marketplace dropdown fields to properly show ghost text (text-slate-500) when no value is selected, instead of showing solid white text. The condition now checks for both null/undefined values and empty strings (formState.retailer && formState.retailer !== '') to ensure proper ghost text styling. This change applies to both desktop and mobile views, providing consistent visual feedback that these fields are empty and need user input.",
      color: "bg-slate-600",
      date: "2024-12-20",
      time: "05:05",
      author: "Development Team"
    },
    {
      title: "Enhanced Order Book Row Padding for Cleaner Visual Appearance",
      description: "Increased padding throughout Order Book table rows to create a cleaner, less squished appearance. Desktop rows now use lg:py-3 lg:px-3 (increased from lg:py-2 lg:px-1) and all input fields now use px-2 py-2 (increased from px-1 py-1). These changes provide better visual breathing room, making the table more comfortable to read and interact with while maintaining the responsive design and functionality.",
      color: "bg-slate-600",
      date: "2024-12-20",
      time: "05:00",
      author: "Development Team"
    },
    {
      title: "Enhanced Stats Page Products Filter with Live Searchable Dropdown",
      description: "Replaced the static products filter with a live searchable dropdown that provides real-time filtering as you type. Users can now search through all available products by typing in the filter field, see live results that update with each keystroke, and select specific products from the dropdown to view stats for individual items. The dropdown shows product counts, supports keyboard navigation (Escape to close), includes a clear button, and automatically closes when clicking outside. This matches the search functionality from the Inventory page for consistent user experience across the application.",
      color: "bg-slate-600",
      date: "2024-12-20",
      time: "05:05",
      author: "Development Team"
    },
    {
      title: "Improved Settings Page Mobile Row Selection - Removed Individual Checkboxes",
      description: "Updated the Settings page (Products, Retailers, Marketplaces) to match the Order Book mobile selection pattern. On mobile devices, individual row checkboxes have been removed and the entire row area is now clickable for selection, providing more intuitive touch interaction. Desktop users still see checkboxes in the grid layout. Mobile users now have a cleaner interface with labeled stacked layouts that don't require precise checkbox tapping. This change improves mobile usability while maintaining the existing desktop experience and follows the established mobile interaction patterns used throughout the application.",
      color: "bg-slate-600",
      date: "2024-12-20",
      time: "05:10",
      author: "Development Team"
    },
    {
      title: "Added Mobile Row Selection Indicators to Settings Page",
      description: "Added 'Click to select row' indicators to the Settings page mobile view, matching the Order Book functionality. These small, centered text indicators appear below each row on mobile devices to clearly communicate that rows are selectable by tapping anywhere on the row. The indicators change to 'Selected' when a row is active, providing clear visual feedback. This enhancement improves mobile usability by making row selection behavior more discoverable and intuitive, especially for users who might not realize that rows without visible checkboxes are still selectable.",
      color: "bg-slate-600",
      date: "2024-12-20",
      time: "05:15",
      author: "Development Team"
    },
    {
      title: "Standardized Settings Page Input Labels for Better Clarity",
      description: "Updated all input field labels in the Settings page (Products, Retailers, Marketplaces) to use consistent and clear terminology across both mobile and desktop views. Products now show 'Item Name' and 'Market Value', Retailers show 'Retailer Name', and Marketplaces show 'Marketplace Name' and 'Fee (%)'. The desktop column headers have also been updated to be more specific, replacing the generic 'Details' header with 'Market Value' for Products and 'Fee (%)' for Marketplaces. These changes improve user understanding and provide better context for what information should be entered in each field.",
      color: "bg-slate-600",
      date: "2024-12-20",
      time: "05:20",
      author: "Development Team"
    },
    {
      title: "Improved Stats Page Filter Alignment and Ghost Text Styling",
      description: "Fixed alignment issues between the 'All time' and 'All products' filters on the Stats page to create a more professional appearance. Adjusted the products filter padding to perfectly align with the time filter dropdown. Also updated the time filter to show 'All time' as ghost text (placeholder styling) when no selection is made, providing better visual hierarchy and a cleaner default state. The filters now have consistent spacing and alignment across both mobile and desktop views, creating a more polished user interface.",
      color: "bg-slate-600",
      date: "2024-12-20",
      time: "05:25",
      author: "Development Team"
    },
    {
      title: "Optimized Retailer and Marketplace Column Widths for Better Space Utilization",
      description: "Reduced Retailer column width by 20% (from 1fr to 0.8fr) and Marketplace column width by 15% (from 1fr to 0.85fr) on Order Book desktop large screens. These adjustments optimize space distribution across the table, providing more room for other important columns while maintaining adequate space for retailer and marketplace names. The changes improve overall layout balance and space utilization in the Order Book spreadsheet view.",
      color: "bg-slate-600",
      date: "2024-12-20",
      time: "04:55",
      author: "Development Team"
    },
    {
      title: "Reduced Profile Column Width for Better Space Distribution",
      description: "Reduced the Profile column width by 20% on Order Book desktop large screens (from 1fr to 0.8fr) to optimize space distribution across the table. This change provides more room for other columns while still maintaining adequate space for profile names. The Profile column is now more compact, allowing for better utilization of the available table width and improved overall layout balance in the Order Book spreadsheet view.",
      color: "bg-slate-600",
      date: "2024-12-20",
      time: "04:50",
      author: "Development Team"
    },
    {
      title: "Doubled Date Column Widths for Better Date Input Visibility",
      description: "Increased the width of Order Date and Sale Date columns from 70px to 140px (doubled) on large screens to provide more space for date inputs and improve readability. The wider date columns make it easier to read and interact with date fields while maintaining the overall table layout efficiency. This change provides better visual balance and improved user experience when working with date values in the Order Book table.",
      color: "bg-slate-600",
      date: "2024-12-20",
      time: "04:45",
      author: "Development Team"
    },
    {
      title: "Reduced Date Column Widths for Better Space Utilization",
      description: "Reduced the width of Order Date and Sale Date columns by 30% on large screens (from 1fr to 70px) to optimize space utilization in the Order Book table. This change allows more space for other columns while still providing adequate room for date inputs. The date columns are now more compact, making better use of the available table width and improving the overall layout efficiency. Mobile layouts remain unchanged, maintaining optimal usability across all screen sizes.",
      color: "bg-slate-600",
      date: "2024-12-20",
      time: "04:40",
      author: "Development Team"
    },
    {
      title: "Refined Default Text Display with Descriptive Ghost Text",
      description: "Updated default text for empty fields to be more descriptive and user-friendly. Profile field now shows 'Profile' as ghost text, Retailer dropdown shows 'Retailer' as default option, Sale Price shows '0.00' when empty or zero, Marketplace dropdown shows 'Marketplace' as default option, and Shipping shows '0.00' when empty or zero. All empty fields maintain ghost text styling (text-slate-500) for subtle visual indication while providing clear context about what each field is for. Changes applied consistently across both desktop and mobile views.",
      color: "bg-slate-600",
      date: "2024-12-20",
      time: "04:35",
      author: "Development Team"
    },
    {
      title: "Updated Empty Field Display Logic with Ghost Text and Enhanced Date Picker Icons",
      description: "Implemented comprehensive empty field display logic across both desktop and mobile views. Empty fields now show '-' as ghost text (text-slate-500) instead of placeholder text, including Profile, Sale Price (when 0 or empty), Sale Date (shows 'mm/dd/yy'), Retailer, Marketplace, and Shipping fields. Updated dropdown default options to show '-' instead of descriptive text. Enhanced date picker icons visibility with CSS filter: invert(1) and opacity adjustments to make them more visible against the dark theme. All changes maintain consistent styling across responsive layouts.",
      color: "bg-slate-600",
      date: "2024-12-20",
      time: "04:30",
      author: "Development Team"
    },
    {
      title: "Removed Focus Border and Background from Dropdown Selection Boxes",
      description: "Eliminated the purple focus border and background change from Item, Retailer, and Marketplace dropdown selection boxes in the desktop spreadsheet view. Added specific CSS targeting the :focus state to remove all focus styling (border, outline, box-shadow, background) and removed the focus:bg-slate-800/50 class from Tailwind. The dropdowns now appear as completely plain text with no visual indication when clicked or focused, creating a true spreadsheet-like appearance where all columns look identical.",
      color: "bg-slate-600",
      date: "2024-12-20",
      time: "04:25",
      author: "Development Team"
    },
    {
      title: "Completely Removed Button-Like Styling from Dropdown Selection Boxes",
      description: "Eliminated all button-like appearance from Item, Retailer, and Marketplace dropdown selection boxes in the desktop spreadsheet view by adding custom CSS that removes borders, shadows, rounded corners, and all default browser styling. The dropdowns now appear as plain text with no visual indication of being interactive elements, creating a true spreadsheet-like appearance where all columns look identical. Added rounded-none and shadow-none classes plus custom CSS with !important declarations to override all default browser styling.",
      color: "bg-slate-600",
      date: "2024-12-20",
      time: "04:20",
      author: "Development Team"
    },
    {
      title: "Hidden Borders on Dropdown Selection Boxes in Desktop Spreadsheet",
      description: "Removed borders from the Item, Retailer, and Marketplace dropdown selection boxes in the desktop spreadsheet view to create a cleaner, more spreadsheet-like appearance. The dropdowns now use border-none instead of border-transparent and have removed the focus border effects (focus:border-indigo-500, focus:border-2, focus:ring-2), making them look like regular text cells rather than input fields. This creates a more seamless spreadsheet experience while maintaining functionality.",
      color: "bg-slate-600",
      date: "2024-12-20",
      time: "04:15",
      author: "Development Team"
    },
    {
      title: "Extended Solid Indigo Border to Desktop Spreadsheet Rows",
      description: "Fixed the desktop spreadsheet view in the Order Book to show solid indigo borders around selected rows, matching the mobile view behavior. Previously, desktop rows only showed a subtle bottom border (lg:border-b lg:border-slate-700/50) even when selected. Now selected desktop rows display the same prominent indigo border (lg:border-indigo-500) as mobile rows, ensuring consistent visual feedback across all screen sizes and maintaining the same professional appearance as the database/settings pages.",
      color: "bg-slate-600",
      date: "2024-12-20",
      time: "04:10",
      author: "Development Team"
    },
    {
      title: "Added Solid Indigo Border to Selected Rows for Better Visual Distinction",
      description: "Enhanced the selected row styling in the Order Book by changing from a subtle transparent border (border-indigo-500/30) to a solid indigo border (border-indigo-500). This provides a clear, prominent border around selected rows that matches the styling used in the database/settings pages. The solid border makes it much easier to distinguish selected rows from unselected ones, improving the overall user experience and visual consistency across the application.",
      color: "bg-slate-600",
      date: "2024-12-20",
      time: "04:05",
      author: "Development Team"
    },
    {
      title: "Added Focus Ring Effect to Individual Row Inputs for Better Visibility",
      description: "Enhanced the focus effect on individual input fields within Order Book grid card rows by adding a focus ring (focus:ring-2 focus:ring-indigo-500/20) in addition to the existing purple border. This creates a more prominent visual indicator when users click on any input field, ensuring the focus state is clearly visible even when the row is selected and has a purple background. The combination of border and ring effects provides excellent visual feedback for form interactions.",
      color: "bg-slate-600",
      date: "2024-12-20",
      time: "04:00",
      author: "Development Team"
    },
    {
      title: "Enhanced Purple Focus Border Visibility on Individual Row Inputs",
      description: "Improved the purple focus border effect on individual row inputs within the Order Book table by increasing the border width to 2px (focus:border-2) for better visibility. This ensures that when users click on any input field within a selected row, they get clear visual feedback with a prominent purple border, making it easy to see which field is currently active. The enhanced border visibility works consistently across all input types (text, date, number) and dropdowns.",
      color: "bg-slate-600",
      date: "2024-12-20",
      time: "03:55",
      author: "Development Team"
    },
    {
      title: "Added Purple Focus Border Effect to Order Book Desktop Inputs",
      description: "Restored the purple focus border effect (focus:border-indigo-500) to all desktop inputs and dropdowns in the Order Book table. This provides consistent visual feedback when users interact with form elements, matching the styling used throughout the rest of the application. The desktop inputs now show a subtle purple border on focus while maintaining the clean spreadsheet aesthetic, and mobile inputs already had this effect.",
      color: "bg-slate-600",
      date: "2024-12-20",
      time: "03:50",
      author: "Development Team"
    },
    {
      title: "Reduced Dollar Column Widths for Better Space Utilization",
      description: "Reduced the width of Buy $, Sale $, and Ship $ columns by 30% on desktop and large screen views (from 80px to 56px) to optimize space utilization in the Order Book table. This change allows more space for other columns while still providing adequate room for dollar value inputs. The responsive design ensures mobile layouts remain unchanged, maintaining optimal usability across all screen sizes.",
      color: "bg-slate-600",
      date: "2024-12-20",
      time: "03:45",
      author: "Development Team"
    },
    {
      title: "Restored Desktop Checkboxes While Keeping Mobile Click-to-Select",
      description: "Added back individual row selection checkboxes for desktop and large screen views (lg+) while maintaining the click-to-select interface for mobile devices. This provides the best of both worlds: precise checkbox selection for desktop users with mouse/keyboard, and intuitive touch-friendly row selection for mobile users. The desktop interface now includes both individual row checkboxes and 'Select All' functionality, while mobile users can still click anywhere on the row to select it.",
      color: "bg-slate-600",
      date: "2024-12-20",
      time: "03:40",
      author: "Development Team"
    },
    {
      title: "Removed Individual Row Checkboxes for Cleaner Click-to-Select Interface",
      description: "Eliminated individual row selection checkboxes from the Order Book table to create a cleaner, more intuitive interface. The entire row is now clickable for selection, making the interaction more natural and reducing visual clutter. Updated the mobile 'click to select row' text to use cursor-pointer and select-none classes to prevent text cursor appearance and make it clear the text is clickable. This change simplifies the selection process while maintaining all functionality.",
      color: "bg-slate-600",
      date: "2024-12-20",
      time: "03:35",
      author: "Development Team"
    },
    {
      title: "Implemented Responsive Order Book Design with Mobile-First Approach",
      description: "Completely redesigned the Order Book table with responsive layouts for different screen sizes. On large screens (lg+), the table displays as a clean spreadsheet with transparent dropdowns that look like text with arrows, no borders or backgrounds. On mobile/small screens, the layout switches to stacked form fields with bubble row outlines, uniform heights, and clear labels for each field. This provides an optimal user experience across all devices while maintaining full functionality.",
      color: "bg-slate-600",
      date: "2024-12-20",
      time: "03:30",
      author: "Development Team"
    },
    {
      title: "Updated Quick Add Navigation Icon to Clean Plus for Better Distinction",
      description: "Changed the Quick Add navigation icon from a plus in circle to a clean plus icon to avoid visual similarity with the Mark as Sold checkmark in circle icon. The clean plus maintains the intuitive 'add' meaning while being visually distinct from other navigation icons. This change improves icon differentiation and prevents user confusion between the Quick Add and Mark as Sold functions.",
      color: "bg-slate-600",
      date: "2024-12-20",
      time: "03:25",
      author: "Development Team"
    },
    {
      title: "Updated Quick Add Navigation Icon to Plus in Circle for Better Visual Weight",
      description: "Replaced the simple plus icon for Quick Add navigation with a plus icon inside a circle that provides better visual weight to match other navigation icons. The plus symbol remains intuitive for adding/creating new items while the circular background gives it more visual presence and consistency with the overall navigation design. This variation maintains the clear 'add' meaning while improving the visual balance with other navigation elements.",
      color: "bg-slate-600",
      date: "2024-12-20",
      time: "03:20",
      author: "Development Team"
    },
    {
      title: "Updated Quick Add Navigation Icon to Shopping Cart for Better Visual Weight",
      description: "Replaced the simple plus icon for Quick Add navigation with a shopping cart icon that better matches the visual weight and style of other navigation icons. The shopping cart icon is more appropriate for adding orders and provides better visual balance with the other navigation elements. This change improves the overall visual consistency of the navigation while making the Quick Add function more intuitive and recognizable to users.",
      color: "bg-slate-600",
      date: "2024-12-20",
      time: "03:15",
      author: "Development Team"
    },
    {
      title: "Updated Order Book Navigation Icon to Document List for Better Representation",
      description: "Replaced the clipboard icon for Order Book navigation with a more appropriate document list icon that better represents a ledger of orders. The new icon shows a document with list lines, which is more intuitive for users to understand that this section contains a comprehensive list/ledger of all orders. This change improves the visual clarity and makes the navigation more intuitive by using an icon that clearly represents the content and purpose of the Order Book section.",
      color: "bg-slate-600",
      date: "2024-12-20",
      time: "03:10",
      author: "Development Team"
    },
    {
      title: "Updated Product Filter Icon to Tag Symbol for Better Clarity",
      description: "Replaced the confusing package/box icon in the product filter dropdown with a clearer tag icon that better represents products and items. The new tag icon is more universally recognized as a symbol for products, items, or categories, making the filter's purpose immediately clear to users. This improvement enhances the user experience by providing more intuitive visual cues for the product selection functionality.",
      color: "bg-slate-600",
      date: "2024-12-20",
      time: "03:05",
      author: "Development Team"
    },
    {
      title: "Fixed Product Filter Icon and Text Overlap Issue",
      description: "Resolved the overlapping icon and text issue in the product filter dropdown by completely restructuring the TableSearchDropdown component to use the same flex layout approach as the Select component. Replaced absolute positioning with a flex container that uses gap-2 spacing between icon and text, ensuring proper separation and alignment. The component now displays icons and text with consistent spacing, matching the visual appearance of the date filter dropdown for a cohesive user interface.",
      color: "bg-slate-600",
      date: "2024-12-20",
      time: "03:00",
      author: "Development Team"
    },
    {
      title: "Fixed Product Filter Icon Positioning and Text Spacing",
      description: "Resolved the issue where the product filter dropdown icon was being cut off on the left side and text was starting too close to the icon. Updated the TableSearchDropdown component to use responsive positioning (left-3 sm:left-4) for the icon and responsive padding (pl-8 sm:pl-10) for the input text. This ensures the icon is fully visible within the container and the text starts with proper spacing to the right of the icon, creating a more polished and readable interface.",
      color: "bg-slate-600",
      date: "2024-12-20",
      time: "02:55",
      author: "Development Team"
    },
    {
      title: "Fixed Stats Page Filter Dropdown Height Consistency",
      description: "Ensured consistent height between the date filter and product filter dropdowns on the Stats page by updating the TableSearchDropdown component to use the standardized inputBase styling. Both filter dropdowns now have matching heights (h-10 on small screens, h-11 on larger screens) for a more polished and consistent user interface. This improvement maintains visual harmony across all form elements in the application.",
      color: "bg-slate-600",
      date: "2024-12-20",
      time: "02:50",
      author: "Development Team"
    },
    {
      title: "Updated Homepage Order Book Link to Direct to Quick Add",
      description: "Modified the homepage Order Book link in the sidebar navigation to direct to the Quick Add page (/add) instead of the Order Book table (/orders). This provides users with direct access to the most commonly used order entry functionality when navigating from the homepage. The Order Book link within the orderbook section navigation still directs to /orders for users who want to view the order table. This creates a more intuitive navigation flow where the homepage provides quick access to order entry, while the orderbook section maintains access to the full order management interface.",
      color: "bg-slate-600",
      date: "2024-12-20",
      time: "02:45",
      author: "Development Team"
    },
    {
      title: "Fixed Checkbox Styling with Custom CSS for Dark Theme",
      description: "Resolved the issue where checkboxes were still appearing white by implementing custom CSS that completely overrides browser default styling. Added custom CSS rules that set checkboxes to have dark gray backgrounds (#1e293b) when unchecked and blue backgrounds (#6366f1) with white checkmarks when checked. The custom styling uses appearance: none to remove all browser defaults and creates a consistent dark theme experience across all checkboxes in the Order Book and Settings pages.",
      color: "bg-slate-600",
      date: "2024-12-20",
      time: "02:35",
      author: "Development Team"
    },
    {
      title: "Improved Checkbox Styling with Dark Backgrounds and Blue Checkmarks",
      description: "Enhanced checkbox styling throughout the application to provide better visual feedback and theme consistency. Checkboxes now have dark backgrounds (bg-slate-800) when unchecked, creating a more subtle appearance that fits the dark theme. When checked, they display blue/purple checkmarks (accent-indigo-500) for clear visual indication of the selected state. This improves the overall user experience by making checkbox states more visually distinct while maintaining consistency with the dark theme aesthetic.",
      color: "bg-slate-600",
      date: "2024-12-20",
      time: "02:25",
      author: "Development Team"
    },
    {
      title: "Darkened Changelog Color Indicators for Better Theme Consistency",
      description: "Updated all changelog color indicator boxes to use darker colors that better fit the dark theme. Changed from bright semi-transparent colors (bg-blue-500/70, bg-yellow-500/70) to solid dark gray (bg-slate-600) for a more subtle and consistent appearance. The color indicators now blend better with the overall dark interface while maintaining their visual purpose as entry type indicators. This creates a more cohesive and professional appearance throughout the changelog section.",
      color: "bg-slate-600",
      date: "2024-12-20",
      time: "02:15",
      author: "Development Team"
    },
    {
      title: "Enhanced Checkbox Styling for Better Dark Theme Integration",
      description: "Updated all checkbox backgrounds throughout the application to use darker colors that better fit the dark theme. Changed checkbox backgrounds from 'bg-slate-900/60' and 'bg-slate-800/60' to solid 'bg-slate-800' for a more consistent and darker appearance. This affects all checkboxes in the Order Book, Settings, and other components, providing better visual integration with the overall dark theme while maintaining the indigo accent colors for checked states and focus rings.",
      color: "bg-slate-600",
      date: "2024-12-20",
      time: "02:05",
      author: "Development Team"
    },
    {
      title: "Optimized Order Book Column Widths for Dollar Values and Full Row Extension",
      description: "Optimized the Order Book grid layout to make dollar value columns (Buy $, Sale $, Ship $) more compact while ensuring the Ship $ column extends all the way to the right edge. Changed grid column definitions from uniform '1fr' sizing to specific widths: 'auto_1fr_2fr_1fr_1fr_80px_80px_1fr_1fr_80px'. This makes the dollar value columns exactly 80px wide (perfect for currency inputs) while allowing other columns to use flexible space. The Ship $ column now properly extends to the furthest right edge of the row, eliminating any unused space. Updated all headers to match the new column structure for perfect alignment.",
      color: "bg-slate-600",
      date: "2024-12-20",
      time: "01:55",
      author: "Development Team"
    },
    {
      title: "Fixed Order Book Full-Width Utilization for Complete Content Display",
      description: "Resolved the remaining width utilization issue in the Order Book to ensure rows fill the entire available width with no empty space on the right side. Reduced grid gaps from 'gap-2' to 'gap-1' to minimize spacing between columns. Added 'min-w-0' to all input fields and grid containers to prevent width constraints. Added 'grid-rows-1' to ensure proper row height distribution. Updated all headers to match the reduced gap spacing. The result is complete width utilization with maximum content visibility per cell, eliminating any wasted horizontal space.",
      color: "bg-slate-600",
      date: "2024-12-20",
      time: "01:45",
      author: "Development Team"
    },
    {
      title: "Optimized Order Book for Maximum Content Visibility and Seamless Cell Design",
      description: "Final optimization of the Order Book spreadsheet design to maximize content visibility and create truly seamless cell appearance. Reduced row padding from 'p-3' to 'py-2 px-1' to eliminate wasted space and allow more content per cell. Removed all visual styling from dropdowns including rounded corners and extra padding, making them look identical to plain text fields. All input fields now use minimal 'px-1 py-1' padding for maximum content space. Dropdowns maintain 'cursor-pointer' for usability while appearing as seamless text. The result is a professional spreadsheet with maximum content density and no visual distinction between input types.",
      color: "bg-slate-600",
      date: "2024-12-20",
      time: "01:35",
      author: "Development Team"
    },
    {
      title: "Enhanced Order Book Spreadsheet Design with Perfect Alignment",
      description: "Further refined the Order Book spreadsheet design by removing all dropdown outlines to create seamless cell appearance, ensuring rows fill the full width of the container, and perfecting header-to-column alignment. All select dropdowns now use 'appearance-none' to remove browser default styling and match the transparent cell design. Grid containers now use 'w-full' to ensure complete width utilization. Fixed column count mismatch between headers and rows to ensure perfect alignment across all screen sizes. The result is a truly professional spreadsheet experience with no visual inconsistencies.",
      color: "bg-slate-600",
      date: "2024-12-20",
      time: "01:25",
      author: "Development Team"
    },
    {
      title: "Redesigned Order Book with Clean Spreadsheet-Style Rows",
      description: "Completely redesigned the Order Book table to use a clean spreadsheet-style layout instead of individual outlined cells. Removed all individual cell borders and backgrounds, creating seamless rows with subtle bottom borders. Input fields now have transparent backgrounds with focus states that highlight the active cell. This eliminates the confusing 'bubble outline' effect and creates a much cleaner, more professional spreadsheet-like appearance while maintaining all editing functionality. The new design is easier to scan and less visually cluttered.",
      color: "bg-slate-600",
      date: "2024-12-20",
      time: "01:15",
      author: "Development Team"
    },
    {
      title: "Updated Marketplace Field Label and Layout",
      description: "Changed 'Sale Location' to 'Marketplace' in the Mark as Sold form for clearer terminology and consistency with the Quick Add form. Made the Marketplace field extend the full width like the 'Select Open Purchase' field above it, providing better visual consistency and more space for marketplace selection. This creates a more intuitive and consistent user experience across both forms.",
      color: "bg-slate-600",
      date: "2024-12-20",
      time: "01:05",
      author: "Development Team"
    },
    {
      title: "Implemented Responsive Grid Layout with Section Dividers",
      description: "Enhanced both Quick Add and Mark as Sold forms with a responsive grid layout that optimizes space usage on larger screens while maintaining single-column layout on mobile. Order details now display as: Row 1 (Order Date & Item), Row 2 (Profile & Retailer), Row 3 (Quantity & Buy Price). Sale details display as: Row 1 (Sale Date & Sell Price), Row 2 (Marketplace), Row 3 (Fees & Shipping). Added subtle divider lines under section headers to create better visual separation. This provides a more efficient use of screen real estate on desktop while preserving the clean, spacious layout on mobile devices.",
      color: "bg-slate-600",
      date: "2024-12-20",
      time: "00:55",
      author: "Development Team"
    },
    {
      title: "Implemented Consistent Individual Input Field Spacing",
      description: "Restructured both Quick Add and Mark as Sold forms to provide perfectly consistent spacing between every individual input field. Each input field now has its own row with uniform space-y-6 spacing between all fields, eliminating the issue where some fields appeared close together while others had larger gaps. This creates a clean, uniform vertical rhythm throughout the forms where every field (Order Date, Item, Profile, Retailer, Quantity, Buy Price, Sell Price, Sale Date, etc.) has exactly the same spacing to the next field. The forms now have a much more professional and organized appearance with perfect visual consistency.",
      color: "bg-slate-600",
      date: "2024-12-20",
      time: "00:45",
      author: "Development Team"
    },
    {
      title: "Enhanced Individual Input Field Spacing",
      description: "Added significant vertical spacing between individual input field groups in both Quick Add and Mark as Sold forms. Reorganized the layout to group related fields together with space-y-6 spacing between each group, creating clear visual separation between different input sections. This provides much better breathing room between fields like 'Select Open Purchase', 'Sell Price', 'Sale Date', etc., making the forms feel less cramped and easier to navigate. Each logical group of fields now has proper spacing while maintaining the responsive grid layout.",
      color: "bg-slate-600",
      date: "2024-12-20",
      time: "00:35",
      author: "Development Team"
    },
    {
      title: "Improved Form Spacing and Visual Hierarchy",
      description: "Enhanced the visual spacing and layout of Quick Add and Mark as Sold forms to reduce cramped appearance. Increased vertical spacing between form sections from space-y-6 to space-y-8 in QuickAdd and space-y-5 to space-y-7 in MarkSold. Expanded grid gaps from gap-4 to gap-6 for better separation between input fields. Increased label-to-input spacing from mb-1 to mb-2 for improved readability. These changes create a more breathable and professional form layout that's easier to scan and use.",
      color: "bg-slate-600",
      date: "2024-12-20",
      time: "00:25",
      author: "Development Team"
    },
    {
      title: "Fixed Input Field Sizing Consistency on Small Screens",
      description: "Standardized all input field heights and widths across Quick Add and Mark as Sold forms to ensure consistent sizing on small screens. Updated SearchDropdown component to use the same inputBase styling as regular inputs, and ensured all input fields use consistent height classes (h-10 sm:h-11). This fixes the issue where input fields appeared different sizes when stacked together on mobile devices, providing a more polished and professional appearance.",
      color: "bg-slate-600",
      date: "2024-12-20",
      time: "00:15",
      author: "Development Team"
    },
    {
      title: "Completely Redesigned Dropdown Components for Reliable Search and Add Functionality",
      description: "Fixed critical dropdown issues that were preventing users from selecting options or adding new items. Completely redesigned both SearchDropdown and SimpleSearchDropdown components with robust state management, proper input handling, and reliable 'Add +' functionality. Users can now search through existing options, select them reliably, and add new items/products/retailers/marketplaces directly from any dropdown. Enhanced Inventory page to support adding new items through the search dropdown. All dropdowns now work consistently across QuickAdd, MarkSold, Inventory, and Stats pages with proper keyboard navigation and click-outside-to-close behavior.",
      color: "bg-slate-600",
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
      color: "bg-slate-600",
      date: "2024-12-19",
      time: "22:45",
      author: "Development Team"
    },
    {
      title: "Enhanced Mobile Experience and UI Improvements",
      description: "Significantly improved the mobile experience with responsive design enhancements. Made header selection text smaller on mobile to match input field text size. Hidden checkboxes on mobile rows and made entire rows clickable for easier selection with ghost text indicators. Reduced button sizes on mobile (w-8 h-8) while maintaining desktop sizes (w-10 h-10). Converted grid/list view buttons into a single toggle button to save space and distinguish view controls from action buttons. Added visual cues and better spacing for mobile interactions.",
      color: "bg-slate-600",
      date: "2024-12-19",
      time: "22:30",
      author: "Development Team"
    },
    {
      title: "Updated Sign Out Button to Match App Design",
      description: "Redesigned the sign out button to match the rest of the web app's design language. Changed from a text-based button to an icon-based square button with rounded edges (rounded-lg). Uses the same styling as other icon buttons throughout the app with slate color scheme, hover effects, and proper accessibility with tooltip. The button now features a logout icon with subtle scale animation on hover.",
      color: "bg-slate-600",
      date: "2024-12-19",
      time: "22:20",
      author: "Development Team"
    },
    {
      title: "Implemented Changelog Pagination and Version Numbering System",
      description: "Added pagination to the changelog to show only 10 entries at a time with navigation controls. Implemented a proper version numbering system that increments by 0.0.1 for each update. Each changelog entry now displays its version number in a styled badge alongside the timestamp. Added Previous/Next buttons and page numbers for easy navigation through changelog history.",
      color: "bg-slate-600",
      date: "2024-12-19",
      time: "22:15",
      author: "Development Team"
    },
    {
      title: "Reverted to Exact Version Before Input Outline Changes",
      description: "Completely reverted to the exact version from before input outline changes were made. Removed profile sections from both HeaderWithTabs and PageHeader components since they're now available in the sidebar. Reverted input focus styles from ring-based focus indicators back to simple border color changes (focus:border-indigo-500). Updated bulk action buttons from rounded-xl to rounded-lg for proper rounded square styling consistent with the site's design.",
      color: "bg-slate-600",
      date: "2024-12-19",
      time: "22:00",
      author: "Development Team"
    },
    {
      title: "Fixed Sidebar Positioning and User Account Section",
      description: "Fixed two critical sidebar issues: 1) Made the sidebar fixed in place so it doesn't scroll with the page content - only the main content area scrolls now, providing a proper dashboard experience. 2) Fixed the user account section at the bottom of the sidebar to stay properly contained within the sidebar bounds instead of extending across the entire page. The profile section now correctly stays at the bottom of the sidebar with proper background and positioning.",
      color: "bg-slate-600",
      date: "2024-12-19",
      time: "21:00",
      author: "Development Team"
    },
    {
      title: "Fixed Sidebar Navigation - All Pages Now Use Sidebar",
      description: "Updated all remaining pages (QuickAdd, MarkSold, Inventory, Stats, Settings) to use the new collapsible sidebar navigation instead of the old HeaderWithTabs component. Now all pages consistently use the modern sidebar layout, providing a unified navigation experience across the entire application. The sidebar shows the appropriate section-specific navigation for each page and maintains the collapsible functionality for optimal space usage.",
      color: "bg-slate-600",
      date: "2024-12-19",
      time: "20:45",
      author: "Development Team"
    },
    {
      title: "Implemented Collapsible Sidebar Navigation",
      description: "Completely redesigned the navigation system with a modern collapsible left sidebar that replaces the header tabs. The sidebar includes section-specific navigation (Order Book, Emails, Profiles) with icons and labels, a collapsible toggle button, and user account information at the bottom. This provides significantly more space for content, eliminates tab wrapping issues, and creates a modern dashboard feel similar to popular applications like Notion and Linear. The sidebar can be collapsed to save even more space when needed.",
      color: "bg-slate-600",
      date: "2024-12-19",
      time: "20:30",
      author: "Development Team"
    },
    {
      title: "Reverted to Original Two-Line Header Layout",
      description: "Reverted the compact single-line header layout back to the original two-line design with the title and user avatar on the first line, and navigation tabs on a separate line below. The original layout provides better visual hierarchy, clearer separation of elements, and more comfortable spacing for navigation. This maintains the familiar and proven user interface that users are accustomed to while preserving all functionality.",
      color: "bg-slate-600",
      date: "2024-12-19",
      time: "20:15",
      author: "Development Team"
    },
    {
      title: "Implemented Compact Single-Line Header Layout",
      description: "Redesigned the header layout to save significant vertical space by combining the title, navigation tabs, and user avatar into a single horizontal line. Reduced title size from text-3xl to text-2xl, made tabs more compact with smaller icons and tighter spacing, and streamlined the user avatar to a smaller, more efficient design. This saves approximately 50px of vertical space while maintaining all functionality and improving the overall user experience with more content visible above the fold.",
      color: "bg-slate-600",
      date: "2024-12-19",
      time: "20:00",
      author: "Development Team"
    },
    {
      title: "Removed Logo and Fine-Tuned BETA Badge Alignment",
      description: "Removed the logo image from all header components to create a cleaner, more minimal brand presentation. Adjusted the BETA badge positioning by increasing the bottom margin from mb-0.5 to mb-1 to better align with the OneTrack title baseline. This creates a more refined and focused header design that emphasizes the typography while maintaining the subtle BETA status indication.",
      color: "bg-slate-600",
      date: "2024-12-19",
      time: "19:45",
      author: "Development Team"
    },
    {
      title: "Reduced BETA Badge Text Size for Subtle Branding",
      description: "Made the BETA badge text smaller (changed from text-sm to text-xs) while maintaining its perfect positioning on the bottom baseline nearly touching the OneTrack title. This creates a more subtle and refined appearance that clearly indicates the beta status without overwhelming the main brand name. The smaller size makes the BETA badge feel more like a natural typographic element while preserving the precise alignment and spacing that was previously achieved.",
      color: "bg-slate-600",
      date: "2024-12-19",
      time: "19:30",
      author: "Development Team"
    },
    {
      title: "Fine-Tuned BETA Badge Positioning for Perfect Alignment",
      description: "Further refined the BETA badge positioning to achieve perfect visual alignment. Moved the BETA text even closer to the OneTrack title using negative left margin (-ml-1) so it's nearly touching, and adjusted the vertical position (mb-0.5) to perfectly align with the bottom baseline of the title text. This creates the most precise and professional typography alignment possible, ensuring the BETA badge appears as a natural extension of the OneTrack brand name.",
      color: "bg-slate-600",
      date: "2024-12-19",
      time: "19:15",
      author: "Development Team"
    },
    {
      title: "Refined Header Logo and BETA Badge Positioning",
      description: "Improved the visual alignment of the header elements by pushing the logo closer to the OneTrack title (reduced gap from 3 to 2) and repositioning the BETA badge to align with the bottom baseline of the title text. The BETA text now sits lower and closer to the title, creating a more cohesive and professional appearance. This refinement enhances the overall visual hierarchy and brand presentation across all pages.",
      color: "bg-slate-600",
      date: "2024-12-19",
      time: "19:00",
      author: "Development Team"
    },
    {
      title: "Added App Logo and BETA Badge to Headers",
      description: "Enhanced the application branding by adding the OneTrack logo to the left of the title in all header components. Added a subtle 'BETA' badge in ghost text styling to the right of the OneTrack title across all pages (Hub, Order Book, Emails, Shipments, and Profiles). This provides consistent branding and clearly indicates the application's beta status to users while maintaining the clean, professional appearance of the interface.",
      color: "bg-slate-600",
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
