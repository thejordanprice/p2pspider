#!/bin/bash

# WARNING: This script deletes data from the database, Redis, and Elasticsearch.
# Make sure you understand what it does before running.

# --- Configuration ---
# Load .env file if it exists in the current directory
if [ -f .env ]; then
  echo "Loading environment variables from .env file..."
  export $(grep -v '^#' .env | xargs)
fi

# Use environment variables or defaults from project files
DB_TYPE=${DB_TYPE:-sqlite} # Get DB type (though we only handle sqlite deletion here)
SQLITE_DB_PATH=${SQLITE_PATH:-./data/magnet.db}
REDIS_URI=${REDIS_URI:-redis://127.0.0.1:6379} # Default if not in .env
ELASTICSEARCH_NODE=${ELASTICSEARCH_NODE:-http://localhost:9200} # Default if not in .env
ELASTICSEARCH_INDEX=${ELASTICSEARCH_INDEX:-magnets} # Default if not in .env

# Elasticsearch index mapping (copied from models/elasticsearch/index.js)
ES_MAPPING='{
  "mappings": {
    "properties": {
      "name": {
        "type": "text",
        "analyzer": "standard",
        "fields": {
          "keyword": {
            "type": "keyword",
            "ignore_above": 256
          }
        }
      },
      "infohash": {
        "type": "keyword"
      },
      "magnet": {
        "type": "keyword"
      },
      "files": {
        "type": "text",
        "analyzer": "standard"
      },
      "fetchedAt": {
        "type": "date",
        "format": "epoch_millis"
      }
    }
  }
}'

# --- Safety Check ---
read -p "This script will DELETE ALL data in SQLite DB (${SQLITE_DB_PATH}), Redis (${REDIS_URI}), and ES Index (${ELASTICSEARCH_NODE}/${ELASTICSEARCH_INDEX}). Are you sure? (y/N): " confirm && [[ $confirm == [yY] || $confirm == [yY][eE][sS] ]] || exit 1

# --- Actions ---

# 1. Delete Database Files
if [ "$DB_TYPE" = "sqlite" ]; then
  echo "1. Deleting SQLite database files (${SQLITE_DB_PATH}*)..."
  # Extract directory from path
  DB_DIR=$(dirname "$SQLITE_DB_PATH")
  DB_BASE=$(basename "$SQLITE_DB_PATH")
  # Remove base file and potential journal/wal files (-v for verbose, -f to ignore non-existent)
  rm -vf "$DB_DIR/$DB_BASE"*
  echo "SQLite files removed."
else
  echo "1. Skipping database file deletion (DB_TYPE is not sqlite)."
fi
echo "---"

# 2. Clear Redis
echo "2. Clearing Redis database (FLUSHALL on ${REDIS_URI})..."
# Use -u URI if available
# Note: Requires redis-cli that supports -u flag. Might need adjustment based on version.
if redis-cli -u "$REDIS_URI" PING > /dev/null 2>&1; then
  redis-cli -u "$REDIS_URI" FLUSHALL
  if [ $? -eq 0 ]; then
    echo "Redis flushed successfully using URI: $REDIS_URI"
  else
    echo "Error: Failed to flush Redis using URI: $REDIS_URI"
  fi
elif redis-cli PING > /dev/null 2>&1; then 
  echo "Warning: Could not ping Redis with URI, trying default connection (127.0.0.1:6379)..."
  redis-cli FLUSHALL
  if [ $? -eq 0 ]; then
    echo "Redis flushed successfully using default connection."
  else
    echo "Error: Failed to flush Redis using default connection."
  fi
else
  echo "Error: Failed to connect to Redis (tried URI and default). Skipping flush."
fi
echo "---"

# 3. Delete Elasticsearch Index
echo "3. Deleting Elasticsearch index: ${ELASTICSEARCH_NODE}/${ELASTICSEARCH_INDEX}..."
# Define the simple delete URL
DELETE_URL="${ELASTICSEARCH_NODE}/${ELASTICSEARCH_INDEX}"
# Pass the variable with double quotes (no -g needed now)
DELETE_STATUS=$(curl -s -o /dev/null -w "%{http_code}" -XDELETE "$DELETE_URL")
# Check only for 200 (success) or allow 404 (already deleted) as acceptable
if [ "$DELETE_STATUS" = "200" ]; then
  echo "Elasticsearch index deleted successfully. Status: $DELETE_STATUS"
elif [ "$DELETE_STATUS" = "404" ]; then 
  echo "Elasticsearch index did not exist. Status: $DELETE_STATUS"
else
  echo "Error deleting Elasticsearch index. Status: $DELETE_STATUS"
  # Use double quotes here too
  curl -XDELETE "$DELETE_URL" # Show error output
fi
echo "---"

# 4. Recreate Elasticsearch Index
echo "4. Recreating Elasticsearch index: ${ELASTICSEARCH_NODE}/${ELASTICSEARCH_INDEX}..."
CREATE_URL="${ELASTICSEARCH_NODE}/${ELASTICSEARCH_INDEX}"
CREATE_STATUS=$(curl -s -o /dev/null -w "%{http_code}" -XPUT "$CREATE_URL" -H 'Content-Type: application/json' -d "$ES_MAPPING")
if [ "$CREATE_STATUS" = "200" ]; then
  echo "Elasticsearch index recreated successfully. Status: $CREATE_STATUS"
else
  echo "Error recreating Elasticsearch index. Status: $CREATE_STATUS"
  curl -XPUT "$CREATE_URL" -H 'Content-Type: application/json' -d "$ES_MAPPING"
fi
echo "---"

echo "Reset script finished." 