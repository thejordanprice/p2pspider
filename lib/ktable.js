'use strict';

const utils = require('./utils');

class KTable {
    constructor(maxsize) {
        this.nid = utils.randomID();
        this.nodes = [];
        this.maxsize = maxsize;
    }

    push(node) {
        if (this.nodes.length < this.maxsize) {
            this.nodes.push(node);
        }
    }
}

module.exports = KTable;
