'use strict';

const express = require('express');
const path = require('path');
const compression = require('compression');
const routes = require('../routes/index');
const { PRODUCTION, SITE_NAME } = require('./env');
const { getWebSocketServerAddress } = require('../services/websocket');

/**
 * Cache control middleware
 */
function cacheControl(req, res, next) {
  // Static assets cache (adjust regex as needed)
  if (req.url.match(/\.(css|js|ico|jpg|jpeg|png|gif|woff|woff2|ttf|svg|eot)$/)) {
    res.set('Cache-Control', `public, max-age=${PRODUCTION ? 86400 : 0}`); // 1 day in prod, no cache in dev
    if (PRODUCTION) {
        res.set('Expires', new Date(Date.now() + 86400000).toUTCString());
    }
  } 
  // HTML pages short cache (adjust as needed)
  else if (req.method === 'GET') {
    res.set('Cache-Control', 'public, max-age=60'); // 1 minute for dynamic content
  }
  
  next();
}

/**
 * Logging middleware
 */
function loggingMiddleware(req, res, next) {
    const ip = req.headers['x-forwarded-for'] || req.socket.remoteAddress;
    res.locals.ip = ip; // Make IP available to routes if needed

    // Skip logging for static assets in production for cleaner logs
    if (PRODUCTION && req.originalUrl.startsWith('/public/')) {
        return next();
    }

    console.log('\x1b[36m%s\x1b[0m', `REQ FROM: ${ip} ON: ${req.method} ${req.originalUrl}`);
    next();
}

/**
 * Express app configuration
 */
function configureExpressApp(db) { // Pass DB if needed by routes/middleware later
  const app = express();
  
  // Use Helmet for basic security headers (recommended)
  // const helmet = require('helmet');
  // app.use(helmet());

  // Compression middleware
  app.use(compression());
  
  // Cache control middleware
  app.use(cacheControl);
  
  // Body parser middleware
  app.use(express.json());
  app.use(express.urlencoded({ extended: true }));
  
  // Static files serving
  app.use('/public', express.static(path.join(__dirname, '..', 'public'), {
    maxAge: PRODUCTION ? '1d' : 0, // Match cacheControl duration
    etag: true // Enable ETag generation
  }));
  
  // View engine setup
  app.set('views', path.join(__dirname, '..', 'views')); // Correct path to views
  app.set('view engine', 'ejs');
  
  // Logging middleware
  app.use(loggingMiddleware);
  
  // Development settings
  if (!PRODUCTION) {
    app.locals.pretty = true; // Pretty print HTML in development
  }
  
  // Global template variables & Routes
  app.use((req, res, next) => {
    res.locals.wsServerAddress = getWebSocketServerAddress();
    res.locals.site_name = SITE_NAME;
    // Pass db instance to request locals if needed by routes
    // res.locals.db = db;
    next();
  });
  
  // Mount main application routes
  app.use('/', routes);

  // Basic 404 handler
  app.use((req, res, next) => {
      res.status(404).render('404', { title: 'Not Found' }); // Assuming a 404.ejs view exists
  });

  // Basic error handler
  app.use((err, req, res, next) => {
      console.error('Express Error:', err.stack);
      res.status(500).render('error', { 
          title: 'Server Error', 
          message: PRODUCTION ? 'An unexpected error occurred' : err.message,
          error: PRODUCTION ? {} : err // Only show stack trace in development
      }); // Assuming an error.ejs view exists
  });
  
  return app;
}

module.exports = { configureExpressApp }; 