#!/bin/bash

set -euo pipefail

OS_URL="http://localhost:9200"
OS_USER="admin"
OS_PASS="${OPENSEARCH_INITIAL_ADMIN_PASSWORD}"
INDEX_NAME="${OPENSEARCH_INDEX:-item}"
MODEL_NAME="${OPENSEARCH_MODEL_NAME:-huggingface/sentence-transformers/all-mpnet-base-v2}"
MODEL_VERSION="${OPENSEARCH_MODEL_VERSION:-1.0.1}"
MODEL_GROUP_NAME="${OPENSEARCH_MODEL_GROUP_NAME:-local_model_group}"
INGEST_PIPELINE="nlp-ingest-pipeline"
SEARCH_PIPELINE="nlp-search-pipeline"

os_api () {
  curl -sS --fail-with-body -ku "${OS_USER}:${OS_PASS}" "$@"
}

json_string () {
  local key="$1"
  local json="$2"
  echo "$json" | tr -d '\n' | sed -nE "s/.*\"${key}\"[[:space:]]*:[[:space:]]*\"([^\"]+)\".*/\1/p"
}

model_group_id_from_conflict () {
  local json="$1"
  echo "$json" | tr -d '\n' | sed -nE 's/.*model group with ID:[[:space:]]*([A-Za-z0-9_-]+).*/\1/p'
}

wait_for_opensearch () {
  until curl -sS "${OS_URL}/_cat/health?h=status" -ku "${OS_USER}:${OS_PASS}" | grep -q "green\|yellow"; do
    echo "Waiting for OpenSearch to start..."
    sleep 1
  done
}

wait_for_ml_endpoints () {
  local attempt
  local status

  for attempt in $(seq 1 40); do
    status=$(curl -s -o /dev/null -w "%{http_code}" -ku "${OS_USER}:${OS_PASS}" \
      -X POST "${OS_URL}/_plugins/_ml/model_groups/_search" \
      -H "Content-Type: application/json" \
      -d '{"size":1,"query":{"match_all":{}}}')
    if [ "$status" -eq 200 ]; then
      return 0
    fi

    echo "Waiting for OpenSearch ML endpoints (status ${status})..."
    sleep 2
  done

  echo "OpenSearch ML endpoints did not become ready in time." >&2
  return 1
}

ensure_model_group () {
  local response
  local response_status
  local response_body
  local model_group_id=""
  local attempt
  local register_response
  local register_status
  local register_body
  local conflicted_group_id

  for attempt in $(seq 1 20); do
    response=$(curl -sS -ku "${OS_USER}:${OS_PASS}" \
      -X POST "${OS_URL}/.plugins-ml-model-group/_search?size=1&filter_path=hits.hits._id" \
      -H "Content-Type: application/json" \
      -d "{
        \"query\": {
          \"term\": {
            \"name\": \"${MODEL_GROUP_NAME}\"
          }
        }
      }" \
      -w '\n%{http_code}')
    response_status="$(echo "$response" | sed -n '$p')"
    response_body="$(echo "$response" | sed '$d')"
    if [ "${response_status}" -ge 200 ] && [ "${response_status}" -lt 300 ]; then
      model_group_id="$(json_string "_id" "$response_body")"
      break
    fi

    # 404 means the model-group backing index has not been created yet
    if [ "${response_status}" -eq 404 ]; then
      break
    fi

    if [ "$attempt" -lt 20 ]; then
      echo "Model group lookup returned status ${response_status}; retrying..." >&2
      sleep 2
    fi
  done

  if [ -z "$model_group_id" ] && { [ "${response_status}" -lt 200 ] || [ "${response_status}" -ge 300 ]; } && [ "${response_status}" -ne 404 ]; then
    echo "Model group lookup returned status ${response_status}; attempting registration fallback." >&2
  fi

  if [ -n "$model_group_id" ]; then
    echo "$model_group_id"
    return 0
  fi

  register_response=$(curl -sS -ku "${OS_USER}:${OS_PASS}" \
    -X POST "${OS_URL}/_plugins/_ml/model_groups/_register?filter_path=model_group_id" \
    -H "Content-Type: application/json" \
    -d "{
      \"name\": \"${MODEL_GROUP_NAME}\",
      \"description\": \"A model group for local models\"
    }" \
    -w '\n%{http_code}')
  register_status="$(echo "$register_response" | sed -n '$p')"
  register_body="$(echo "$register_response" | sed '$d')"

  if [ "${register_status}" -ge 200 ] && [ "${register_status}" -lt 300 ]; then
    model_group_id="$(json_string "model_group_id" "$register_body")"
  else
    conflicted_group_id="$(model_group_id_from_conflict "$register_body")"
    if [ -n "$conflicted_group_id" ]; then
      echo "Model group ${MODEL_GROUP_NAME} already exists as ${conflicted_group_id}; reusing." >&2
      echo "$conflicted_group_id"
      return 0
    fi
  fi

  if [ -z "$model_group_id" ]; then
    echo "Unable to create model group ${MODEL_GROUP_NAME}" >&2
    echo "$register_body" >&2
    exit 1
  fi

  echo "$model_group_id"
}

wait_for_model_registration_task () {
  local task_id="$1"
  local response
  local state
  local model_id

  while true; do
    response=$(os_api -X GET "${OS_URL}/_plugins/_ml/tasks/${task_id}?filter_path=state,model_id")
    state="$(json_string "state" "$response")"
    case "$state" in
      COMPLETED)
        model_id="$(json_string "model_id" "$response")"
        if [ -z "$model_id" ]; then
          echo "Model task ${task_id} completed without model id" >&2
          exit 1
        fi
        echo "$model_id"
        return 0
        ;;
      FAILED|COMPLETED_WITH_ERROR)
        echo "Model registration task ${task_id} failed" >&2
        echo "$response" >&2
        exit 1
        ;;
      *)
        sleep 2
        ;;
    esac
  done
}

ensure_model () {
  local model_group_id="$1"
  local response
  local response_status
  local response_body
  local pipeline_response
  local pipeline_status
  local pipeline_body
  local pipeline_model_id=""
  local pipeline_model_state_response
  local pipeline_model_state_status
  local pipeline_model_state_body
  local pipeline_model_state
  local model_id=""
  local attempt
  local register_response
  local register_status
  local register_body
  local task_id

  pipeline_response=$(curl -sS -ku "${OS_USER}:${OS_PASS}" \
    -X GET "${OS_URL}/_ingest/pipeline/${INGEST_PIPELINE}" \
    -w '\n%{http_code}')
  pipeline_status="$(echo "$pipeline_response" | sed -n '$p')"
  pipeline_body="$(echo "$pipeline_response" | sed '$d')"
  if [ "${pipeline_status}" -ge 200 ] && [ "${pipeline_status}" -lt 300 ]; then
    pipeline_model_id="$(json_string "model_id" "$pipeline_body")"
  fi
  if [ -n "$pipeline_model_id" ]; then
    pipeline_model_state_response=$(curl -sS -ku "${OS_USER}:${OS_PASS}" \
      -X GET "${OS_URL}/_plugins/_ml/models/${pipeline_model_id}?filter_path=model_state" \
      -w '\n%{http_code}')
    pipeline_model_state_status="$(echo "$pipeline_model_state_response" | sed -n '$p')"
    pipeline_model_state_body="$(echo "$pipeline_model_state_response" | sed '$d')"
    if [ "${pipeline_model_state_status}" -ge 200 ] && [ "${pipeline_model_state_status}" -lt 300 ]; then
      pipeline_model_state="$(json_string "model_state" "$pipeline_model_state_body")"
      if [ "$pipeline_model_state" != "DEPLOY_FAILED" ]; then
        echo "$pipeline_model_id"
        return 0
      fi
      echo "Existing pipeline model ${pipeline_model_id} is DEPLOY_FAILED; selecting a replacement model." >&2
    fi
  fi

  for attempt in $(seq 1 30); do
    response=$(curl -sS -ku "${OS_USER}:${OS_PASS}" \
      -X POST "${OS_URL}/_plugins/_ml/models/_search?size=1&filter_path=hits.hits._id" \
      -H "Content-Type: application/json" \
      -d "{
        \"query\": {
          \"bool\": {
            \"must\": [
              {\"match\": {\"name\": \"${MODEL_NAME}\"}},
              {\"term\": {\"model_group_id\": \"${model_group_id}\"}},
              {\"term\": {\"model_state\": \"DEPLOYED\"}}
            ]
          }
        }
      }" \
      -w '\n%{http_code}')
    response_status="$(echo "$response" | sed -n '$p')"
    response_body="$(echo "$response" | sed '$d')"
    if [ "${response_status}" -ge 200 ] && [ "${response_status}" -lt 300 ]; then
      model_id="$(json_string "_id" "$response_body")"
      if [ -n "$model_id" ]; then
        echo "$model_id"
        return 0
      fi
      break
    fi

    if [ "$attempt" -lt 30 ]; then
      echo "Model lookup returned status ${response_status}; retrying..." >&2
      sleep 2
    fi
  done

  response=$(curl -sS -ku "${OS_USER}:${OS_PASS}" \
    -X POST "${OS_URL}/_plugins/_ml/models/_search?size=1&filter_path=hits.hits._id" \
    -H "Content-Type: application/json" \
    -d "{
      \"query\": {
        \"bool\": {
          \"must\": [
            {\"match\": {\"name\": \"${MODEL_NAME}\"}},
            {\"term\": {\"model_group_id\": \"${model_group_id}\"}}
          ]
        }
      }
    }" \
    -w '\n%{http_code}')
  response_status="$(echo "$response" | sed -n '$p')"
  response_body="$(echo "$response" | sed '$d')"
  if [ "${response_status}" -ge 200 ] && [ "${response_status}" -lt 300 ]; then
    model_id="$(json_string "_id" "$response_body")"
  else
    echo "Model lookup returned status ${response_status}; attempting registration fallback." >&2
  fi

  if [ -n "$model_id" ]; then
    echo "$model_id"
    return 0
  fi

  register_response=$(curl -sS -ku "${OS_USER}:${OS_PASS}" \
    -X POST "${OS_URL}/_plugins/_ml/models/_register?filter_path=task_id" \
    -H "Content-Type: application/json" \
    -d "{
      \"name\": \"${MODEL_NAME}\",
      \"version\": \"${MODEL_VERSION}\",
      \"model_group_id\": \"${model_group_id}\",
      \"model_format\": \"TORCH_SCRIPT\"
    }" \
    -w '\n%{http_code}')
  register_status="$(echo "$register_response" | sed -n '$p')"
  register_body="$(echo "$register_response" | sed '$d')"
  if [ "${register_status}" -ge 200 ] && [ "${register_status}" -lt 300 ]; then
    task_id="$(json_string "task_id" "$register_body")"
  else
    response=$(curl -sS -ku "${OS_USER}:${OS_PASS}" \
      -X POST "${OS_URL}/_plugins/_ml/models/_search?size=1&filter_path=hits.hits._id" \
      -H "Content-Type: application/json" \
      -d "{
        \"query\": {
          \"bool\": {
            \"must\": [
              {\"match\": {\"name\": \"${MODEL_NAME}\"}},
              {\"term\": {\"model_group_id\": \"${model_group_id}\"}}
            ]
          }
        }
      }" \
      -w '\n%{http_code}')
    response_status="$(echo "$response" | sed -n '$p')"
    response_body="$(echo "$response" | sed '$d')"
    if [ "${response_status}" -ge 200 ] && [ "${response_status}" -lt 300 ]; then
      model_id="$(json_string "_id" "$response_body")"
      if [ -n "$model_id" ]; then
        echo "$model_id"
        return 0
      fi
    fi
  fi

  if [ -z "$task_id" ]; then
    echo "Unable to start model registration for ${MODEL_NAME}" >&2
    echo "$register_body" >&2
    exit 1
  fi

  wait_for_model_registration_task "$task_id"
}

ensure_model_deployed () {
  local model_id="$1"
  local response
  local model_state

  response=$(os_api -X GET "${OS_URL}/_plugins/_ml/models/${model_id}?filter_path=model_state")
  model_state="$(json_string "model_state" "$response")"
  if [ "$model_state" != "DEPLOYED" ]; then
    os_api \
      -X POST "${OS_URL}/_plugins/_ml/models/${model_id}/_deploy" \
      -H "Content-Type: application/json" \
      -d "{}" >/dev/null
  fi

  while true; do
    response=$(os_api -X GET "${OS_URL}/_plugins/_ml/models/${model_id}?filter_path=model_state")
    model_state="$(json_string "model_state" "$response")"
    case "$model_state" in
      DEPLOYED)
        return 0
        ;;
      DEPLOY_FAILED)
        echo "Model deployment failed for ${model_id}" >&2
        exit 1
        ;;
      *)
        sleep 2
        ;;
    esac
  done
}

ensure_ingest_pipeline () {
  local model_id="$1"

  os_api -s -o /dev/null \
    -X PUT "${OS_URL}/_ingest/pipeline/${INGEST_PIPELINE}" \
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
            \"model_id\": \"${model_id}\",
            \"field_map\": {
              \"text\": \"text_embedding\",
              \"title\": \"title_embedding\"
            }
          }
        }
      ]
    }"
}

ensure_search_pipeline () {
  local model_id="$1"

  os_api -s -o /dev/null \
    -X PUT "${OS_URL}/_search/pipeline/${SEARCH_PIPELINE}" \
    -H "Content-Type: application/json" \
    -d "{
      \"description\": \"Pre and post processor for hybrid search\",
      \"request_processors\": [
        {
          \"neural_query_enricher\": {
            \"description\": \"Sets the default model ID at index and field levels\",
            \"default_model_id\": \"${model_id}\"
          }
        }
      ],
      \"phase_results_processors\": [
        {
          \"normalization-processor\": {
            \"normalization\": {
              \"technique\": \"min_max\"
            },
            \"combination\": {
              \"technique\": \"arithmetic_mean\",
              \"parameters\": {
                \"weights\": [
                  0.7,
                  0.3
                ]
              }
            }
          }
        }
      ]
    }"
}

create_neural_index () {
  os_api -s -o /dev/null \
    -X PUT "${OS_URL}/${INDEX_NAME}" \
    -H "Content-Type: application/json" \
    -d "{
      \"settings\": {
        \"index.knn\": true,
        \"default_pipeline\": \"${INGEST_PIPELINE}\",
        \"index.search.default_pipeline\": \"${SEARCH_PIPELINE}\"
      },
      \"mappings\": {
        \"properties\": {
          \"text\": {
            \"type\": \"text\",
            \"analyzer\": \"english\",
            \"fields\": {
              \"keyword\": {
                \"type\": \"keyword\",
                \"ignore_above\": 256
              },
              \"exact\": {
                \"type\": \"text\",
                \"analyzer\": \"standard\"
              }
            }
          },
          \"title\": {
            \"type\": \"text\",
            \"analyzer\": \"english\",
            \"fields\": {
              \"keyword\": {
                \"type\": \"keyword\",
                \"ignore_above\": 256
              },
              \"exact\": {
                \"type\": \"text\",
                \"analyzer\": \"standard\"
              }
            }
          },
          \"title_embedding\": {
            \"type\": \"knn_vector\",
            \"dimension\": 768,
            \"method\": {
              \"engine\": \"lucene\",
              \"space_type\": \"l2\",
              \"name\": \"hnsw\",
              \"parameters\": {}
            }
          },
          \"text_embedding\": {
            \"type\": \"knn_vector\",
            \"dimension\": 768,
            \"method\": {
              \"engine\": \"lucene\",
              \"space_type\": \"l2\",
              \"name\": \"hnsw\",
              \"parameters\": {}
            }
          }
        }
      }
    }"
  echo "OpenSearch index ${INDEX_NAME} created."
}

ensure_neural_index () {
  local index_exists
  local has_embedding_fields

  index_exists=$(curl -s -o /dev/null -w "%{http_code}" -I -ku "${OS_USER}:${OS_PASS}" "${OS_URL}/${INDEX_NAME}")
  if [ "$index_exists" -ne 200 ]; then
    create_neural_index
    return 0
  fi

  echo "OpenSearch index ${INDEX_NAME} already exists; ensuring neural settings."

  has_embedding_fields=$(curl -s -o /dev/null -w "%{http_code}" -X GET -ku "${OS_USER}:${OS_PASS}" "${OS_URL}/${INDEX_NAME}/_mapping/field/title_embedding")
  if [ "$has_embedding_fields" -ne 200 ]; then
    os_api -s -o /dev/null \
      -X PUT "${OS_URL}/${INDEX_NAME}/_mapping" \
      -H "Content-Type: application/json" \
      -d "{
        \"properties\": {
          \"title_embedding\": {
            \"type\": \"knn_vector\",
            \"dimension\": 768,
            \"method\": {
              \"engine\": \"lucene\",
              \"space_type\": \"l2\",
              \"name\": \"hnsw\",
              \"parameters\": {}
            }
          },
          \"text_embedding\": {
            \"type\": \"knn_vector\",
            \"dimension\": 768,
            \"method\": {
              \"engine\": \"lucene\",
              \"space_type\": \"l2\",
              \"name\": \"hnsw\",
              \"parameters\": {}
            }
          }
        }
      }"
  fi

  if ! os_api -s -o /dev/null \
    -X PUT "${OS_URL}/${INDEX_NAME}/_settings" \
    -H "Content-Type: application/json" \
    -d "{\"index.knn\": true}"; then
    echo "Warning: could not set index.knn=true on existing index ${INDEX_NAME}." >&2
  fi

  os_api -s -o /dev/null \
    -X PUT "${OS_URL}/${INDEX_NAME}/_settings" \
    -H "Content-Type: application/json" \
    -d "{
      \"index.default_pipeline\": \"${INGEST_PIPELINE}\",
      \"index.search.default_pipeline\": \"${SEARCH_PIPELINE}\"
    }"
}

/usr/share/opensearch/opensearch-docker-entrypoint.sh &
opensearch_pid=$!

wait_for_opensearch

echo "Configuring OpenSearch ML plugin."
os_api -s -o /dev/null \
  -X PUT "${OS_URL}/_cluster/settings" \
  -H "Content-Type: application/json" \
  -d '{
    "persistent": {
      "plugins.ml_commons.only_run_on_ml_node": "false",
      "plugins.ml_commons.model_access_control_enabled": "true",
      "plugins.ml_commons.native_memory_threshold": "99"
    }
  }'

wait_for_ml_endpoints

echo "Ensuring local model group exists."
model_group_id="$(ensure_model_group)"
echo "Ensuring NLP model is registered."
model_id="$(ensure_model "$model_group_id")"
echo "Ensuring NLP model is deployed."
ensure_model_deployed "$model_id"
echo "Ensuring NLP pipelines exist."
ensure_ingest_pipeline "$model_id"
ensure_search_pipeline "$model_id"
echo "Ensuring index ${INDEX_NAME} is neural-ready."
ensure_neural_index

echo "OpenSearch neural bootstrap complete."
wait "$opensearch_pid"
