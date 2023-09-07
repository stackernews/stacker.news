#!/bin/bash

# to be run periodically throughout the day

AD_USER_ID=9 # to exclude ads
TOP_POST_RESULT=top-post.out
TOP_POST_HISTORY=top-posts

curl \
	--request POST \
	--header "content-type: application/json" \
	--url "https://stacker.news/api/graphql" \
	--data '{"variables":{"sort":"top","when":"day","limit":1},"query":"query SubItems($sub: String, $sort: String, $cursor: String, $type: String, $name: String, $when: String, $by: String,$limit: Int) { items(sub: $sub, sort: $sort, cursor: $cursor, type: $type, name: $name, when: $when, by: $by, limit: $limit) { items { id userId title } } }"}' \
	2> /dev/null \
	> $TOP_POST_RESULT

TOP_POST_ID=`cat $TOP_POST_RESULT | grep -Pom1 '"id":"\K[0-9]*(?=")'`
TOP_POST_UID=`cat $TOP_POST_RESULT | grep -Pom1 '"userId":\K[0-9]*(?=,)'`
TOP_POST_TITLE=`cat $TOP_POST_RESULT | grep -Pom1 '"title":"\K[^"]*(?=")'`

touch $TOP_POST_HISTORY
TOP_POST_FOUND=`cat $TOP_POST_HISTORY|grep -Fx $TOP_POST_ID`

if [ "$TOP_POST_ID" != "$TOP_POST_FOUND" ] && [ "$TOP_POST_UID" != "$AD_USER_ID" ]; then

read -r -d '' BODY << EOM
🔥 Trending on SN 🔥

$TOP_POST_TITLE
https://stacker.news/items/$TOP_POST_ID/r/sn
EOM

if [ -z "$1" ]; then
	./send-all.sh "$BODY"
fi

echo $TOP_POST_ID >> $TOP_POST_HISTORY
sort -o $TOP_POST_HISTORY -u $TOP_POST_HISTORY

fi


