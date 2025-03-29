'use strict';

require('dotenv').config();
const { Database } = require('./models/db');
const redis = require('redis');
const P2PSpider = require('./lib');

// Database configuration
const db = new Database();
db.connect()
  .then(() => console.log(`Database (${db.type}) is connected.`))
  .catch(err => console.error(`Database connection error:`, err));

// Redis configuration
const USE_REDIS = process.env.USE_REDIS === 'true';
let redisClient = null;

if (USE_REDIS) {
  redisClient = redis.createClient({ url: process.env.REDIS_URI });
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
}

// P2PSpider Configuration
const p2p = new P2PSpider({
  nodesMaxSize: 250,
  maxConnections: 500,
  timeout: 1000
});

// Handle metadata event
p2p.on('metadata', async (metadata, rinfo) => {
  const { infohash, info } = metadata;

  try {
    // Check if infohash exists in Redis, if Redis is enabled
    let existsInRedis = false;
    if (USE_REDIS && redisClient) {
      existsInRedis = await redisClient.exists(`hashes:${infohash}`);
    }

    if (existsInRedis) {
      console.log(`Metadata for infohash ${infohash} has already been seen recently.`);
      return; // Skip processing
    }

    // Metadata is not in Redis, proceed with database
    const name = info.name ? info.name.toString() : '';
    // Convert files to an array of strings
    const files = (info.files || []).map(file => {
      // Assuming file.path exists and is a buffer
      return file.path ? file.path.toString() : '';
    }).sort();
    const fetchedAt = Date.now();

    // Check if metadata exists in database
    const existingMagnet = await db.findOne({ infohash });

    if (!existingMagnet) {
      await db.saveMagnet({ name, infohash, magnet: metadata.magnet, files, fetchedAt });
      console.log('Added to database:', name);

      // Store infohash in Redis with a TTL of 24 hours if Redis is enabled
      if (USE_REDIS && redisClient) {
        await redisClient.set(`hashes:${infohash}`, infohash, 'EX', 60 * 60 * 24);
      }
    } else {
      console.log(`Metadata for infohash ${infohash} already exists in database.`);
    }
  } catch (err) {
    console.error('Error handling metadata:', err);
  }
});

// Start listening for connections
p2p.listen(6881, '0.0.0.0', () => {
  console.log('UDP Server listening on 0.0.0.0:6881');
});
