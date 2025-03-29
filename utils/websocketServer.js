'use strict';

const WebSocket = require('ws');
let wss = null;
let dbInstance = null;

// HTTP API endpoint path for daemon to send messages to webserver
const HTTP_WEBHOOK_PATH = '/api/websocket/broadcast';

// Batching and throttling settings
let pendingBroadcasts = [];
let broadcastTimer = null;
const BROADCAST_INTERVAL = 3000; // 3 seconds

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
    
    // Set client properties
    ws.isAlive = true;
    ws.lastUpdate = 0;
    
    // Handle pings to keep connection alive
    ws.on('pong', () => {
      ws.isAlive = true;
    });
    
    // Handle messages (don't log all of them to reduce overhead)
    ws.on('message', message => {
      // Only process messages, don't log them
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
        
        // Queue the message for batch processing
        queueBroadcast(data);
        
        // If this is a new magnet, update the count for all clients
        if (data.eventType === 'new_magnet' && dbInstance) {
          updateAllClientsCount(dbInstance);
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
 * Queue a message for batch broadcast
 * @param {Object} message - Message to broadcast
 */
function queueBroadcast(message) {
  pendingBroadcasts.push(message);
  
  // Start broadcast timer if not already running
  if (!broadcastTimer) {
    broadcastTimer = setTimeout(() => {
      processBroadcastQueue();
      broadcastTimer = null;
    }, BROADCAST_INTERVAL);
  }
}

/**
 * Process queued broadcast messages in batches
 */
function processBroadcastQueue() {
  if (pendingBroadcasts.length === 0) return;
  
  // Combine similar message types
  const messagesByType = {};
  
  pendingBroadcasts.forEach(message => {
    const type = message.eventType || 'unknown';
    if (!messagesByType[type]) {
      messagesByType[type] = [];
    }
    messagesByType[type].push(message);
  });
  
  // Create a single combined message for each type
  Object.keys(messagesByType).forEach(type => {
    const messages = messagesByType[type];
    
    if (type === 'new_magnet') {
      // For magnets, just send the latest one to reduce bandwidth
      const latestMagnet = messages[messages.length - 1];
      latestMagnet.count = messages.length; // Include count of messages batched
      broadcastToClients(latestMagnet);
    } else if (type === 'count') {
      // For count updates, only send the latest
      broadcastToClients(messages[messages.length - 1]);
    } else {
      // For other types, send all
      messages.forEach(broadcastToClients);
    }
  });
  
  // Clear the queue
  pendingBroadcasts = [];
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
    queueBroadcast({ count });
  } catch (err) {
    console.error('Error updating WebSocket clients count:', err);
  }
}

/**
 * Broadcast a message to all connected clients
 * @param {Object} message - Message to broadcast
 */
function broadcastToClients(message) {
  if (!wss) return;
  
  const messageStr = JSON.stringify(message);
  const currentTime = Date.now();
  
  wss.clients.forEach(client => {
    if (client.readyState === WebSocket.OPEN) {
      // Ensure we're not sending updates too frequently to the same client
      if (currentTime - client.lastUpdate > 1000) { // Throttle to 1 update per second max
        client.send(messageStr);
        client.lastUpdate = currentTime;
      }
    }
  });
}

/**
 * Alias for backward compatibility
 */
function broadcastMessage(message) {
  queueBroadcast(message);
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

module.exports = {
  initialize,
  getServer,
  broadcastMessage,
  updateAllClientsCount,
  HTTP_WEBHOOK_PATH,
  getWebhookUrl
}; 