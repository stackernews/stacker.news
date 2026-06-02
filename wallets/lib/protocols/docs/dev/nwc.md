Use these NWC strings to attach the protocol:

* sending:

Use a connection that supports `pay_invoice`. To show balances in the wallet list,
the same connection must also support `get_balance`.

run the following command:
```
sndev logs --since 0  nwc_send | awk '/nostr\+walletconnect/{print $3; exit}'
```

- receiving:

run the following command:
```
sndev logs --since 0  nwc_recv | awk '/nostr\+walletconnect/{print $3; exit}'
```
