'use strict';

require('dotenv').config();

// Environment configuration constants
const USE_REDIS = process.env.USE_REDIS === 'true';
const REDIS_URI = process.env.REDIS_URI;
const REDIS_HASH_TTL = 60 * 60 * 24; // 24 hours in seconds
const P2P_PORT = parseInt(process.env.P2P_PORT || '6881', 10);
const P2P_HOST = process.env.P2P_HOST || '0.0.0.0';
const SITE_HOSTNAME = process.env.SITE_HOSTNAME;
const SITE_NAME = process.env.SITE_NAME || 'P2P Spider';
const SITE_PORT = parseInt(process.env.SITE_PORT || '3000', 10);
const PRODUCTION = process.env.NODE_ENV === 'production';
const RUN_DAEMON = process.env.RUN_DAEMON !== 'false'; // Default to true if not set
const RUN_WEBSERVER = process.env.RUN_WEBSERVER !== 'false'; // Default to true if not set

/**
 * Validate environment configuration
 */
function validateEnvironment() {
  // Check SITE_HOSTNAME format
  if (SITE_HOSTNAME && !SITE_HOSTNAME.startsWith('http')) {
    console.warn(`
⚠️  WARNING: SITE_HOSTNAME "${SITE_HOSTNAME}" does not include protocol (http:// or https://)
   For WebSocket communication to work properly, update your .env file:
   SITE_HOSTNAME=http://${SITE_HOSTNAME}:${SITE_PORT || '3000'}
    `);
  }

  if (isNaN(P2P_PORT)) {
      console.error('Invalid P2P_PORT defined in environment');
      process.exit(1);
  }
    if (isNaN(SITE_PORT)) {
      console.error('Invalid SITE_PORT defined in environment');
      process.exit(1);
  }
}

module.exports = {
    USE_REDIS,
    REDIS_URI,
    REDIS_HASH_TTL,
    P2P_PORT,
    P2P_HOST,
    SITE_HOSTNAME,
    SITE_NAME,
    SITE_PORT,
    PRODUCTION,
    RUN_DAEMON,
    RUN_WEBSERVER,
    validateEnvironment
}; 