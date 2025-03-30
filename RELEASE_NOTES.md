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