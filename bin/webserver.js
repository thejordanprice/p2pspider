'use strict';

/**
 * Web Server
 */

const site_title = 'Tordex v1.2';

/**
 * Mongoose / MongoDB
 */
const mongoose = require('mongoose');
mongoose.Promise = global.Promise;
const mongoDB = 'mongodb://127.0.0.1/magnetdb';
mongoose.connection.openUri(mongoDB);
const db = mongoose.connection;

db.on('error', console.error.bind(console, 'MongoDB connection error:'));
db.once('open', () => { console.log('MongoDB has connected.'); });

const magnetSchema = mongoose.Schema({
  name: String,
  infohash: {type: String, index: true},
  magnet: String,
  fetchedAt: Number
});

const Magnet = mongoose.model('Magnet', magnetSchema, "magnetdb");

/**
 *  Just in case.
 *  db.dropDatabase();
 **/
// db.dropDatabase();


/**
 * Setting the trackers.
 * Very handy repo below.
 * https://github.com/ngosang/trackerslist
 */
const trackers = () => {
  let string = '&tr=udp%3A%2F%2Ftracker.leechers-paradise.org%3A6969' +
  '&tr=udp%3A%2F%2Fzer0day.ch%3A1337' +
  '&tr=udp%3A%2F%2Fopen.demonii.com%3A1337' +
  '&tr=udp%3A%2F%2Ftracker.coppersurfer.tk%3A6969 ' +
  '&tr=udp%3A%2F%2Fexodus.desync.com%3A6969';
  return string;
};

/**
 * Express / Web App
 */
const express = require('express');
const path = require('path');
const app = express();

app.set('view engine', 'pug');
app.use('/public', express.static(path.join(__dirname + '/public')));

app.use((req, res, next) => {
  res.locals.ip = req.headers['x-forwarded-for'] || req.connection.remoteAddress;
  console.log('\x1b[36m%s\x1b[0m', 'FROM: ' + res.locals.ip + ' ON: ' + req.originalUrl);
  next();
});

if (app.get('env') === 'development') {
  app.locals.pretty = true;
};

/**
 * Routing / Pages
 */
app.get('/', (req, res) => {
  Magnet.count({}, (err, count) => {
    // format number with commas
    let localecount = count.toLocaleString();
    // render home page
    res.render(
      'index',
      { title: site_title, count: localecount }
    );
  });
});

app.get('/latest', (req, res) => {
  Magnet.find({}, (err,results) => {
    res.render(
      'search',
      { title: site_title, results: results, trackers: trackers() }
    );
  }).limit(25).sort({ 'fetchedAt': -1 });
});

app.get('/statistics', (req, res) => {
  db.db.stats({scale: 1048576}, (err, stats) => {
    console.log(stats);
    res.render(
      'statistics',
      { title: site_title, statistics: stats }
    );
  });
});

app.get('/infohash', (req,res) => {
  var infohash = new RegExp(req.query.q, 'i');
  if(req.query.q.length !== 40) {
    // display error
    res.render(
      'error',
      { title: site_title, error: "Incorrect infohash length." }
    );
  } else {
    // find search query
    Magnet.find({infohash: infohash}, (err,results) => {
      res.render(
        'single',
        { title: site_title, result: results, trackers: trackers() }
      );
    }).limit(25).sort({ 'fetchedAt': -1 });
  };
});

app.get('/search', (req,res) => {
  if(!req.query.q) {
    // display search page
    res.render(
      'searchform',
      { title: site_title }
    );
  } else {
    var searchqueryregex = new RegExp(req.query.q, 'i');
    if(req.query.q.length < 3) {
      // display error
      res.render(
        'error',
        { title: site_title, error: "You must type a longer search query." }
      );
    } else {
      // find search query
      const options = {
        page: req.query.p || 0,
        limit: 10
      };
      // count total, then start pagination
      Magnet.count({name: searchqueryregex}, (err, count) => {
        Magnet.find({name: searchqueryregex}) 
        .skip(options.page * options.limit)
        .limit(options.limit)
        .exec((err, results) => {
          // a little organizing for page variables
          let pages = {};
          pages.query = searchqueryregex.toString().split('/')[1];
          pages.results = count;
          pages.available = Math.ceil((count / options.limit) - 1);
          pages.current = parseInt(options.page);
          pages.previous = pages.current - 1;
          pages.next = pages.current + 1;
          // render our paginated feed of magnets
          // pagesdebug is handy for debugging.
          res.render(
            'search',
            { title: site_title, results: results, trackers: trackers(), /* pagesdebug: JSON.stringify(pages, null, 2),*/ pages: pages}
          );
        });
      });
    };
  };
});

app.get('/api/count', (req, res) => {
  Magnet.count({}, (err, count) => {
    // format number with commas
    let localecount = count.toLocaleString();
    // send the count
    res.send(localecount);
  });
});

/**
 * Start Express
 */
app.listen(8080, () => {
  console.log('Webserver is listening on port 8080!');
});
