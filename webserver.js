'use strict';

const express = require('express');
const path = require('path');
const mongoose = require('mongoose');
const WebSocket = require('ws');
const http = require('http');
const routes = require('./routes/index');
const Magnet = require('./models/magnetModel');
require('dotenv').config();

// Constants
const MONGO_URI = process.env.MONGO_URI;
const SITE_HOSTNAME = process.env.SITE_HOSTNAME;
const SITE_NAME = process.env.SITE_NAME;
const SITE_PORT = process.env.SITE_PORT;

// Initialize Express app
const app = express();

// Mongoose setup
mongoose.connect(MONGO_URI)
  .then(() => console.log('MongoDB connected.'))
  .catch(err => console.error('MongoDB connection error:', err));

// Middleware
app.use('/public', express.static(path.join(__dirname, 'public')));
app.set('view engine', 'pug');

app.use((req, res, next) => {
  const ip = req.headers['x-forwarded-for'] || req.connection.remoteAddress;
  console.log('\x1b[36m%s\x1b[0m', `FROM: ${ip} ON: ${req.originalUrl}`);
  res.locals.ip = ip;
  next();
});

if (app.get('env') === 'development') {
  app.locals.pretty = true;
}

// Use routes
app.use('/', (req, res, next) => {
  res.locals.wsServerAddress = SITE_HOSTNAME;
  res.locals.site_name = SITE_NAME;
  next();
}, routes);

// Create HTTP server from the Express app
const server = http.createServer(app);

// WebSocket server setup
const wss = new WebSocket.Server({ server });

wss.on('connection', async ws => {
  console.log('WebSocket connection established');
  ws.on('message', message => console.log('Received:', message));

  try {
    const count = await Magnet.countDocuments({});
    if (ws.readyState === WebSocket.OPEN) {
      ws.send(JSON.stringify({ count }));
    }
  } catch (err) {
    console.error('Error fetching count for WebSocket:', err);
  }
});

const updateCounter = async () => {
  try {
    const count = await Magnet.countDocuments({});
    wss.clients.forEach(client => {
      if (client.readyState === WebSocket.OPEN) {
        client.send(JSON.stringify({ count }));
      }
    });
  } catch (err) {
    console.error('Error fetching count for WebSocket:', err);
  }
};

setInterval(updateCounter, 5000);

// Start server
server.listen(SITE_PORT, () => {
  console.log(`Webserver is listening on port ${SITE_PORT}!`);
});
