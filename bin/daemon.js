'use strict';

/**
 * Mongoose / MongoDB
 */
const mongoose = require('mongoose');
mongoose.Promise = global.Promise;
const mongoDB = 'mongodb://127.0.0.1/magnetdb';
mongoose.connection.openUri(mongoDB);
const db = mongoose.connection;

/**
 * Mongoose Schema
 */
const magnetSchema = mongoose.Schema({
  name: String,
  infohash: {type: String, index: true},
  magnet: String,
  files: String,
  fetchedAt: Number
});

/**
 * Mongoose Model
 */
const Magnet = mongoose.model('Magnet', magnetSchema, "magnetdb");

/**
 * Redis
 */
const redis = require("redis")
const client = redis.createClient();

// Log redis errors if any.
client.on("error", (err) => {
    console.log("Error " + err);
});


/**
 * P2PSpider Configuration
 */
const P2PSpider = require('../lib');

const p2p = P2PSpider({
    nodesMaxSize: 250,
    maxConnections: 500,
    timeout: 1000
});

/**
 * Check if torrent is in DB already.
 */
p2p.ignore((infohash, rinfo, callback) => {
    // rinfo is interesting.
    client.exists('hashes:' + infohash, (err, reply) => {
        if (reply) {
            console.log('Ignored: ' + infohash);
            callback(true);
        } else {
            callback(false);
        };
    });
});

/**
 * The nitty gritty.
 */
p2p.on('metadata', (metadata, rinfo) => {

    // On metadata.
    let data = {};
    data.magnet = metadata.magnet;
    data.infohash = metadata.infohash;
    data.name = metadata.info.name ? metadata.info.name.toString() : '';
    data.files = 1;

    let fixfiles = new Array();
    if(metadata.info.files) {
        let files = metadata.info.files;
        files.forEach((item) => {
            fixfiles.push(item.path);
        });
    };

    // Organize some of the data
    data.files = fixfiles.sort();
    data.fetchedAt = new Date().getTime();

    // Prep mongoose model.
    let magnet = new Magnet({
        name: data.name,
        infohash: data.infohash,
        magnet: data.magnet,
        files: data.files,
        fetchedAt: data.fetchedAt
    });

    // Insert infohash to redis and to expire.
    client.set('hashes:'+ magnet.infohash, magnet.infohash, 'EX', 60 * 60 * 24);

    // Check if it is already in the DB.
    Magnet.find({infohash : magnet.infohash}, (err, result) => {
        if (!result.length) {
            // Save the model to DB.
            Magnet.save((err) => {
                if (err) throw err;
                console.log('Added: ' + data.name);
            });
        };
    });


});

process.on('uncaughtException', (err) => {
    console.log('Caught exception: ' + err);
    throw err;
});

p2p.listen(6881, '0.0.0.0');
