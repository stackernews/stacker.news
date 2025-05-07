#!/bin/bash

set -m

/usr/share/opensearch/opensearch-docker-entrypoint.sh &

# ---- Wait for OpenSearch to start

until curl -sS "http://localhost:9200/_cat/health?h=status" -ku admin:${OPENSEARCH_INITIAL_ADMIN_PASSWORD} | grep -q "green\|yellow"; do
  echo "Waiting for OpenSearch to start..."
  sleep 1
done

# ---- If index doesn't exist, create it with default settings

index_exists=$(curl -s -o /dev/null -w "%{http_code}" -I "http://localhost:9200/$OPENSEARCH_INDEX")

if [ "$index_exists" -eq 200 ]; then
  echo "OpenSearch index $OPENSEARCH_INDEX already exists."
else
  curl \
    -H "Content-Type: application/json" \
    -X PUT \
    -d '{
      "settings": {
        "analysis": {
          "analyzer": {
            "exact_case_sensitive_analyzer": {
              "tokenizer": "standard",
              "filter": []
            }
          }
        }
      },
      "mappings": {
        "properties": {
          "text": {
            "type": "text",
            "analyzer": "english",
            "fields": {
              "keyword": {"type": "keyword", "ignore_above": 256},
              "exact": {
                "type": "text",
                "analyzer": "exact_case_sensitive_analyzer"
              }
            }
          },
          "title": {
            "type": "text",
            "analyzer": "english",
            "fields": {
              "keyword": {"type": "keyword", "ignore_above": 256},
              "exact": {
                "type": "text",
                "analyzer": "exact_case_sensitive_analyzer"
              }
            }
          }
        }
      }
    }' \
    "http://localhost:9200/$OPENSEARCH_INDEX" \
    -ku admin:${OPENSEARCH_INITIAL_ADMIN_PASSWORD}
  echo ""
  echo "OpenSearch index $OPENSEARCH_INDEX created."
fi

fg
