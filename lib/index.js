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
        this.udpServer = null;
        this.btclient = null;
        this.intervalId = null;
    }

    ignore(ignore) {
        this._ignore = ignore;
    }

    listen(port = 6881, address = '0.0.0.0') {
        this.port = port;
        this.address = address;

        this.btclient = new BTClient({
            timeout: this.options.timeout || 10000,
            ignore: this._ignore,
            maxConnections: this.options.maxConnections
        });

        this.btclient.on('complete', (metadata, infohash, rinfo) => {
            const _metadata = { ...metadata, address: rinfo.address, port: rinfo.port, infohash: infohash.toString('hex') };
            _metadata.magnet = `magnet:?xt=urn:btih:${_metadata.infohash}`;
            this.emit('metadata', _metadata);
        });

        const dhtSpider = DHTSpider.start({
            btclient: this.btclient,
            address: this.address,
            port: this.port,
            nodesMaxSize: this.options.nodesMaxSize || 4000
        });

        // Store reference to UDP server for cleanup
        if (dhtSpider && dhtSpider.udp) {
            this.udpServer = dhtSpider.udp;
        }
    }

    close(callback) {
        if (this.udpServer) {
            try {
                this.udpServer.close(() => {
                    console.log('UDP server closed');
                    if (callback && typeof callback === 'function') {
                        callback();
                    }
                });
            } catch (err) {
                console.error('Error closing UDP server:', err);
                if (callback && typeof callback === 'function') {
                    callback(err);
                }
            }
        } else {
            console.log('No UDP server to close');
            if (callback && typeof callback === 'function') {
                callback();
            }
        }
    }
}

module.exports = P2PSpider;
