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
    
    // Process files to ensure they're in a consistent format for indexing
    let processedFiles;
    
    if (document.files) {
      if (Array.isArray(document.files)) {
        // If already an array, keep as is
        processedFiles = document.files;
      } else if (typeof document.files === 'string') {
        // If JSON string, try to parse it
        try {
          const parsed = JSON.parse(document.files);
          processedFiles = Array.isArray(parsed) ? parsed : document.files.split(',').map(f => f.trim()).filter(f => f);
        } catch (e) {
          // If not valid JSON, treat as comma-separated string
          processedFiles = document.files.split(',').map(f => f.trim()).filter(f => f);
        }
      } else {
        // Fallback
        processedFiles = [String(document.files)];
      }
    } else {
      processedFiles = [];
    }
    
    // Transform processedFiles into a single string of paths for indexing
    let filesString = '';
    if (Array.isArray(processedFiles)) {
        // Check if the first element looks like a file object (has path/size)
        if (processedFiles.length > 0 && typeof processedFiles[0] === 'object' && processedFiles[0] !== null && ('path' in processedFiles[0] || 'size' in processedFiles[0])) {
            // Extract paths and join with newline
            filesString = processedFiles.map(file => (typeof file === 'object' && file !== null && file.path) ? file.path : String(file)).join('\n'); 
        } else {
            // Assume it's an array of strings already (or simple values)
            filesString = processedFiles.map(String).join('\n');
        }
    } else if (typeof processedFiles === 'string') {
        // It might already be a string from the previous processing steps
        filesString = processedFiles;
    } // If processedFiles was something else (e.g., empty array), filesString remains ''

    // Make sure infohash is used as the document ID for deduplication
    const result = await client.index({
      index: ELASTICSEARCH_INDEX,
      id: document.infohash,
      document: {
        name: document.name || '',
        infohash: document.infohash,
        magnet: document.magnet || '',
        files: filesString, // Use the transformed string here
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
    
    // Process results to ensure file data is in the right format
    const processedResults = result.hits.hits.map(hit => {
      const source = hit._source;
      
      // Ensure files is always an array
      if (source.files) {
        if (!Array.isArray(source.files)) {
          // If files is not an array, try to parse it or convert it
          if (typeof source.files === 'string') {
            // If it's a JSON string, try to parse it
            try {
              const parsed = JSON.parse(source.files);
              source.files = Array.isArray(parsed) ? parsed : [source.files];
            } catch (e) {
              // If parsing fails, treat it as a comma-separated string
              source.files = source.files.split(',').map(f => f.trim()).filter(f => f);
            }
          } else {
            // Fallback to a simple array with the original value
            source.files = [String(source.files)];
          }
        }
      } else {
        // If files is missing or null, initialize as empty array
        source.files = [];
      }
      
      return {
        ...source,
        score: hit._score
      };
    });
    
    return {
      count: result.hits.total.value,
      results: processedResults
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