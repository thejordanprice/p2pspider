'use strict';

class PeerQueue {
    constructor(maxSize = 200, perLimit = 10) {
        this.maxSize = maxSize;
        this.perLimit = perLimit;
        this.peers = {};
        this.reqs = [];
    }

    _shift() {
        if (this.length() > 0) {
            const req = this.reqs.shift();
            this.peers[req.infohash.toString('hex')] = [];
            return req;
        }
    }

    push(peer) {
        const infohashHex = peer.infohash.toString('hex');
        const peers = this.peers[infohashHex];

        if (peers && peers.length < this.perLimit) {
            peers.push(peer);
        } else if (this.length() < this.maxSize) {
            this.reqs.push(peer);
        }
    }

    shift(infohash, successful) {
        if (infohash) {
            const infohashHex = infohash.toString('hex');
            if (successful === true) {
                delete this.peers[infohashHex];
            } else {
                const peers = this.peers[infohashHex];
                if (peers) {
                    if (peers.length > 0) {
                        return peers.shift();
                    } else {
                        delete this.peers[infohashHex];
                    }
                }
            }
        }
        return this._shift();
    }

    length() {
        return this.reqs.length;
    }
}

module.exports = PeerQueue;
