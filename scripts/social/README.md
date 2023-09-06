# Scripts for automated social posting

Let it rip:

`./run.sh &`

## Overview

`./run.sh` # This is the main script. It checks the time and decides when to do stuff.

`./check-top-story.sh` # This is called regularly. If a new post hits the top rank, it blares it out.

`./check-rewards.sh` # This checks for pending rewards and if greater than threshold, publicizes it.

`./check-weekly-stories.sh` # This gathers a summary of how many stackers posted stories and posts it.

`./check-stackers.sh` # This ranks the top 3 stackers and reports about it.

`./send-all.sh <text>` # This broadcasts `<text>` to the social networks.

`./send-nostr.sh <text>` # This publishes `<text>` as an event on Nostr.

`./send-twitter.sh <text>` # This tweets out `<text>` on Twitter.

You can run any of the scripts manually for testing purposes. (And they will call any of the scripts below them as needed.)

## Setup your social networks

Install and configure your social network tools and accounts as follows:

For nostr, we use [fiatjaf/noscl](https://github.com/fiatjaf/noscl). Follow existing installation and setup docs.

For twitter, we use [twitter/twurl](https://github.com/twitter/twurl). Follow existing installation and setup docs.

## Notes and more info

See issue #434.
