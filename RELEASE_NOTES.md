# P2P Spider v1.1.0 Release Notes

This release focuses on a major internal refactoring of the codebase to improve modularity, maintainability, and overall structure. While there are no significant new user-facing features, these changes lay a foundation for future development and enhance the project's robustness.

## Major Refactoring

The core `app.js` file, which previously handled many different responsibilities, has been significantly refactored. Its logic has been broken down and moved into dedicated modules:

- **Configuration (`config/`)**: Environment variables (`env.js`) and Express app setup (`express.js`) are now centralized in the `config` directory.
- **Core Libraries (`lib/`)**: Database initialization (`database.js`), Redis client management (`redis.js`), and P2P Spider logic (`p2p.js`, `index.js`) are now organized within the `lib` directory.
- **Services (`services/`)**: WebSocket server logic (`websocket.js`) is now handled by a dedicated service module.

The main `app.js` file now acts as a streamlined orchestrator, responsible for initializing these modules and starting the application services (Web Server, P2P Daemon) based on the configuration.

## Key Benefits of the Refactoring

- **Improved Modularity**: Code is now organized into logical, single-responsibility modules.
- **Enhanced Maintainability**: Easier to understand, modify, and debug specific parts of the application.
- **Better Readability**: The codebase structure is clearer and the main entry point is simplified.
- **Increased Robustness**: Clearer separation of concerns reduces the chance of unintended side effects.
- **Improved Shutdown**: Graceful shutdown process has been enhanced to reliably close all components (HTTP server, P2P Spider, Redis client).

## Upgrading

This update involves significant changes to the internal file structure.

1.  Pull the latest changes from the repository:
    ```bash
    git pull origin master # Or your main branch name
    ```
2.  Install/update dependencies (if any changes were made to package.json, although none were in this refactor):
    ```bash
    npm install
    ```
3.  Restart the application:
    ```bash
    npm start # Or your usual start command (e.g., pm2 restart app)
    ```

No database schema changes or manual configuration updates are required for this version.

---

# P2P Spider v1.0.13 Release Notes

We're pleased to announce the release of P2P Spider v1.0.13, which enhances the metadata extraction capabilities with file size tracking and improves the file tree display UI.

## What's New

### File Size Tracking
- Added file size extraction from torrent metadata
- Updated the database schema to store individual file sizes and total torrent size
- Enhanced the UI to display file sizes in human-readable format (B, KB, MB, GB, TB)
- Improved file tree view to show individual file sizes
- Added total torrent size display on all views (search, latest, infohash)

### File Tree UI Improvements
- Fixed vertical alignment issues in file tree display
- Enhanced CSS to ensure consistent alignment between filenames and file sizes
- Updated folder toggle functionality to work with both directory and file elements
- Improved tree rendering for better visual consistency

## Benefits
- Better understanding of content size before downloading
- More comprehensive metadata for torrents
- Enhanced file browsing experience with detailed size information
- Improved search experience with at-a-glance size information
- More useful metadata for archival and analysis purposes
- Consistent visual alignment across all UI elements

## Upgrading
This update requires:
- Pull the latest changes from the repository
- Database schema updates will be automatically applied
- Restart the application

---

# P2P Spider v1.0.12 Release Notes

We're pleased to announce the release of P2P Spider v1.0.12, which improves the file listing experience on individual infohash pages.

## What's New

### Enhanced Infohash File Listings
- Improved file display on infohash detail pages to show all files instead of truncated list
- Modified processFilesForDisplay function to conditionally skip file limits on infohash pages
- Enhanced file tree rendering logic for better handling of large file lists

## Benefits
- Complete file listing for better exploration of torrents on dedicated infohash pages
- Improved user experience when examining detailed content of specific torrents
- Better visualization of complex file structures for comprehensive torrent assessment
- Consistent browsing experience across all pages with appropriate file detail level

## Upgrading
This update requires:
- Pull the latest changes from the repository
- No database schema changes are required
- Restart the application

---

# P2P Spider v1.0.11 Release Notes

We're pleased to announce the release of P2P Spider v1.0.11, which improves the directory tree display functionality to work consistently across all data sources.

## What's New

### Directory Tree Display Improvements
- Fixed directory tree display on search results page to properly show hierarchical file structure
- Enhanced handling of comma-separated file paths by converting them to proper directory structure
- Improved file tree processing to work consistently with both Elasticsearch and database results
- Refactored file processing code for better maintainability and consistency across all pages
- Enhanced client-side tree initialization to handle different data formats seamlessly

## Benefits
- Consistent directory tree display across all pages (search, latest, and infohash)
- Improved user experience when browsing search results with complex file structures
- More reliable file navigation regardless of data source (Elasticsearch or database)
- Better visual representation of folder structures
- Enhanced compatibility across different file path formats

## Upgrading
This update requires:
- Pull the latest changes from the repository
- No database schema changes are required
- Restart the application

---

# P2P Spider v1.0.10 Release Notes

We're pleased to announce the release of P2P Spider v1.0.10, which focuses on enhancing the directory tree functionality for a more reliable and responsive user experience.

## What's New

### Directory Tree Enhancements
- Completely refactored directory tree initialization and state management to prevent duplicate initializations
- Implemented a promise-based approach for waiting on directory trees to ensure proper loading
- Added processing state management to prevent user interactions during folder operations
- Improved folder open/close logic to eliminate visual glitches and ensure consistency
- Enhanced DOM event handling for better responsiveness with dynamically loaded content
- Added MutationObserver to automatically initialize trees added to the DOM
- Updated CSS to disable transitions during operations for better performance
- Improved error handling and retry mechanisms for more reliable initialization

## Benefits
- More reliable directory tree functionality across the application
- Better visual consistency when opening and closing folders
- Improved user experience with proper state management during operations
- Enhanced performance with optimized transitions and event handling
- More robust handling of dynamically loaded content
- Prevented duplicate event handlers and initialization issues

## Upgrading
This update requires:
- Pull the latest changes from the repository
- No database schema changes are required
- Restart the application

---

# P2P Spider v1.0.9 Release Notes

We're pleased to announce the release of P2P Spider v1.0.9, which focuses on significant performance improvements to the /latest page for a faster and more responsive user experience.

## What's New

### Latest Page Performance Optimization
- Reduced default page size from 25 to 15 items for faster initial rendering
- Increased cache duration for latest page results from 5 to 15 minutes for better resource utilization
- Implemented optimized database field projection to minimize data transfer
- Enhanced file display with more efficient handling of large file lists
- Improved client-side WebSocket handling with delayed initialization

## Benefits
- Significantly faster loading times for the Latest Discoveries page
- Reduced server load and improved resource utilization
- Better performance on mobile devices and slower connections
- More responsive real-time updates via optimized WebSocket handling
- Enhanced overall user experience when browsing new content

## Upgrading
This update requires:
- Pull the latest changes from the repository
- No database schema changes are required
- Restart the application

---

# P2P Spider v1.0.8 Release Notes

We're pleased to announce the release of P2P Spider v1.0.8, which introduces flexible control over the daemon and webserver components, allowing them to run independently or together.

## What's New

### Component Independence
- Added environment variable controls for independent operation of daemon and webserver
- New configuration options in .env file:
  - `RUN_DAEMON=true/false` - Controls whether the P2P Spider daemon runs
  - `RUN_WEBSERVER=true/false` - Controls whether the web server runs
- Both components can now be run independently or together based on your needs

## Benefits
- More flexible deployment options
- Reduced resource usage when only one component is needed
- Better control over system resources
- Easier debugging and maintenance of individual components

## Usage Examples
1. Run both daemon and webserver (default):
   ```bash
   node app.js
   ```

2. Run only the daemon:
   ```bash
   RUN_WEBSERVER=false node app.js
   ```

3. Run only the webserver:
   ```bash
   RUN_DAEMON=false node app.js
   ```

---

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