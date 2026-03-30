#!/usr/bin/env bash

# test if every node can pay invoices from every other node

SN_LND_PUBKEY=034fcbe80658a2b0e32d416ca34c91cf359f7010b3529582fce6b1deddfadb2ba6
LND_PUBKEY=03eff113993bd7dbb43f5e923d5569ecefa43e3cc7ce5b5634a4b6854d4b287dfa
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
