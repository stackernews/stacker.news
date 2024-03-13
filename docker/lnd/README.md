We assume control of certs so that the app container doesn't need to inspect lnd for these things.

For the admin.macaroon, we do the same but we also need to store `macaroons.db` because it contains the master key.

For the wallet addresses, we do the same but we also need to store `wallet.db` because it contains the master key.