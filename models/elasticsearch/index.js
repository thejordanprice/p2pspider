'use strict';

const { Client } = require('@elastic/elasticsearch');
require('dotenv').config();

// Elasticsearch configuration
const USE_ELASTICSEARCH = process.env.USE_ELASTICSEARCH === 'true';
const ELASTICSEARCH_NODE = process.env.ELASTICSEARCH_NODE || 'http://localhost:9200';
const ELASTICSEARCH_INDEX = process.env.ELASTICSEARCH_INDEX || 'magnets';

let client = null;
let isConnected = false;

/**
 * Initialize Elasticsearch connection and create index if it doesn't exist
 */
async function initialize() {
  if (!USE_ELASTICSEARCH) {
    console.log('Elasticsearch is disabled in configuration.');
    return false;
  }

  try {
    console.log(`Connecting to Elasticsearch at ${ELASTICSEARCH_NODE}...`);
    client = new Client({
      node: ELASTICSEARCH_NODE,
      maxRetries: 3,
      requestTimeout: 30000
    });

    // Test the connection
    const info = await client.info();
    console.log(`Elasticsearch connected to ${info.name} cluster running on ${info.version.number}`);
    
    // Create index if it doesn't exist
    const indexExists = await client.indices.exists({ index: ELASTICSEARCH_INDEX });
    
    if (!indexExists) {
      console.log(`Creating Elasticsearch index: ${ELASTICSEARCH_INDEX}...`);
      await client.indices.create({
        index: ELASTICSEARCH_INDEX,
        body: {
          mappings: {
            properties: {
              name: { 
                type: 'text',
                analyzer: 'standard',
                fields: {
                  keyword: {
                    type: 'keyword',
                    ignore_above: 256
                  }
                }
              },
              infohash: { 
                type: 'keyword'
              },
              magnet: { 
                type: 'keyword' 
              },
              files: { 
                type: 'text',
                analyzer: 'standard'
              },
              fetchedAt: { 
                type: 'date',
                format: 'epoch_millis'
              }
            }
          }
        }
      });
      console.log(`Created Elasticsearch index: ${ELASTICSEARCH_INDEX}`);
    } else {
      console.log(`Using existing Elasticsearch index: ${ELASTICSEARCH_INDEX}`);
    }
    
    isConnected = true;
    return true;
  } catch (error) {
    console.error('Elasticsearch initialization error:', error);
    isConnected = false;
    return false;
  }
}

/**
 * Index a document in Elasticsearch
 * @param {Object} document - Document to index
 * @returns {Promise<Object>} - Elasticsearch response
 */
async function indexDocument(document) {
  if (!USE_ELASTICSEARCH || !isConnected || !client) return null;
  
  try {
    if (!document || !document.infohash) {
      console.error('Invalid document for indexing:', document);
      return null;
    }
    
    // Make sure infohash is used as the document ID for deduplication
    const result = await client.index({
      index: ELASTICSEARCH_INDEX,
      id: document.infohash,
      document: {
        name: document.name || '',
        infohash: document.infohash,
        magnet: document.magnet || '',
        files: Array.isArray(document.files) ? document.files : 
              (typeof document.files === 'string' ? [document.files] : []),
        fetchedAt: document.fetchedAt || Date.now()
      },
      refresh: true // Make document immediately searchable
    });
    
    return result;
  } catch (error) {
    console.error('Elasticsearch indexing error:', error);
    return null;
  }
}

/**
 * Search documents in Elasticsearch
 * @param {String} query - Search query
 * @param {Number} page - Page number (0-based)
 * @param {Number} size - Number of results per page
 * @returns {Promise<Object>} - Search results with count and items
 */
async function search(query, page = 0, size = 10) {
  if (!USE_ELASTICSEARCH || !isConnected || !client) return null;
  
  try {
    // Check if query is an infohash (40 hex chars)
    const isInfohash = /^[a-f0-9]{40}$/i.test(query);
    
    let searchQuery;
    if (isInfohash) {
      // Direct infohash lookup (exact match)
      searchQuery = {
        term: {
          infohash: query.toLowerCase()
        }
      };
    } else {
      // Text search with boosting for name field
      searchQuery = {
        multi_match: {
          query: query,
          fields: ['name^3', 'files'],
          type: 'best_fields',
          fuzziness: 'AUTO'
        }
      };
    }
    
    const result = await client.search({
      index: ELASTICSEARCH_INDEX,
      body: {
        query: searchQuery,
        sort: [
          { _score: 'desc' },
          { fetchedAt: 'desc' }
        ]
      },
      from: page * size,
      size: size
    });
    
    return {
      count: result.hits.total.value,
      results: result.hits.hits.map(hit => ({
        ...hit._source,
        score: hit._score
      }))
    };
  } catch (error) {
    console.error('Elasticsearch search error:', error);
    return null;
  }
}

/**
 * Get total count of documents in the index
 * @returns {Promise<Number>} - Total count of documents
 */
async function count() {
  if (!USE_ELASTICSEARCH || !isConnected || !client) return 0;
  
  try {
    const result = await client.count({
      index: ELASTICSEARCH_INDEX
    });
    
    return result.count;
  } catch (error) {
    console.error('Elasticsearch count error:', error);
    return 0;
  }
}

/**
 * Check if Elasticsearch is enabled and connected
 * @returns {Boolean} - True if Elasticsearch is enabled and connected
 */
function isElasticsearchEnabled() {
  return USE_ELASTICSEARCH && isConnected;
}

module.exports = {
  initialize,
  indexDocument,
  search,
  count,
  isElasticsearchEnabled
}; 