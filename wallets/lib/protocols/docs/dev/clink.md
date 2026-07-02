Testing CLINK is done with Lightning.Pub and Shockwallet.

Shockwallet PWA: https://my.shockwallet.app/

Steps for sending and receiving:

1. Run this command to get `nprofile` of the lnpub container

```
$ sndev logs --since 0 lnpub | grep -oE 'nprofile1\w+'
```

2. Go to https://my.shockwallet.app/sources
3. Add a new source and paste `nprofile`

sending:

4. Go to https://my.shockwallet.app/home (ndebit is populated when fetching tx history)
5. Go to https://my.shockwallet.app/lapps
6. Copy ndebit and paste into SN

receiving:

4. Go to https://my.shockwallet.app/offers
5. Reload page to make sure the offer is correctly updated
6. Copy offer and paste into SN

## Cancellation

The CLINK adapter must honor the wallet shell's `AbortSignal`. `SendNdebitRequest`
does not accept a signal, so the adapter uses `raceAbort` around the SDK call and
closes the nostr pool in `finally`.

The SDK also receives a `timeout` option and treats it as its own upper bound,
but that is not a replacement for `signal`. Direct sends may still settle after
the UI gives up; the "may still be in flight" warning in `send-form.js` is the
user-facing safeguard against double-pay.

## Proof/status

CLINK Debits return an immediate response to a direct payment request. For
standard Lightning settlement, that response can include `preimage`; for
internal settlement, it can acknowledge success without one.

CLINK Offers also define an optional payment receipt event after the invoice is
paid. That is an async Nostr receipt, not a later lookup endpoint. Supporting it
for receives would require persisting the original request identity and running
a subscription until payment or expiry.
