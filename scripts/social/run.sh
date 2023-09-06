#!/bin/bash

# Main script. Keep this running.

# Settings

POLL_INTERVAL=60 # seconds
REWARDS_HOUR=16 # 4:00 p.m. daily
TOP_STORIES_HOUR=12 # 12:00 noon
TOP_STORIES_DAY=6 # Saturday
TOP_STACKERS_HOUR=12 # 12:00 noon
TOP_STACKERS_DAY=0 # Sunday


# Script logic begins

# This primer check prevents firing off an untimely post when starting the script the first time.
./check-top-story.sh skip

# for sanity
if [ "$HOURPRE" = "" ]; then
	HOURNUM=`date +%H`
	DAYNUM=`date +%u`
	echo `date -u`
	echo "Note: hour is $HOURNUM, day is $DAYNUM."
	echo "- Rewards post is at hour $REWARDS_HOUR"
	echo "- Top stories are at hour $TOP_STORIES_HOUR on day $TOP_STORIES_DAY"
	echo "- Stackerboard is at hour $TOP_STACKERS_HOUR on day $TOP_STACKERS_DAY"
	echo "- Trending top story is checked every $POLL_INTERVAL seconds"
fi

while :; do
sleep $POLL_INTERVAL
HOURNUM=`date +%H`
DAYNUM=`date +%u`

# check and post if there is a new top story
./check-top-story.sh

# bong... check the time
if [ "$HOURNUM" != "$HOURPRE" ]; then

	# is it time for the rewards alert?
	if [ "$HOURNUM" = "$REWARDS_HOUR" ] && [ "$HOURPRE" != "" ]; then
		echo hit rewards hour

		# check and post if upcoming rewards are large
		./check-rewards.sh
	fi

	# is it the time/day for the top stories of the week?
	if [ "$DAYNUM" = "$TOP_STORIES_DAY" ] && [ "$HOURNUM" = "$TOP_STORIES_HOUR" ] && [ "$HOURPRE" != "" ]; then
		echo hit story hour

		# post top stories of the week
		./check-weekly-stories.sh
	fi

	# is it the time/day for the weekly stackerboard?
	if [ "$DAYNUM" = "$TOP_STACKERS_DAY" ] && [ "$HOURNUM" = "$TOP_STACKERS_HOUR" ] && [ "$HOURPRE" != "" ]; then
		echo hit stacker hour

		# post top stackers of the week
		./check-stackers.sh
	fi
fi

HOURPRE=$HOURNUM
done

