'use strict';

const P2PSpider = require('../lib');

// P2PSpider Configuration
const p2p = P2PSpider({
  nodesMaxSize: 250,
  maxConnections: 500,
  timeout: 1000
});

// Handle metadata event
p2p.on('metadata', (metadata, rinfo) => {
  console.log('Received metadata:', metadata);
  console.log('Remote info:', rinfo);
});

// Start listening for connections
p2p.listen(6881, '0.0.0.0', () => {
  console.log('P2PSpider is listening on port 6881');
});
