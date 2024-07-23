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
redisClient.on('error', err => console.error('Redis error:', err));
redisClient.on('end', () => {
  console.log('Redis client disconnected');
  reconnectRedisClient();
});

const reconnectRedisClient = () => {
  console.log('Attempting to reconnect to Redis...');
  setTimeout(() => {
    redisClient.connect().catch(err => {
      console.error('Redis reconnection error:', err);
      reconnectRedisClient();
    });
  }, 5000);
};

redisClient.connect().catch(err => {
  console.error('Error connecting to Redis:', err);
  reconnectRedisClient();
});

// P2PSpider Configuration
const p2p = P2PSpider({
  nodesMaxSize: 250,
  maxConnections: 500,
  timeout: 1000
});

// Handle metadata event
p2p.on('metadata', async (metadata, rinfo) => {
  const { infohash, info } = metadata;

  try {
    // Check if infohash exists in Redis
    const existsInRedis = await redisClient.exists(`hashes:${infohash}`);

    if (existsInRedis) {
      console.log(`Metadata for infohash ${infohash} has already been seen recently.`);
      return; // Skip processing
    }

    // Metadata is not in Redis, proceed with MongoDB
    const name = info.name ? info.name.toString() : '';
    // Convert files to an array of strings
    const files = (info.files || []).map(file => {
      // Assuming file.path exists and is a buffer
      return file.path ? file.path.toString() : '';
    }).sort();
    const fetchedAt = Date.now();

    // Check if metadata exists in MongoDB
    const existingMagnet = await Magnet.findOne({ infohash }).exec();

    if (!existingMagnet) {
      const magnetDoc = new Magnet({ name, infohash, magnet: metadata.magnet, files, fetchedAt });
      await magnetDoc.save();
      console.log('Added to MongoDB:', name);

      // Store infohash in Redis with a TTL of 24 hours
      await redisClient.set(`hashes:${infohash}`, infohash, 'EX', 60 * 60 * 24);
    } else {
      console.log(`Metadata for infohash ${infohash} already exists in MongoDB.`);
    }
  } catch (err) {
    console.error('Error handling metadata:', err);
  }
});

// Start listening for connections
p2p.listen(6881, '0.0.0.0', () => {
  console.log('UDP Server listening on 0.0.0.0:6881');
});
