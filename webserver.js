'use strict';

require('dotenv').config();
const express = require('express');
const path = require('path');
const http = require('http');
const routes = require('./routes/index');
const { Database } = require('./models/db');
const wsServer = require('./utils/websocketServer');
const compression = require('compression');

// Constants
const SITE_HOSTNAME = process.env.SITE_HOSTNAME;
const SITE_NAME = process.env.SITE_NAME;
const SITE_PORT = process.env.SITE_PORT;
const PRODUCTION = process.env.NODE_ENV === 'production';

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
