#!/bin/bash

# to be run daily at 4:00 p.m. CT

REWARDS_THRESHOLD=125000
REWARDS_RESULT=rewards.out

curl \
	--request POST \
	--header "content-type: application/json" \
	--url "https://stacker.news/api/graphql" \
	--data '{"query":"{ rewards { total }}"}' \
	2> /dev/null \
	> $REWARDS_RESULT

REWARDS_NUMBER=`cat $REWARDS_RESULT | grep -Pom1 '"total":\K[0-9]*(?=})'`
REWARDS_AMOUNT=`echo $REWARDS_NUMBER | sed -r 's/(.+)[0-9][0-9][0-9]$/\1k/'`
REWARDS_AMOUNT=`echo $REWARDS_AMOUNT | sed -r 's/(.+)[0-9][0-9][0-9]k$/\1M/'`

if (( $REWARDS_NUMBER >= $REWARDS_THRESHOLD )); then

read -r -d '' BODY << EOM
In 8 hours, we're giving away over $REWARDS_AMOUNT sats to all the best zappers on Stacker News!

https://stacker.news/rewards/r/sn
EOM

./send-all.sh "$BODY"

fi
