Use an address like `nym@localhost:3000` from browser-based attached wallets.
LNURL requests to the public development origin are translated to `SELF_URL`
server-side, so the app and worker can reach the same address internally.

## Proof/status

Lightning Address is LNURL-pay. If the provider's invoice callback returns the
optional LUD-21 `verify` URL, SN stores it with the external receive transaction
and polls it for `settled` plus `preimage`.

Providers that omit `verify` can still create invoices, but they do not expose a
later HTTP lookup path for SN to recover proof after invoice creation.
