#!/bin/bash

function initialize { 
    ####################### generate and save control password ########################
    cp -f /etc/tor/torrc.template /tordata/torrc
    TOR_PASSWORD=""
    if [ -f /tordata/.env.torpass ]; then source /tordata/.env.torpass; fi

    if [ -z "$torPassword" ]; then
        TOR_PASSWORD=$(openssl rand -hex 32)
        echo "TOR_PASSWORD=$TOR_PASSWORD" > /tordata/.env.torpass
    fi

    TOR_PASSWORD_HASH=$(tor --hash-password "$TOR_PASSWORD" 2>/dev/null | tail -n 1)
    echo "Replacing %HashedControlPassword% with $TOR_PASSWORD_HASH"
    sed -i "s|%HashedControlPassword%|$TOR_PASSWORD_HASH|g" /tordata/torrc
    ##################################################################################
}

function mergeServices {
    cat /services.conf >> /tordata/torrc
}

# There is a circular dependency between tor and stacker_lnd:
#  <-> tor needs stacker_lnd to be running to resolve the hidden service target
#  <-> stacker_lnd needs to wait for tor to start and generate the hidden service address
# Afaik there isn't an "official" solution for this issue.
#
# This workaround starts tor the first time without the lnd hidden service
# and then re-start tor with the full configuration after the lnd service is ready.


if [ -f /tordata/start.timestamp ];
then
    # Remove leftovers from a previous run
    rm /tordata/start.timestamp
fi

if [ "$1" = "check" ];
then
    if [ ! -f /tordata/start.timestamp ]; then
        # if still initializing we just check if the hidden service was generated and use this as a healthcheck
        if [ -f /tordata/hidden_service/hostname ]; then exit 0; else exit 1; fi
    else
        # run the real healthcheck
        echo -e 'AUTHENTICATE "'$TOR_PASSWORD'"\nGETINFO status/circuit-established\nQUIT' | nc 127.0.0.1 9051 | grep OK || exit 1
        exit 0
    fi
else
    # Step 1: we start tor with a fake hidden service that points to port 8080, 
    # just to get it to generate the hidden service data, then we kill it immediately after
    echo "Initializing..."
    initialize
    tor -f /tordata/torrc &
    pid=$!
    sleep 60
    kill $pid

    # debug
    ls /tordata/hidden_service/
    
    # Step 2: we merge the service configuration and start tor again
    echo "Starting tor..."
    initialize
    mergeServices
    date +%s > /tordata/start.timestamp
    tor -f /tordata/torrc
fi
