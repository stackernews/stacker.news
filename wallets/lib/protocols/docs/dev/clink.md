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
