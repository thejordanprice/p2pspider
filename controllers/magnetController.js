// controllers/magnetController.js
const { Database } = require('../models/db');

// Initialize database
const db = new Database();

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
    const count = await db.countDocuments({});
    res.render('index', { title: res.locals.site_name, count: count.toLocaleString() });
  } catch (err) {
    console.error('Error fetching count:', err);
    res.status(500).send('Internal Server Error');
  }
};

exports.latest = async (req, res) => {
  const start = Date.now();
  try {
    const results = await db.find({}, { sort: { fetchedAt: -1 }, limit: 25 });
    const timer = Date.now() - start;
    res.render('latest', { title: res.locals.site_name, results, trackers: getTrackers(), timer });
  } catch (err) {
    console.error('Error fetching latest:', err);
    res.status(500).send('Internal Server Error');
  }
};

exports.statistics = async (req, res) => {
  try {
    let stats;
    
    if (db.type === 'mongodb') {
      const mongoStats = await db.db.connection.db.stats({ scale: 1048576 });
      stats = {
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
      
      const count = await db.countDocuments({});
      
      stats = {
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
    // Using a simple string match for both database types
    // In SQLite we can't use RegExp, but we can do case-insensitive search
    const results = await db.find({ infohash: infohash.toLowerCase() }, { limit: 1 });
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

  try {
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

    const endTime = Date.now();

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
    const count = await db.countDocuments({});
    res.send(count.toLocaleString());
  } catch (err) {
    console.error('Error fetching count:', err);
    res.status(500).send('Internal Server Error');
  }
};
