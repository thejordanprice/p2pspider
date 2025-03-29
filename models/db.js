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

// Database interface class
class Database {
  constructor() {
    this.db = null;
    this.type = DB_TYPE;
    this.connected = false;
  }

  async connect() {
    if (this.type === 'mongodb') {
      try {
        await mongoose.connect(MONGO_URI);
        this.connected = true;
        console.log('MongoDB has connected.');
      } catch (err) {
        console.error('MongoDB connection error:', err);
        throw err;
      }
    } else if (this.type === 'sqlite') {
      return new Promise((resolve, reject) => {
        this.db = new sqlite3.Database(SQLITE_PATH, (err) => {
          if (err) {
            console.error('SQLite connection error:', err);
            reject(err);
          } else {
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
              } else {
                this.db.run('CREATE INDEX IF NOT EXISTS idx_infohash ON magnets(infohash)', (err) => {
                  if (err) {
                    console.error('SQLite index creation error:', err);
                    reject(err);
                  } else {
                    this.db.run('CREATE INDEX IF NOT EXISTS idx_name ON magnets(name)', (err) => {
                      if (err) {
                        console.error('SQLite index creation error:', err);
                        reject(err);
                      } else {
                        this.connected = true;
                        console.log('SQLite has connected.');
                        resolve();
                      }
                    });
                  }
                });
              }
            });
          }
        });
      });
    } else {
      throw new Error(`Unsupported database type: ${this.type}`);
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

    if (this.type === 'mongodb') {
      const magnetDoc = new Magnet(magnetData);
      return await magnetDoc.save();
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
              resolve({ id: this.lastID, ...magnetData });
            }
          }
        );
      });
    }
  }

  async countDocuments(query = {}) {
    if (!this.connected) await this.connect();

    if (this.type === 'mongodb') {
      return await Magnet.countDocuments(query);
    } else {
      return new Promise((resolve, reject) => {
        this.db.get('SELECT COUNT(*) as count FROM magnets', [], (err, row) => {
          if (err) {
            reject(err);
          } else {
            resolve(row.count);
          }
        });
      });
    }
  }

  async find(query, options = {}) {
    if (!this.connected) await this.connect();

    if (this.type === 'mongodb') {
      let mongoQuery = Magnet.find(query);
      
      if (options.sort) mongoQuery = mongoQuery.sort(options.sort);
      if (options.limit) mongoQuery = mongoQuery.limit(options.limit);
      if (options.skip) mongoQuery = mongoQuery.skip(options.skip);
      
      return await mongoQuery.exec();
    } else {
      return new Promise((resolve, reject) => {
        // Convert MongoDB-style query to SQLite
        const whereClause = this.buildWhereClause(query);
        const { sort, limit, skip } = options;
        
        let sql = 'SELECT * FROM magnets';
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
              row.files = row.files ? JSON.parse(row.files) : [];
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
}

module.exports = {
  Database,
  Magnet // Export for backward compatibility
}; 