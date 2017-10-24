'use strict';

/**
 * Mongoose / MongoDB
 */
var mongoose = require('mongoose');
var mongoDB = 'mongodb://127.0.0.1/magnetdb';
mongoose.connect(mongoDB);

var db = mongoose.connection;

var magnetSchema = mongoose.Schema({
  name: String,
  infohash: {type: String, index: true},
  magnet: String,
  files: String,
  fetchedAt: Number
});

var Magnet = mongoose.model('Magnet', magnetSchema, "magnetdb");

/**
 * P2PSpider Configuration
 */
var P2PSpider = require('../lib');

var p2p = P2PSpider({
    nodesMaxSize: 250,
    maxConnections: 500,
    timeout: 1000
});

/**
 * Check if torrent is in DB already.
 */
p2p.ignore(function (infohash, rinfo, callback) {
    // rinfo is interesting.
    Magnet.find({infohash : infohash}, function (err, result) {
        if (result.length) {
            callback(true);
        } else {
            callback(false);
        };
    });
});

/**
 * The nitty gritty.
 */
p2p.on('metadata', function (metadata, rinfo) {

    // On metadata.
    var data = {};
    data.magnet = metadata.magnet;
    data.infohash = metadata.infohash;
    data.name = metadata.info.name ? metadata.info.name.toString() : '';
    data.files = 1;

    var fixfiles = new Array();
    if(metadata.info.files) {
        var files = metadata.info.files;
        files.forEach(function(item) {
            fixfiles.push(item.path);
        });
    }

    if(fixfiles == '') {
        fixfiles = 1;
    }

    data.files = fixfiles;
    data.fetchedAt = new Date().getTime();

    // Prep mongoose model.
    var magnet = new Magnet({
        name: data.name,
        infohash: data.infohash,
        magnet: data.magnet,
        files: data.files,
        fetchedAt: data.fetchedAt
    });

    // Save the model to DB.
    magnet.save(function(err){
        if(err) throw err;
        console.log('Added: ' + data.name);
    });

});

p2p.listen(6881, '0.0.0.0');
