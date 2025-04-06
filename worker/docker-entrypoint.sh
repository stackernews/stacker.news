#!/bin/bash

if [[ "$COMPOSE_PROFILES" == *"search"* ]]; then
  # Wait until opensearch container is healthy
  until curl -sS "$OPENSEARCH_URL/_cat/health?h=status" -ku admin:${OPENSEARCH_INITIAL_ADMIN_PASSWORD} | grep -q "green\|yellow"; do
    echo "Waiting for OpenSearch container to be ready"
    sleep 1
  done  
  # Wait until index is ready
  until [[ $(curl -sS -o /dev/null -w "%{http_code}" -I "$OPENSEARCH_URL/$OPENSEARCH_INDEX" -ku admin:${OPENSEARCH_INITIAL_ADMIN_PASSWORD}) -eq 200 ]]; do
    echo "Waiting for OpenSearch index to be ready"
    sleep 1
  done
  # Get the model_id if OPENSEARCH_INDEX=item-nlp
  if [[ "$OPENSEARCH_INDEX" == "item-nlp" ]]; then
    response=$(curl -s -X POST "$OPENSEARCH_URL/_plugins/_ml/models/_search" \
      -H "Content-Type: application/json" \
      -d '{
        "query": {
          "bool": {
            "must": [
              {"term":{"name.keyword":"'"$OPENSEARCH_MODEL_NAME"'"}}
            ]}}}')
    exists=$(echo "$response" | jq -r '.hits.total.value')
    if [ "$exists" -gt 0 ]; then
      OPENSEARCH_MODEL_ID=$(echo "$response" | jq -r '.hits.hits[0]._id')
      echo "OPENSEARCH_MODEL_ID=$OPENSEARCH_MODEL_ID"
      export OPENSEARCH_MODEL_ID
    else
      echo "Error: OpenSearch model not found."
      exit 1
    fi
  fi
fi

exec "$@"