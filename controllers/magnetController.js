// controllers/magnetController.js
const mongoose = require('mongoose');
const Magnet = require('../models/magnetModel');

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
    const count = await Magnet.countDocuments({});
    res.render('index', { title: res.locals.site_name, count: count.toLocaleString() });
  } catch (err) {
    console.error('Error fetching count:', err);
    res.status(500).send('Internal Server Error');
  }
};

exports.latest = async (req, res) => {
  const start = Date.now();
  try {
    const results = await Magnet.find({})
      .sort({ fetchedAt: -1 })
      .limit(25)
      .lean();
    const timer = Date.now() - start;
    res.render('search', { title: res.locals.site_name, results, trackers: getTrackers(), timer });
  } catch (err) {
    console.error('Error fetching latest:', err);
    res.status(500).send('Internal Server Error');
  }
};

exports.statistics = async (req, res) => {
  try {
    const stats = await mongoose.connection.db.stats({ scale: 1048576 });

    // Format numbers to two decimal places
    const formattedStats = {
      db: stats.db,
      collections: stats.collections,
      objects: stats.objects,
      avgObjSize: (stats.avgObjSize / 1024).toFixed(2), // Convert MB to GB
      dataSize: stats.dataSize.toFixed(2),
      storageSize: stats.storageSize.toFixed(2),
      indexes: stats.indexes,
      indexSize: stats.indexSize.toFixed(2)
    };

    res.render('statistics', { title: res.locals.site_name, statistics: formattedStats });
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
    const results = await Magnet.find({ infohash: new RegExp(infohash, 'i') }).lean().limit(1);
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

  const regex = new RegExp(query, 'i');
  const countQuery = query.length === 40 ? { infohash: regex } : { name: regex };

  const startTime = Date.now();

  try {
    const count = await Magnet.countDocuments(countQuery);
    const results = await Magnet.find(countQuery)
      .skip(page * limit)
      .limit(limit)
      .lean();

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
    const count = await Magnet.countDocuments({});
    res.send(count.toLocaleString());
  } catch (err) {
    console.error('Error fetching count:', err);
    res.status(500).send('Internal Server Error');
  }
};
