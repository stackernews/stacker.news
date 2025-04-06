#!/bin/bash

set -m

/usr/share/opensearch/opensearch-docker-entrypoint.sh &

# ---- Wait for OpenSearch to start

until curl -sS "http://localhost:9200/_cat/health?h=status" -ku admin:${OPENSEARCH_INITIAL_ADMIN_PASSWORD} | grep -q "green\|yellow"; do
  echo "Waiting for OpenSearch to start..."
  sleep 1
done

# ---- If index doesn't exist, create it

index_exists=$(curl -s -o /dev/null -w "%{http_code}" -I "http://localhost:9200/$OPENSEARCH_INDEX")

if [ "$index_exists" -eq 200 ]; then
  echo "OpenSearch index $OPENSEARCH_INDEX already exists."
elif [[ "$OPENSEARCH_INDEX" == "item-nlp" ]]; then
  # Semantic search index
  
  # ---- Configure the ML plugin
  echo "Configuring the ML plugin"
  curl -s -X PUT "http://localhost:9200/_cluster/settings" \
    -H "Content-Type: application/json" \
    -d '{
      "persistent": {
        "plugins.ml_commons.only_run_on_ml_node": "false",
        "plugins.ml_commons.model_access_control_enabled": "true",
        "plugins.ml_commons.native_memory_threshold": "99"
      }}'
  echo ""
  
  # ---- Check if local model group exists and create if not
  echo "Creating local model group"
  response=$(curl -s -X POST "http://localhost:9200/_plugins/_ml/model_groups/_search" \
    -H "Content-Type: application/json" \
    -d '{
      "query": {
        "term": {
          "name.keyword": "local_model_group"
        }}}')
  exists=$(echo "$response" | jq -r '.hits.total.value')
  if [ "$exists" -gt 0 ]; then
    model_group_id=$(echo "$response" | jq -r '.hits.hits[0]._id')
  else
    model_group_id=$(curl -s -X POST \
      "http://localhost:9200/_plugins/_ml/model_groups/_register" \
      -H "Content-Type: application/json" \
      -d '{
        "name": "local_model_group",
        "description": "A model group for local models"
      }' | jq -r '.model_group_id')
  fi
  echo "model_group_id=$model_group_id"
  
  # ---- Check if the model exists and create if not
  echo "Creating the ML model for NLP"

  response=$(curl -s -X POST "http://localhost:9200/_plugins/_ml/models/_search" \
    -H "Content-Type: application/json" \
    -d '{
      "query": {
        "bool": {
          "must": [
            {"term":{"name.keyword":"'"$OPENSEARCH_MODEL_NAME"'"}},
            {"term":{ "model_group_id":"'"$model_group_id"'"}}
          ]}}}')
    
  exists=$(echo "$response" | jq -r '.hits.total.value')
  
  if [ "$exists" -gt 0 ]; then
    model_id=$(echo "$response" | jq -r '.hits.hits[0]._id')
  else
    task_id=$(curl -s -X POST "http://localhost:9200/_plugins/_ml/models/_register" \
      -H "Content-Type: application/json" \
      -d '{
        "name": "'"$OPENSEARCH_MODEL_NAME"'",
        "version": "1.0.1",
        "model_group_id": "'"$model_group_id"'",
        "model_format": "TORCH_SCRIPT"
      }' | jq -r '.task_id')
    echo "Registering the model (task_id=$task_id)"
    state="INCOMPLETE"
    start_time=$(date +%s)
    while [ $state != "COMPLETED" ]
    do
      response=$(curl -s -X GET "http://localhost:9200/_plugins/_ml/tasks/$task_id" \
                      -H "Content-Type: application/json")
      state=$(echo "$response" | jq -r '.state')
      elapsed=$(( $(date +%s) - start_time ))
      echo "Waiting for model to be ready (~1 minute)... ${elapsed}s"
      sleep 1
    done
    model_id=$(echo "$response" | jq -r '.model_id')
  fi
  echo "model_id=$model_id"
  
  # ---- Deploy the model
  echo "Deploying the model"
  task_id=$(curl -s \
    -X POST "http://localhost:9200/_plugins/_ml/models/$model_id/_deploy" \
    -H "Content-Type: application/json" | jq -r '.task_id')
  echo "task_id=$task_id"
  state="NOT_DEPLOYED"
  start_time=$(date +%s)
  while [ $state != "DEPLOYED" ]
  do
    response=$(curl \
      -s -X GET "http://localhost:9200/_plugins/_ml/models/$model_id" \
      -H "Content-Type: application/json")
    state=$(echo "$response" | jq -r '.model_state')
    elapsed=$(( $(date +%s) - start_time ))
    echo "Waiting for the model to deploy... ${elapsed}s"
    sleep 1
  done
  echo "Model deployed"
  
  # ---- Create the ingest pipeline
  echo "Creating ingest pipeline for NLP search"
  curl -s -X PUT "http://localhost:9200/_ingest/pipeline/nlp-ingest-pipeline" \
    -H "Content-Type: application/json" \
    -d "{
         \"description\": \"An NLP ingest pipeline\",
         \"processors\": [
           {
             \"remove\": {
               \"field\": \"text\",
               \"if\": \"ctx?.text?.trim() == ''\"
             }
           },
           {
             \"remove\": {
               \"field\": \"title\",
               \"if\": \"ctx?.title?.trim() == ''\"
             }
           },
           {
             \"text_embedding\": {
               \"model_id\": \"$model_id\",
               \"field_map\": {
                 \"text\": \"text_embedding\",
                 \"title\": \"title_embedding\"
               }}}]}"
  echo ""
  
  # ---- Creating the NLP index
  echo "Creating NLP index"
  curl -s -X PUT "http://localhost:9200/$OPENSEARCH_INDEX" \
    -H "Content-Type: application/json" \
    -d '{
     "settings": {
       "index.knn": true,
       "default_pipeline": "nlp-ingest-pipeline"
     },
     "mappings": {
       "properties": {
         "text": {
           "type": "text",
           "analyzer": "english",
           "fields": {"keyword": {"type": "keyword", "ignore_above": 256}}
         },
         "title": {
           "type": "text",
           "analyzer": "english",
           "fields": {"keyword": {"type": "keyword", "ignore_above": 256}}
         },
         "title_embedding": {
           "type": "knn_vector",
           "dimension": 768,
           "method": {
             "engine": "lucene",
             "space_type": "l2",
             "name": "hnsw",
             "parameters": {}
           }
         },
         "text_embedding": {
           "type": "knn_vector",
           "dimension": 768,
           "method": {
             "engine": "lucene",
             "space_type": "l2",
             "name": "hnsw",
             "parameters": {}
           }}}}}'
  echo ""
  
  # ---- Create a hybrid search pipeline
  echo "Creating a hybrid search pipeline"
  curl -s -X PUT "http://localhost:9200/_search/pipeline/nlp-search-pipeline" \
    -H "Content-Type: application/json" \
    -d '{
      "description": "Pre and post processor for hybrid search", 
      "request_processors": [{
        "neural_query_enricher": {
          "description": "Sets the default model ID at index and field levels (which doesnt actually work)", 
          "default_model_id": "'"$model_id"'"
        }
      }],
      "phase_results_processors": [{
        "normalization-processor": {
          "normalization": {"technique": "min_max"},
          "combination": {
            "technique": "arithmetic_mean",
            "parameters": {"weights": [0.7,0.3]}
          }
        }}]}'
  echo ""
  
  # ---- Set hybrid search as default pipeline
  echo "Setting hybrid search as default pipeline"
  curl -s -X PUT "http://localhost:9200/$OPENSEARCH_INDEX/_settings" \
       -H "Content-Type: application/json" \
       -d '{
             "index.search.default_pipeline": "nlp-search-pipeline"
           }'
  echo ""
  echo "OpenSearch index $OPENSEARCH_INDEX created."
else
  # Default non-NLP index
  curl \
    -H "Content-Type: application/json" \
    -X PUT \
    -d '{
      "mappings": {
        "properties": {
          "text": {
            "type": "text",
            "analyzer": "english",
            "fields": {"keyword":{"type":"keyword","ignore_above":256}}
          },
          "title": {
            "type": "text",
            "analyzer": "english",
            "fields": {"keyword":{"type":"keyword","ignore_above":256}}
          }}}}' \
    "http://localhost:9200/$OPENSEARCH_INDEX" \
    -ku admin:${OPENSEARCH_INITIAL_ADMIN_PASSWORD}
  echo ""
  echo "OpenSearch index $OPENSEARCH_INDEX created."
fi

fg
