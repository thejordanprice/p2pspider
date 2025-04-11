'use strict';

const { Database, getDatabase } = require('../models/db');

/**
 * Database initialization
 */
async function initializeDatabase() {
  // Check if database is already initialized by controller
  const existingDb = getDatabase();
  
  if (existingDb && existingDb.connected) {
    console.log(`Using existing database (${existingDb.type}) connection.`);
    return existingDb;
  }
  
  const db = new Database();
  await db.connect()
    .then(() => console.log(`Database (${db.type}) is connected.`))
    .catch(err => {
        console.error(`Database connection error:`, err);
        // Consider exiting if the database connection is critical and fails
        process.exit(1); 
    });
  return db;
}

module.exports = { initializeDatabase }; 