'use strict';

const WebSocket = require('ws');
let wss = null;
let dbInstance = null;

// HTTP API endpoint path for daemon to send messages to webserver
const HTTP_WEBHOOK_PATH = '/api/websocket/broadcast';

/**
 * Initialize WebSocket server
 * @param {http.Server} server - HTTP server to attach WebSocket server to
 * @param {Object} db - Database instance
 * @param {express.Application} app - Express application
 */
function initialize(server, db, app) {
  if (wss) {
    return wss; // Already initialized
  }

  wss = new WebSocket.Server({ server });
  dbInstance = db;
  
  wss.on('connection', async (ws) => {
    console.log('WebSocket connection established');
    ws.on('message', message => console.log('Received:', message));
    
    try {
      await sendCountToClient(ws, db);
      
      // Also send statistics to newly connected clients
      await sendStatsToClient(ws, db);
      
      // Send latest magnets to newly connected clients
      await sendLatestToClient(ws, db);
    } catch (err) {
      console.error('Error in WebSocket connection handler:', err);
    }
  });
  
  // Set up HTTP webhook endpoint for daemon to send messages
  setupHttpWebhook(app);
  
  return wss;
}

/**
 * Set up HTTP webhook for inter-process communication
 * @param {express.Application} app - Express application
 */
function setupHttpWebhook(app) {
  try {
    if (!app) {
      console.warn('Express app not provided, HTTP webhook not set up');
      return;
    }
    
    // Check if bodyParser middleware is already loaded
    try {
      const bodyParser = require('body-parser');
      app.use(bodyParser.json({ limit: '1mb' }));
    } catch (err) {
      console.log('Using express.json() for body parsing');
      // Express already has a built-in body parser
    }
    
    app.post(HTTP_WEBHOOK_PATH, (req, res) => {
      try {
        const data = req.body;
        
        if (!data) {
          return res.status(400).json({ error: 'Invalid request body' });
        }
        
        broadcastMessage(data);
        
        // If this is a new magnet, update the count for all clients
        if (data.eventType === 'new_magnet' && dbInstance) {
          updateAllClientsCount(dbInstance);
          // Also update statistics for all clients
          updateAllClientsStats(dbInstance);
          // Send latest magnets to all clients
          updateAllClientsLatest(dbInstance);
        }
        
        res.status(200).json({ success: true, clients: wss ? wss.clients.size : 0 });
      } catch (err) {
        console.error('Error handling webhook request:', err);
        res.status(500).json({ error: err.message });
      }
    });
    
    console.log(`HTTP webhook endpoint set up at ${HTTP_WEBHOOK_PATH}`);
  } catch (err) {
    console.error('Error setting up HTTP webhook:', err);
  }
}

/**
 * Get WebSocket server instance
 * @returns {WebSocket.Server} WebSocket server instance
 */
function getServer() {
  return wss;
}

/**
 * Send count to a specific client
 * @param {WebSocket} ws - WebSocket client
 * @param {Object} db - Database instance
 */
async function sendCountToClient(ws, db) {
  try {
    const count = await db.countDocuments({});
    if (ws.readyState === WebSocket.OPEN) {
      ws.send(JSON.stringify({ count }));
    }
  } catch (err) {
    console.error('Error fetching count for WebSocket:', err);
  }
}

/**
 * Update all connected clients with latest count
 * @param {Object} db - Database instance
 */
async function updateAllClientsCount(db) {
  try {
    const count = await db.countDocuments({});
    broadcastMessage({ count });
  } catch (err) {
    console.error('Error updating WebSocket clients count:', err);
  }
}

/**
 * Broadcast a message to all connected clients
 * @param {Object} message - Message to broadcast
 */
function broadcastMessage(message) {
  if (!wss) return;
  
  wss.clients.forEach(client => {
    if (client.readyState === WebSocket.OPEN) {
      client.send(JSON.stringify(message));
    }
  });
}

/**
 * Send statistics to a specific client
 * @param {WebSocket} ws - WebSocket client
 * @param {Object} db - Database instance
 */
async function sendStatsToClient(ws, db) {
  try {
    const stats = await getDatabaseStats(db);
    if (ws.readyState === WebSocket.OPEN) {
      ws.send(JSON.stringify({ eventType: 'statistics_update', statistics: stats }));
    }
  } catch (err) {
    console.error('Error fetching statistics for WebSocket:', err);
  }
}

/**
 * Update all connected clients with latest statistics
 * @param {Object} db - Database instance
 */
async function updateAllClientsStats(db) {
  try {
    const stats = await getDatabaseStats(db);
    broadcastMessage({ eventType: 'statistics_update', statistics: stats });
  } catch (err) {
    console.error('Error updating WebSocket clients statistics:', err);
  }
}

/**
 * Get database statistics
 * @param {Object} db - Database instance
 * @returns {Object} Database statistics
 */
async function getDatabaseStats(db) {
  let stats;
  
  try {
    if (db.type === 'mongodb') {
      const mongoStats = await db.db.connection.db.stats({ scale: 1048576 });
      stats = {
        db: mongoStats.db,
        collections: mongoStats.collections,
        objects: mongoStats.objects,
        avgObjSize: (mongoStats.avgObjSize / 1024).toFixed(2),
        dataSize: mongoStats.dataSize.toFixed(2),
        storageSize: mongoStats.storageSize.toFixed(2),
        indexes: mongoStats.indexes,
        indexSize: mongoStats.indexSize.toFixed(2)
      };
    } else {
      // SQLite statistics
      const dbSize = await new Promise((resolve, reject) => {
        db.db.get('SELECT page_count * page_size as size FROM pragma_page_count(), pragma_page_size()', (err, row) => {
          if (err) reject(err);
          else resolve(row ? row.size / (1024 * 1024) : 0);
        });
      });
      
      const count = await db.countDocuments({});
      
      stats = {
        db: 'SQLite',
        collections: 1,
        objects: count,
        avgObjSize: count > 0 ? ((dbSize * 1024 * 1024) / count / 1024).toFixed(2) : '0.00',
        dataSize: dbSize.toFixed(2),
        storageSize: dbSize.toFixed(2),
        indexes: 2,  // We created 2 indexes (infohash and name)
        indexSize: (dbSize * 0.2).toFixed(2)  // Estimate index size as 20% of total
      };
    }
    
    return stats;
  } catch (err) {
    console.error('Error getting database statistics:', err);
    throw err;
  }
}

/**
 * Get the URL for the webhook endpoint
 * @returns {string} The URL for the webhook endpoint
 */
function getWebhookUrl() {
  const hostname = process.env.SITE_HOSTNAME || 'http://localhost:' + (process.env.SITE_PORT || 3000);
  return hostname.startsWith('http') 
    ? `${hostname}${HTTP_WEBHOOK_PATH}`
    : `http://${hostname}${HTTP_WEBHOOK_PATH}`;
}

/**
 * Send latest magnets to a specific client
 * @param {WebSocket} ws - WebSocket client
 * @param {Object} db - Database instance
 */
async function sendLatestToClient(ws, db) {
  try {
    const latestMagnets = await getLatestMagnets(db);
    if (ws.readyState === WebSocket.OPEN) {
      ws.send(JSON.stringify({ eventType: 'latest_magnets', latestMagnets }));
    }
  } catch (err) {
    console.error('Error fetching latest magnets for WebSocket:', err);
  }
}

/**
 * Update all connected clients with latest magnets
 * @param {Object} db - Database instance
 */
async function updateAllClientsLatest(db) {
  try {
    const latestMagnets = await getLatestMagnets(db);
    broadcastMessage({ eventType: 'latest_magnets', latestMagnets });
  } catch (err) {
    console.error('Error updating WebSocket clients with latest magnets:', err);
  }
}

/**
 * Get latest magnets from database
 * @param {Object} db - Database instance
 * @returns {Array} Latest magnets
 */
async function getLatestMagnets(db) {
  try {
    // Fetch 15 most recent magnets
    return await db.find({}, { sort: { fetchedAt: -1 }, limit: 15 });
  } catch (err) {
    console.error('Error getting latest magnets:', err);
    throw err;
  }
}

module.exports = {
  initialize,
  getServer,
  broadcastMessage,
  updateAllClientsCount,
  updateAllClientsStats,
  updateAllClientsLatest,
  HTTP_WEBHOOK_PATH,
  getWebhookUrl
}; 