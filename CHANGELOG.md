# Changelog

All notable changes to this project will be documented in this file.

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