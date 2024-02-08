# Testing Search

You may want to create an index that more closely resembles prod for testing search. The simplest way is to create an index that applies an english analyzer on `title` and `text` fields.

### Create a new index in OpenSearch
```bash
curl 
  \ -H "Content-Type: application/json" 
  \ -X PUT 
  \ -d '{"mappings":{"properties":{"text":{"type":"text","analyzer":"english","fields":{"keyword":{"type":"keyword","ignore_above":256}}},"title":{"type":"text","analyzer":"english","fields":{"keyword":{"type":"keyword","ignore_above":256}}}}}}' 
  \ "http://localhost:9200/english" 
  \ -ku admin:admin
```

### Reindex your documents into the `english` index
```bash
curl 
  \ -H "Content-Type: application/json" 
  \ -X POST 
  \ -d '{"source":{"index":"item"},"dest":{"index":"english"}}' 
  \ "http://localhost:9200/_reindex?wait_for_completion=false" 
  \ -ku admin:admin
```

### Update `.env.sample`

Search for `OPENSEARCH_INDEX=item` and replace it with `OPENSEARCH_INDEX=english`
