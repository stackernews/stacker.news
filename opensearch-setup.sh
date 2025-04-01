#!/bin/bash

set -e

# Ensure search is in COMPOSE_PROFILES
COMPOSE_PROFILES=$(docker exec db printenv COMPOSE_PROFILES)

if [[ ! "$COMPOSE_PROFILES" == *"search"* ]]; then
  echo "Please ensure that COMPOSE_PROFILES contains search, then restart the container."
fi

# Check the existence of an item index
echo -ne "Checking existence of \"item\" index... "

response=$(curl -s -o /dev/null -w "%{http_code}" -I "http://localhost:9200/item")

if [ "$response" -eq 200 ]; then
  echo "yes."
else
  echo "no."
  echo "An OpenSearch index named \"item\" needs to exist." 
  echo "If you just started the container, try waiting a while. Otherwise, you may need to rebuild your OpenSearch volume. Check that .env.local does not contain OPENSEARCH_INDEX=item-nlp prior to rebuilding."
  exit 0
fi

# Check that indexing of item is complete by checking stability in count
echo ""
echo -ne "Checking whether indexing of \"item\" is complete... "

count1=$(curl -s -X GET "http://localhost:9200/item/_count" | jq -r '.count')
sleep 2
count2=$(curl -s -X GET "http://localhost:9200/item/_count" | jq -r '.count')

if [ "$count2" -eq "$count1" ] && [ "$count2" -ge 10000 ]; then
  echo "yes."
else
  echo "no."
  echo "Please wait for indexing of \"item\" to complete."
  exit 0
fi

# Check if item-nlp already exists
echo ""
echo "Checking existence of \"item-nlp\" index... "

item_nlp_exists=$(curl -s -o /dev/null -w "%{http_code}" -I "http://localhost:9200/item-nlp")

if [ "$item_nlp_exists" -eq 200 ]; then
  echo "item-nlp index already exists."
  read -p "Do you want to rebuild the index? (y/n): " choice
  case "$choice" in 
    y|Y ) echo "Continuing....";;
    * ) echo "Exiting."; exit 0;;
  esac
else
  echo "item-nlp does not exist."
  echo "Building the index..."
fi

# Configure the ML plugin

echo ""
echo "Configuring the ML plugin..."

curl -s -X PUT "http://localhost:9200/_cluster/settings" \
     -H "Content-Type: application/json" \
     -d '{
           "persistent": {
             "plugins.ml_commons.only_run_on_ml_node": "false",
             "plugins.ml_commons.model_access_control_enabled": "true",
             "plugins.ml_commons.native_memory_threshold": "99"
           }
         }'
echo ""

# Check if local model group already exists

echo ""
echo "Checking if local model group already exists..."

model_group_name="local_model_group"

response=$(curl -s -X POST "http://localhost:9200/_plugins/_ml/model_groups/_search" \
                -H "Content-Type: application/json" \
                -d '{
                      "query": {
                        "term": {
                          "name.keyword": "'"$model_group_name"'"
                        }
                      }
                    }')

exists=$(echo "$response" | jq -r '.hits.total.value')

if [ "$exists" -gt 0 ]; then
  model_group_id=$(echo "$response" | jq -r '.hits.hits[0]._id')
  echo "Local model group exists."
else
  echo "Local model group not found."
  echo "Creating local model group."
  model_group_id=$(curl -s -X POST "http://localhost:9200/_plugins/_ml/model_groups/_register" \
       -H "Content-Type: application/json" \
       -d '{
             "name": "'"$model_group_name"'",
             "description": "A model group for local models"
           }' | jq -r '.model_group_id')
  echo ""
fi
echo "model_group_id=$model_group_id"    

# Check if pretrained model already exists

echo ""
echo "Checking if pretrained model is already registered..."

model_name="huggingface/sentence-transformers/all-mpnet-base-v2"

response=$(curl -s -X POST "http://localhost:9200/_plugins/_ml/models/_search" \
                -H "Content-Type: application/json" \
                -d '{
                      "query": {
                        "bool": {
                          "must": [
                            { "term": { "name.keyword": "'"$model_name"'" }},
                            { "term": { "model_group_id": "'"$model_group_id"'" }}
                          ]
                        }
                      }
                    }')

exists=$(echo "$response" | jq -r '.hits.total.value')

if [ "$exists" -gt 0 ]; then
  model_id=$(echo "$response" | jq -r '.hits.hits[0]._id')
  echo "Pretrained model already registered."
else
  echo "Pretrained model not found."
  echo "Registering pretrained model."
  task_id=$(curl -s -X POST "http://localhost:9200/_plugins/_ml/models/_register" \
                 -H "Content-Type: application/json" \
                 -d '{
                       "name": "'"$model_name"'",
                       "version": "1.0.1",
                       "model_group_id": "'"$model_group_id"'",
                       "model_format": "TORCH_SCRIPT"
                     }' | jq -r '.task_id')
  echo "Waiting for the model to download (task_id=$task_id)"
  state="INCOMPLETE"
  start_time=$(date +%s)
  while [ $state != "COMPLETED" ]
  do
    response=$(curl -s -X GET "http://localhost:9200/_plugins/_ml/tasks/$task_id" \
                    -H "Content-Type: application/json")
    state=$(echo "$response" | jq -r '.state')
    elapsed=$(( $(date +%s) - start_time ))
    echo -ne "\rThis may take a while... ${elapsed}s"
    sleep 1
  done
  model_id=$(echo "$response" | jq -r '.model_id')
  echo ""
  echo "Done"
fi
echo "model_id=$model_id"    

# Deploy the model

echo ""
echo "Deploying the model..."

task_id=$(curl -s -X POST "http://localhost:9200/_plugins/_ml/models/$model_id/_deploy" \
               -H "Content-Type: application/json" | jq -r '.task_id')
echo "task_id=$task_id"
state="INCOMPLETE"
start_time=$(date +%s)
while [ $state != "COMPLETED" ]
do
  response=$(curl -s -X GET "http://localhost:9200/_plugins/_ml/tasks/$task_id" \
                  -H "Content-Type: application/json")
  state=$(echo "$response" | jq -r '.state')
  elapsed=$(( $(date +%s) - start_time ))
  echo -ne "\rWaiting for the model to deploy... ${elapsed}s"
  sleep 1
done
echo ""
echo "Done"

# Create the ingest pipeline

echo ""
echo "Creating the ingest pipeline..."

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
                 }
               }
             }
           ]
         }"
echo ""

# Create the new index for semantic search if not already existing

if [ "$item_nlp_exists" != 200 ]; then
  echo ""
  echo "Creating the item-nlp index..."
  
  curl -s -X PUT "http://localhost:9200/item-nlp" \
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
               "fields": {
                 "keyword": {
                   "type": "keyword",
                   "ignore_above": 256
                 }
               }
             },
             "title": {
               "type": "text",
               "analyzer": "english",
               "fields": {
                 "keyword": {
                   "type": "keyword",
                   "ignore_above": 256
                 }
               }
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
               }
             }
           }
         }
       }'
  echo ""
fi

# Create a search pipeline for weighting term searches and vector search

echo ""
echo "Creating a hybrid search pipeline for combining term and vector searches..."

curl -s -X PUT "http://localhost:9200/_search/pipeline/nlp-search-pipeline" \
     -H "Content-Type: application/json" \
     -d '{
       "description": "Pre and post processor for hybrid search",
       "request_processors": [
         {
           "neural_query_enricher": {
             "description": "Sets the default model ID at index and field levels (which doesnt actually work)",
             "default_model_id": "'"$model_id"'"
           }
         }
       ],
       "phase_results_processors": [
         {
           "normalization-processor": {
             "normalization": {
               "technique": "min_max"
             },
             "combination": {
               "technique": "arithmetic_mean",
               "parameters": {
                 "weights": [
                   0.7,
                   0.3
                 ]
               }
             }
           }
         }
       ]
     }'
echo ""

# Set the hybrid search as the default search pipeline

echo ""
echo "Setting hybrid search as default search pipeline..."

curl -s -X PUT "http://localhost:9200/item-nlp/_settings" \
     -H "Content-Type: application/json" \
     -d '{
           "index.search.default_pipeline": "nlp-search-pipeline"
         }'
echo ""

# Reindex the data

echo ""
echo "Reindexing the data, this may take a while..."

task_id=$(curl -s -X POST "http://localhost:9200/_reindex?wait_for_completion=false" \
               -H "Content-Type: application/json" \
               -d '{
                     "source": {
                       "index": "item"
                     },
                     "dest": {
                       "index": "item-nlp"
                     }
                   }' | jq -r '.task')

echo "task_id=$task_id"
completed="false"
start_time=$(date +%s)
while [ $completed != "true" ]
do
  completed=$(curl -s -X GET "http://localhost:9200/_tasks/$task_id" \
                   -H "Content-Type: application/json" | jq -r '.completed')
  elapsed=$(( $(date +%s) - start_time ))
  echo -ne "\rWaiting for indexing to complete... ${elapsed}s"
  sleep 1
done
echo ""
echo "Done"

# Update .env.local

echo ""
echo "Updating .env.local..."

if grep -q "^OPENSEARCH_INDEX=" ".env.local"; then
  sed -i '' "s|^OPENSEARCH_INDEX=.*|OPENSEARCH_INDEX=item-nlp|" ".env.local"
else
  echo "OPENSEARCH_INDEX=item-nlp" >> ".env.local"
fi

if grep -q "^OPENSEARCH_MODEL_ID=" ".env.local"; then
  sed -i '' "s|^OPENSEARCH_MODEL_ID=.*|OPENSEARCH_MODEL_ID=$model_id|" ".env.local"
else
  echo "OPENSEARCH_MODEL_ID=$model_id" >> ".env.local"
fi

cat ".env.local"

# Final instructions

echo ""
echo "item-nlp has been successfully built."
echo "Restart SN containers to start using hybrid search."







