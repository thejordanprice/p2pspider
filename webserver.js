// webserver.js

'use strict';

const express = require('express');
const path = require('path');
const mongoose = require('mongoose');
const WebSocket = require('ws');
const routes = require('./routes/index');
const Magnet = require('./models/magnetModel'); // Import the Magnet model

// Constants
const PORT = 8080;
const MONGO_URI = 'mongodb://127.0.0.1/magnetdb';
const WS_SERVER_ADDRESS = 'ws://161.35.122.235:8081'; // WebSocket server address

// Initialize Express app
const app = express();

// Mongoose setup
mongoose.connect(MONGO_URI, { useNewUrlParser: true, useUnifiedTopology: true })
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
  res.locals.wsServerAddress = WS_SERVER_ADDRESS; // Expose WebSocket address to Pug
  next();
}, routes);

// WebSocket server setup
const wss = new WebSocket.Server({ port: 8081 });

wss.on('connection', ws => {
  console.log('WebSocket connection established');
  ws.on('message', message => console.log('Received:', message));
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

// Update counter every 5 seconds
setInterval(updateCounter, 5000);

// Start server
app.listen(PORT, () => {
  console.log(`Webserver is listening on port ${PORT}!`);
});
