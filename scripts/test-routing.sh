#!/usr/bin/env bash

# test if every node can pay invoices from every other node

SN_LND_PUBKEY=02cb2e2d5a6c5b17fa67b1a883e2973c82e328fb9bd08b2b156a9e23820c87a490
LND_PUBKEY=028093ae52e011d45b3e67f2e0f2cb6c3a1d7f88d2920d408f3ac6db3a56dc4b35
CLN_PUBKEY=03ca7acec181dbf5e427c682c4261a46a0dd9ea5f35d97acb094e399f727835b90

# -e: exit on first failure | -x: print commands
set -ex

sndev cli lnd queryroutes $SN_LND_PUBKEY 1000
sndev cli lnd queryroutes $CLN_PUBKEY 1000

sndev cli sn_lnd queryroutes $LND_PUBKEY 1000
sndev cli sn_lnd queryroutes $CLN_PUBKEY 1000

# https://docs.corelightning.org/reference/lightning-getroute
sndev cli cln getroute $LND_PUBKEY 1000 0
sndev cli cln getroute $SN_LND_PUBKEY 1000 0
