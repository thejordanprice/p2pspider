'use strict';

/**
 * Web Server
 */

const site_title = 'Tordex v1.2';

/**
 * Mongoose / MongoDB
 */
const mongoose = require('mongoose');
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

/*
 * Parser to add more metadata into the array before passing it into pug.
 * This needs to be moved but its here for temporary.
 */
const parseResults = (results, callback) => {
  let trackers = +
  '&tr=udp%3A%2F%2Ftracker.leechers-paradise.org%3A6969' +
  '&tr=udp%3A%2F%2Fzer0day.ch%3A1337' +
  '&tr=udp%3A%2F%2Fopen.demonii.com%3A1337' +
  '&tr=udp%3A%2F%2Ftracker.coppersurfer.tk%3A6969 ' +
  '&tr=udp%3A%2F%2Fexodus.desync.com%3A6969';
  let newResults = new Array();
  for (item in results) {
    let thing = results[item];
    let data = [];
    data = {
      _id: thing._id,
      name: thing.name,
      infohash: thing.infohash,
      magnet: thing.magnet,
      files: thing.files,
      fetchedAt: thing.fetchedAt,
      trackers: trackers,
      timestring: new Date(thing.fetchedAt),
      magneturi: thing.magnet + '&dn=' + thing.name + trackers,
    };
    newResults.push(data);
  };
  callback(newResults);
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
  console.log('FROM: ' + res.locals.ip + ' ON: ' + req.originalUrl);
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
    // render home page
    res.render(
      'index',
      { title: site_title, count: count }
    );
  });
});

app.get('/latest', (req, res) => {
  Magnet.find({}, (err,results) => {
    res.render(
      'search',
      { title: site_title, results: results }
    );
  }).limit(25).sort({ 'fetchedAt': -1 });
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
        { title: site_title, result: results }
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
        { title: site_title, error: "Type a longer search query." }
      );
    } else {
      // find search query
      Magnet.find({name: searchqueryregex}, (err,results) => {
        res.render(
          'search',
          { title: site_title, results: results }
        );
      });
    };
  };
});

/**
 * Start Express
 */
app.listen(8080, () => {
  console.log('Webserver is listening on port 8080!');
});
