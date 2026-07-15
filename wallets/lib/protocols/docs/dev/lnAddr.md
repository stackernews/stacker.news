For testing lightning address autowithdraw, you'll need to reference a host reachable by the worker, e.g. `app:3000`.

You'll want to deposit in another nym's account using an address like: `nym@app:3000`.

## Proof/status

Lightning Address is LNURL-pay. If the provider's invoice callback returns the
optional LUD-21 `verify` URL, SN stores it with the external receive transaction
and polls it for `settled` plus `preimage`.

Providers that omit `verify` can still create invoices, but they do not expose a
later HTTP lookup path for SN to recover proof after invoice creation.
