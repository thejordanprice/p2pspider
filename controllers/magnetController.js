// controllers/magnetController.js
const { Database } = require('../models/db');
const redis = require('redis');

// Initialize database
const db = new Database();

// Initialize Redis client if enabled
const USE_REDIS = process.env.USE_REDIS === 'true';
const REDIS_URI = process.env.REDIS_URI;
let redisClient = null;

// Cache duration in seconds
const CACHE_DURATION = 60; // 1 minute

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
      const data = await dataFn();
      await redisClient.set(key, JSON.stringify(data), { EX: ttl });
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
  
  const data = await dataFn();
  memoryCache.set(key, data, ttl);
  return data;
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
    const count = await getOrSetCache('total_count', CACHE_DURATION, async () => {
      return db.totalCount; // Use cached counter instead of counting
    });
    
    res.render('index', { title: res.locals.site_name, count: count.toLocaleString() });
  } catch (err) {
    console.error('Error fetching count:', err);
    res.status(500).send('Internal Server Error');
  }
};

exports.latest = async (req, res) => {
  const start = Date.now();
  try {
    const results = await getOrSetCache('latest_results', CACHE_DURATION, async () => {
      return await db.find({}, { sort: { fetchedAt: -1 }, limit: 25 });
    });
    
    const timer = Date.now() - start;
    res.render('latest', { title: res.locals.site_name, results, trackers: getTrackers(), timer });
  } catch (err) {
    console.error('Error fetching latest:', err);
    res.status(500).send('Internal Server Error');
  }
};

exports.statistics = async (req, res) => {
  try {
    // Check if database is connected before proceeding
    if (!db.connected) {
      // Handle case where database isn't connected yet
      console.log('Database not connected yet when accessing statistics page');
      return res.status(503).send('Database is still initializing, please try again in a few seconds.');
    }

    const stats = await getOrSetCache('db_statistics', CACHE_DURATION, async () => {
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
    res.status(500).send('Internal Server Error');
  }
};

exports.infohash = async (req, res) => {
  const start = Date.now();
  const { q: infohash } = req.query;

  if (infohash.length !== 40) {
    return res.render('error', { title: res.locals.site_name, error: 'Incorrect infohash length.' });
  }

  try {
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
      title: 'Tordex',
      result,
      trackers: getTrackers(),
      timer
    });
  } catch (err) {
    console.error('Error fetching infohash:', err);
    res.status(500).send('Internal Server Error');
  }
};

exports.search = async (req, res) => {
  const { q: query, p: pageParam } = req.query;
  const page = parseInt(pageParam, 10) || 0;
  const limit = 10;

  if (!query) {
    return res.render('searchform', { title: res.locals.site_name });
  }

  if (query.length < 3) {
    return res.render('error', { title: res.locals.site_name, error: 'You must type a longer search query.' });
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
    const searchResults = await getOrSetCache(cacheKey, CACHE_DURATION, async () => {
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
      title: 'Tordex',
      results: results,
      trackers: getTrackers(),
      pages,
      timer: endTime - startTime
    });
  } catch (err) {
    console.error('Error during search:', err);
    res.status(500).send('Internal Server Error');
  }
};

exports.count = async (req, res) => {
  try {
    const count = await getOrSetCache('total_count', CACHE_DURATION, async () => {
      return db.totalCount; // Use cached counter instead of counting
    });
    
    res.send(count.toLocaleString());
  } catch (err) {
    console.error('Error fetching count:', err);
    res.status(500).send('Internal Server Error');
  }
};
