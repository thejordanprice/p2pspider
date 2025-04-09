# P2P Spider v1.0.7 Release Notes

We're pleased to announce the release of P2P Spider v1.0.7, which enhances the file browsing experience and improves the robustness of the directory tree component.

## What's New

### Enhanced File Browsing Experience
- Improved handling of file data in latest.ejs with better validation and error handling
- Added intelligent file count limiting with "more files" link for cleaner UI presentation
- Enhanced directory tree component with better container-specific interactions
- Improved error recovery with retry capability for dynamic content loading

### Directory Tree Component Improvements
- Refactored directory tree JavaScript with IIFE pattern for proper encapsulation
- Enhanced folder icon management for more consistent visual experience
- Updated event handling for better component-level isolation
- Improved error handling throughout the file browser components

## Benefits
- More reliable file browsing experience with better error handling
- Improved performance when navigating torrents with large file counts
- Enhanced code organization with better encapsulation of component logic
- Consistent behavior across different parts of the application

## Upgrading

This update requires:
- Pull the latest changes from the repository
- No database schema changes are required
- Restart the application

---

# P2P Spider v1.0.6 Release Notes

We're pleased to announce the release of P2P Spider v1.0.6, which addresses a minor HTML structure issue on the search page.

## What's New

### HTML Structure Fix
- Fixed an issue where the directory-tree.css stylesheet was being loaded outside the HTML head block
- Properly relocated the stylesheet link to the header include file
- Improved page load reliability and rendering consistency

## Benefits
- More efficient HTML structure and proper stylesheet loading
- Ensures consistent styling across different browsers
- Maintains HTML standards compliance

## Upgrading

This update requires:
- Pull the latest changes from the repository
- No database schema changes are required
- Restart the application

---

# P2P Spider v1.0.5 Release Notes

We're pleased to announce the release of P2P Spider v1.0.5, which delivers significant UI enhancements for file browsing and improvements to rendering performance.

## What's New

### Enhanced File Navigation
- Implemented a tree structure for file paths across all relevant views:
  - Added an interactive, collapsible directory tree for intuitive file navigation
  - Introduced "Collapse All" and "Expand All" buttons for improved user control
  - Enhanced visual feedback during folder interactions for better user experience
- Improved file path management with dedicated file tree utilities
- Added support for both tree view and simple list formats to accommodate different user preferences

### Performance Optimizations
- Updated cache durations in magnetController.js for faster response times
- Enhanced rendering logic to handle large file lists more efficiently
- Optimized file display to limit initially displayed files for faster page loading
- Improved overall rendering performance with better structured file data

## Benefits
- More intuitive navigation of torrent file structures
- Significantly improved user experience when browsing torrents with many files
- Faster page loading and smoother interactions
- Better visual hierarchy for complex file structures

## Upgrading

This update requires:
- Pull the latest changes from the repository
- No database schema changes are required
- Restart the application

---

# P2P Spider v1.0.4 Release Notes

We're pleased to announce the upcoming release of P2P Spider v1.0.4, which focuses on connectivity improvements, configuration enhancements, and better development experience.

## What's New

### Connectivity Improvements
- Updated tracker URLs in magnetController.js to include additional and updated torrent trackers
  - Enhanced torrent discovery by adding more reliable trackers
  - Updated outdated tracker URLs to their current endpoints
  - Improved connection success rates for DHT operations

### Database Configuration
- Updated database configuration to use SQLite as default with fallback MongoDB URI
  - Simplified local development setup with SQLite as the default database
  - Enhanced compatibility across different environments
  - Maintained MongoDB support for production deployments

### Development Experience
- Updated .gitignore to include additional database and environment files
  - Added entries for SQLite shared memory and write-ahead log files
  - Organized system files for clarity
  - Improved cleanliness of repository for developers

## Upgrading

This update requires:
- Pull the latest changes from the repository
- No database schema changes are required
- Restart the application

---

# P2P Spider v1.0.3 Release Notes

We're pleased to announce the release of P2P Spider v1.0.3, which focuses on significant performance improvements and stability enhancements, particularly for resource-intensive operations.

## What's New

### Performance & Stability Improvements
- Implemented robust timeout mechanisms for database and Redis operations to prevent deadlocks
- Added LRU eviction policy to the memory cache system with size limits to prevent memory leaks
- Enhanced SQLite configuration for better concurrency handling using WAL mode
- Improved Redis connection handling with automatic health checks and recovery
- Added graceful error handling for long-running queries that could cause system instability

### Search Optimization
- Optimized search functionality for large datasets with improved query timeouts
- Enhanced pagination handling for better performance with large result sets
- Implemented graceful fallbacks for search operations to prevent system lockups

## Benefits
- Significantly improved stability under heavy load and with large datasets
- Better memory management preventing resource exhaustion
- More responsive search experience, even for uncommon search terms
- Reduced likelihood of application deadlocks during resource-intensive operations

## Upgrading

This update requires:
- Pull the latest changes from the repository
- Install any dependencies if needed: `npm install`
- No database schema changes are required
- Restart the application

---

# P2P Spider v1.0.2 Release Notes

We're excited to announce the release of P2P Spider v1.0.2, which introduces Elasticsearch integration for significantly improved search capabilities.

## What's New

### Elasticsearch Integration
- Added full Elasticsearch support for powerful and efficient full-text search
- Implemented configuration options in the `.env` file for easy setup
- Created a bulk indexing utility to migrate existing data to Elasticsearch
- Enhanced search functionality to use Elasticsearch when available

### Benefits
- Significantly faster search performance, especially for large datasets
- Improved search relevance with better ranking of results
- Support for fuzzy matching and advanced search capabilities
- Scalable search infrastructure for growing magnet collections

## How to Use

1. Install Elasticsearch on your system or use a managed service
2. Update your `.env` file with the following settings:
   ```
   USE_ELASTICSEARCH=true
   ELASTICSEARCH_NODE=http://localhost:9200
   ELASTICSEARCH_INDEX=magnets
   ```
3. To migrate existing data to Elasticsearch, run:
   ```
   node utils/bulkIndexToElasticsearch.js
   ```

## Upgrading

This update requires:
- Pull the latest changes from the repository
- Install the new dependencies: `npm install`
- Update your `.env` file with Elasticsearch configuration
- Restart the application

---

# P2P Spider v1.0.1 Release Notes

We're pleased to announce the release of P2P Spider v1.0.1, a maintenance update that fixes UI consistency issues across the application.

## What's New

### Bug Fixes
- Fixed inconsistent page titles in search and infohash pages that were showing "Tordex" instead of the configured site name
  - All pages now correctly display the site name configured in your environment settings
  - This provides a more consistent and professional user experience

## Upgrading

This is a minor update focused on UI consistency. Upgrading requires:
- Pull the latest changes from the repository
- Restart the application

No database changes or configuration updates are required for this release.

---

# P2P Spider v1.0.0 Release Notes

We're excited to announce the official 1.0.0 release of P2P Spider, a powerful DHT network crawler and magnet link indexer with a modern web interface.

## What's New

### Unified Architecture
- Consolidated codebase with a single entry point (`app.js`) replacing the separate daemon and web server
- Complete migration from PUG to EJS templates for better maintainability

### Enhanced Database Support
- Added SQLite support as an alternative to MongoDB
- Redis integration for caching recently seen infohashes
- Improved database abstraction layer for better performance

### Modern User Interface
- Fully responsive design using Tailwind CSS
- Real-time updates through optimized WebSocket implementation
- Enhanced search functionality and statistics visualization
- Improved typography with Google Fonts (Inter, Manrope)

### Performance & Stability
- Optimized WebSocket communication with message batching
- Enhanced DHT spider with improved error handling
- Better connection failure recovery
- Resource usage optimizations with memory limits

### Deployment Improvements
- Environment configuration via `.env` files
- Enhanced PM2 integration for production deployments
- Comprehensive documentation

## Upgrading

When upgrading from previous versions, please note:
- Configuration has moved to `.env` files (see `.env.sample` for reference)
- The database schema has been updated for better performance
- Process management now uses the included `ecosystem.json` file

## Documentation

See the [README.md](README.md) for complete setup and configuration instructions. 