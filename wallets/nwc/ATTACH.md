Use this NWC string to attach the wallet for payments:

```
nostr+walletconnect://5224c44600696216595a70982ee7387a04bd66248b97fefb803f4ed6d4af1972?relay=wss%3A%2F%2Frelay.damus.io&secret=0d1ef06059c9b1acf8c424cfe357c5ffe2d5f3594b9081695771a363ee716b67
```

This won't work for receives since it allows `pay_invoice`.

TODO: generate NWC string with only `make_invoice` as permission
