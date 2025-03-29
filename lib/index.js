'use strict';

const EventEmitter = require('events');
const util = require('util');
const DHTSpider = require('./dhtspider');
const BTClient = require('./btclient');

class P2PSpider extends EventEmitter {
    constructor(options = {}) {
        super();
        this.options = options;
        this._ignore = undefined;
    }

    ignore(ignore) {
        this._ignore = ignore;
    }

    listen(port = 6881, address = '0.0.0.0') {
        this.port = port;
        this.address = address;

        const btclient = new BTClient({
            timeout: this.options.timeout || 10000,
            ignore: this._ignore,
            maxConnections: this.options.maxConnections
        });

        btclient.on('complete', (metadata, infohash, rinfo) => {
            const _metadata = { ...metadata, address: rinfo.address, port: rinfo.port, infohash: infohash.toString('hex') };
            _metadata.magnet = `magnet:?xt=urn:btih:${_metadata.infohash}`;
            this.emit('metadata', _metadata);
        });

        DHTSpider.start({
            btclient,
            address: this.address,
            port: this.port,
            nodesMaxSize: this.options.nodesMaxSize || 4000
        });
    }
}

module.exports = P2PSpider;
