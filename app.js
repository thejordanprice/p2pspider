'use strict';

const http = require('http');
const { 
    validateEnvironment,
    SITE_PORT,
    RUN_DAEMON,
    RUN_WEBSERVER,
    USE_REDIS
} = require('./config/env');
const { initializeDatabase } = require('./lib/database');
const { initializeRedis, closeRedis } = require('./lib/redis');
const { initializeP2PSpider, startP2PSpider, closeP2PSpider } = require('./lib/p2p');
const { initializeWebSocket } = require('./services/websocket');
const { configureExpressApp } = require('./config/express');

let server = null;

/**
 * Graceful shutdown handler
 */
async function gracefulShutdown() {
    console.log('\nReceived shutdown signal. Shutting down gracefully...');

    // Close HTTP server
    if (server) {
        await new Promise((resolve) => server.close(resolve));
        console.log('HTTP server closed.');
    }

    // Close P2P Spider
    if (RUN_DAEMON) {
        await new Promise((resolve) => closeP2PSpider(resolve));
        console.log('P2P Spider closed.');
    }

    // Close Redis connection
    if (USE_REDIS) {
        await closeRedis();
        // No log here, closeRedis logs internally
    }

    // Database connection is likely managed by mongoose/sqlite driver,
    // typically doesn't require explicit close on SIGINT unless specified.

    console.log('Graceful shutdown complete.');
    process.exit(0);
}

/**
 * Main application startup
 */
async function main() {
    try {
        // Validate environment variables
        validateEnvironment();

        // Initialize Database
        const db = await initializeDatabase();

        // Initialize Redis (if enabled)
        const redisClient = await initializeRedis();

        // Initialize P2P Spider (if enabled)
        if (RUN_DAEMON) {
            initializeP2PSpider(db, redisClient);
        }

        // Initialize and start Webserver (if enabled)
        if (RUN_WEBSERVER) {
            const app = configureExpressApp(db); // Pass db if needed by routes
            server = http.createServer(app);
            initializeWebSocket(server, db); // Pass db to WebSocket service

            server.listen(SITE_PORT, () => {
                console.log(`Web server listening on port ${SITE_PORT}`);
            });

            server.on('error', (err) => {
                console.error('HTTP Server error:', err);
                process.exit(1);
            });
        } else {
            console.log('Webserver is disabled (RUN_WEBSERVER=false)');
        }

        // Start P2P Spider listening (if enabled)
        if (RUN_DAEMON) {
            startP2PSpider();
        } else {
            console.log('P2P Spider daemon is disabled (RUN_DAEMON=false)');
        }

        // Setup signal handlers for graceful shutdown
        process.on('SIGINT', gracefulShutdown);
        process.on('SIGTERM', gracefulShutdown);

        console.log('Application started successfully.');

    } catch (err) {
        console.error('Application startup failed:', err);
        process.exit(1);
    }
}

// Start the application
main(); 