#!/bin/bash

echo `date -u`
echo ========
echo "$1"
echo ----
./send-twitter.sh "$1"
./send-nostr.sh "$1"
echo .
