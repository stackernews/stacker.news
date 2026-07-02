Use these NWC strings to attach the protocol:

* sending:

Use a connection that supports `pay_invoice`. To recover proof/status after an
uncertain send, the same connection must also support `lookup_invoice`. To show
balances in the wallet list, it must also support `get_balance`.

run the following command:
```
sndev logs --since 0  nwc_send | awk '/nostr\+walletconnect/{print $3; exit}'
```

- receiving:

Use a connection that supports `make_invoice`. To recover proof/status after
invoice creation, the same connection must also support `lookup_invoice`.
The connection must NOT allow spending (`pay_invoice`, `pay_keysend`,
`multi_pay_invoice`, `multi_pay_keysend`): the secret is stored on the server,
so the attach test rejects any connection that advertises a spend method.

run the following command:
```
sndev logs --since 0  nwc_recv | awk '/nostr\+walletconnect/{print $3; exit}'
```
