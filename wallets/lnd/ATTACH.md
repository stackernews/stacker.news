# Attaching an LND Node to Stacker News

This guide explains how to attach your LND (Lightning Network Daemon) node as a receiving wallet on Stacker News. This allows you to automatically receive payments to your node.

## Prerequisites

- A running LND node
- Access to `lncli` command line tool
- If using the development environment: access to `sndev` commands

## Required Information

You'll need three pieces of information to attach your LND node:

1. Host and port (socket)
2. Invoice macaroon
3. TLS certificate (optional for some setups)

### 1. Socket (Host and Port)

For clearnet connections, use:
```
your-node-ip:10009
```

For Tor connections (recommended for better privacy):
```bash
# Get your onion address in development:
sndev onion lnd

# Then use the onion address with port 10009:
your-onion-address.onion:10009
```

### 2. Invoice Macaroon

You need a macaroon with invoice read and write permissions. You can either:

A. Use your existing `invoice.macaroon` (less secure but convenient)

B. Generate a new limited macaroon (recommended for better security):
```bash
# In development:
sndev cli lnd -n regtest bakemacaroon invoices:write invoices:read

# On your production node:
lncli bakemacaroon invoices:write invoices:read
```

### 3. TLS Certificate

The TLS certificate is required unless your node uses a certificate from a known Certificate Authority (CA).

```bash
# In development:
sndev cert lnd

# On your production node:
cat ~/.lnd/tls.cert | base64
```

## Security Considerations

1. The macaroon you provide should ONLY have invoice reading and writing permissions
2. Use Tor connections when possible for better privacy
3. Keep your macaroon secure - it grants permission to create invoices on your node

## Troubleshooting

If you encounter connection issues:
1. Verify your node is accessible from the internet (if using clearnet)
2. Check that your firewall allows connections to port 10009
3. Verify the macaroon has the correct permissions
4. Ensure your TLS certificate is valid and properly encoded

For more detailed information about LND wallet integration, refer to the [Wallets README](../README.md).
