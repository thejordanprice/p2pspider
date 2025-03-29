'use strict';

require('dotenv').config();
const { Database } = require('./models/db');
const redis = require('redis');
const P2PSpider = require('./lib');
const axios = require('axios');

// Environment configuration
const USE_REDIS = process.env.USE_REDIS === 'true';
const REDIS_URI = process.env.REDIS_URI;
const REDIS_HASH_TTL = 60 * 60 * 24; // 24 hours in seconds
const P2P_PORT = 6881;
const P2P_HOST = '0.0.0.0';

// WebSocket webhook configuration
const SITE_HOSTNAME = process.env.SITE_HOSTNAME || 'http://localhost:3000';
const WEBHOOK_PATH = '/api/websocket/broadcast';
const WEBHOOK_URL = SITE_HOSTNAME.startsWith('http') 
  ? `${SITE_HOSTNAME}${WEBHOOK_PATH}`
  : `http://${SITE_HOSTNAME}${WEBHOOK_PATH}`;

/**
 * Validate environment configuration
 */
function validateEnvironment() {
  // Check SITE_HOSTNAME format
  const siteHostname = process.env.SITE_HOSTNAME;
  if (siteHostname && !siteHostname.startsWith('http')) {
    console.warn(`
⚠️  WARNING: SITE_HOSTNAME "${siteHostname}" does not include protocol (http:// or https://)
   For WebSocket communication to work properly, update your .env file:
   SITE_HOSTNAME=http://${siteHostname}:${process.env.SITE_PORT || '3000'}
    `);
  }
}

/**
 * Database initialization
 */
function initializeDatabase() {
  const db = new Database();
  db.connect()
    .then(() => console.log(`Database (${db.type}) is connected.`))
    .catch(err => console.error(`Database connection error:`, err));
  return db;
}

/**
 * Redis client initialization and configuration
 */
async function initializeRedis() {
  if (!USE_REDIS) {
    console.log('Redis is disabled');
    return null;
  }

  const client = redis.createClient({ url: REDIS_URI });
  
  client.on('error', err => console.error('Redis error:', err));
  client.on('end', () => {
    console.log('Redis client disconnected');
    reconnectRedisClient(client);
  });

  try {
    await client.connect();
    console.log('Redis client connected');
    return client;
  } catch (err) {
    console.error('Error connecting to Redis:', err);
    reconnectRedisClient(client);
    return client; // Return client even if initial connection fails
  }
}

/**
 * Attempt to reconnect to Redis after a disconnection
 */
function reconnectRedisClient(client) {
  console.log('Attempting to reconnect to Redis...');
  setTimeout(() => {
    client.connect().catch(err => {
      console.error('Redis reconnection error:', err);
      reconnectRedisClient(client);
    });
  }, 5000);
}

/**
 * Initialize and configure P2P Spider
 */
function initializeP2PSpider(db, redisClient) {
  const p2p = new P2PSpider({
    nodesMaxSize: 250,
    maxConnections: 500,
    timeout: 1000
  });

  p2p.on('metadata', async (metadata, rinfo) => {
    await handleMetadata(metadata, rinfo, db, redisClient);
  });

  return p2p;
}

/**
 * Handle metadata event from P2P Spider
 */
async function handleMetadata(metadata, rinfo, db, redisClient) {
  const { infohash, info } = metadata;

  try {
    // Check if infohash exists in Redis
    if (await isInfohashInRedis(infohash, redisClient)) {
      console.log(`Metadata for infohash ${infohash} has already been seen recently.`);
      return;
    }

    // Process metadata
    await processMetadata(metadata, db, redisClient);

  } catch (err) {
    console.error('Error handling metadata:', err);
  }
}

/**
 * Check if infohash exists in Redis
 */
async function isInfohashInRedis(infohash, redisClient) {
  if (!USE_REDIS || !redisClient) {
    return false;
  }

  try {
    return await redisClient.exists(`hashes:${infohash}`);
  } catch (err) {
    console.error('Error checking Redis for infohash:', err);
    return false;
  }
}

/**
 * Process and store metadata
 */
async function processMetadata(metadata, db, redisClient) {
  const { infohash, info, magnet } = metadata;
  
  // Extract data from metadata
  const name = info.name ? info.name.toString() : '';
  const files = (info.files || []).map(file => {
    return file.path ? file.path.toString() : '';
  }).sort();
  const fetchedAt = Date.now();

  try {
    // Check if metadata exists in database
    const existingMagnet = await db.findOne({ infohash });

    if (!existingMagnet) {
      // Save to database
      await db.saveMagnet({ name, infohash, magnet, files, fetchedAt });
      console.log('Added to database:', name);

      // Store in Redis with TTL
      await storeInfohashInRedis(infohash, redisClient);
      
      // Broadcast new magnet via WebSocket
      await broadcastNewMagnet({ name, infohash, fetchedAt });
    } else {
      console.log(`Metadata for infohash ${infohash} already exists in database.`);
    }
  } catch (err) {
    console.error('Error processing metadata:', err);
    throw err;
  }
}

/**
 * Store infohash in Redis with TTL
 */
async function storeInfohashInRedis(infohash, redisClient) {
  if (!USE_REDIS || !redisClient) {
    return;
  }

  try {
    await redisClient.set(`hashes:${infohash}`, infohash, 'EX', REDIS_HASH_TTL);
  } catch (err) {
    console.error('Error storing infohash in Redis:', err);
  }
}

/**
 * Broadcast new magnet discovery via WebSocket webhook
 */
async function broadcastNewMagnet(magnetData) {
  try {
    const message = {
      eventType: 'new_magnet',
      data: magnetData
    };
    
    await sendWebhookRequest(message);
  } catch (err) {
    console.error('Error broadcasting new magnet:', err);
  }
}

/**
 * Send webhook request to webserver for WebSocket broadcast
 */
async function sendWebhookRequest(data) {
  try {
    console.log(`Sending webhook request to ${WEBHOOK_URL}`);
    const response = await axios.post(WEBHOOK_URL, data, {
      headers: {
        'Content-Type': 'application/json'
      },
      timeout: 3000 // 3 second timeout
    });
    
    if (response.status === 200) {
      console.log(`WebSocket broadcast successful, reached ${response.data.clients} clients`);
    } else {
      console.warn(`WebSocket broadcast returned status ${response.status}`);
    }
  } catch (err) {
    console.error(`Error sending webhook request to ${WEBHOOK_URL}:`, err.message);
  }
}

/**
 * Check connection to the webserver
 */
async function checkWebserverConnection() {
  try {
    console.log(`Checking connection to webserver at ${WEBHOOK_URL}...`);
    await axios.get(WEBHOOK_URL.replace('/api/websocket/broadcast', '/'), {
      timeout: 3000
    });
    console.log('Successfully connected to webserver!');
    return true;
  } catch (err) {
    console.error(`Could not connect to webserver: ${err.message}`);
    console.log(`Make sure webserver is running and SITE_HOSTNAME (${process.env.SITE_HOSTNAME}) is correct in .env file`);
    return false;
  }
}

/**
 * Main application function
 */
async function main() {
  // Validate environment configuration
  validateEnvironment();

  const db = initializeDatabase();
  const redisClient = await initializeRedis();
  const p2p = initializeP2PSpider(db, redisClient);

  // Check connection to webserver
  await checkWebserverConnection();

  // Start listening for connections
  p2p.listen(P2P_PORT, P2P_HOST, () => {
    console.log(`UDP Server listening on ${P2P_HOST}:${P2P_PORT}`);
    console.log(`WebSocket webhook URL: ${WEBHOOK_URL}`);
  });
}

// Start the application
main().catch(err => {
  console.error('Fatal error in main application:', err);
  process.exit(1);
});
