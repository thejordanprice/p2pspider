'use strict';

const mongoose = require('mongoose');
const redis = require('redis');
const P2PSpider = require('../lib');

// MongoDB configuration
const mongoDB = 'mongodb://127.0.0.1/magnetdb';
mongoose.connect(mongoDB, { useNewUrlParser: true, useUnifiedTopology: true })
  .then(() => console.log('MongoDB has connected.'))
  .catch(err => console.error('MongoDB connection error:', err));

// Define Mongoose Schema and Model
const magnetSchema = new mongoose.Schema({
  name: { type: String, index: true },
  infohash: { type: String, index: true },
  magnet: String,
  files: [String],
  fetchedAt: { type: Number, default: Date.now }
});

const Magnet = mongoose.model('Magnet', magnetSchema);

// Redis configuration
const redisClient = redis.createClient();

redisClient.on('error', err => {
  console.error('Redis error:', err);
});

redisClient.on('end', () => {
  console.log('Redis client disconnected');
  // Reconnect logic here
  reconnectRedisClient();
});

const reconnectRedisClient = () => {
  console.log('Attempting to reconnect to Redis...');
  // Try to reconnect every 5 seconds
  setTimeout(() => {
    redisClient.connect().catch(err => {
      console.error('Redis reconnection error:', err);
      reconnectRedisClient(); // Retry if connection fails
    });
  }, 5000);
};

// Ensure Redis client is connected
redisClient.connect().catch(err => {
  console.error('Error connecting to Redis:', err);
  reconnectRedisClient(); // Retry if initial connection fails
});

// P2PSpider Configuration
const p2p = P2PSpider({
  nodesMaxSize: 250,
  maxConnections: 500,
  timeout: 1000
});

// Check if torrent is in DB already
p2p.ignore((infohash, rinfo, callback) => {
  if (redisClient.isOpen) {
    redisClient.exists(`hashes:${infohash}`, (err, reply) => {
      if (err) return callback(err);
      callback(Boolean(reply));
    });
  } else {
    callback(new Error('Redis client is not connected'));
  }
});

// Handle metadata event
p2p.on('metadata', async (metadata, rinfo) => {
  try {
    const { magnet, infohash, info } = metadata;
    const name = info.name ? info.name.toString() : '';
    const files = (info.files || []).map(item => item.path).sort();
    const fetchedAt = Date.now();

    const existingMagnet = await Magnet.findOne({ infohash }).exec();

    if (!existingMagnet) {
      const magnetDoc = new Magnet({ name, infohash, magnet, files, fetchedAt });
      await magnetDoc.save();
      console.log('Added:', name);
      
      redisClient.set(`hashes:${infohash}`, infohash, 'EX', 60 * 60 * 24);
    }
  } catch (err) {
    console.error('Error handling metadata:', err);
  }
});

// Start listening for connections
p2p.listen(6881, '0.0.0.0');
