For testing litd as an attached receiving wallet, you'll need a pairing phrase:

This can be done one of two ways:

# cli

We only need permissions for the uri `/lnrpc.Lightning/SendPaymentSync`

```bash
$ sndev stacker_litcli accounts create --balance <budget>
```

Grab the `account.id` from the output and use it here:
```bash
$ sndev stacker_litcli sessions add --type custom --label <your label> --account_id <account_id> --uri /lnrpc.Lightning/SendPaymentSync
```

Grab the `pairing_secret_mnemonic` from the output and that's your pairing phrase.

# gui

To open the gui, run:

```bash
sndev open litd
```

Or navigate to `http://localhost:8443` in your browser.

1. If it's not open click on the hamburger menu in the top left.
2. Click `Lightning Node Connect`
3. Click on `Create a new session`, give it a label, select `Custom` in perimissions, and click `Submit`.
4. Select `Custodial Account`, fill in the balance, and click `Submit`.
5. Copy using the copy icon in the bottom left of the session card.

