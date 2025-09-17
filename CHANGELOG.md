# Changelog

All notable changes to this project will be documented in this file.

## [Unreleased]

### Added
- **Complete Light/Dark Mode Theme System**: Implemented a comprehensive theme system with light and dark mode support across the entire application. Features include:
  - **Theme Context & Provider**: Created React context for theme state management with localStorage persistence and system preference detection
  - **Theme Toggle Component**: Added elegant theme toggle button with sun/moon icons, positioned in the sidebar header for easy access
  - **CSS Custom Properties**: Implemented CSS variables for all theme colors (backgrounds, text, borders, accents) with smooth transitions
  - **Comprehensive Theme Coverage**: Updated all components including sidebar, layout, error pages, workspace cards, and form elements to support both themes
  - **Professional Light Mode**: Light mode features clean white cards, soft gray backgrounds, and professional color scheme that's easy on the eyes
  - **Full Page Coverage**: Updated all application pages (OrderBook, Portfolio, Emails, Profiles, Database/Settings, Stats, Inventory, QuickAdd, MarkSold, Shipments) and components (SearchPage, UnifiedProductsCard, CategoryComponents, UnifiedNewProductRow, ProductSearchDropdown, TableSearchDropdown, SearchDropdown, Select) to use consistent light theme styling
  - **SearchPage Redesign**: Completely redesigned SearchPage to use expandable cards with slide-out panels instead of static sidebar, matching the Portfolio page design pattern for better space utilization and user experience
  - **SearchPage UI Improvements**: Removed color circle indicators, fixed button text colors for light mode, made expand preview use full container without header, and updated + add buttons to be smaller and theme-colored
  - **Mobile-Optimized**: Theme toggle is hidden on mobile to avoid interference with the bottom navigation bar
  - **UI Utilities Update**: Updated all shared UI components (cards, inputs, buttons, tabs) to be fully theme-aware
  - **Smooth Transitions**: All theme changes include smooth 300ms transitions for a polished user experience
  - **System Integration**: Automatically detects and respects user's system theme preference on first visit

### Enhanced
- **Search Page Dropdown Visibility**: Significantly increased the height and text size of the three filter dropdowns (Category, Product Type, Sort Results) on the search page to ensure full text visibility. Changed from h-8 to h-12, text-xs to text-base, and increased padding (px-4 py-3) for optimal readability.
- **Search Page Filter Layout**: Reorganized the filter dropdown layout to ensure all dropdowns stay on a single line and fill the entire row width. All three dropdowns now use `flex-1` to equally distribute the available space, with smaller text size (text-xs) across all screen sizes for better visibility on small screens. The "items found" count is positioned inline with the dropdowns, and the Sort Results dropdown maintains its transparent background and no border for a cleaner appearance.

### Added
- **Category Browse Cards**: Added interactive category cards that appear on the main search page before any search is performed. Features 8 popular categories (Pokemon, Magic: The Gathering, Yu-Gi-Oh!, Video Games, Sports Cards, Dragon Ball, One Piece, Digimon) with colorful gradient backgrounds, emoji icons, and hover effects. Clicking any category card automatically populates the search field and triggers a search for that category, providing an intuitive browsing experience similar to modern trading card platforms.
- **Enhanced Card Grid Responsiveness**: Improved the product card grid with smarter responsive breakpoints to prevent cards from becoming too thin. Updated grid to use 2 columns on small screens, 3 on medium (sm), and 4 on large (lg) screens for optimal card proportions and better readability.
- **Streamlined Add Button**: Simplified the add button to display only a plus icon without text, creating a cleaner and more consistent design. The button is now a fixed 8x8 size with centered icon for better visual balance.
- **Real Inventory Tracking**: Replaced random quantity display with actual inventory count from the order book. Each product card now shows the real quantity of items in inventory (orders without 'sold' status) by querying the Supabase orders table, providing accurate inventory information for better collection management.
- **Uniform Card Layout**: Enhanced product card consistency with fixed-height sections and uniform button positioning. Cards now use flexbox layout with fixed heights for product names (40px) and console names (20px), ensuring the + button is always positioned at the exact same spot at the bottom of each card regardless of content length.
- **Improved Card Information Layout**: Restructured product card layout to group product name and set name together with proper spacing. Set name now appears directly below the item name with a small margin, followed by a larger gap before the price section, creating better visual hierarchy and information grouping.
- **Streamlined Filter Layout**: Reorganized the search interface by moving category and product type filters to dropdowns below the search bar, with the sort filter positioned on the right side of the same row. Removed the left sidebar filter card to maximize space for the product grid, which now supports up to 3 columns maximum on large screens (2 on small, 3 on medium and above).
- **Compact Header Filters**: Moved all filter dropdowns into the header section directly below the search bar for better space utilization. Removed filter title labels and made dropdowns more compact with smaller height (h-8), reduced text size (text-xs), smaller chevron icons (w-3 h-3), and tighter spacing (gap-2, mt-3) for a cleaner, more integrated header design.
- **Dropdown Placeholder Text**: Added descriptive placeholder text to each filter dropdown to indicate their purpose. The default options now show "Category", "Product Type", and "Sort Results" respectively, providing clear context for users while maintaining the compact design without separate labels.
- **Repositioned Results Count**: Moved the "items found" count from below the search bar to below the filter dropdowns for better visual hierarchy and logical grouping of search-related information, then moved it back to its original position below the search bar.
- **Product Image Scraping**: Implemented comprehensive image scraping system for PriceCharting products. Created new Supabase Edge Function (`price-charting-images`) that scrapes product images from PriceCharting's website, with intelligent caching to avoid repeated scraping. Images are cached for 24 hours and stored in a new `product_images` database table. Both ProductCard and ProductPreview components now display real product images with fallback to category icons when images are unavailable or fail to load.

### Added
- **Collectr-Style Search Page**: Completely redesigned the Portfolio search page to match Collectr's interface with a professional full-width layout featuring a prominent search header, left sidebar filters, right sidebar preview/legend, and responsive product grid. The page includes a "Find a Product" header with search bar, context information showing "Adding to: Main" and inventory totals, and comprehensive filtering system in a collapsible sidebar.
- **Product Preview Window**: Replaced expandable cards with a sophisticated preview window that appears in the right sidebar when clicking on any product. The preview includes comprehensive product information, price breakdown (loose/CIB/new prices), graded card values (PSA 8/9/10), price history chart placeholder, and a quick-add section with pre-filled product name and quantity selector.
- **Streamlined Search Interface**: Removed portfolio header title and moved "Find a Product" header up for better focus. Eliminated "Adding to: Main" and inventory total display since these are calculated on the collections page. Fixed search bar text input positioning to prevent overlap with search icon. Removed unnecessary "Search for Products" card for cleaner interface.
- **Integrated Sort Filter**: Moved comprehensive sorting system from main content area to left sidebar filters section, replacing the set name search. Includes all 13 sorting options (Best Match, Price, Card Number, Product Name, Trending, Date Added, Percent Change) with proper integration into the filter state management system.
- **Enhanced Product Preview**: Added placeholder description in right sidebar when search results are displayed but no product is selected, explaining the preview functionality. Replaced simple add-to-collection with a complete minified quick-add form that includes order date, product name (pre-filled), retailer, quantity, and buy price fields, matching the functionality of the main QuickAdd page.
- **Improved Search Interface**: Enhanced sort dropdown with proper styling including custom chevron icon and appearance-none for better visual consistency. Moved "X items found" text to appear directly below the search box for better information hierarchy. Fixed search icon positioning with proper padding (pl-12) to prevent text overlap and ensure clean visual separation.
- **Smart Product Cards**: Updated product cards to display inventory quantity instead of loose price, showing "Qty: X in inventory" with random mock data. Changed add button behavior to open product preview instead of directly adding to collection, with blue styling for better visual distinction. Add button now triggers preview with automatic highlighting and scrolling to the add-to-collection form section.
- **Enhanced Product Preview Experience**: Added automatic highlighting effect to the add-to-collection form when accessed via the add button, with smooth scrolling and 3-second highlight duration. Ensured full product names (like "Accessory Pouch Special Collection") are properly populated in the form using useEffect to handle product changes. Added visual feedback with blue border and background highlight for better user guidance.
- **Mobile-First Responsive Design**: Implemented comprehensive mobile optimization with responsive grid layout (2 columns on small screens, 3 on medium, 4 on large screens). Optimized all components for mobile including smaller text sizes, reduced padding, and touch-friendly button sizes. Made sidebar collapsible on mobile with full-width layout, and hid product details sidebar on mobile when no product is selected for better space utilization.
- **Optimized Search Page Layout**: Removed the "Portfolio" header from the search page to maximize available space for search functionality. The header now only appears on other portfolio tabs (Overview, Collection, Stats, Inventory) while the search page uses the full available space for its search interface and results.
- **Streamlined Filter Sidebar**: Reduced the filter sidebar width from 256px (w-64) to 224px (w-56) for better space efficiency. Made filter option text responsive (text-xs on mobile, text-sm on desktop) to fit better in the narrower space while maintaining readability and functionality.
- **Graded Card Values**: Added graded card pricing for single cards showing PSA 8, PSA 9, and PSA 10 values with realistic multipliers based on the base card price. Values are calculated dynamically and only shown for single cards (not sealed products).
- **Price History Charts**: Added price history chart placeholders with professional styling that will integrate with future price tracking data. Charts include proper labeling and visual indicators for trend analysis.
- **Professional Filtering System**: Implemented a sophisticated left sidebar filter system with collapsible sections for Category (Pokemon, Magic, Yu-Gi-Oh!, Sports Cards, Video Games), Product Type (Cards Only, Sealed Only), and Set Name filtering. Filters use radio buttons and checkboxes with proper styling and include item counts for better user experience.
- **Enhanced Search Interface**: Added professional search header with search bar, Search/Clear buttons, context information, and sort functionality. The interface includes proper loading states, error handling, and responsive design that works seamlessly across all screen sizes with full-width utilization.
- **Collection Integration with Quantity Selection**: Seamlessly integrated search results with the existing collection system, allowing users to add any searched item directly to their portfolio with quantity selection, automatic status setting to "ordered", and proper price tracking. Added watchlist functionality for tracking items of interest without immediately adding them to collection.
- **Popular Search Suggestions**: Added quick-search buttons for popular items like Charizard, Black Lotus, Blue-Eyes White Dragon, Elite Trainer Box, and more to help users get started with searching.

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
- **Order Book Simplification**: Removed Market $ column from Order Book since market data is already stored by the API and doesn't need to be displayed in the order management interface
- **Order Book Error Fix**: Fixed ReferenceError caused by remaining marketData references after removing Market $ column
- **Order Book Column Reorder**: Swapped positions of Sale Date and Sale Price columns for better workflow (Sale Date now comes before Sale Price)
- **Order Book New Row UX**: Prevented grid card from collapsing when adding new rows to ensure form remains accessible during data entry, and hid the expand/collapse arrow since new order sections cannot be collapsed
- **Database Dropdown Styling**: Applied consistent dropdown styling to database category dropdowns to match other input fields, ensuring proper border outline and text alignment
- **Database Input Consistency**: Unified background styling across all database input fields (item name, category dropdown, and market value) for a cohesive visual appearance
- **Database Dropdown Arrow**: Added dropdown arrow icon to category dropdown for better user experience and visual clarity
- **Order Book Dropdown Arrows**: Added dropdown arrow icons to retailer and marketplace dropdowns in Order Book for consistent UX across all dropdowns
- **Dropdown Background Consistency**: Fixed dropdown background colors to match other input fields, ensuring all form elements have the same visual appearance
- **Database Interface Simplification**: Removed singles/sealed toggle and TCG singles card, now using unified products card for all product categories
- **Portfolio API Integration Enhancement**: Improved market data coverage tracking and visualization in Portfolio page with detailed indicators for items with/without API data, enhanced error handling and logging in market data service, and added market data coverage metrics to help users identify items needing better product name matching
- **Portfolio Market Data Matching Fix**: Fixed issue where items added via ProductSearchDropdown weren't getting market data due to display name vs. product name mismatch. Now properly matches both display names (e.g., "Charizard - Pokemon Base Set") and base product names (e.g., "Charizard") to API data
- **API Endpoint Fix**: Fixed 404 error by updating market data service and ProductSearchDropdown to use Netlify functions instead of Supabase edge functions for price-charting API calls
- **Background Market Data Loading**: Implemented background market data service that pre-loads portfolio data while users navigate other pages, with 24-hour caching and localStorage persistence for instant Portfolio page loading
- **Portfolio Instant Loading**: Enhanced Portfolio page to check background cache first and load data instantly without API calls when cached data is available, eliminating loading states on page refresh
- **Portfolio Image Placeholder System**: Replaced non-functional image placeholders with attractive product type indicators since PriceCharting API doesn't provide image URLs. Added smart product type detection (ETB, Booster Box, Pack, Collection, Premium, Card) and set name display with decorative elements
- **Order Book Number Parsing Fix**: Fixed critical bug where editing numeric values in Order Book was corrupting data (e.g., 30.65 becoming 306,500.00). Improved parseMoney function to handle commas and multiple decimal points correctly, and updated centsToStr to only add commas for values >= 1000

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
