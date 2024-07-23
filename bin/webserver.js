'use strict';

const express = require('express');
const path = require('path');
const mongoose = require('mongoose');
const basicAuth = require('express-basic-auth');
const webtorrentHealth = require('webtorrent-health');

// Configurations
const SITE_TITLE = 'Tordex';
const MONGO_URI = 'mongodb://127.0.0.1/magnetdb';
const PORT = 8080;

// Connect to MongoDB
mongoose.connect(MONGO_URI, { useNewUrlParser: true, useUnifiedTopology: true })
  .then(() => console.log('MongoDB has connected.'))
  .catch(err => console.error('MongoDB connection error:', err));

// Define Mongoose Schema and Model
const magnetSchema = new mongoose.Schema({
  name: { type: String, index: true },
  infohash: { type: String, index: true },
  magnet: String,
  fetchedAt: { type: Number, default: Date.now }
});

const Magnet = mongoose.model('Magnet', magnetSchema);

// Initialize Express app
const app = express();

// Static file serving
app.use('/public', express.static(path.join(__dirname, 'public')));

// Set view engine
app.set('view engine', 'pug');

// Basic Auth (commented out by default)
// app.use(basicAuth({
//   users: { 'username': 'password' },
//   challenge: true,
//   realm: 'Secret Place'
// }));

// Middleware to log IP addresses and URLs
app.use((req, res, next) => {
  const ip = req.headers['x-forwarded-for'] || req.connection.remoteAddress;
  console.log('\x1b[36m%s\x1b[0m', `FROM: ${ip} ON: ${req.originalUrl}`);
  res.locals.ip = ip;
  next();
});

// Development settings
if (app.get('env') === 'development') {
  app.locals.pretty = true;
}

// Utility function for trackers
const getTrackers = () => (
  '&tr=udp%3A%2F%2Ftracker.coppersurfer.tk%3A6969' +
  '&tr=udp%3A%2F%2Fp4p.arenabg.com%3A1337' +
  '&tr=udp%3A%2F%2Ftracker.internetwarriors.net%3A1337' +
  '&tr=udp%3A%2F%2Ftracker.skyts.net%3A6969' +
  '&tr=udp%3A%2F%2Ftracker.safe.moe%3A6969' +
  '&tr=udp%3A%2F%2Ftracker.piratepublic.com%3A1337'
);

// Route handlers
app.get('/', async (req, res) => {
  try {
    const count = await Magnet.countDocuments({});
    res.render('index', { title: SITE_TITLE, count: count.toLocaleString() });
  } catch (err) {
    console.error('Error fetching count:', err);
    res.status(500).send('Internal Server Error');
  }
});

app.get('/latest', async (req, res) => {
  const start = Date.now();
  try {
    const results = await Magnet.find({})
      .sort({ fetchedAt: -1 })
      .limit(25)
      .lean();
    const timer = Date.now() - start;
    res.render('search', { title: SITE_TITLE, results, trackers: getTrackers(), timer });
  } catch (err) {
    console.error('Error fetching latest:', err);
    res.status(500).send('Internal Server Error');
  }
});

app.get('/statistics', async (req, res) => {
  try {
    const stats = await mongoose.connection.db.stats({ scale: 1048576 });
    res.render('statistics', { title: SITE_TITLE, statistics: stats });
  } catch (err) {
    console.error('Error fetching statistics:', err);
    res.status(500).send('Internal Server Error');
  }
});

app.get('/infohash', async (req, res) => {
  const start = Date.now();
  const infohash = req.query.q;
  
  if (infohash.length !== 40) {
    return res.render('error', { title: SITE_TITLE, error: 'Incorrect infohash length.' });
  }

  try {
    const results = await Magnet.find({ infohash: new RegExp(infohash, 'i') }).lean().limit(1);
    const timer = Date.now() - start;
    const healthPromises = results.map(result => {
      const magnet = result.magnet + getTrackers();
      return webtorrentHealth(magnet).then(data => ({ result, data }));
    });

    const healthData = await Promise.all(healthPromises);
    const [firstResult] = healthData;
    
    res.render('single', {
      title: SITE_TITLE,
      result: firstResult.result,
      trackers: getTrackers(),
      timer,
      health: firstResult.data
    });
  } catch (err) {
    console.error('Error fetching infohash:', err);
    res.status(500).send('Internal Server Error');
  }
});

app.get('/search', async (req, res) => {
  const query = req.query.q;
  const page = parseInt(req.query.p, 10) || 0;
  const limit = 10;
  
  if (!query) {
    return res.render('searchform', { title: SITE_TITLE });
  }

  if (query.length < 3) {
    return res.render('error', { title: SITE_TITLE, error: 'You must type a longer search query.' });
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
      return webtorrentHealth(magnet).then(data => ({ result, data }));
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
      title: SITE_TITLE,
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
});

app.get('/api/count', async (req, res) => {
  try {
    const count = await Magnet.countDocuments({});
    res.send(count.toLocaleString());
  } catch (err) {
    console.error('Error fetching count:', err);
    res.status(500).send('Internal Server Error');
  }
});

// Start server
app.listen(PORT, () => {
  console.log(`Webserver is listening on port ${PORT}!`);
});
