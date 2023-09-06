#!/bin/bash

# to be run every Saturday at 12:00 p.m. CT

MAX=100000

POST_SEPARATOR_RESULT=weekly-posts.out

curl \
	--request POST \
	--header "content-type: application/json" \
	--url "https://stacker.news/api/graphql" \
	--data '{"variables":{"sort":"top","when":"week","limit":'$MAX'},"query":"query SubItems($sub: String, $sort: String, $cursor: String, $type: String, $name: String, $when: String, $by: String,$limit: Int) {    items(sub: $sub, sort: $sort, cursor: $cursor, type: $type, name: $name, when: $when, by: $by, limit: $limit) { items { id } } }"}' \
	2> /dev/null \
	| tr -cd ',' | wc -c \
	> $POST_SEPARATOR_RESULT

NUM_POSTS=$(( `cat $POST_SEPARATOR_RESULT` + 1 ))

POSTER_RESULT=weekly-posters.out

curl \
	--request POST \
	--header "content-type: application/json" \
	--url "https://stacker.news/api/graphql" \
	--data '{"variables":{"sort":"top","when":"week","limit":'$MAX'},"query":"query SubItems($sub: String, $sort: String, $cursor: String, $type: String, $name: String, $when: String, $by: String,$limit: Int) {    items(sub: $sub, sort: $sort, cursor: $cursor, type: $type, name: $name, when: $when, by: $by, limit: $limit) { items { userId } } }"}' \
	2> /dev/null \
	| tr -cs 0-9 '\n' | sort -u | wc -l \
	> $POSTER_RESULT

NUM_POSTERS=$(( `cat $POSTER_RESULT` ))

read -r -d '' BODY << EOM
This week $NUM_POSTERS stackers created $NUM_POSTS Stacker News posts, catch up on all the top stories from the last week!

https://stacker.news/top/posts/week @sn
EOM

./send-all.sh "$BODY"

