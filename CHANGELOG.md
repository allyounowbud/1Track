# Changelog

All notable changes to this project will be documented in this file.

## [Unreleased]

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

## [Unreleased] - Database Bulk Delete Debug

### Debug
- Added comprehensive debug logging to bulk delete functions in database/products page
- Added logging to button visibility logic to help diagnose bulk delete button issues
- Enhanced error handling and user feedback for bulk delete operations

### Fixed
- Fixed bulk delete functionality for all database cards (Video Games, Products, Retailers, Marketplaces)
- Ensured all bulk delete functions have consistent debug logging and error handling
- All bulk delete functions now work consistently like the TCG Sealed card
