'use strict';

const P2PSpider = require('./index'); // Assuming lib/index.js exports the P2PSpider class
const { isInfohashInRedis, storeInfohashInRedis } = require('./redis');
const { broadcastNewMagnet } = require('../services/websocket');
const { P2P_PORT, P2P_HOST } = require('../config/env');

let p2pInstance = null;

/**
 * Process and store metadata
 */
async function processMetadata(metadata, db, redisClient) {
  const { infohash, info, magnet } = metadata;
  
  // Extract data from metadata
  const name = info.name ? info.name.toString() : '';
  
  // Extract files with their sizes
  let files = [];
  let totalSize = 0;
  
  if (info.files && Array.isArray(info.files)) {
    // Multi-file torrent
    files = info.files.map(file => {
      const filePath = file.path ? file.path.toString() : '';
      const fileSize = file.length || 0;
      totalSize += fileSize;
      return { 
        path: filePath, 
        size: fileSize 
      };
    }).sort((a, b) => a.path.localeCompare(b.path));
  } else if (info.name) {
    // Single file torrent
    const fileSize = info.length || 0;
    totalSize += fileSize;
    files = [{ 
      path: info.name.toString(), 
      size: fileSize 
    }];
  }
  
  const fetchedAt = Date.now();

  try {
    // Check if metadata exists in database
    const existingMagnet = await db.findOne({ infohash });

    if (!existingMagnet) {
      // Save to database
      await db.saveMagnet({ 
        name, 
        infohash, 
        magnet, 
        files, 
        totalSize,
        fetchedAt 
      });
      console.log('Added to database:', name);

      // Store in Redis with TTL
      await storeInfohashInRedis(infohash, redisClient);
      
      // Broadcast new magnet via WebSocket 
      // No need to pass count, websocket service will get it from db instance
      await broadcastNewMagnet({ 
        name, 
        infohash, 
        files,
        totalSize,
        fetchedAt
      });
    } else {
      // console.log(`Metadata for infohash ${infohash} already exists in database.`);
      // Optionally update fetchedAt timestamp if needed
      // await db.updateMagnet({ infohash }, { fetchedAt: Date.now() });
    }
  } catch (err) {
    console.error('Error processing metadata:', err);
    // Decide if we should throw or just log
    // throw err;
  }
}

/**
 * Handle metadata event from P2P Spider
 */
async function handleMetadata(metadata, rinfo, db, redisClient) {
  const { infohash } = metadata;

  try {
    // Check if infohash exists in Redis
    if (await isInfohashInRedis(infohash, redisClient)) {
      // console.log(`Metadata for infohash ${infohash} has already been seen recently (Redis).`);
      return;
    }

    // Process metadata
    await processMetadata(metadata, db, redisClient);

  } catch (err) {
    console.error(`Error handling metadata for ${infohash}:`, err);
  }
}

/**
 * Initialize and configure P2P Spider
 */
function initializeP2PSpider(db, redisClient) {
  if (p2pInstance) {
      console.log('P2P Spider already initialized.');
      return p2pInstance;
  }

  p2pInstance = new P2PSpider({
    nodesMaxSize: 250, // Consider making these configurable via env
    maxConnections: 500,
    timeout: 1000
  });

  p2pInstance.on('metadata', async (metadata, rinfo) => {
    // Pass db and redisClient to the handler
    await handleMetadata(metadata, rinfo, db, redisClient);
  });

  // Log errors from the spider
  p2pInstance.on('error', (err) => {
      console.error('P2P Spider Error:', err);
  });

  console.log('P2P Spider Initialized');
  return p2pInstance;
}

/**
 * Start listening with the P2P Spider
 */
function startP2PSpider() {
    if (!p2pInstance) {
        console.error('P2P Spider not initialized before starting.');
        return;
    }
    p2pInstance.listen(P2P_PORT, P2P_HOST, () => {
        console.log(`P2P Spider is listening on ${P2P_HOST}:${P2P_PORT}!`);
    });
}

/**
 * Close the P2P Spider
 */
function closeP2PSpider(callback) {
    if (p2pInstance) {
        p2pInstance.close(callback);
        p2pInstance = null; // Clear the instance
    } else if (callback) {
        callback(); // Call callback even if not initialized
    }
}

module.exports = {
    initializeP2PSpider,
    startP2PSpider,
    closeP2PSpider
}; 