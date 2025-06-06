Use these NWC strings to attach the protocol:

* sending:

run the following command:
```
sndev logs --since 0  nwc_send | awk '/nostr\+walletconnect/{print $3; exit}'
```

- receiving:

run the following command:
```
sndev logs --since 0  nwc_recv | awk '/nostr\+walletconnect/{print $3; exit}'
```
