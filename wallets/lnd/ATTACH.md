For testing lnd as an attached receiving wallet, you'll need a macaroon and the cert.

# host and port

`stacker_lnd:10009`

## host and port (onion)

To get the onion address run this command:

```bash
sndev stacker_lnd get_onion
```

# generate macaroon

```bash
sndev stacker_lndcli -n regtest bakemacaroon invoices:write invoices:read
```

# get cert

To get the cert run this command:

```bash
sndev stacker_lnd get_cert
```