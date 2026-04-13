# Spark development notes

## Network selection

Spark runs on the network specified by `NEXT_PUBLIC_SPARK_NETWORK` (the same value is read on server and client):

- `REGTEST` in local development (default via `.env.development`)
- `MAINNET` in production (default via `.env.production`)
- `TESTNET` / `SIGNET` are accepted for staging when set explicitly

The SDK talks to hosted Lightspark infrastructure for whichever network is chosen; there is no fully-offline Spark. Staging environments must set `NEXT_PUBLIC_SPARK_NETWORK=TESTNET` (or similar) explicitly — `NODE_ENV=production` alone will mint MAINNET invoices.

## Sndev limitations

Hosted Spark `REGTEST` has no channel graph peering with `sndev`'s local `sn_lnd`. End-to-end Spark zaps inside `sndev` **cannot settle** — a Spark client wallet has no route to pay a locally-generated `sn_lnd` invoice, and vice versa. Previously this repo shipped a mock shim that mirrored Spark hodl invoices to local `sn_lnd`, but only the receive side was ever wired up (the client send path bypassed the mock entirely), so the shim was deleted.

For sndev wallet-attach / form-flow QA:

1. Put a BIP-39 phrase funded on Lightspark regtest in `.env.local` as `SPARK_SERVICE_MNEMONIC`.
2. Attach Spark receive with any Spark identity pubkey — the server mints invoices via the service wallet.
3. Attach Spark send by entering a payer mnemonic. `testSendPayment` initializes the wallet and calls `getBalance()` to verify SSP reachability; it does not attempt a real payment.
4. Real zaps between sndev users via Spark will not settle. Use `scripts/spark-live-e2e.mjs` for end-to-end verification.

## Live SDK check

To verify the real Spark SDK path against hosted `REGTEST`, run the live check inside the app container:

```bash
docker exec app sh -lc 'RUN_SPARK_LIVE=1 \
SPARK_SERVICE_MNEMONIC="<service mnemonic>" \
SPARK_PAYER_MNEMONIC="<funded payer mnemonic>" \
SPARK_RECEIVER_MNEMONIC="<receiver mnemonic>" \
node scripts/spark-live-e2e.mjs'
```

Notes:
- the payer must be funded on its `sparkrt...` address via the [Lightspark regtest faucet](https://app.lightspark.com/regtest-faucet)
- the script uses the real Spark service-wallet shape: service wallet creates the invoice for the receiver identity, payer wallet pays it, and the script checks that the returned preimage hashes to the invoice payment hash

## Production rollout

Spark is gated behind `SN_ADMIN_IDS` in production until the first mainnet payments land cleanly. See `wallets/README.md` for the operator threat model and rollout checklist.

Spark uses the repo-wide `no_grpc_proxy` exclusion list, so no Spark-specific proxy env vars are needed.
