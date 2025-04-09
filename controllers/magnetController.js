'use strict';

// controllers/magnetController.js
const { Database } = require('../models/db');
const redis = require('redis');
const elasticsearch = require('../models/elasticsearch');

// Initialize database
const db = new Database();

// Track if full initialization is complete (not just connection)
let dbInitialized = false;

// Initialize database connection
(async function initializeDatabase() {
  try {
    await db.connect();
    // Set a flag once the counter is initialized to ensure all initialization is complete
    // This ensures controllers won't report database not ready when it actually is
    setTimeout(() => {
      if (db.totalCount >= 0) {
        dbInitialized = true;
        console.log(`Database fully initialized with ${db.totalCount} records`);
      }
    }, 500); // Small delay to ensure counter is initialized
  } catch (err) {
    console.error('Error initializing database in controller:', err);
  }
})();

// Initialize Redis client if enabled
const USE_REDIS = process.env.USE_REDIS === 'true';
const REDIS_URI = process.env.REDIS_URI;
let redisClient = null;

// Cache duration in seconds
const CACHE_DURATION = 60 * 60; // 1 hour in seconds
const LATEST_PAGE_CACHE_DURATION = 60 * 5; // 5 minutes in seconds
const SEARCH_CACHE_DURATION = 60 * 30; // 30 minutes in seconds
const STATISTICS_CACHE_DURATION = 600; // 10 minutes for statistics page

// Maximum number of items to store in memory cache
const MEMORY_CACHE_MAX_ITEMS = 1000;

// In-memory cache for when Redis is disabled
const memoryCache = {
  cache: {},
  keys: [], // Track keys for LRU eviction
  get: function(key) {
    const item = this.cache[key];
    if (!item) return null;
    
    // Check if expired
    if (item.expiry < Date.now()) {
      delete this.cache[key];
      this.keys = this.keys.filter(k => k !== key);
      return null;
    }
    
    // Update key position in LRU tracking
    this.keys = this.keys.filter(k => k !== key);
    this.keys.push(key);
    
    return item.value;
  },
  set: function(key, value, ttlSeconds) {
    // Check if we need to evict
    if (this.keys.length >= MEMORY_CACHE_MAX_ITEMS && !this.cache[key]) {
      const oldestKey = this.keys.shift(); // Remove oldest key
      delete this.cache[oldestKey];
    }
    
    this.cache[key] = {
      value,
      expiry: Date.now() + (ttlSeconds * 1000)
    };
    
    // Add/update key in tracked keys
    this.keys = this.keys.filter(k => k !== key);
    this.keys.push(key);
  },
  // Debug method to check cache size
  size: function() {
    return this.keys.length;
  },
  // Clear all expired items
  prune: function() {
    const now = Date.now();
    const expiredKeys = this.keys.filter(key => 
      this.cache[key] && this.cache[key].expiry < now
    );
    
    expiredKeys.forEach(key => {
      delete this.cache[key];
    });
    
    this.keys = this.keys.filter(key => !expiredKeys.includes(key));
    return expiredKeys.length;
  }
};

// Periodically prune expired items to avoid memory growth
setInterval(() => {
  const pruned = memoryCache.prune();
  if (pruned > 0) {
    console.log(`Pruned ${pruned} expired cache items`);
  }
}, 60000); // Prune every minute

// Initialize Redis if enabled
async function setupRedis() {
  if (!USE_REDIS) return;
  
  try {
    redisClient = redis.createClient({ 
      url: REDIS_URI,
      socket: {
        reconnectStrategy: (retries) => {
          // Maximum reconnection attempts 
          if (retries > 10) {
            console.error('Redis max reconnection attempts reached');
            return new Error('Redis max reconnection attempts reached');
          }
          // Exponential backoff with jitter
          return Math.min(Math.pow(2, retries) * 100 + Math.random() * 100, 10000);
        },
        connectTimeout: 5000, // 5 seconds timeout
      }
    });
    
    redisClient.on('error', err => {
      console.error('Redis error:', err);
    });
    
    redisClient.on('reconnecting', () => {
      console.log('Redis client reconnecting...');
    });
    
    redisClient.on('ready', () => {
      console.log('Redis client ready');
    });
    
    await redisClient.connect();
    console.log('Redis connected in controller');
    
    // Add a periodic health check to detect zombied connections
    setInterval(async () => {
      try {
        if (redisClient && redisClient.isOpen) {
          // Simple ping to verify connection is still responsive
          await Promise.race([
            redisClient.ping(),
            new Promise((_, reject) => setTimeout(() => reject(new Error('Redis ping timeout')), 2000))
          ]);
        }
      } catch (err) {
        console.error('Redis health check failed:', err);
        // Force reconnect if ping fails
        if (redisClient) {
          try {
            await redisClient.quit();
          } catch (e) {
            // Ignore quit errors
          }
          setupRedis().catch(e => console.error('Redis reconnect error:', e));
        }
      }
    }, 30000); // Check every 30 seconds
    
  } catch (err) {
    console.error('Failed to connect to Redis:', err);
    redisClient = null;
  }
}

// Call Redis setup
setupRedis();

// Cache helper function
async function getOrSetCache(key, ttl, dataFn) {
  // Try Redis first if available
  if (USE_REDIS && redisClient && redisClient.isOpen) {
    try {
      const cached = await Promise.race([
        redisClient.get(key),
        new Promise((_, reject) => setTimeout(() => reject(new Error('Redis get timeout')), 5000))
      ]);
      
      if (cached) {
        return JSON.parse(cached);
      }
      
      // If not in cache, fetch and store
      console.time(`Cache miss for ${key}`);
      
      // Set a timeout for the data function
      const data = await Promise.race([
        dataFn(),
        new Promise((_, reject) => setTimeout(() => reject(new Error('Data function timeout')), 15000))
      ]);
      
      console.timeEnd(`Cache miss for ${key}`);
      
      // Don't wait for the set operation to complete
      redisClient.set(key, JSON.stringify(data), { EX: ttl })
        .catch(err => console.error(`Redis error setting ${key}:`, err));
      
      return data;
    } catch (err) {
      console.error('Redis cache error:', err);
      // Fall back to memory cache if Redis fails
    }
  }
  
  // Use memory cache if Redis is disabled or failed
  const cachedData = memoryCache.get(key);
  if (cachedData) {
    return cachedData;
  }
  
  console.time(`Memory cache miss for ${key}`);
  
  // Set a timeout for the data function when using memory cache
  let data;
  try {
    data = await Promise.race([
      dataFn(),
      new Promise((_, reject) => setTimeout(() => reject(new Error('Data function timeout (memory cache)')), 15000))
    ]);
  } catch (err) {
    console.error(`Error fetching data for ${key}:`, err);
    // Return an empty result instead of deadlocking
    if (key.startsWith('search_')) {
      return { count: 0, results: [], source: 'error' };
    }
    throw err;
  }
  
  console.timeEnd(`Memory cache miss for ${key}`);
  
  memoryCache.set(key, data, ttl);
  return data;
}

// Helper function to check if database is ready
function isDatabaseReady() {
  // The database is ready if either of these conditions is true:
  // 1. Connection is established AND the dbInitialized flag is true
  // 2. Connection is established AND totalCount is positive
  return db.connected && (dbInitialized || db.totalCount > 0);
}

const getTrackers = () => (
  '&tr=udp%3A%2F%2Ftracker.opentrackr.org%3A1337%2Fannounce' +
  '&tr=udp%3A%2F%2Fopen.demonii.com%3A1337%2Fannounce' +
  '&tr=udp%3A%2F%2Fopen.stealth.si%3A80%2Fannounce' +
  '&tr=udp%3A%2F%2Ftracker.torrent.eu.org%3A451%2Fannounce' +
  '&tr=udp%3A%2F%2Fexplodie.org%3A6969%2Fannounce' +
  '&tr=udp%3A%2F%2Fexodus.desync.com%3A6969%2Fannounce' +
  '&tr=udp%3A%2F%2Ftracker.skyts.net%3A6969%2Fannounce' +
  '&tr=udp%3A%2F%2Ftracker.ololosh.space%3A6969%2Fannounce' +
  '&tr=udp%3A%2F%2Ftracker.dump.cl%3A6969%2Fannounce' +
  '&tr=udp%3A%2F%2Fopentracker.io%3A6969%2Fannounce' +
  '&tr=udp%3A%2F%2Fopen.free-tracker.ga%3A6969%2Fannounce' +
  '&tr=udp%3A%2F%2Fns-1.x-fins.com%3A6969%2Fannounce' +
  '&tr=udp%3A%2F%2Fisk.richardsw.club%3A6969%2Fannounce' +
  '&tr=udp%3A%2F%2Fdiscord.heihachi.pw%3A6969%2Fannounce' +
  '&tr=udp%3A%2F%2Fbt.ktrackers.com%3A6666%2Fannounce' +
  '&tr=http%3A%2F%2Fwww.torrentsnipe.info%3A2701%2Fannounce' +
  '&tr=http%3A%2F%2Fwww.genesis-sp.org%3A2710%2Fannounce' +
  '&tr=http%3A%2F%2Ftracker810.xyz%3A11450%2Fannounce' +
  '&tr=http%3A%2F%2Ftracker.xiaoduola.xyz%3A6969%2Fannounce' +
  '&tr=http%3A%2F%2Ftracker.vanitycore.co%3A6969%2Fannounce' +
  '&tr=http%3A%2F%2Ftracker.dump.cl%3A6969%2Fannounce' +
  '&tr=http%3A%2F%2Fopentracker.io%3A6969%2Fannounce' +
  '&tr=http%3A%2F%2Fopen.free-tracker.ga%3A6969%2Fannounce' +
  '&tr=http%3A%2F%2Fns-1.x-fins.com%3A6969%2Fannounce' +
  '&tr=http%3A%2F%2Fisk.richardsw.club%3A6969%2Fannounce' +
  '&tr=http%3A%2F%2Fdiscord.heihachi.pw%3A6969%2Fannounce' +
  '&tr=http%3A%2F%2Fbt.ktrackers.com%3A6666%3A6969%2Fannounce'
);

// File tree utils for directory structure
const fileTreeUtils = require('../utils/fileTreeUtils');

exports.index = async (req, res) => {
  try {
    // Check if database is ready before proceeding
    if (!isDatabaseReady()) {
      console.log('Database not fully initialized when accessing index page');
      return res.render('error', { 
        title: res.locals.site_name, 
        error: 'Database is still initializing, please try again in a few seconds.' 
      });
    }

    const count = await getOrSetCache('total_count', CACHE_DURATION, async () => {
      return db.totalCount; // Use cached counter instead of counting
    });
    
    res.render('index', { title: res.locals.site_name, count: count.toLocaleString() });
  } catch (err) {
    console.error('Error fetching count:', err);
    res.render('error', { 
      title: res.locals.site_name, 
      error: 'An error occurred while loading the page. Please try again shortly.' 
    });
  }
};

exports.latest = async (req, res) => {
  const start = Date.now();
  try {
    // Check if database is ready before proceeding
    if (!isDatabaseReady()) {
      console.log('Database not fully initialized when accessing latest page');
      return res.render('error', { 
        title: res.locals.site_name, 
        error: 'Database is still initializing, please try again in a few seconds.' 
      });
    }

    // Get page parameter for pagination
    const page = parseInt(req.query.p) || 0;
    const pageSize = 15; // Reduced from 25 to 15 for faster rendering
    const skip = page * pageSize;
    
    // Use cache key that includes pagination parameters
    const cacheKey = `latest_results_p${page}`;

    const results = await getOrSetCache(cacheKey, LATEST_PAGE_CACHE_DURATION, async () => {
      // For MongoDB, use projection to limit fields returned
      // For SQLite, we'll still get all fields but it should be faster with proper indexing
      const query = {};
      const options = { 
        sort: { fetchedAt: -1 }, 
        limit: pageSize, 
        skip: skip 
      };
      
      // Only include specific fields we need to display
      if (db.type === 'mongodb') {
        options.projection = {
          name: 1, 
          infohash: 1, 
          magnet: 1, 
          fetchedAt: 1,
          // Include a truncated version of files directly in projection
          files: { $slice: 5 } // Limit to first 5 files
        };
      }
      
      const items = await db.find(query, options);
      
      // Pre-process file data for rendering to avoid doing it in the template
      items.forEach(item => {
        // Process files for both display formats - tree view and simple list
        if (item.files && Array.isArray(item.files)) {
          // Store original file count to show "more files" link if needed
          const originalCount = item.files.length;
          
          // Limit to first few files to improve rendering performance
          if (item.files.length > 5) {
            item.files = item.files.slice(0, 5);
            item.hasMoreFiles = true;
          }
          
          // Create a simple string representation for the old format
          item.filestring = item.files.join('\n');
          if (item.filestring.length > 100) {
            item.filestring = item.filestring.substring(0, 100) + '...';
          }
          
          // Create tree structure for the new format
          item.fileTree = fileTreeUtils.buildFileTree(item.files);
          item.treeHtml = fileTreeUtils.renderFileTree(item.fileTree);
          
          // Add a note about truncated files
          if (item.hasMoreFiles) {
            item.moreFilesCount = originalCount - 5;
          }
        } else if (typeof item.files === 'string') {
          // Handle string representation
          let fileString = item.files;
          let formatString = fileString.split(',').join('\n');
          if (formatString.length > 100) {
            formatString = formatString.substring(0, 100) + '...';
          }
          item.filestring = formatString;
          
          // Create tree structure for string format as well
          item.fileTree = fileTreeUtils.buildFileTree(item.files);
          item.treeHtml = fileTreeUtils.renderFileTree(item.fileTree);
        }
      });
      
      return items;
    });
    
    // Get total count for pagination
    const totalCount = await getOrSetCache('total_count', CACHE_DURATION, async () => {
      return db.totalCount;
    });
    
    // Calculate pagination data
    const totalPages = Math.ceil(totalCount / pageSize);
    const pages = {
      current: page,
      previous: Math.max(0, page - 1),
      next: page + 1,
      available: totalPages - 1
    };
    
    const timer = Date.now() - start;
    res.render('latest', { 
      title: res.locals.site_name, 
      results, 
      trackers: getTrackers(), 
      timer,
      pages 
    });
  } catch (err) {
    console.error('Error fetching latest:', err);
    res.render('error', { 
      title: res.locals.site_name, 
      error: 'An error occurred while loading the latest entries. Please try again shortly.' 
    });
  }
};

exports.statistics = async (req, res) => {
  try {
    // Check if database is ready before proceeding
    if (!isDatabaseReady()) {
      // Handle case where database isn't connected yet
      console.log('Database not fully initialized when accessing statistics page');
      return res.render('error', { 
        title: res.locals.site_name, 
        error: 'Database is still initializing, please try again in a few seconds.' 
      });
    }

    const stats = await getOrSetCache('db_statistics', STATISTICS_CACHE_DURATION, async () => {
      if (db.type === 'mongodb') {
        const mongoStats = await db.db.connection.db.stats({ scale: 1048576 });
        return {
          db: mongoStats.db,
          collections: mongoStats.collections,
          objects: mongoStats.objects,
          avgObjSize: (mongoStats.avgObjSize / 1024).toFixed(2),
          dataSize: mongoStats.dataSize.toFixed(2),
          storageSize: mongoStats.storageSize.toFixed(2),
          indexes: mongoStats.indexes,
          indexSize: mongoStats.indexSize.toFixed(2)
        };
      } else if (db.type === 'sqlite') {
        // SQLite statistics
        const dbSize = await new Promise((resolve, reject) => {
          db.db.get('SELECT page_count * page_size as size FROM pragma_page_count(), pragma_page_size()', (err, row) => {
            if (err) reject(err);
            else resolve(row ? row.size / (1024 * 1024) : 0);
          });
        });
        
        // Use the cached counter instead of counting
        const count = db.totalCount;
        
        return {
          db: 'SQLite',
          collections: 1,
          objects: count,
          avgObjSize: count > 0 ? ((dbSize * 1024 * 1024) / count / 1024).toFixed(2) : '0.00',
          dataSize: dbSize.toFixed(2),
          storageSize: dbSize.toFixed(2),
          indexes: 2,  // We created 2 indexes (infohash and name)
          indexSize: (dbSize * 0.2).toFixed(2)  // Estimate index size as 20% of total
        };
      }
    });

    res.render('statistics', { title: res.locals.site_name, statistics: stats });
  } catch (err) {
    console.error('Error fetching statistics:', err);
    res.render('error', {
      title: res.locals.site_name,
      error: 'An error occurred while loading statistics. Please try again shortly.'
    });
  }
};

exports.infohash = async (req, res) => {
  const start = Date.now();
  const { q: infohash } = req.query;

  if (infohash.length !== 40) {
    return res.render('error', { title: res.locals.site_name, error: 'Incorrect infohash length.' });
  }

  try {
    // Check if database is ready before proceeding
    if (!isDatabaseReady()) {
      console.log('Database not fully initialized when fetching infohash');
      return res.render('error', { 
        title: res.locals.site_name, 
        error: 'Database is still initializing, please try again in a few seconds.' 
      });
    }

    // Cache key includes the infohash
    const cacheKey = `infohash_${infohash.toLowerCase()}`;
    
    const results = await getOrSetCache(cacheKey, CACHE_DURATION, async () => {
      // Using a simple string match for both database types
      return await db.find({ infohash: infohash.toLowerCase() }, { limit: 1 });
    });
    
    const timer = Date.now() - start;

    if (results.length === 0) {
      return res.render('error', { title: res.locals.site_name, error: 'No results found.' });
    }

    const [result] = results;
    
    // Process file tree data
    const fileTree = fileTreeUtils.buildFileTree(result.files);
    const treeHtml = fileTreeUtils.renderFileTree(fileTree);
    
    // Add the processed data to the result
    result.fileTree = fileTree;
    
    const magnet = result.magnet + getTrackers();

    res.render('infohash', {
      title: res.locals.site_name,
      result,
      treeHtml,
      trackers: getTrackers(),
      timer
    });
  } catch (err) {
    console.error('Error fetching infohash:', err);
    res.render('error', { 
      title: res.locals.site_name, 
      error: 'An error occurred while fetching the infohash. Please try again shortly.' 
    });
  }
};

exports.search = async (req, res) => {
  const { q: query, p: pageParam } = req.query;
  const page = parseInt(pageParam, 10) || 0;
  const limit = 10;

  if (!query) {
    return res.redirect('/');
  }

  if (query.length < 3) {
    return res.render('error', { title: res.locals.site_name, error: 'You must type a longer search query.' });
  }

  // Check if database is ready before proceeding
  if (!isDatabaseReady()) {
    console.log('Database not fully initialized when performing search');
    return res.render('error', { 
      title: res.locals.site_name, 
      error: 'Database is still initializing, please try again in a few seconds.' 
    });
  }

  const startTime = Date.now();
  const cacheKey = `search_${query.toLowerCase()}_page_${page}`;

  try {
    // Check if Elasticsearch is enabled and connected
    const useElasticsearch = elasticsearch.isElasticsearchEnabled();
    
    let searchResults;
    try {
      searchResults = await getOrSetCache(cacheKey, SEARCH_CACHE_DURATION, async () => {
        let count, results;
        
        // Use Elasticsearch if available
        if (useElasticsearch) {
          console.log('Using Elasticsearch for search query:', query);
          const esResults = await elasticsearch.search(query, page, limit);
          
          if (esResults) {
            return {
              count: esResults.count,
              results: esResults.results,
              source: 'elasticsearch'
            };
          }
          // Fall back to database search if Elasticsearch fails
          console.log('Elasticsearch search failed, falling back to database');
        }
        
        // Regular database search logic
        let countQuery;
        // Simplify query for SQLite compatibility
        if (query.length === 40) {
          countQuery = { infohash: query.toLowerCase() };
        } else {
          // SQLite doesn't support RegExp, but we can use LIKE
          // For MongoDB, we'll keep using the existing approach
          if (db.type === 'mongodb') {
            countQuery = { name: new RegExp(query, 'i') };
          } else {
            // For SQLite, we modify our database interface to handle this special case
            countQuery = { name: `%${query}%` };
          }
        }
        
        // Estimate count instead of exact counting for performance
        // For large datasets, exact counting can be expensive
        const MAX_COUNT_ESTIMATE = 10000;
        
        if (db.type === 'mongodb') {
          // For MongoDB, use countDocuments but with a limit
          count = await db.countDocuments(countQuery);
          if (count > MAX_COUNT_ESTIMATE) count = MAX_COUNT_ESTIMATE;
          
          results = await db.find(countQuery, {
            skip: page * limit,
            limit: limit
          });
        } else {
          // For SQLite, we need special handling for the LIKE operator
          if (query.length !== 40) {
            // Use custom SQLite search for name with a maximum count constraint
            count = await new Promise((resolve, reject) => {
              const countTimer = setTimeout(() => {
                console.warn('Count query took too long, using estimate');
                resolve(MAX_COUNT_ESTIMATE);
              }, 5000);
              
              db.db.get('SELECT COUNT(*) as count FROM magnets WHERE name LIKE ? LIMIT ?', 
                [`%${query}%`, MAX_COUNT_ESTIMATE], 
                (err, row) => {
                  clearTimeout(countTimer);
                  if (err) reject(err);
                  else resolve(row ? row.count : 0);
                }
              );
            });
            
            results = await new Promise((resolve, reject) => {
              const queryTimer = setTimeout(() => {
                console.warn('Search query took too long, aborting');
                reject(new Error('Query timeout'));
              }, 10000);
              
              db.db.all(
                'SELECT * FROM magnets WHERE name LIKE ? LIMIT ? OFFSET ?',
                [`%${query}%`, limit, page * limit],
                (err, rows) => {
                  clearTimeout(queryTimer);
                  if (err) reject(err);
                  else {
                    // Convert files string to array for each row
                    rows.forEach(row => {
                      row.files = row.files ? JSON.parse(row.files) : [];
                    });
                    resolve(rows);
                  }
                }
              );
            });
          } else {
            // Direct infohash search
            count = await db.countDocuments(countQuery);
            results = await db.find(countQuery, {
              skip: page * limit,
              limit: limit
            });
          }
        }
        
        // Process file data for rendering to avoid doing it in the template
        results.forEach(item => {
          // Process files for both display formats - tree view and simple list
          if (item.files && Array.isArray(item.files)) {
            // Store original file count to show "more files" link if needed
            const originalCount = item.files.length;
            
            // Limit to first few files to improve rendering performance
            if (item.files.length > 5) {
              item.files = item.files.slice(0, 5);
              item.hasMoreFiles = true;
            }
            
            // Create a simple string representation for the old format
            item.filestring = item.files.join('\n');
            if (item.filestring.length > 100) {
              item.filestring = item.filestring.substring(0, 100) + '...';
            }
            
            // Create tree structure for the new format
            item.fileTree = fileTreeUtils.buildFileTree(item.files);
            item.treeHtml = fileTreeUtils.renderFileTree(item.fileTree);
            
            // Add a note about truncated files
            if (item.hasMoreFiles) {
              item.moreFilesCount = originalCount - 5;
            }
          } else if (typeof item.files === 'string') {
            // Handle string representation
            let fileString = item.files;
            let formatString = fileString.split(',').join('\n');
            if (formatString.length > 100) {
              formatString = formatString.substring(0, 100) + '...';
            }
            item.filestring = formatString;
            
            // Create tree structure for string format as well
            item.fileTree = fileTreeUtils.buildFileTree(item.files);
            item.treeHtml = fileTreeUtils.renderFileTree(item.fileTree);
          }
        });
        
        return { 
          count, 
          results,
          source: 'database'
        };
      });
    } catch (err) {
      console.error('Search error:', err);
      // Provide fallback for UI in case of a search error
      searchResults = { count: 0, results: [], source: 'error' };
    }

    const endTime = Date.now();
    const { count = 0, results = [], source = 'database' } = searchResults || {};

    const pages = {
      query: query || '',
      results: count,
      available: Math.ceil(count / limit) - 1,
      current: page,
      previous: page - 1,
      next: page + 1
    };

    res.render('search', {
      title: res.locals.site_name,
      results: results,
      trackers: getTrackers(),
      pages,
      timer: endTime - startTime,
      searchSource: source
    });
  } catch (err) {
    console.error('Error during search:', err);
    res.render('error', { 
      title: res.locals.site_name, 
      error: 'An error occurred while searching. The database might still be initializing.' 
    });
  }
};

exports.count = async (req, res) => {
  try {
    // Check if database is ready before proceeding
    if (!isDatabaseReady()) {
      console.log('Database not fully initialized when fetching count');
      return res.status(503).json({ error: 'Database is still initializing' });
    }
    
    const count = await getOrSetCache('total_count', CACHE_DURATION, async () => {
      return db.totalCount; // Use cached counter instead of counting
    });
    
    res.send(count.toLocaleString());
  } catch (err) {
    console.error('Error fetching count:', err);
    res.status(500).json({ error: 'Error fetching count' });
  }
};
