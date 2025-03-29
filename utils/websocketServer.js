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
  if (!app) {
    console.warn('Express app not provided, HTTP webhook not set up');
    return;
  }
  
  // Parse JSON bodies for the webhook endpoint
  const bodyParser = require('body-parser');
  app.use(bodyParser.json({ limit: '1mb' }));
  
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
      }
      
      res.status(200).json({ success: true, clients: wss ? wss.clients.size : 0 });
    } catch (err) {
      console.error('Error handling webhook request:', err);
      res.status(500).json({ error: err.message });
    }
  });
  
  console.log(`HTTP webhook endpoint set up at ${HTTP_WEBHOOK_PATH}`);
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
 * Get the URL for the webhook endpoint
 * @returns {string} The URL for the webhook endpoint
 */
function getWebhookUrl() {
  const hostname = process.env.SITE_HOSTNAME || 'http://localhost:' + (process.env.SITE_PORT || 3000);
  return `${hostname}${HTTP_WEBHOOK_PATH}`;
}

module.exports = {
  initialize,
  getServer,
  broadcastMessage,
  updateAllClientsCount,
  HTTP_WEBHOOK_PATH,
  getWebhookUrl
}; 