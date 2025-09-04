#!/usr/bin/env bash

# Sends a lightning payment using CLNRest
# Usage: ./clnrest_pay.sh <bolt11>

if [ $# -eq 0 ]; then
    echo "Usage: $0 <bolt11>"
    echo "Example: $0 lnbc..."
    exit 1
fi

BOLT11=$1
# add rune here
# $ sndev cli clnrest createrune restrictions='["method=pay"]'
RUNE=
NODE_ID=02cb2e2d5a6c5b17fa67b1a883e2973c82e328fb9bd08b2b156a9e23820c87a490

curl -X POST \
    -H "Content-Type: application/json" \
    -H "Rune: $RUNE" \
    -H "nodeId: $NODE_ID" \
    -d "{\"bolt11\":\"$BOLT11\"}" \
    --cacert docker/cln/ca.pem \
    -v \
    https://localhost:9092/v1/pay
