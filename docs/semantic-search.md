Getting semantic search setup in OpenSearch is a multistep process.

### step 1: configure the ml plugin
```json
PUT _cluster/settings
{
  "persistent": {
        "plugins.ml_commons.only_run_on_ml_node": "false",
        "plugins.ml_commons.model_access_control_enabled": "true",
        "plugins.ml_commons.native_memory_threshold": "99"
      }
}
```

### step 2: create a model group
```json
POST /_plugins/_ml/model_groups/_register
{
  "name": "local_model_group",
  "description": "A model group for local models"
}
```

### step 3: register a pretained model to the model group
Importantly, we need to use a model that truncates input. Note the feature number of the model you're using, because we'll need to store those features. For example, the model below has 768 features.

```json
POST /_plugins/_ml/models/_register
{
  "name": "huggingface/sentence-transformers/all-mpnet-base-v2",
  "version": "1.0.1",
  "model_group_id": <model group id>,
  "model_format": "TORCH_SCRIPT"
}
```

### step 4: wait until the model registration is complete
```json
GET /_plugins/_ml/tasks/<task id from above>
```

### step 5: deploy the model
Note the model id
```json
POST /_plugins/_ml/models/<model id>/_deploy
```

### step 6: create an ingest pipeline
Most models choke on empty strings, so we remove them at an earlier stage in the pipeline. We also add the model to the pipeline which generates the embeddings.

```json
PUT /_ingest/pipeline/nlp-ingest-pipeline
{
  "description": "An NLP ingest pipeline",
  "processors": [
    {
      "remove": {
        "field": "text",
        "if": "ctx?.text?.trim() == ''"
      }
    },
    {
      "remove": {
        "field": "title",
        "if": "ctx?.title?.trim() == ''"
      }
    },
    {
      "text_embedding": {
        "model_id": "6whlBY0B2sj1ObjeeD5d",
        "field_map": {
          "text": "text_embedding",
          "title": "title_embedding"
        }
      }
    }
  ]
}
```

### step 7: create a new index with the knn_vector type
We'll need to create mappings for the embeddings which is also a convenient time to specifiy special analyzers for the text and title fields.

```json
PUT /item-nlp
{
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
}
```

### step 8: create a search pipeline for weighting term search and vector search
```json
PUT /_search/pipeline/nlp-search-pipeline
{
  "description": "Pre and post processor for hybrid search",
  "request_processors": [
    {
      "neural_query_enricher" : {
        "description": "Sets the default model ID at index and field levels (which doesn't actually work)",
        "default_model_id": <model id>,
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
}
```

### step 9: set it as the default search pipeline
```json
PUT /item-nlp/_settings
{
  "index.search.default_pipeline" : "nlp-search-pipeline"
}
```

### step 10: reindex your data if you have data
Warning: this take a very very long time.
```json
POST _reindex?wait_for_completion=false
{
  "source": {
    "index": "item"
  },
  "dest": {
    "index": "item-nlp"
  }
}
```

You can check the status of the reindexing with the following command:
```json
GET _tasks/<task id>
```

### step 11: search!
```json
GET /item-nlp/_search
{
  "_source": {
    "excludes": [
      "text_embedding",
      "title_embedding"
    ]
  },
  "size": 100,
  "function_score": {
    "query": {
      "hybrid": {
        "queries": [
          {
            "bool": {
              "should": [
                {
                  "neural": {
                    "title_embedding": {
                      "query_text": "etf bitcoin",
                      "model_id": <model id>,
                      "k": 100
                    }
                  }
                },
                {
                  "neural": {
                    "text_embedding": {
                      "query_text": "etf bitcoin",
                      "model_id": <model id>,
                      "k": 100
                    }
                  }
                }
              ],
              "filter": [
                {
                  "range": {
                    "wvotes": {
                      "gte": 0
                    }
                  }
                }
              ]
            }
          },
          {
            "bool": {
              "should": [
                {
                  "multi_match": {
                    "query": "etf bitcoin",
                    "type": "most_fields",
                    "fields": [
                      "title^1000",
                      "text"
                    ],
                    "minimum_should_match": "100%",
                    "boost": 10
                  }
                },
                {
                  "multi_match": {
                    "query": "etf bitcoin",
                    "type": "most_fields",
                    "fields": [
                      "title^1000",
                      "text"
                    ],
                    "minimum_should_match": "60%",
                    "boost": 1
                  }
                }
              ],
              "filter": [
                {
                  "range": {
                    "wvotes": {
                      "gte": 0
                    }
                  }
                }
              ]
            }
          }
        ]
      }
    },
    "functions": [
      {
        "field_value_factor": {
          "field": "wvotes",
          "modifier": "none",
          "factor": 1.2
        }
      },
      {
        "field_value_factor": {
          "field": "ncomments",
          "modifier": "ln1p",
          "factor": 1
        }
      }
    ]
  }
}
```

