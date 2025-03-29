'use strict';

require('dotenv').config();
const express = require('express');
const path = require('path');
const WebSocket = require('ws');
const http = require('http');
const routes = require('./routes/index');
const { Database } = require('./models/db');

// Constants
const SITE_HOSTNAME = process.env.SITE_HOSTNAME;
const SITE_NAME = process.env.SITE_NAME;
const SITE_PORT = process.env.SITE_PORT;
const UPDATE_INTERVAL = 5000; // WebSocket update interval in ms

/**
 * Database initialization
 */
function initializeDatabase() {
  const db = new Database();
  db.connect()
    .then(() => console.log(`Database (${db.type}) is connected.`))
    .catch(err => console.error('Database connection error:', err));
  return db;
}

/**
 * Express app configuration
 */
function configureExpressApp(db) {
  const app = express();
  
  // Static files and view engine
  app.use('/public', express.static(path.join(__dirname, 'public')));
  app.set('view engine', 'pug');
  
  // Logging middleware
  app.use((req, res, next) => {
    const ip = req.headers['x-forwarded-for'] || req.connection.remoteAddress;
    console.log('\x1b[36m%s\x1b[0m', `FROM: ${ip} ON: ${req.originalUrl}`);
    res.locals.ip = ip;
    next();
  });
  
  // Development settings
  if (app.get('env') === 'development') {
    app.locals.pretty = true;
  }
  
  // Routes with locals
  app.use('/', (req, res, next) => {
    res.locals.wsServerAddress = SITE_HOSTNAME;
    res.locals.site_name = SITE_NAME;
    next();
  }, routes);
  
  return app;
}

/**
 * WebSocket server configuration
 */
function configureWebSocketServer(server, db) {
  const wss = new WebSocket.Server({ server });
  
  wss.on('connection', async (ws) => {
    console.log('WebSocket connection established');
    ws.on('message', message => console.log('Received:', message));
    
    try {
      await sendCountToClient(ws, db);
    } catch (err) {
      console.error('Error in WebSocket connection handler:', err);
    }
  });
  
  // Set up periodic counter updates
  setInterval(() => updateAllClients(wss, db), UPDATE_INTERVAL);
  
  return wss;
}

/**
 * Send count to a specific client
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
 */
async function updateAllClients(wss, db) {
  try {
    const count = await db.countDocuments({});
    wss.clients.forEach(client => {
      if (client.readyState === WebSocket.OPEN) {
        client.send(JSON.stringify({ count }));
      }
    });
  } catch (err) {
    console.error('Error updating WebSocket clients:', err);
  }
}

/**
 * Main application startup
 */
function startServer() {
  const db = initializeDatabase();
  const app = configureExpressApp(db);
  const server = http.createServer(app);
  configureWebSocketServer(server, db);
  
  server.listen(SITE_PORT, () => {
    console.log(`Webserver is listening on port ${SITE_PORT}!`);
  });
}

// Start the application
startServer();
