For testing lnd as an attached receiving wallet, you'll need a macaroon and the cert.

# host and port

`lnd:10009`

## host and port (onion)

To get the onion address run this command:

```bash
sndev onion lnd
```

Then use port 10009 on the onion address.

# generate macaroon

```bash
sndev cli lnd -n regtest bakemacaroon invoices:write invoices:read
```

# get cert

To get the cert run this command:

```bash
sndev cert lnd
```
