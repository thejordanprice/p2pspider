'use strict';

const WebSocket = require('ws');
let wss = null;
let dbInstance = null;

/**
 * Initialize WebSocket server
 * @param {http.Server} server - HTTP server to attach WebSocket server to
 * @param {Object} db - Database instance
 */
function initialize(server, db) {
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
  
  return wss;
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
 * Broadcast a new magnet discovery to all connected clients
 * @param {Object} magnetData - Magnet data to broadcast
 */
function broadcastNewMagnet(magnetData) {
  if (!wss) return;
  
  const message = {
    eventType: 'new_magnet',
    data: magnetData
  };
  
  broadcastMessage(message);
  
  // Also update the count for all clients after a new magnet
  // This ensures the counter stays in sync
  if (wss.clients.size > 0 && dbInstance) {
    updateAllClientsCount(dbInstance);
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

module.exports = {
  initialize,
  getServer,
  broadcastNewMagnet,
  broadcastMessage,
  updateAllClientsCount
}; 