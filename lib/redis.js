'use strict';

const redis = require('redis');
const { USE_REDIS, REDIS_URI, REDIS_HASH_TTL } = require('../config/env');

let redisClient = null;

/**
 * Attempt to reconnect to Redis after a disconnection
 */
function reconnectRedisClient(client) {
  console.log('Attempting to reconnect to Redis...');
  setTimeout(() => {
    client.connect().catch(err => {
      console.error('Redis reconnection error:', err);
      reconnectRedisClient(client); // Retry reconnection
    });
  }, 5000); // Retry after 5 seconds
}

/**
 * Redis client initialization and configuration
 */
async function initializeRedis() {
  if (!USE_REDIS) {
    console.log('Redis is disabled');
    return null;
  }

  if (redisClient && redisClient.isOpen) {
      console.log('Using existing Redis connection.');
      return redisClient;
  }

  const client = redis.createClient({ url: REDIS_URI });
  
  client.on('error', err => console.error('Redis error:', err));
  client.on('end', () => {
    console.log('Redis client disconnected');
    redisClient = null; // Clear the client reference on disconnect
    reconnectRedisClient(client);
  });

  try {
    await client.connect();
    console.log('Redis client connected');
    redisClient = client; // Store the connected client
    return client;
  } catch (err) {
    console.error('Error connecting to Redis:', err);
    reconnectRedisClient(client); // Attempt reconnect even on initial failure
    // Return null or handle the error appropriately, maybe don't return the client if connect failed?
    return null; 
  }
}

/**
 * Check if infohash exists in Redis
 */
async function isInfohashInRedis(infohash, client) {
  if (!USE_REDIS || !client || !client.isOpen) {
    return false;
  }

  try {
    return await client.exists(`hashes:${infohash}`);
  } catch (err) {
    console.error('Error checking Redis for infohash:', err);
    return false;
  }
}

/**
 * Store infohash in Redis with TTL
 */
async function storeInfohashInRedis(infohash, client) {
  if (!USE_REDIS || !client || !client.isOpen) {
    return;
  }

  try {
    await client.set(`hashes:${infohash}`, infohash, { EX: REDIS_HASH_TTL });
  } catch (err) {
    console.error('Error storing infohash in Redis:', err);
  }
}

function getRedisClient() {
    return redisClient;
}

async function closeRedis() {
    if (redisClient && redisClient.isOpen) {
        await redisClient.quit();
        console.log('Redis client closed');
        redisClient = null;
    }
}

module.exports = {
    initializeRedis,
    isInfohashInRedis,
    storeInfohashInRedis,
    getRedisClient,
    closeRedis
}; 