'use strict';

const crypto = require('crypto');

const randomID = () => crypto.createHash('sha1').update(crypto.randomBytes(20)).digest();

const decodeNodes = (data) => {
    const nodes = [];
    for (let i = 0; i + 26 <= data.length; i += 26) {
        nodes.push({
            nid: data.slice(i, i + 20),
            address: `${data[i + 20]}.${data[i + 21]}.${data[i + 22]}.${data[i + 23]}`,
            port: data.readUInt16BE(i + 24)
        });
    }
    return nodes;
};

const genNeighborID = (target, nid) => Buffer.concat([target.slice(0, 10), nid.slice(10)]);

module.exports = { randomID, decodeNodes, genNeighborID };
