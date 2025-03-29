'use strict';

require('dotenv').config();
const express = require('express');
const path = require('path');
const http = require('http');
const routes = require('./routes/index');
const { Database } = require('./models/db');
const wsServer = require('./utils/websocketServer');

// Constants
const SITE_HOSTNAME = process.env.SITE_HOSTNAME;
const SITE_NAME = process.env.SITE_NAME;
const SITE_PORT = process.env.SITE_PORT;

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
  
  // Body parser middleware
  app.use(express.json());
  app.use(express.urlencoded({ extended: true }));
  
  // Static files and view engine
  app.use('/public', express.static(path.join(__dirname, 'public')));
  app.set('view engine', 'ejs');
  
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
 * Main application startup
 */
function startServer() {
  const db = initializeDatabase();
  const app = configureExpressApp(db);
  const server = http.createServer(app);
  
  // Initialize WebSocket server with Express app
  wsServer.initialize(server, db, app);
  
  // Log the URL for the webhook endpoint
  console.log(`WebSocket broadcast webhook URL: ${wsServer.getWebhookUrl()}`);
  
  server.listen(SITE_PORT, () => {
    console.log(`Webserver is listening on port ${SITE_PORT}!`);
  });
}

// Start the application
startServer();
