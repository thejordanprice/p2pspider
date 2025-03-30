# Changelog

All notable changes to this project will be documented in this file.

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