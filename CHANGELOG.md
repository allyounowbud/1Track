# Changelog

All notable changes to this project will be documented in this file.

## [Unreleased]

### Technical
- **Responsive Design Update**: Changed small screen breakpoint from 640px to 749px (screens 749px and below are now considered small screens)
- **Sidebar Expansion Restriction**: Removed ability to expand sidebar on mid-size screens (650px-1023px), now only available on large screens (1024px+)

### Enhanced
- **Mobile Card Spacing**: Improved spacing between workspace cards on mobile screens to prevent them from touching each other
- **Form Layout Consistency**: Restructured Quick Add and Mark as Sold forms to stack all input fields vertically with consistent spacing on mobile and small screens, with responsive 2-column grid layout on medium screens and above for better space utilization
- **Mark as Sold Field Spacing**: Fixed spacing issue where "Select Open Purchase" field was separated from other input fields, now all fields have consistent spacing
- **Order Book Layout**: Hidden checkbox column when adding new orders and adjusted header rows to perfectly align with input fields below
- **Order Book Dropdown Styling**: Fixed retailer and marketplace dropdown fields to have the same border outline as other input fields by adding `new-order-select` class to bypass CSS that removes styling from existing order rows
- **Order Book Dropdown Text Alignment**: Fixed vertical text alignment in retailer and marketplace dropdowns using CSS flexbox properties to properly center text on large screens
- **Market Data Debugging**: Added comprehensive logging to investigate why market values are showing as N/A in the Order Book despite API data being available

### Added
- Enhanced image display in Portfolio collection page with improved loading states and error handling
- Added lazy loading for product images from PriceCharting API
- Added click-to-expand functionality for product images
- Added visual indicator (green dot) to show when images are available from PriceCharting API
- Added hover effects and smooth transitions for image interactions

### Enhanced
- Improved image loading experience with loading spinners
- Better error handling for failed image loads with graceful fallbacks
- Enhanced user experience with hover overlays and click-to-view functionality

### Technical
- Images are now pulled from PriceCharting API and displayed in the collection page
- Added proper image optimization with lazy loading
- Improved accessibility with proper alt text and tooltips

## [Unreleased] - Database Consolidation & Unified Products System

### Major Changes
- **COMPLETE DATABASE CONSOLIDATION**: Consolidated all product categories into a single unified `products` table
- **SINGLE UNIFIED PRODUCTS CARD**: Replaced separate TCG Sealed, Video Games, and Other Items cards with a single card containing expandable category sections
- **NESTED CATEGORY ORGANIZATION**: Products are now organized by expandable categories within a single card interface
- **CATEGORY SELECTOR FOR NEW ROWS**: New product rows include a category dropdown to properly sort items
- **ELIMINATED BULK ACTION ISSUES**: All bulk delete/save functionality now works consistently across all categories

### Database Changes
- Created unified `products` table with `category` field to replace separate tables
- Added migration scripts to consolidate data from `tcg_sealed`, `tcg_singles`, `video_games`, and `items` tables
- Maintained all existing data fields while adding category-based organization
- Added proper indexing and RLS policies for the unified table

### UI/UX Improvements
- **Single Products Card**: All product categories now live in one card with nested expandable sections
- **Nested Category Sections**: TCG Sealed, TCG Singles, Video Games, and Other Items are now expandable sections within the single card
- **Category Selector**: New product rows include a dropdown to select the appropriate category
- **Empty State**: Added friendly empty state message with "Add Your First Product" button when no products exist
- **Main Add Button**: Added prominent "Add New Product" button in header when database is empty
- **Unified Bulk Actions**: Bulk delete/save now works consistently across all categories
- **Cleaner Interface**: Eliminated redundant cards and simplified the database management interface
- **Category Indicators**: Color-coded category headers with item counts and selection status

### Technical Improvements
- **Unified State Management**: Single selection state and bulk operations for all products
- **Consistent API**: All categories use the same CRUD operations and bulk action logic
- **Better Performance**: Single query instead of multiple separate queries
- **Maintainable Code**: Eliminated duplicate code and functions across categories

### Files Created
- `create-unified-products-table.sql`: Database schema for unified products table
- `migrate-to-unified-products.sql`: Migration script to consolidate existing data
- `src/components/UnifiedProductsCard.jsx`: New unified products interface component with nested categories
- `src/components/UnifiedNewProductRow.jsx`: New product row component with category selector and proper styling

### Bug Fixes
- **Fixed new product row styling**: Completely rewrote the new product row component to match existing design exactly
- **Removed visible utility classes**: Eliminated broken styling that was showing utility class names
- **Proper grid layout**: New product rows now use the same grid layout as existing product rows
- **Consistent button styling**: Save/Cancel buttons now match the existing design with proper icons
- **Mobile responsive**: Added proper mobile layout that matches existing components
- **Fixed card layout structure**: Completely rewrote UnifiedProductsCard to match SettingsCard structure exactly
- **Proper header positioning**: Title now appears at top with "Total: X" below it, matching TCG Singles card
- **Correct selector placement**: x/x selector now appears in proper position above spreadsheet rows
- **Removed broken CSS classes**: Eliminated all visible CSS utility classes from the interface
- **Added proper empty state**: Empty state now matches existing card design with proper messaging
- **Fixed input field heights**: All input fields now have consistent height (h-8) matching the save/delete buttons
- **Removed API search functionality**: Completely removed ProductSearchDropdown and all API-related code from new product rows
- **Manual entry only**: New product rows now use simple text input for manual entry, perfect for backup database items
- **Removed color indicators**: Eliminated all color indicator dots from product rows since API functionality is removed
- **Improved empty state**: Replaced large "Add Your First Product" button with subtle "+ adding" link in the text
- **Fixed dropdown height**: Increased category dropdown height from h-8 to h-9 for better text visibility
- **Uniform row heights**: Made all input fields, dropdown, and buttons the same height (h-8) for consistent appearance
- **Fixed dropdown text visibility**: Added proper styling to dropdown options to make text visible and match other input fields
- **Increased input heights**: Changed all inputs and buttons from h-8 to h-10 for better text readability and proper display
- **Fixed category text cutoff**: Increased dropdown height to h-12 to prevent any letter cutoff
- **Matched dropdown text size**: Added text-sm class to dropdown options to match input field text size
- **Fixed input consistency**: Made all inputs and buttons the same height (h-10) and text size (text-sm) for professional appearance
- **Removed unnecessary checkbox**: Removed checkbox from new product row since it auto-selects and can't be unselected
- **Reduced market value width**: Made market value input 35% less wide by adjusting grid proportions from 1fr to 0.65fr
- **Added minimum width to product name**: Added min-w-[150px] to product name input with proper overflow handling to prevent it from becoming too narrow while staying within container bounds
- **Fixed input visibility and proportions**: Restructured grid layout to grid-cols-[3fr_2fr_1fr_auto] ensuring all inputs are always visible with proper sizing priorities (product name widest, category second, market value smallest)

### Files Modified
- `src/routes/Settings.jsx`: Replaced multiple cards with unified Products card
- Updated all product-related queries to use unified `products` table
- Consolidated all bulk action functions into unified operations

## [Unreleased] - Database Bulk Delete Debug

### Debug
- Added comprehensive debug logging to bulk delete functions in database/products page
- Added logging to button visibility logic to help diagnose bulk delete button issues
- Enhanced error handling and user feedback for bulk delete operations

### Fixed
- Fixed bulk delete functionality for all database cards (Video Games, Products, Retailers, Marketplaces)
- Ensured all bulk delete functions have consistent debug logging and error handling
- All bulk delete functions now work consistently like the TCG Sealed card
- **CRITICAL FIX**: Copied exact working functions from TCG Sealed/Video Games cards to Other Items card
- Removed excessive debug logging that was spamming the console
- Other Items card now works 100% identically to the working cards
