## Automated Setup (Default)

Semantic search bootstraps automatically in dev when the `search` profile is enabled.

1. Ensure `search` is enabled in `COMPOSE_PROFILES`:

   ```.env
   COMPOSE_PROFILES=...,search,...
   ```

2. Start your dev environment:

   ```bash
   ./sndev start
   ```

3. Wait for OpenSearch bootstrap to finish on first boot (model registration and deployment can take a few minutes).

No manual migration script is required for the default `OPENSEARCH_INDEX` flow.

## Current Search Architecture

### Indexed fields used by search

- `title_text` (text): concatenated title/body lexical field
- `text_semantic` (semantic): dense semantic field
- `text_sparse` (rank_features): sparse expansion field
- `docType` (keyword): `post` or `comment`
- `textLength` (integer): body length metadata

### Query legs

The default search query is hybrid RRF over:

1. Lexical (`title_text` + filters)
2. Semantic (`neural` query on `text_semantic`)
3. Sparse (`neural_sparse` query on `text_sparse`)

Both pipelines are set by bootstrap:

- ingest pipeline: `nlp-ingest-pipeline`
- search pipeline: `nlp-search-pipeline`

## Troubleshooting

### Existing index is incompatible

If bootstrap reports missing required fields for an existing index, use the supported path:

1. Delete the incompatible OpenSearch data/index
2. Restart the stack
3. Let bootstrap recreate mappings and pipelines

Do not use one-off mapping migration scripts.

### Confirm mappings and pipelines

```bash
curl -sS -ku "admin:${OPENSEARCH_INITIAL_ADMIN_PASSWORD}" \
  "http://localhost:9200/${OPENSEARCH_INDEX:-item}/_mapping"

curl -sS -ku "admin:${OPENSEARCH_INITIAL_ADMIN_PASSWORD}" \
  "http://localhost:9200/_ingest/pipeline/nlp-ingest-pipeline"

curl -sS -ku "admin:${OPENSEARCH_INITIAL_ADMIN_PASSWORD}" \
  "http://localhost:9200/_search/pipeline/nlp-search-pipeline"
```

## Optional Local Overrides

If you need a dedicated index/model for debugging, set overrides in `.env.local` and restart:

```bash
OPENSEARCH_INDEX=<custom index>
OPENSEARCH_MODEL_ID=<dense model id>
```
