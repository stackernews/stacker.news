For testing Lightning Node Connect via litd as a sending wallet protocol, you'll need a pairing phrase:

This can be done one of two ways:

# cli

We need `/lnrpc.Lightning/SendPaymentSync` to send payments. To recover
proof/status after an uncertain send, the best session permission is
`/routerrpc.Router/TrackPaymentV2`. To show balances in the wallet list, the session must also allow
`/lnrpc.Lightning/ChannelBalance`.

## account session

```bash
$ sndev cli litd accounts create --balance <budget>
```

Grab the `account.id` from the output and use it here:
```bash
$ sndev cli litd sessions add --type account --label <your label> --account_id <account_id>
```

Grab the `pairing_secret_mnemonic` from the output and that's your pairing phrase.

To do all of above in one line with default values:

```bash
$ sndev cli litd sessions add --type account --label sndev --account_id $(sndev cli litd accounts create --balance 100000 | jq -r '.account.id') | jq -r '.session.pairing_secret_mnemonic'
```

## custom session

For a custom session with proof recovery and balance support:

```bash
$ sndev cli litd sessions add --type custom --label <your label> --uri /lnrpc.Lightning/SendPaymentSync --uri /routerrpc.Router/TrackPaymentV2 --uri /lnrpc.Lightning/ChannelBalance
```

For a custom send-only session, omit `--uri /routerrpc.Router/TrackPaymentV2`
and `--uri /lnrpc.Lightning/ChannelBalance`.

# gui

To open the gui, run:

```bash
sndev open litd
```

Or navigate to `http://localhost:8443` in your browser.

1. If it's not open click on the hamburger menu in the top left.
2. Click `Lightning Node Connect`
3. Click on `Create a new session`, give it a label, select `Custom` in permissions, and click `Submit`.
4. Select `Custodial Account`, fill in the balance, and click `Submit`.
5. Copy using the copy icon in the bottom left of the session card.
