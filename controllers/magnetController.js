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
    res.render('index', { title: 'Tordex', count: count.toLocaleString() });
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
    res.render('search', { title: 'Tordex', results, trackers: getTrackers(), timer });
  } catch (err) {
    console.error('Error fetching latest:', err);
    res.status(500).send('Internal Server Error');
  }
};

exports.statistics = async (req, res) => {
  try {
    const stats = await mongoose.connection.db.stats({ scale: 1048576 });
    res.render('statistics', { title: 'Tordex', statistics: stats });
  } catch (err) {
    console.error('Error fetching statistics:', err);
    res.status(500).send('Internal Server Error');
  }
};

exports.infohash = async (req, res) => {
  const start = Date.now();
  const { q: infohash } = req.query;

  if (infohash.length !== 40) {
    return res.render('error', { title: 'Tordex', error: 'Incorrect infohash length.' });
  }

  try {
    const results = await Magnet.find({ infohash: new RegExp(infohash, 'i') }).lean().limit(1);
    const timer = Date.now() - start;

    if (results.length === 0) {
      return res.render('error', { title: 'Tordex', error: 'No results found.' });
    }

    // console.log(results);

    const [result] = results;
    const magnet = result.magnet + getTrackers();
    const healthData = false;

    console.log(result)

    res.render('infohash', {
      title: 'Tordex',
      result,
      trackers: getTrackers(),
      timer,
      health: healthData
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
    return res.render('searchform', { title: 'Tordex' });
  }

  if (query.length < 3) {
    return res.render('error', { title: 'Tordex', error: 'You must type a longer search query.' });
  }

  const regex = new RegExp(query, 'i');
  const countQuery = query.length === 40 ? { infohash: regex } : { name: regex };

  try {
    const count = await Magnet.countDocuments(countQuery);
    const results = await Magnet.find(countQuery)
      .skip(page * limit)
      .limit(limit)
      .lean();

    const healthPromises = results.map(result => {
      const magnet = result.magnet + getTrackers();
      return false;
    });

    const healthData = await Promise.all(healthPromises);
    const pages = {
      query: query.split('/')[1],
      results: count,
      available: Math.ceil(count / limit) - 1,
      current: page,
      previous: page - 1,
      next: page + 1
    };

    res.render('search', {
      title: 'Tordex',
      results: healthData.map(data => data.result),
      trackers: getTrackers(),
      pages,
      timer: Date.now() - page,
      health: healthData.map(data => data.data)
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
