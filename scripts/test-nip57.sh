#!/usr/bin/env bash

# https://github.com/nostr-protocol/nips/blob/master/57.md
set -e

# test user with attached wallet
# TODO: attach wallet to test01 via psql if not already attached?
USERNAME=test01

# XXX this should match NOSTR_PRIVATE_KEY in .env.development
NOSTR_PRIVATE_KEY=5f30b7e7714360f51f2be2e30c1d93b7fdf67366e730658e85777dfcc4e4245f
NOSTR_PUBLIC_KEY=$(nak key public $NOSTR_PRIVATE_KEY)

SINCE=$(date +%s)

function create_event() {
    nak event -k 9734 \
        --tag p=$NOSTR_PUBLIC_KEY \
        --tag 'relays=wss://relay.primal.net' \
        --tag amount=100000
}

function url_encode() {
    cat - | jq -sRr @uri
}

function test_exit() {
    if [ $1 -eq 0 ]; then
        echo "worker publishes nip-57 zap receipts: PASSED"
    else
        echo "worker publishes nip-57 zap receipts: FAILED"
    fi
    exit $1
}

create_event | nak verify

# create a zap request event (kind 9734)
EVENT="$(create_event)"

echo "generated zap request event:"
echo "$EVENT" | jq

echo $EVENT | nak verify

# XXX make sure amount is higher than dust limit of receiver's wallet
echo -n "sending zap request event LNURL endpoint ... "
PR=$(curl -s "http://localhost:3000/api/lnurlp/$USERNAME/pay?amount=100000&nostr=$(echo $EVENT | url_encode)" | jq -r .pr)
echo "OK"

[ "$PR" == "null" ] && echo "error: LNURL endpoint did not return bolt11" && test_exit 1
echo $PR

sndev fund --cln $PR

# subscribe to zap receipt event (kind 9735)
echo -n "waiting for zap receipt event ... "
sleep 3
PR2=$(nak -q req -k 9735 -p $NOSTR_PUBLIC_KEY --limit 1 wss://relay.primal.net | jq -r '.tags[] | select(.[0] == "bolt11") | .[1]')
echo "OK"

[ "$PR" == "$PR2" ] && test_exit 0 || test_exit 1
