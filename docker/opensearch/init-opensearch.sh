#!/bin/bash

set -euo pipefail

OS_URL="http://localhost:9200"
OS_USER="admin"
OS_PASS="${OPENSEARCH_INITIAL_ADMIN_PASSWORD}"
INDEX_NAME="${OPENSEARCH_INDEX:-item}"
MODEL_NAME="${OPENSEARCH_MODEL_NAME:-huggingface/sentence-transformers/all-mpnet-base-v2}"
MODEL_VERSION="${OPENSEARCH_MODEL_VERSION:-1.0.2}"
SPARSE_MODEL_NAME="${OPENSEARCH_SPARSE_MODEL_NAME:-amazon/neural-sparse/opensearch-neural-sparse-encoding-doc-v3-distill}"
SPARSE_MODEL_VERSION="${OPENSEARCH_SPARSE_MODEL_VERSION:-1.0.0}"
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
  local model_id=""
  local attempt
  local register_response
  local register_status
  local register_body
  local task_id

  # Dense model is referenced by the semantic field mapping, not the ingest pipeline.
  # Look up directly from model registry.
  # On fresh installs the .plugins-ml-model index doesn't exist yet, so _search
  # returns 400. Try a few times, then fall through to registration.
  for attempt in $(seq 1 5); do
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

    if [ "$attempt" -lt 5 ]; then
      echo "Model lookup returned status ${response_status}; retrying (${attempt}/5)..." >&2
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
  local deploy_attempt=0
  local max_deploy_attempts=90  # 3 minutes at 2s intervals
  local deploy_retries=0
  local max_deploy_retries=2

  response=$(os_api -X GET "${OS_URL}/_plugins/_ml/models/${model_id}?filter_path=model_state")
  model_state="$(json_string "model_state" "$response")"
  case "$model_state" in
    DEPLOYED) return 0 ;;
    DEPLOYING) ;;  # already in progress — just poll
    *)
      os_api \
        -X POST "${OS_URL}/_plugins/_ml/models/${model_id}/_deploy" \
        -H "Content-Type: application/json" \
        -d "{}" >/dev/null
      ;;
  esac

  while true; do
    response=$(os_api -X GET "${OS_URL}/_plugins/_ml/models/${model_id}?filter_path=model_state")
    model_state="$(json_string "model_state" "$response")"
    case "$model_state" in
      DEPLOYED)
        return 0
        ;;
      DEPLOY_FAILED)
        deploy_retries=$((deploy_retries + 1))
        if [ "$deploy_retries" -gt "$max_deploy_retries" ]; then
          echo "Model deployment failed for ${model_id} after ${deploy_retries} attempts" >&2
          exit 1
        fi
        echo "Model ${model_id} in DEPLOY_FAILED state; retrying deploy (${deploy_retries}/${max_deploy_retries})..." >&2
        os_api \
          -X POST "${OS_URL}/_plugins/_ml/models/${model_id}/_deploy" \
          -H "Content-Type: application/json" \
          -d "{}" >/dev/null 2>&1 || true
        sleep 2
        ;;
      *)
        deploy_attempt=$((deploy_attempt + 1))
        if [ "$deploy_attempt" -ge "$max_deploy_attempts" ]; then
          echo "Model deployment timed out for ${model_id} (state: ${model_state})" >&2
          exit 1
        fi
        sleep 2
        ;;
    esac
  done
}

ensure_sparse_model () {
  local model_group_id="$1"
  local response
  local response_status
  local response_body
  local model_id=""
  local task_id
  local register_response
  local register_status
  local register_body

  # Check if sparse model is already deployed (fast path)
  for attempt in $(seq 1 5); do
    response=$(curl -sS -ku "${OS_USER}:${OS_PASS}" \
      -X POST "${OS_URL}/_plugins/_ml/models/_search?size=1&filter_path=hits.hits._id" \
      -H "Content-Type: application/json" \
      -d "{
        \"query\": {
          \"bool\": {
            \"must\": [
              {\"match\": {\"name\": \"${SPARSE_MODEL_NAME}\"}},
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

    if [ "$attempt" -lt 5 ]; then
      echo "Sparse model lookup returned status ${response_status}; retrying (${attempt}/5)..." >&2
      sleep 2
    fi
  done

  # Not deployed — check if model exists in any state (REGISTERED, DEPLOYING, etc.)
  response=$(curl -sS -ku "${OS_USER}:${OS_PASS}" \
    -X POST "${OS_URL}/_plugins/_ml/models/_search?size=1&filter_path=hits.hits._id" \
    -H "Content-Type: application/json" \
    -d "{
      \"query\": {
        \"bool\": {
          \"must\": [
            {\"match\": {\"name\": \"${SPARSE_MODEL_NAME}\"}},
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
    echo "Sparse model lookup returned status ${response_status}; attempting registration fallback." >&2
  fi

  # If model already exists in any state, return its id (ensure_model_deployed will handle deploy)
  if [ -n "$model_id" ]; then
    echo "$model_id"
    return 0
  fi

  # Register and deploy sparse model
  register_response=$(curl -sS -ku "${OS_USER}:${OS_PASS}" \
    -X POST "${OS_URL}/_plugins/_ml/models/_register?deploy=true&filter_path=task_id" \
    -H "Content-Type: application/json" \
    -d "{
      \"name\": \"${SPARSE_MODEL_NAME}\",
      \"version\": \"${SPARSE_MODEL_VERSION}\",
      \"model_group_id\": \"${model_group_id}\",
      \"model_format\": \"TORCH_SCRIPT\"
    }" \
    -w '\n%{http_code}')
  register_status="$(echo "$register_response" | sed -n '$p')"
  register_body="$(echo "$register_response" | sed '$d')"
  if [ "${register_status}" -ge 200 ] && [ "${register_status}" -lt 300 ]; then
    task_id="$(json_string "task_id" "$register_body")"
  else
    # Registration conflict — model may have been created concurrently; look it up
    response=$(curl -sS -ku "${OS_USER}:${OS_PASS}" \
      -X POST "${OS_URL}/_plugins/_ml/models/_search?size=1&filter_path=hits.hits._id" \
      -H "Content-Type: application/json" \
      -d "{
        \"query\": {
          \"bool\": {
            \"must\": [
              {\"match\": {\"name\": \"${SPARSE_MODEL_NAME}\"}},
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
    echo "Unable to start sparse model registration for ${SPARSE_MODEL_NAME}" >&2
    echo "$register_body" >&2
    exit 1
  fi

  wait_for_model_registration_task "$task_id"
}

ensure_ingest_pipeline () {
  local sparse_model_id="$1"

  # Ingest pipeline:
  # - Strips empty text/title fields
  # - Computes docType, textLength metadata, and title_text concat
  # - Content-hash gating: hashes title_text + sparse model_id, compares with stored
  #   contentHash. Embedding processors only fire when content actually changed.
  # - Clears old dense embeddings (text_semantic_semantic_info) on content change so
  #   the semantic field (skip_existing_embedding: true) knows to re-embed
  # - Copies title_text into text_semantic (semantic field handles its own embedding + chunking)
  # - Sparse-encodes title_text into text_sparse (rank_features, learned term expansion)
  # - Sanitizes sparse token keys (replaces dots, which rank_features rejects)
  os_api -s -o /dev/null \
    -X PUT "${OS_URL}/_ingest/pipeline/${INGEST_PIPELINE}" \
    -H "Content-Type: application/json" \
    -d "{
      \"description\": \"SN ingest: title_text concat + semantic + sparse + metadata\",
      \"processors\": [
        {
          \"remove\": {
            \"field\": \"text\",
            \"if\": \"ctx?.text != null && ctx.text.trim().length() == 0\"
          }
        },
        {
          \"remove\": {
            \"field\": \"title\",
            \"if\": \"ctx?.title != null && ctx.title.trim().length() == 0\"
          }
        },
        {
          \"script\": {
            \"source\": \"ctx.docType = (ctx.containsKey('parentId') && ctx.parentId != null) ? 'comment' : 'post'; ctx.textLength = ctx.containsKey('text') && ctx.text != null ? ctx.text.length() : 0; def t = ctx.containsKey('title') && ctx.title != null ? ctx.title : ''; def b = ctx.containsKey('text') && ctx.text != null ? ctx.text : ''; def sep = String.valueOf((char)10) + String.valueOf((char)10); ctx.title_text = t.length() > 0 && b.length() > 0 ? t + sep + b : (t.length() > 0 ? t : b); def hashInput = ctx.title_text + '|${sparse_model_id}'; def newHash = String.valueOf(hashInput.hashCode()); ctx.contentChanged = !newHash.equals(ctx.containsKey('contentHash') ? ctx.contentHash : ''); ctx.contentHash = newHash;\"
          }
        },
        {
          \"remove\": {
            \"field\": \"text_semantic_semantic_info\",
            \"if\": \"ctx.contentChanged == true\",
            \"ignore_missing\": true
          }
        },
        {
          \"remove\": {
            \"field\": [\"text_semantic\", \"text_sparse\"],
            \"if\": \"ctx.contentChanged == true && (ctx.title_text == null || ctx.title_text.length() == 0)\",
            \"ignore_missing\": true
          }
        },
        {
          \"set\": {
            \"field\": \"text_semantic\",
            \"value\": \"{{title_text}}\",
            \"if\": \"ctx.contentChanged == true && ctx?.title_text != null && ctx.title_text.length() > 0\"
          }
        },
        {
          \"sparse_encoding\": {
            \"model_id\": \"${sparse_model_id}\",
            \"field_map\": {
              \"title_text\": \"text_sparse\"
            },
            \"prune_type\": \"max_ratio\",
            \"prune_ratio\": 0.1,
            \"if\": \"ctx.contentChanged == true && ctx?.title_text != null && ctx.title_text.length() > 0\",
            \"ignore_failure\": true
          }
        },
        {
          \"script\": {
            \"source\": \"if (ctx.text_sparse != null) { def clean = new HashMap(); for (entry in ctx.text_sparse.entrySet()) { def k = entry.getKey().replace('.', '_'); if (k.length() > 0) { clean.put(k, entry.getValue()); } } ctx.text_sparse = clean; }\"
          }
        },
        {
          \"remove\": {
            \"field\": \"contentChanged\",
            \"ignore_missing\": true
          }
        }
      ]
    }"
}

ensure_search_pipeline () {
  # Search pipeline:
  # - N-leg equal-weight RRF: lexical + dense-semantic(chunked) + sparse
  # - Title neural leg removed: structurally biases against comments (no title → 0 contribution)
  # - No neural_query_enricher (conflicts with sparse analyzer; model_id set explicitly in queries)
  # - No explicit weights: RRF defaults to equal weighting for all 3 legs.
  os_api -s -o /dev/null \
    -X PUT "${OS_URL}/_search/pipeline/${SEARCH_PIPELINE}" \
    -H "Content-Type: application/json" \
    -d "{
      \"description\": \"SN hybrid search: N-leg equal-weight RRF — lexical + semantic + sparse\",
      \"phase_results_processors\": [
        {
          \"score-ranker-processor\": {
            \"combination\": {
              \"technique\": \"rrf\"
            }
          }
        }
      ]
    }"
}

create_neural_index () {
  local model_id="$1"
  local create_response

  create_response=$(os_api -s \
    -X PUT "${OS_URL}/${INDEX_NAME}" \
    -H "Content-Type: application/json" \
    -d "{
      \"settings\": {
        \"index.knn\": true,
        \"index.analyze.max_token_count\": 50000,
        \"index.search.default_pipeline\": \"${SEARCH_PIPELINE}\",
        \"similarity\": {
          \"default\": {
            \"type\": \"BM25\",
            \"k1\": 1.6,
            \"b\": 0.5
          }
        },
        \"analysis\": {
          \"filter\": {
            \"btc_synonyms\": {
              \"type\": \"synonym_graph\",
              \"synonyms\": [
                \"btc, bitcoin\",
                \"sats, satoshi, satoshis\",
                \"lightning, lightning network, ln\",
                \"utxo, unspent transaction output, utxos\",
                \"psbt, partially signed bitcoin transaction\",
                \"nostr, nostr protocol\",
                \"lnurl, lightning url\",
                \"hodl, hold\",
                \"nwc, nostr wallet connect\",
                \"lnd, lightning network daemon\",
                \"cln, core lightning, c-lightning\",
                \"xpub, extended public key\",
                \"xprv, extended private key\",
                \"taproot, schnorr\",
                \"dlc, discreet log contract, discreet log contracts\",
                \"lsp, lightning service provider\",
                \"hww, hardware wallet\",
                \"kyc, know your customer\",
                \"aml, anti money laundering\",
                \"dca, dollar cost averaging\",
                \"sn, stacker news\",
                \"op_return, opreturn\",
                \"mempool, mem pool\",
                \"segwit, segregated witness\",
                \"multisig, multi sig, multi-sig, multi signature\",
                \"ecash, e-cash, chaumian ecash\",
                \"coinjoin, coin join\",
                \"payjoin, pay join\",
                \"bip, bitcoin improvement proposal\",
                \"bolt, basis of lightning technology\",

                \"pow, proof of work\",
                \"cpfp, child pays for parent\",
                \"rbf, replace by fee\",
                \"ibd, initial block download\",
                \"spv, simplified payment verification\",
                \"p2pkh, pay to public key hash\",
                \"p2sh, pay to script hash\",
                \"p2wsh, pay to witness script hash\",
                \"p2tr, pay to taproot\",
                \"htlc, hash time locked contract\",
                \"halving, halvening\",

                \"seed phrase, recovery phrase, mnemonic, backup phrase\",
                \"hd wallet, hierarchical deterministic wallet\",
                \"cold storage, cold wallet, offline wallet\",
                \"hot wallet, online wallet\",

                \"mpp, multi path payment, multipath payment\",
                \"amp, atomic multi path payment\",
                \"keysend, spontaneous payment\",
                \"watchtower, watch tower\",
                \"channel capacity, channel size\",
                \"inbound liquidity, receiving capacity\",

                \"self custody, self-custody\",
                \"on chain, on-chain, onchain\",
                \"off chain, off-chain, offchain\",
                \"non custodial, non-custodial, noncustodial\",
                \"open source, open-source, opensource\",
                \"zero conf, zero-conf, zeroconf\",

                \"bitvm, bit vm\",
                \"musig, musig2\",
                \"frost, flexible round optimized schnorr threshold\",
                \"silent payments, stealth addresses\",
                \"ark, ark protocol\",

                \"tor, onion routing\",
                \"vpn, virtual private network\",
                \"p2p, peer to peer\",
                \"rpc, remote procedure call\",

                \"ai, artificial intelligence\",
                \"ml, machine learning\",
                \"llm, large language model\",
                \"foss, free and open source software, open source software\",
                \"ux, user experience\",
                \"ui, user interface\",
                \"cli, command line interface, command line\",
                \"gui, graphical user interface\",
                \"2fa, two factor authentication\",
                \"mfa, multi factor authentication\"
              ]
            },
            \"en_stemmer\": { \"type\": \"stemmer\", \"language\": \"english\" },
            \"en_stop\": { \"type\": \"stop\", \"stopwords\": \"_english_\" },
            \"en_possessive\": { \"type\": \"stemmer\", \"language\": \"possessive_english\" }
          },
          \"analyzer\": {
            \"bitcoin_index\": {
              \"tokenizer\": \"standard\",
              \"filter\": [\"lowercase\", \"asciifolding\", \"en_possessive\", \"en_stop\", \"en_stemmer\"]
            },
            \"bitcoin_search\": {
              \"tokenizer\": \"standard\",
              \"filter\": [\"lowercase\", \"asciifolding\", \"btc_synonyms\", \"en_possessive\", \"en_stop\", \"en_stemmer\"]
            }
          }
        }
      },
      \"mappings\": {
        \"dynamic\": \"false\",
        \"properties\": {
          \"id\": { \"type\": \"long\" },
          \"parentId\": { \"type\": \"long\" },
          \"createdAt\": { \"type\": \"date\" },
          \"updatedAt\": { \"type\": \"date\" },
          \"status\": { \"type\": \"keyword\" },
          \"userId\": { \"type\": \"long\" },
          \"docType\": { \"type\": \"keyword\" },

          \"title\": {
            \"type\": \"text\",
            \"analyzer\": \"bitcoin_index\",
            \"search_analyzer\": \"bitcoin_search\",
            \"fields\": {
              \"exact\": { \"type\": \"text\", \"analyzer\": \"standard\" },
              \"keyword\": { \"type\": \"keyword\", \"ignore_above\": 512 }
            }
          },
          \"text\": {
            \"type\": \"text\",
            \"analyzer\": \"bitcoin_index\",
            \"search_analyzer\": \"bitcoin_search\",
            \"fields\": {
              \"exact\": { \"type\": \"text\", \"analyzer\": \"standard\" }
            }
          },

          \"text_semantic\": {
            \"type\": \"semantic\",
            \"model_id\": \"${model_id}\",
            \"raw_field_type\": \"text\",
            \"skip_existing_embedding\": true,
            \"dense_embedding_config\": {
              \"method\": {
                \"name\": \"hnsw\",
                \"engine\": \"lucene\",
                \"parameters\": {
                  \"m\": 16,
                  \"ef_construction\": 128
                }
              }
            },
            \"chunking\": [
              {
                \"algorithm\": \"delimiter\",
                \"parameters\": { \"delimiter\": \"\\n\\n\" }
              },
              {
                \"algorithm\": \"fixed_token_length\",
                \"parameters\": {
                  \"token_limit\": 220,
                  \"overlap_rate\": 0.2
                }
              }
            ]
          },

          \"title_text\": {
            \"type\": \"text\",
            \"analyzer\": \"bitcoin_index\",
            \"search_analyzer\": \"bitcoin_search\",
            \"fields\": {
              \"exact\": { \"type\": \"text\", \"analyzer\": \"standard\" }
            }
          },

          \"text_sparse\": {
            \"type\": \"rank_features\"
          },

          \"url\": { \"type\": \"text\", \"fields\": { \"keyword\": { \"type\": \"keyword\", \"ignore_above\": 2048 } } },
          \"ranktop\": { \"type\": \"long\" },
          \"ncomments\": { \"type\": \"integer\" },
          \"wvotes\": { \"type\": \"integer\" },
          \"textLength\": { \"type\": \"integer\" },
          \"bookmarkedBy\": { \"type\": \"long\" },

          \"user\": {
            \"properties\": {
              \"name\": { \"type\": \"keyword\" }
            }
          },
          \"subNames\": { \"type\": \"keyword\" },
          \"sub\": {
            \"properties\": {
              \"name\": { \"type\": \"keyword\" }
            }
          },

          \"company\": { \"type\": \"text\" },
          \"location\": { \"type\": \"text\" },
          \"remote\": { \"type\": \"boolean\" },
          \"lastCommentAt\": { \"type\": \"date\" },

          \"contentHash\": { \"type\": \"keyword\", \"index\": false, \"doc_values\": false }
        }
      }
    }")

  # Verify the index was created successfully
  if echo "$create_response" | grep -q '"error"'; then
    echo "ERROR: Failed to create index ${INDEX_NAME}:" >&2
    echo "$create_response" >&2
    exit 1
  fi
  echo "OpenSearch index ${INDEX_NAME} created."

  # Verify critical mapping fields are present (catches silent drops from OS)
  local mapping_check
  mapping_check=$(curl -sS -ku "${OS_USER}:${OS_PASS}" \
    -X GET "${OS_URL}/${INDEX_NAME}/_mapping" 2>/dev/null || echo "{}")
  local missing_fields=""
  for field in title_text text_semantic text_sparse user; do
    if ! echo "$mapping_check" | grep -q "\"${field}\""; then
      missing_fields="${missing_fields} ${field}"
    fi
  done
  if [ -n "$missing_fields" ]; then
    echo "ERROR: Index created but missing required mapping fields:${missing_fields}" >&2
    echo "Full mapping response:" >&2
    echo "$mapping_check" >&2
    exit 1
  fi
}

ensure_neural_index () {
  local model_id="$1"
  local index_exists

  index_exists=$(curl -s -o /dev/null -w "%{http_code}" -I -ku "${OS_USER}:${OS_PASS}" "${OS_URL}/${INDEX_NAME}")
  if [ "$index_exists" -ne 200 ]; then
    create_neural_index "$model_id"
    return 0
  fi

  echo "OpenSearch index ${INDEX_NAME} already exists; checking schema compatibility."

  # Validate required fields exist for 3-leg hybrid search
  local mapping_response
  mapping_response=$(curl -sS -ku "${OS_USER}:${OS_PASS}" \
    -X GET "${OS_URL}/${INDEX_NAME}/_mapping" 2>/dev/null || echo "{}")
  local missing_fields=""
  for field in title_text text_semantic text_sparse user; do
    if ! echo "$mapping_response" | grep -q "\"${field}\""; then
      missing_fields="${missing_fields} ${field}"
    fi
  done
  if [ -n "$missing_fields" ]; then
    echo "ERROR: Existing index is missing required fields:${missing_fields}" >&2
    echo "This index was created with an older/incompatible schema." >&2
    echo "Delete the index and restart to recreate with the new schema:" >&2
    echo "  sndev delete opensearch   # or:" >&2
    echo "  curl -X DELETE '${OS_URL}/${INDEX_NAME}' -ku '${OS_USER}:****'" >&2
    exit 1
  fi

  # Ensure search pipeline is attached (default_pipeline is set at the end
  # of the bootstrap, after seed import, as a readiness signal for the worker).
  os_api -s -o /dev/null \
    -X PUT "${OS_URL}/${INDEX_NAME}/_settings" \
    -H "Content-Type: application/json" \
    -d "{
      \"index.search.default_pipeline\": \"${SEARCH_PIPELINE}\"
    }" || echo "Warning: could not update search pipeline setting on existing index." >&2
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
echo "Ensuring dense embedding model is registered."
dense_model_id="$(ensure_model "$model_group_id")"
echo "Ensuring sparse encoding model is registered."
sparse_model_id="$(ensure_sparse_model "$model_group_id")"
echo "Sparse model ID: ${sparse_model_id}"
echo "Ensuring NLP pipelines exist."
ensure_ingest_pipeline "$sparse_model_id"
ensure_search_pipeline
echo "Ensuring index ${INDEX_NAME} is neural-ready."
ensure_neural_index "$dense_model_id"

# --- Seed data import (dev convenience) ---
# Seed file format: gzipped two-section file
#   Section 1: _bulk NDJSON (all fields + sparse vectors, no dense)
#   ---DENSE_EMBEDDINGS_FLOAT16_BASE64---
#   Section 2: NDJSON with float16 base64-encoded dense embeddings
#
# Both sections are merged in Python and bulk-indexed in one pass so that
# text_semantic_semantic_info persists (the semantic field type silently
# drops it on update operations; only index operations preserve it).
SEED_FILE="/usr/share/opensearch/seed-embeddings.gz"
DENSE_MARKER="---DENSE_EMBEDDINGS_FLOAT16_BASE64---"

if [ -f "$SEED_FILE" ]; then
  doc_count=$(curl -sS -ku "${OS_USER}:${OS_PASS}" \
    "${OS_URL}/${INDEX_NAME}/_count" 2>/dev/null \
    | sed -nE 's/.*"count"[[:space:]]*:[[:space:]]*([0-9]+).*/\1/p')
  doc_count="${doc_count:-0}"

  if [ "$doc_count" -eq 0 ]; then
    echo "Loading seed data from ${SEED_FILE}..."
    seed_start=$(date +%s)

    # Extract both sections to temp files
    gunzip -c "$SEED_FILE" | sed "/${DENSE_MARKER}/,\$d" > /tmp/sparse_bulk.ndjson
    gunzip -c "$SEED_FILE" | sed -n "/${DENSE_MARKER}/,\$p" | tail -n +2 > /tmp/dense_seed.ndjson

    # Merge sparse + dense in Python then bulk-index (not update).
    # The semantic field type silently drops text_semantic_semantic_info
    # on update operations, so we must use index with the full document.
    python3 -u - "$OS_URL" "$OS_USER" "$OS_PASS" "$INDEX_NAME" "$sparse_model_id" \
      /tmp/sparse_bulk.ndjson /tmp/dense_seed.ndjson <<'PYEOF'
import sys, json, struct, base64, urllib.request, ssl, hashlib

OS_URL, OS_USER, OS_PASS, INDEX, SPARSE_MODEL_ID, SPARSE_FILE, DENSE_FILE = sys.argv[1:8]
BATCH = 200
ctx = ssl._create_unverified_context()
auth = base64.b64encode(f"{OS_USER}:{OS_PASS}".encode()).decode()

def decode_f16(b64, dim):
    buf = base64.b64decode(b64)
    return [struct.unpack_from('<e', buf, i*2)[0] for i in range(dim)]

def java_hash(s):
    h = 0
    for c in s:
        h = (31 * h + ord(c)) & 0xFFFFFFFF
    return h if h < 0x80000000 else h - 0x100000000

def content_hash(doc):
    t = doc.get('title') or ''
    b = doc.get('text') or ''
    sep = '\n\n'
    tt = (t + sep + b) if t and b else (t or b)
    return str(java_hash(tt + '|' + SPARSE_MODEL_ID))

def bulk_send(lines):
    body = '\n'.join(lines) + '\n'
    req = urllib.request.Request(
        f"{OS_URL}/{INDEX}/_bulk?pipeline=_none",
        data=body.encode(),
        headers={'Content-Type':'application/x-ndjson','Authorization':f'Basic {auth}'},
        method='POST')
    with urllib.request.urlopen(req, context=ctx) as r:
        resp = json.loads(r.read())
    return sum(1 for it in resp.get('items',[]) if 'error' in it.get('index',it.get('create',{})))

# Phase 1: read sparse docs into memory
docs = {}
with open(SPARSE_FILE) as f:
    lines = f.readlines()
for i in range(0, len(lines)-1, 2):
    action = json.loads(lines[i])
    doc = json.loads(lines[i+1])
    _id = str(action.get('index',action.get('create',{})).get('_id',''))
    if _id:
        docs[_id] = doc
print(f"seed: loaded {len(docs)} sparse docs into memory", file=sys.stderr, flush=True)

# Phase 2: merge dense embeddings
dense_merged = 0
with open(DENSE_FILE) as f:
    for line in f:
        line = line.strip()
        if not line:
            continue
        rec = json.loads(line)
        _id = str(rec['_id'])
        if _id not in docs:
            continue
        chunks = []
        for c in rec.get('chunks', []):
            emb = decode_f16(c['embedding_b64'], c['dim'])
            chunks.append({'text': c['text'], 'embedding': emb})
        docs[_id]['text_semantic_semantic_info'] = {
            'chunks': chunks, 'model': rec.get('model', {})
        }
        dense_merged += 1
print(f"seed: merged {dense_merged} dense embeddings", file=sys.stderr, flush=True)

# Phase 3: compute contentHash and bulk-index all docs
total = errs = 0
batch = []
for _id, doc in docs.items():
    doc['contentHash'] = content_hash(doc)
    batch.append(json.dumps({"index":{"_index":INDEX,"_id":_id}},separators=(',',':')))
    batch.append(json.dumps(doc,separators=(',',':')))
    if len(batch) >= BATCH * 2:
        errs += bulk_send(batch)
        total += len(batch) // 2
        print(f"seed: {total} docs indexed ({errs} errors)", file=sys.stderr, flush=True)
        batch = []
if batch:
    errs += bulk_send(batch)
    total += len(batch) // 2
print(f"seed: complete — {total} docs indexed, {dense_merged} with dense embeddings, {errs} errors",
      file=sys.stderr, flush=True)
PYEOF
    rm -f /tmp/dense_seed.ndjson /tmp/sparse_bulk.ndjson

    seed_end=$(date +%s)
    echo "Seed import complete in $((seed_end - seed_start))s."
  else
    echo "Index already has ${doc_count} docs; skipping seed import."
  fi
else
  echo "No seed file found at ${SEED_FILE}; skipping seed import."
fi

# Deploy models now — registration was done earlier so IDs were available
# for pipeline/index creation and seed import, but inference isn't needed
# until the default_pipeline is activated below.
echo "Deploying dense embedding model..."
ensure_model_deployed "$dense_model_id"
echo "Deploying sparse encoding model..."
ensure_model_deployed "$sparse_model_id"

# Set the default ingest pipeline LAST — the worker uses its presence as a
# "bootstrap complete" signal, so nothing should write to the index before
# seeds are loaded and the pipeline is ready.
os_api -s -o /dev/null \
  -X PUT "${OS_URL}/${INDEX_NAME}/_settings" \
  -H "Content-Type: application/json" \
  -d "{\"index.default_pipeline\": \"${INGEST_PIPELINE}\"}"

echo "OpenSearch neural bootstrap complete (3-leg hybrid: title_text lexical + semantic + sparse)."
wait "$opensearch_pid"
