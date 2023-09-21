#!/bin/bash

# wait for opensearch API to come online
sleep 10
while ! (echo > /dev/tcp/127.0.0.1/9200) >/dev/null 2>&1; do
	sleep 1
done

# check if index is missing
ERR_RESP=`curl http://localhost:9200/item 2>/dev/null |grep index_not_found_exception`
if [ "$ERR_RESP" != "" ]; then
  echo $0: first-time run detected: creating index and mappings
  set -x

  curl 2>/dev/null -X PUT -H "Content-Type: application/json" http://localhost:9200/item \
    --data "{}"

  curl 2>/dev/null -X PUT -H "Content-Type: application/json" http://localhost:9200/item/_mapping \
    --data "{\"properties\":{\"wvotes\":{\"type\":\"integer\"}}}"

  curl 2>/dev/null -X PUT -H "Content-Type: application/json" http://localhost:9200/item/_mapping \
    --data "{\"properties\":{\"sats\":{\"type\":\"integer\"}}}"

  set +x
  echo $0: one-time initialization done
else
  echo $0: "indices and mappings detected: first-time check done"
fi


