'use strict';

const EventEmitter = require('events');
const net = require('net');

const PeerQueue = require('./peer-queue');
const Wire = require('./wire');

class BTClient extends EventEmitter {
    constructor(options) {
        super();

        this.timeout = options.timeout;
        this.maxConnections = options.maxConnections || 200;
        this.activeConnections = 0;
        this.peers = new PeerQueue(this.maxConnections);
        this.on('download', this._download.bind(this));

        if (typeof options.ignore === 'function') {
            this.ignore = options.ignore;
        } else {
            this.ignore = (infohash, rinfo, ignore) => {
                ignore(false);
            };
        }
    }

    _next(infohash, successful) {
        const req = this.peers.shift(infohash, successful);
        if (req) {
            this.ignore(req.infohash.toString('hex'), req.rinfo, (drop) => {
                if (!drop) {
                    this.emit('download', req.rinfo, req.infohash);
                }
            });
        }
    }

    _download(rinfo, infohash) {
        this.activeConnections++;

        let successful = false;
        const socket = new net.Socket();

        socket.setTimeout(this.timeout || 5000);

        socket.connect(rinfo.port, rinfo.address, () => {
            const wire = new Wire(infohash);
            socket.pipe(wire).pipe(socket);

            wire.on('metadata', (metadata, infoHash) => {
                successful = true;
                this.emit('complete', metadata, infoHash, rinfo);
                socket.destroy();
            });

            wire.on('fail', () => {
                socket.destroy();
            });

            wire.sendHandshake();
        });

        socket.on('error', () => {
            socket.destroy();
        });

        socket.on('timeout', () => {
            socket.destroy();
        });

        socket.once('close', () => {
            this.activeConnections--;
            this._next(infohash, successful);
        });
    }

    add(rinfo, infohash) {
        this.peers.push({ infohash, rinfo });
        if (this.activeConnections < this.maxConnections && this.peers.length() > 0) {
            this._next();
        }
    }

    isIdle() {
        return this.peers.length() === 0;
    }
}

module.exports = BTClient;
