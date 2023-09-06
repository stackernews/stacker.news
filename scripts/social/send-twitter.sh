#!/bin/bash

TWEET=`echo "$1" | awk '{printf "%s\\\\n", $0}'`

echo "$ twurl ..."
twurl \
	-X POST \
	-A "Content-type: application/json" \
	-d '{"text": "'"$TWEET"'"}' \
	"/2/tweets"
