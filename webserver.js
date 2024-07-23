'use strict';

const express = require('express');
const path = require('path');
const mongoose = require('mongoose');
const routes = require('./routes/index');

// Constants
const PORT = 8080;
const MONGO_URI = 'mongodb://127.0.0.1/magnetdb';

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
app.use('/', routes);

// Start server
app.listen(PORT, () => {
  console.log(`Webserver is listening on port ${PORT}!`);
});
