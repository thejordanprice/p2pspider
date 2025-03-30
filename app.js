'use strict';

require('dotenv').config();
const express = require('express');
const path = require('path');
const http = require('http');
const WebSocket = require('ws');
const compression = require('compression');
const { Database } = require('./models/db');
const routes = require('./routes/index');
const redis = require('redis');
const P2PSpider = require('./lib');

// Environment configuration
const USE_REDIS = process.env.USE_REDIS === 'true';
const REDIS_URI = process.env.REDIS_URI;
const REDIS_HASH_TTL = 60 * 60 * 24; // 24 hours in seconds
const P2P_PORT = 6881;
const P2P_HOST = '0.0.0.0';
const SITE_HOSTNAME = process.env.SITE_HOSTNAME;
const SITE_NAME = process.env.SITE_NAME;
const SITE_PORT = process.env.SITE_PORT;
const PRODUCTION = process.env.NODE_ENV === 'production';

// WebSocket server instance
let wss = null;

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
}

/**
 * Database initialization
 */
async function initializeDatabase() {
  // Check if database is already initialized by controller
  const { getDatabase } = require('./models/db');
  const existingDb = getDatabase();
  
  if (existingDb && existingDb.connected) {
    console.log(`Using existing database (${existingDb.type}) connection.`);
    return existingDb;
  }
  
  const db = new Database();
  await db.connect()
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
      
      // Broadcast new magnet via WebSocket including current count
      await broadcastNewMagnet({ 
        name, 
        infohash, 
        files,
        fetchedAt,
        count: db.totalCount // Include current count from cached counter
      });
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
 * Broadcast new magnet discovery via WebSocket
 */
async function broadcastNewMagnet(magnetData) {
  try {
    const message = {
      eventType: 'new_magnet',
      data: magnetData
    };
    
    // Broadcast directly to all clients
    if (wss) {
      broadcastToClients(message);
    }
  } catch (err) {
    console.error('Error broadcasting new magnet:', err);
  }
}

// ===== WebSocket Functions =====

/**
 * Initialize WebSocket server
 */
function initializeWebSocket(server, db) {
  wss = new WebSocket.Server({ server });
  
  wss.on('connection', async (ws) => {
    console.log('WebSocket connection established');
    
    // Set client properties
    ws.isAlive = true;
    ws.lastUpdate = 0;
    
    // Handle pings to keep connection alive
    ws.on('pong', () => {
      ws.isAlive = true;
    });
    
    // Handle messages
    ws.on('message', message => {
      // Process messages if needed
    });
    
    try {
      await sendCountToClient(ws, db);
    } catch (err) {
      console.error('Error in WebSocket connection handler:', err);
    }
  });
  
  // Set up ping interval to keep connections alive and clean up dead connections
  const pingInterval = setInterval(() => {
    wss.clients.forEach(ws => {
      if (ws.isAlive === false) {
        return ws.terminate();
      }
      
      ws.isAlive = false;
      ws.ping(() => {});
    });
  }, 30000); // 30 seconds
  
  wss.on('close', () => {
    clearInterval(pingInterval);
  });
  
  return wss;
}

/**
 * Send count to a specific client
 */
async function sendCountToClient(ws, db) {
  try {
    // Use cached count instead of counting documents again
    const count = db.totalCount;
    if (ws.readyState === WebSocket.OPEN) {
      ws.send(JSON.stringify({ count }));
    }
  } catch (err) {
    console.error('Error fetching count for WebSocket:', err);
  }
}

/**
 * Update all connected clients with latest count
 */
async function updateAllClientsCount(db) {
  try {
    // Use cached count instead of counting documents again
    const count = db.totalCount;
    // Broadcast directly instead of queueing
    if (wss) {
      broadcastToClients({ count });
    }
  } catch (err) {
    console.error('Error updating WebSocket clients count:', err);
  }
}

/**
 * Broadcast a message to all connected clients
 */
function broadcastToClients(message) {
  if (!wss) return;
  
  const messageStr = JSON.stringify(message);
  const currentTime = Date.now();
  
  wss.clients.forEach(client => {
    if (client.readyState === WebSocket.OPEN) {
      // Allow more frequent updates (200ms instead of 1000ms)
      if (currentTime - client.lastUpdate > 200) {
        client.send(messageStr);
        client.lastUpdate = currentTime;
      }
    }
  });
}

// ===== Express App Configuration =====

/**
 * Cache control middleware
 */
function cacheControl(req, res, next) {
  // Static assets cache
  if (req.url.match(/\.(css|js|ico|jpg|jpeg|png|gif|woff|woff2|ttf|svg|eot)$/)) {
    res.set('Cache-Control', 'public, max-age=86400'); // 1 day
    res.set('Expires', new Date(Date.now() + 86400000).toUTCString());
  } 
  // HTML pages short cache
  else if (req.method === 'GET') {
    res.set('Cache-Control', 'public, max-age=60'); // 1 minute for dynamic content
  }
  
  next();
}

/**
 * Express app configuration
 */
function configureExpressApp(db) {
  const app = express();
  
  // Compression middleware
  app.use(compression());
  
  // Cache control middleware
  app.use(cacheControl);
  
  // Body parser middleware
  app.use(express.json());
  app.use(express.urlencoded({ extended: true }));
  
  // Static files with caching
  app.use('/public', express.static(path.join(__dirname, 'public'), {
    maxAge: PRODUCTION ? '1d' : 0,
    etag: true
  }));
  
  // View engine
  app.set('view engine', 'ejs');
  
  // Logging middleware - only log in development or log less in production
  if (!PRODUCTION) {
    app.use((req, res, next) => {
      const ip = req.headers['x-forwarded-for'] || req.connection.remoteAddress;
      console.log('\x1b[36m%s\x1b[0m', `FROM: ${ip} ON: ${req.originalUrl}`);
      res.locals.ip = ip;
      next();
    });
  } else {
    // In production, only log errors or important requests
    app.use((req, res, next) => {
      const ip = req.headers['x-forwarded-for'] || req.connection.remoteAddress;
      // Skip logging for static asset requests
      if (!req.originalUrl.startsWith('/public/')) {
        console.log('\x1b[36m%s\x1b[0m', `FROM: ${ip} ON: ${req.originalUrl}`);
      }
      res.locals.ip = ip;
      next();
    });
  }
  
  // Development settings
  if (app.get('env') === 'development') {
    app.locals.pretty = true;
  }
  
  // Routes with locals
  app.use('/', (req, res, next) => {
    // Make sure WebSocket address has proper protocol
    let wsAddress = SITE_HOSTNAME;
    if (wsAddress && !wsAddress.startsWith('ws')) {
      // Convert http:// to ws:// or https:// to wss://
      wsAddress = wsAddress.replace(/^http/, 'ws');
    }
    res.locals.wsServerAddress = wsAddress;
    res.locals.site_name = SITE_NAME;
    next();
  }, routes);
  
  return app;
}

/**
 * Main application startup
 */
async function main() {
  try {
    // Validate environment
    validateEnvironment();
    
    // Connect to database
    const db = await initializeDatabase();
    
    // Connect to Redis if enabled
    const redisClient = await initializeRedis();
    
    // Configure Express app
    const app = configureExpressApp(db);
    
    // Create HTTP server
    const server = http.createServer(app);
    
    // Initialize WebSocket server
    initializeWebSocket(server, db);
    
    // Initialize P2P Spider
    const p2p = initializeP2PSpider(db, redisClient);
    
    // Start HTTP server
    server.listen(SITE_PORT, () => {
      console.log(`Web server is listening on port ${SITE_PORT}!`);
    });
    
    // Start P2P Spider
    p2p.listen(P2P_PORT, P2P_HOST, () => {
      console.log(`P2P Spider is listening on ${P2P_HOST}:${P2P_PORT}!`);
    });
    
    // Handle process exit
    process.on('SIGINT', () => {
      console.log('Shutting down gracefully...');
      
      // Close HTTP server
      server.close(() => {
        console.log('HTTP server closed');
      });
      
      // Close P2P Spider
      p2p.close(() => {
        console.log('P2P Spider closed');
      });
      
      // Close Redis if enabled
      if (redisClient) {
        redisClient.quit().then(() => {
          console.log('Redis client closed');
        }).catch(err => {
          console.error('Error closing Redis client:', err);
        });
      }
      
      process.exit(0);
    });
    
  } catch (err) {
    console.error('Application startup error:', err);
    process.exit(1);
  }
}

// Start the application
main().catch(err => {
  console.error('Unhandled error during startup:', err);
  process.exit(1);
}); 