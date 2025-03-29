'use strict';

const fs = require('fs');
const path = require('path');

/**
 * Ensures that the data directory exists for SQLite database
 * @param {string} dbPath - Path to the SQLite database file
 */
function ensureDataDir(dbPath) {
  const dir = path.dirname(dbPath);
  if (!fs.existsSync(dir)) {
    console.log(`Creating directory: ${dir}`);
    fs.mkdirSync(dir, { recursive: true });
  }
}

module.exports = ensureDataDir; 