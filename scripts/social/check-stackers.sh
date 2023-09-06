#!/bin/bash

# to be run every Sunday at 12:00 p.m. CT

TOP_STACKERS_PART=top-stackers.out
TOP_STACKERS_RESULT=top-stackers-all.out
NUMFMT="numfmt --to=si --round=nearest"

rm $TOP_STACKERS_RESULT
touch $TOP_STACKERS_RESULT
CURSOR=
while :; do
curl \
	--request POST \
	--header "content-type: application/json" \
	--url "https://stacker.news/api/graphql" \
	--data '{"variables":{"cursor":"'$CURSOR'","sort":"top","type":"stackers","when":"week","by":"stacked"},"query":"query TopUsers($cursor: String, $when: String, $by: String) { topUsers(cursor: $cursor, when: $when, by: $by) { cursor users { name stacked } } }"}' \
	2> /dev/null \
	> $TOP_STACKERS_PART

echo -n `cat $TOP_STACKERS_PART` >> $TOP_STACKERS_RESULT

CURSOR=`cat $TOP_STACKERS_PART | grep -Pom1 '"cursor":"\K[^"]*(?=")'`
[ "$CURSOR" != "" ] || break
done

WEEK_STACKERS=`cat $TOP_STACKERS_RESULT | grep -Pom1 '"name":"\K[^"]*(?=")'`
WEEK_STACKED=`cat $TOP_STACKERS_RESULT | grep -Pom1 '"stacked":\K[0-9]*(?=})'`

NUM_STACKERS=`echo "$WEEK_STACKERS" | wc -l`

sum=0; while IFS= read -r num; do ((sum += num)); done < <(printf '%s\n' "$WEEK_STACKED");
NUM_STACKED=`$NUMFMT $sum`

STACKER1_NYM=`echo "$WEEK_STACKERS" | head -1 | tail -1`
STACKER2_NYM=`echo "$WEEK_STACKERS" | head -2 | tail -1`
STACKER3_NYM=`echo "$WEEK_STACKERS" | head -3 | tail -1`
STACKER1_SATS=`echo "$WEEK_STACKED" | head -1 | tail -1 | $NUMFMT`
STACKER2_SATS=`echo "$WEEK_STACKED" | head -2 | tail -1 | $NUMFMT`
STACKER3_SATS=`echo "$WEEK_STACKED" | head -3 | tail -1 | $NUMFMT`

read -r -d '' BODY << EOM
This week $NUM_STACKERS stackers earned $NUM_STACKED sats, who topped this week's leaderboard?

🥇 $STACKER1_NYM: $STACKER1_SATS
🥈 $STACKER2_NYM: $STACKER2_SATS
🥉 $STACKER3_NYM: $STACKER3_SATS

Full leaderboard 👇

https://stacker.news/top/stackers/week/r/sn
EOM

./send-all.sh "$BODY"

