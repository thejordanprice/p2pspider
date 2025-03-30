// controllers/magnetController.js
const { Database } = require('../models/db');
const redis = require('redis');

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
const CACHE_DURATION = 300; // Changed from 60 to 300 (5 minutes)
const LATEST_PAGE_CACHE_DURATION = 600; // 10 minutes for latest page
const SEARCH_PAGE_CACHE_DURATION = 300; // 5 minutes for search results
const STATISTICS_CACHE_DURATION = 600; // 10 minutes for statistics page

// In-memory cache for when Redis is disabled
const memoryCache = {
  cache: {},
  get: function(key) {
    const item = this.cache[key];
    if (!item) return null;
    
    // Check if expired
    if (item.expiry < Date.now()) {
      delete this.cache[key];
      return null;
    }
    
    return item.value;
  },
  set: function(key, value, ttlSeconds) {
    this.cache[key] = {
      value,
      expiry: Date.now() + (ttlSeconds * 1000)
    };
  }
};

// Initialize Redis if enabled
async function setupRedis() {
  if (!USE_REDIS) return;
  
  try {
    redisClient = redis.createClient({ url: REDIS_URI });
    redisClient.on('error', err => console.error('Redis error:', err));
    
    await redisClient.connect();
    console.log('Redis connected in controller');
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
      const cached = await redisClient.get(key);
      if (cached) {
        return JSON.parse(cached);
      }
      
      // If not in cache, fetch and store
      console.time(`Cache miss for ${key}`);
      const data = await dataFn();
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
  const data = await dataFn();
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
  '&tr=udp%3A%2F%2Ftracker.coppersurfer.tk%3A6969' +
  '&tr=udp%3A%2F%2Fp4p.arenabg.com%3A1337' +
  '&tr=udp%3A%2F%2Ftracker.internetwarriors.net%3A1337' +
  '&tr=udp%3A%2F%2Ftracker.skyts.net%3A6969' +
  '&tr=udp%3A%2F%2Ftracker.safe.moe%3A6969' +
  '&tr=udp%3A%2F%2Ftracker.piratepublic.com%3A1337'
);

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
        // Pre-format file strings for display
        if (item.files && Array.isArray(item.files)) {
          // Limit to first few files to improve rendering performance
          if (item.files.length > 5) {
            item.files = item.files.slice(0, 5);
            item.hasMoreFiles = true;
          }
          item.filestring = item.files.join('\n');
          if (item.filestring.length > 100) {
            item.filestring = item.filestring.substring(0, 100) + '...';
          }
        } else if (typeof item.files === 'string') {
          let fileString = item.files;
          let formatString = fileString.split(',').join('\n');
          if (formatString.length > 100) {
            formatString = formatString.substring(0, 100) + '...';
          }
          item.filestring = formatString;
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
    const magnet = result.magnet + getTrackers();

    res.render('infohash', {
      title: res.locals.site_name,
      result,
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

  const startTime = Date.now();
  const cacheKey = `search_${query.toLowerCase()}_page_${page}`;

  try {
    const searchResults = await getOrSetCache(cacheKey, SEARCH_PAGE_CACHE_DURATION, async () => {
      let count, results;
      
      if (db.type === 'mongodb') {
        count = await db.countDocuments(countQuery);
        results = await db.find(countQuery, {
          skip: page * limit,
          limit: limit
        });
      } else {
        // For SQLite, we need special handling for the LIKE operator
        if (query.length !== 40) {
          // Use custom SQLite search for name
          count = await new Promise((resolve, reject) => {
            db.db.get('SELECT COUNT(*) as count FROM magnets WHERE name LIKE ?', [`%${query}%`], (err, row) => {
              if (err) reject(err);
              else resolve(row ? row.count : 0);
            });
          });
          
          results = await new Promise((resolve, reject) => {
            db.db.all(
              'SELECT * FROM magnets WHERE name LIKE ? LIMIT ? OFFSET ?',
              [`%${query}%`, limit, page * limit],
              (err, rows) => {
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
      
      return { count, results };
    });

    const endTime = Date.now();
    const { count, results } = searchResults;

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
      timer: endTime - startTime
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
