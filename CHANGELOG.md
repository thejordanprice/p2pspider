# Changelog

All notable changes to this project will be documented in this file.

## [1.0.12] - 2025-04-10

### UI Enhancements
- Improved file display on infohash detail pages to show all files instead of truncated list
- Modified processFilesForDisplay function to conditionally skip file limits on infohash pages
- Enhanced file tree rendering logic for better handling of large file lists

## [1.0.11] - 2025-04-09

### Directory Tree Improvements
- Fixed directory tree display on search results page to work with all data sources
- Enhanced handling of comma-separated file paths in the file tree processing
- Improved file tree processing with consistent approach for all data formats
- Added a central processFilesForDisplay helper function for code consistency
- Enhanced client-side tree initialization to better handle dynamic content
- Updated Elasticsearch integration to properly process file data for tree display
- Improved error handling in directory tree rendering when data is incomplete

## [1.0.10] - 2025-04-09

### UI Enhancements
- Refactored directory tree initialization and state management for enhanced reliability
- Implemented promise-based approach for waiting on directory tree initialization
- Added processing state management to prevent user interactions during folder operations
- Enhanced folder state checks to prevent visual glitches and ensure consistency
- Improved DOM event handling for better responsiveness with dynamically loaded content
- Integrated MutationObserver to automatically initialize directory trees added to the DOM
- Updated CSS to disable transitions during operations for improved performance
- Enhanced error handling with detailed logging and retry mechanisms
- Removed unused collapse/expand buttons from infohash.ejs and search.ejs for cleaner UI

## [1.0.9] - 2025-04-09

### Performance Improvements
- Optimized /latest page loading speed and rendering performance
- Reduced default page size from 25 to 15 items for faster initial load
- Increased cache duration for latest page results from 5 to 15 minutes
- Improved file display with optimized field projection in database queries
- Enhanced client-side WebSocket initialization with delayed loading

## [1.0.8] - 2025-04-09

### New Features
- Added environment variable controls for independent daemon and webserver operation
  - `RUN_DAEMON=true/false` to control P2P Spider daemon
  - `RUN_WEBSERVER=true/false` to control web server
  - Both components can now run independently or together

## [1.0.7] - 2025-04-09

### UI Enhancements
- Enhanced file display logic in latest.ejs for improved handling of magnetData.files
- Added file count limiting in directory tree with "more files" link for better UI performance
- Refactored directory tree initialization with IIFE pattern to prevent global scope pollution
- Implemented retry capability for dynamic content loading in directory tree component
- Updated event listeners for directory controls to work within specific tree containers
- Enhanced error handling and folder icon management in file browser components

## [1.0.6] - 2025-04-09

### Bug Fixes
- Fixed stylesheet inclusion issue on search page where directory-tree.css was loaded outside the head block
- Properly moved directory-tree.css link to the header include file for better HTML structure

## [1.0.5] - 2025-04-08

### UI Enhancements
- Implemented tree structure for file paths in magnetController.js and associated views
- Added collapsible directory tree with visual feedback for better user interaction
- Enhanced folder interaction with "Collapse All" and "Expand All" buttons
- Improved rendering performance by limiting displayed files
- Added CSS for directory tree styling and JavaScript for dynamic functionality
- Integrated file tree utilities for better file path management

### Performance Improvements
- Updated cache durations for improved performance in magnetController.js
- Enhanced rendering logic in views for better performance with large file lists
- Optimized file display with support for both tree view and simple list formats

## [1.0.4] - 2025-04-08

### Connectivity Improvements
- Updated tracker URLs in magnetController.js to include additional and updated torrent trackers for improved connectivity

### Database Configuration
- Updated database configuration to use SQLite as default and set fallback MongoDB URI
- Simplified local development setup with SQLite as the default database
- Enhanced compatibility across different environments

### Development Improvements
- Updated .gitignore to include additional database and environment files
- Added entries for database shared memory and write-ahead log files
- Organized system files for clarity

## [1.0.3] - 2025-04-08

### Performance & Stability
- Fixed deadlock issues occurring during resource-intensive search operations
- Implemented comprehensive timeout handling for database and cache operations
- Enhanced memory management in the caching system:
  - Added LRU (Least Recently Used) eviction policy to prevent memory leaks
  - Implemented cache size limits with automatic pruning
  - Added periodic cleanup of expired cache items
- Improved database handling:
  - Enhanced SQLite configuration with WAL mode for better concurrency
  - Added query timeouts to prevent long-running operations from blocking
  - Optimized connection handling for high-load scenarios
- Redis improvements:
  - Added robust connection management with automatic reconnection
  - Implemented connection health checks to detect and recover from zombied connections
  - Added timeout handling for Redis operations

### Search Enhancements
- Optimized search handling for large datasets with better error recovery
- Improved handling of resource-intensive search queries
- Added graceful fallbacks for search operations that exceed timeout thresholds

## [1.0.2] - 2025-04-08

### Added
- Integrated Elasticsearch for powerful full-text search capabilities
- Added configuration options for Elasticsearch in `.env` file
- Created bulk indexing utility for migrating existing data to Elasticsearch
- Enhanced search functionality to use Elasticsearch when available

## [1.0.1] - 2025-03-30

### Bug Fixes
- Fixed inconsistent page titles in search and infohash pages that were showing "Tordex" instead of the configured site name

## [1.0.0] - 2025-03-30

### Major Architectural Changes
- Migrated from PUG templates to EJS templates
- Consolidated architecture from separate `daemon.js` and `webserver.js` into a unified `app.js`
- Added support for SQLite as an alternative to MongoDB
- Implemented Redis for caching recently seen infohashes

### Frontend Enhancements
- Implemented Tailwind CSS for modern, responsive design
- Added comprehensive favicon support with light/dark variants
- Improved font system:
  - Added Google Fonts (Inter, Manrope) for improved typography
  - Integrated FontAwesome icons via local files
- Enhanced real-time updates via WebSocket implementation
- Interface improvements:
  - Enhanced search functionality
  - Improved stats visualization
  - Better mobile responsiveness

### Backend Improvements
- Performance optimizations:
  - WebSocket message batching to reduce overhead
  - Connection health monitoring
  - Throttled broadcasts to prevent excessive updates
- DHT Spider enhancements:
  - Improved error handling in `dhtspider.js`
  - Optimized index.js for better resource usage
- Database layer enhancements:
  - Abstracted database operations through unified interface
  - Added SQLite support alongside MongoDB
  - Enhanced query performance

### Configuration & Deployment
- Environment configuration:
  - Added `.env` support with `.env.sample` template
  - Improved configuration validation
- Process management:
  - Enhanced PM2 integration with optimized ecosystem.json
  - Added production mode configuration
- Documentation:
  - Added performance optimization guidelines
  - Improved setup instructions
  - Added screenshots

### Security & Stability
- Improved error handling throughout the application
- Better handling of connection failures and reconnection logic
- Added memory limits and improved resource allocation

### Removed Features
- Removed separate daemon.js and webserver.js in favor of unified app.js
- Cleaned up temporary font files and generator templates 