'use strict';

const WebSocket = require('ws');
const { SITE_HOSTNAME } = require('../config/env');

let wss = null;
let dbInstance = null; // Store db instance

/**
 * Initialize WebSocket server
 */
function initializeWebSocket(server, db) {
  if (wss) {
    console.log('WebSocket server already initialized.');
    return wss;
  }
  
  dbInstance = db; // Store database instance for later use
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
      // Process messages if needed (e.g., client requests)
      console.log('Received ws message:', message);
    });
    
    ws.on('close', () => {
        console.log('WebSocket connection closed');
    });

    ws.on('error', (error) => {
        console.error('WebSocket error:', error);
    });
    
    try {
      // Send initial count
      await sendCountToClient(ws);
    } catch (err) {
      console.error('Error in WebSocket connection handler:', err);
    }
  });
  
  // Set up ping interval to keep connections alive and clean up dead connections
  const pingInterval = setInterval(() => {
    wss.clients.forEach(ws => {
      if (ws.isAlive === false) {
        console.log('Terminating dead WebSocket connection');
        return ws.terminate();
      }
      
      ws.isAlive = false;
      ws.ping(() => {});
    });
  }, 30000); // 30 seconds
  
  wss.on('close', () => {
    console.log('WebSocket server closing, clearing ping interval.');
    clearInterval(pingInterval);
    wss = null; // Clear the instance
    dbInstance = null;
  });
  
  console.log('WebSocket server initialized');
  return wss;
}

/**
 * Send count to a specific client
 */
async function sendCountToClient(ws) {
  if (!dbInstance) {
      console.error('Cannot send count, DB instance not available in WebSocket service.');
      return;
  }
  try {
    // Use cached count from DB instance
    const count = dbInstance.totalCount;
    if (ws.readyState === WebSocket.OPEN) {
      ws.send(JSON.stringify({ eventType: 'count_update', data: { count } }));
    }
  } catch (err) {
    console.error('Error sending count to WebSocket client:', err);
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
      // Throttle updates per client (e.g., allow max 1 update per 200ms)
      if (currentTime - (client.lastUpdate || 0) > 200) {
        client.send(messageStr);
        client.lastUpdate = currentTime;
      }
    }
  });
}

/**
 * Broadcast new magnet discovery via WebSocket
 */
async function broadcastNewMagnet(magnetData) {
  if (!dbInstance) {
      console.error('Cannot broadcast magnet, DB instance not available.');
      return;
  }
  try {
    const message = {
      eventType: 'new_magnet',
      // Ensure count is included from the database instance
      data: { ...magnetData, count: dbInstance.totalCount } 
    };
    broadcastToClients(message);
  } catch (err) {
    console.error('Error broadcasting new magnet:', err);
  }
}

/**
 * Update all connected clients with latest count
 */
async function updateAllClientsCount() {
    if (!dbInstance) {
        console.error('Cannot update client count, DB instance not available.');
        return;
    }
    try {
        const count = dbInstance.totalCount;
        broadcastToClients({ eventType: 'count_update', data: { count } });
    } catch (err) {
        console.error('Error updating WebSocket clients count:', err);
    }
}


/**
 * Get the WebSocket server address based on SITE_HOSTNAME
 */
function getWebSocketServerAddress() {
    let wsAddress = SITE_HOSTNAME;
    if (wsAddress && !wsAddress.startsWith('ws')) {
      // Convert http:// to ws:// or https:// to wss://
      wsAddress = wsAddress.replace(/^http/, 'ws');
    }
    return wsAddress;
}

function getWssInstance() {
    return wss;
}

module.exports = {
    initializeWebSocket,
    broadcastNewMagnet, 
    // sendCountToClient, // Likely only needed internally or on connection
    updateAllClientsCount, 
    // broadcastToClients, // Might be internal helper
    getWebSocketServerAddress,
    getWssInstance
}; 