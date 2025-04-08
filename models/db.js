'use strict';

const mongoose = require('mongoose');
const sqlite3 = require('sqlite3').verbose();
const fs = require('fs');
const path = require('path');
const ensureDataDir = require('../utils/ensureDataDir');

// Database configuration
const DB_TYPE = process.env.DB_TYPE || 'mongodb';
const MONGO_URI = process.env.MONGO_URI;
const SQLITE_PATH = process.env.SQLITE_PATH || './data/magnet.db';

// Ensure data directory exists for SQLite
if (DB_TYPE === 'sqlite') {
  ensureDataDir(SQLITE_PATH);
}

// Define Mongoose Schema
const magnetSchema = new mongoose.Schema({
  name: { type: String, index: true },
  infohash: { type: String, index: true },
  magnet: String,
  files: [String],
  fetchedAt: { type: Number, default: Date.now }
});

const Magnet = mongoose.model('Magnet', magnetSchema);

// Global database instance
let dbInstance = null;

// Database interface class
class Database {
  constructor() {
    this.db = null;
    this.type = DB_TYPE;
    this.connected = false;
    this.totalCount = 0; // Added counter to track total documents
    this.lastCountUpdate = 0; // Timestamp of last full count
    
    // Store this instance as the global one
    dbInstance = this;
  }

  async connect() {
    const elasticsearch = require('./elasticsearch');

    if (this.type === 'mongodb') {
      try {
        // Set connected first so routes can work immediately 
        this.connected = true;
        
        // Connect to MongoDB
        await mongoose.connect(MONGO_URI);
        console.log('MongoDB has connected.');
        
        // Initialize counter in background
        this.initializeCounter().then(() => {
          console.log('MongoDB counter initialized');
        }).catch(err => {
          console.error('Error initializing MongoDB counter:', err);
        });
        
        // Initialize Elasticsearch in background if enabled
        elasticsearch.initialize().catch(err => {
          console.error('Error initializing Elasticsearch:', err);
        });
        
        return;
      } catch (err) {
        console.error('MongoDB connection error:', err);
        this.connected = false; // Reset if connection fails
        throw err;
      }
    } else if (this.type === 'sqlite') {
      return new Promise((resolve, reject) => {
        // First set connected so routes can work immediately
        this.connected = true;
        
        this.db = new sqlite3.Database(SQLITE_PATH, (err) => {
          if (err) {
            console.error('SQLite connection error:', err);
            this.connected = false; // Reset if connection fails
            reject(err);
            return;
          }
          
          console.log('SQLite has connected.');
          
          // Run table creation in the background
          this.setupSQLiteTables().then(() => {
            // Initialize counter in background without waiting for result
            this.initializeCounter().then(() => {
              console.log('SQLite counter initialized');
            }).catch(err => {
              console.error('Error initializing SQLite counter:', err);
            });
            
            // Initialize Elasticsearch in background if enabled
            elasticsearch.initialize().catch(err => {
              console.error('Error initializing Elasticsearch:', err);
            });
            
            resolve();
          }).catch(err => {
            this.connected = false; // Reset if setup fails
            reject(err);
          });
        });
      });
    } else {
      throw new Error(`Unsupported database type: ${this.type}`);
    }
  }
  
  // Helper method to set up SQLite tables without blocking main initialization
  async setupSQLiteTables() {
    return new Promise((resolve, reject) => {
      this.db.run(`
        CREATE TABLE IF NOT EXISTS magnets (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          name TEXT,
          infohash TEXT UNIQUE,
          magnet TEXT,
          files TEXT,
          fetchedAt INTEGER
        )
      `, (err) => {
        if (err) {
          console.error('SQLite table creation error:', err);
          reject(err);
          return;
        }
        
        this.db.run('CREATE INDEX IF NOT EXISTS idx_infohash ON magnets(infohash)', (err) => {
          if (err) {
            console.error('SQLite index creation error:', err);
            reject(err);
            return;
          }
          
          this.db.run('CREATE INDEX IF NOT EXISTS idx_name ON magnets(name)', (err) => {
            if (err) {
              console.error('SQLite index creation error:', err);
              reject(err);
              return;
            }
            
            resolve();
          });
        });
      });
    });
  }
  
  // This method initializes the counter without blocking the connection
  async initializeCounter() {
    try {
      if (this.type === 'mongodb') {
        this.totalCount = await Magnet.countDocuments({});
      } else {
        this.totalCount = await new Promise((resolve, reject) => {
          this.db.get('SELECT COUNT(*) as count FROM magnets', [], (err, row) => {
            if (err) {
              console.error('SQLite count error:', err);
              reject(err);
            } else {
              resolve(row ? row.count : 0);
            }
          });
        });
      }
      
      this.lastCountUpdate = Date.now();
      console.log(`Initial document count: ${this.totalCount}`);
    } catch (err) {
      console.error('Error initializing counter:', err);
      // Set default count to 0 if there's an error
      this.totalCount = 0;
      this.lastCountUpdate = Date.now();
    }
  }

  async findOne(query) {
    if (!this.connected) await this.connect();

    if (this.type === 'mongodb') {
      return await Magnet.findOne(query).exec();
    } else {
      return new Promise((resolve, reject) => {
        this.db.get('SELECT * FROM magnets WHERE infohash = ?', [query.infohash], (err, row) => {
          if (err) {
            reject(err);
          } else {
            if (row) {
              // Convert the files string back to array
              row.files = row.files ? JSON.parse(row.files) : [];
            }
            resolve(row);
          }
        });
      });
    }
  }

  async saveMagnet(magnetData) {
    if (!this.connected) await this.connect();

    const elasticsearch = require('./elasticsearch');

    if (this.type === 'mongodb') {
      const magnetDoc = new Magnet(magnetData);
      const result = await magnetDoc.save();
      if (result) {
        this.totalCount++; // Increment counter on successful save
        
        // Index in Elasticsearch if enabled
        if (elasticsearch.isElasticsearchEnabled()) {
          elasticsearch.indexDocument(magnetData).catch(err => {
            console.error('Error indexing in Elasticsearch:', err);
          });
        }
      }
      return result;
    } else {
      return new Promise((resolve, reject) => {
        const { name, infohash, magnet, files, fetchedAt } = magnetData;
        const filesJson = JSON.stringify(files || []);
        
        this.db.run(
          'INSERT INTO magnets (name, infohash, magnet, files, fetchedAt) VALUES (?, ?, ?, ?, ?)',
          [name, infohash, magnet, filesJson, fetchedAt],
          function(err) {
            if (err) {
              // Handle UNIQUE constraint error
              if (err.code === 'SQLITE_CONSTRAINT') {
                resolve(null); // Already exists
              } else {
                reject(err);
              }
            } else {
              this.totalCount++; // Increment counter on successful save
              
              // Index in Elasticsearch if enabled
              if (elasticsearch.isElasticsearchEnabled()) {
                elasticsearch.indexDocument(magnetData).catch(err => {
                  console.error('Error indexing in Elasticsearch:', err);
                });
              }
              
              resolve({ id: this.lastID, ...magnetData });
            }
          }.bind(this) // Bind to access this.totalCount
        );
      });
    }
  }

  async countDocuments(query = {}) {
    if (!this.connected) await this.connect();

    // If it's a complex query or it's been over an hour since last full count, do a real count
    const isComplexQuery = Object.keys(query).length > 0;
    const shouldRefreshCount = Date.now() - this.lastCountUpdate > 3600000; // 1 hour
    
    if (isComplexQuery) {
      // For complex queries, we still need to do a full count
      if (this.type === 'mongodb') {
        return await Magnet.countDocuments(query);
      } else {
        return new Promise((resolve, reject) => {
          const whereClause = this.buildWhereClause(query);
          const sql = whereClause 
            ? `SELECT COUNT(*) as count FROM magnets WHERE ${whereClause}`
            : 'SELECT COUNT(*) as count FROM magnets';
            
          this.db.get(sql, [], (err, row) => {
            if (err) {
              reject(err);
            } else {
              resolve(row.count);
            }
          });
        });
      }
    } else {
      // For empty queries requesting total count, use the cached counter
      if (shouldRefreshCount) {
        // Periodically refresh the total count to ensure accuracy
        if (this.type === 'mongodb') {
          this.totalCount = await Magnet.countDocuments({});
        } else {
          this.totalCount = await new Promise((resolve, reject) => {
            this.db.get('SELECT COUNT(*) as count FROM magnets', [], (err, row) => {
              if (err) reject(err);
              else resolve(row.count);
            });
          });
        }
        this.lastCountUpdate = Date.now();
        console.log(`Refreshed document count: ${this.totalCount}`);
      }
      
      return this.totalCount;
    }
  }

  async find(query, options = {}) {
    if (!this.connected) await this.connect();

    if (this.type === 'mongodb') {
      let mongoQuery = Magnet.find(query);
      
      if (options.sort) mongoQuery = mongoQuery.sort(options.sort);
      if (options.limit) mongoQuery = mongoQuery.limit(options.limit);
      if (options.skip) mongoQuery = mongoQuery.skip(options.skip);
      if (options.projection) mongoQuery = mongoQuery.select(options.projection);
      
      // Use lean() to get plain JavaScript objects instead of Mongoose documents
      // This significantly improves performance by skipping document hydration
      return await mongoQuery.lean().exec();
    } else {
      return new Promise((resolve, reject) => {
        // Convert MongoDB-style query to SQLite
        const whereClause = this.buildWhereClause(query);
        const { sort, limit, skip, projection } = options;
        
        // Optimize the fields selection for SQLite
        let fieldSelection = '*';
        if (projection) {
          // Convert MongoDB-style projection to SQLite column selection
          const fields = [];
          for (const field in projection) {
            if (projection[field] === 1 || projection[field] === true) {
              fields.push(field);
            }
          }
          if (fields.length > 0) {
            // Always include id to ensure we have a primary key
            if (!fields.includes('id')) {
              fields.unshift('id');
            }
            fieldSelection = fields.join(', ');
          }
        }
        
        let sql = `SELECT ${fieldSelection} FROM magnets`;
        if (whereClause) sql += ` WHERE ${whereClause}`;
        
        if (sort) {
          const sortField = Object.keys(sort)[0];
          const sortOrder = sort[sortField] === 1 ? 'ASC' : 'DESC';
          sql += ` ORDER BY ${sortField} ${sortOrder}`;
        }
        
        if (limit) sql += ` LIMIT ${limit}`;
        if (skip) sql += ` OFFSET ${skip}`;
        
        this.db.all(sql, [], (err, rows) => {
          if (err) {
            reject(err);
          } else {
            // Convert files string to array for each row
            rows.forEach(row => {
              if (row.files && typeof row.files === 'string') {
                try {
                  row.files = JSON.parse(row.files);
                } catch (e) {
                  row.files = [];
                }
              }
            });
            resolve(rows);
          }
        });
      });
    }
  }

  buildWhereClause(query) {
    if (Object.keys(query).length === 0) return '';
    
    const clauses = [];
    for (const key in query) {
      const value = query[key];
      
      if (typeof value === 'string') {
        // Check if value contains % for LIKE queries
        if (value.includes('%')) {
          clauses.push(`${key} LIKE '${value}'`);
        } else {
          clauses.push(`${key} = '${value}'`);
        }
      } else if (typeof value === 'number') {
        clauses.push(`${key} = ${value}`);
      }
    }
    
    return clauses.join(' AND ');
  }

  async removeMagnet(query) {
    if (!this.connected) await this.connect();

    if (this.type === 'mongodb') {
      const result = await Magnet.deleteOne(query);
      if (result.deletedCount > 0) {
        this.totalCount--;
      }
      return result;
    } else {
      return new Promise((resolve, reject) => {
        const whereClause = this.buildWhereClause(query);
        if (!whereClause) {
          resolve({ deleted: 0 }); // Safety check
          return;
        }
        
        this.db.run(
          `DELETE FROM magnets WHERE ${whereClause}`,
          function(err) {
            if (err) {
              reject(err);
            } else {
              const deleted = this.changes;
              if (deleted > 0) {
                this.totalCount -= deleted;
              }
              resolve({ deleted });
            }
          }.bind(this) // Bind to access this.totalCount
        );
      });
    }
  }

  // Utility method for forcing a refresh of the counter
  async refreshCounter() {
    if (!this.connected) await this.connect();
    
    if (this.type === 'mongodb') {
      this.totalCount = await Magnet.countDocuments({});
    } else {
      this.totalCount = await new Promise((resolve, reject) => {
        this.db.get('SELECT COUNT(*) as count FROM magnets', [], (err, row) => {
          if (err) reject(err);
          else resolve(row.count);
        });
      });
    }
    
    this.lastCountUpdate = Date.now();
    console.log(`Refreshed document count: ${this.totalCount}`);
    return this.totalCount;
  }
}

// Export the class
module.exports = {
  Database,
  
  // Function to get existing database instance
  getDatabase: () => dbInstance
}; 