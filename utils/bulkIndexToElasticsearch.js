'use strict';

require('dotenv').config();
const { getDatabase } = require('../models/db');
const elasticsearch = require('../models/elasticsearch');

const BATCH_SIZE = 1000; // Process in batches to avoid memory issues

/**
 * Index all existing magnets from the database into Elasticsearch
 */
async function bulkIndexAll() {
  try {
    console.log('Starting Elasticsearch bulk indexing process...');
    
    // Initialize Elasticsearch
    const esInitialized = await elasticsearch.initialize();
    if (!esInitialized) {
      console.error('Failed to initialize Elasticsearch. Please check your connection settings.');
      process.exit(1);
    }
    
    // Get database instance
    const db = getDatabase();
    await db.connect();
    
    // Get total count for progress tracking
    const totalCount = db.totalCount;
    console.log(`Found ${totalCount.toLocaleString()} documents to index`);
    
    let indexed = 0;
    let skip = 0;
    let successCount = 0;
    let errorCount = 0;
    
    // Process in batches
    while (true) {
      console.log(`Processing batch starting at offset ${skip}...`);
      
      // Fetch batch from database
      const batch = await db.find({}, { 
        skip: skip, 
        limit: BATCH_SIZE,
        sort: { fetchedAt: -1 } 
      });
      
      if (!batch || batch.length === 0) {
        console.log('No more documents found. Indexing complete.');
        break;
      }
      
      console.log(`Indexing batch of ${batch.length} documents...`);
      
      // Process each document in the batch
      const promises = batch.map(async (doc) => {
        try {
          await elasticsearch.indexDocument(doc);
          return { success: true };
        } catch (err) {
          return { 
            success: false, 
            error: err.message,
            infohash: doc.infohash 
          };
        }
      });
      
      // Wait for all promises to resolve
      const results = await Promise.all(promises);
      
      // Count results
      const batchSuccess = results.filter(r => r.success).length;
      const batchError = results.filter(r => !r.success).length;
      
      successCount += batchSuccess;
      errorCount += batchError;
      indexed += batch.length;
      
      const progress = Math.round((indexed / totalCount) * 100);
      console.log(`Progress: ${progress}% (${indexed.toLocaleString()}/${totalCount.toLocaleString()}) - Success: ${successCount}, Errors: ${errorCount}`);
      
      // Prepare for next batch
      skip += BATCH_SIZE;
    }
    
    console.log('Bulk indexing complete!');
    console.log(`Total documents processed: ${indexed.toLocaleString()}`);
    console.log(`Successfully indexed: ${successCount.toLocaleString()}`);
    console.log(`Failed to index: ${errorCount.toLocaleString()}`);
    
    // Exit the process
    process.exit(0);
  } catch (error) {
    console.error('Bulk indexing failed:', error);
    process.exit(1);
  }
}

// Run the bulk indexing function
bulkIndexAll(); 