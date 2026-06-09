---
title: Official LNbits Guide
id: 1212223
sub: meta
---

# Official LNbits Guide

last updated: September 8, 2025

Requirements:

- [LNbits](https://lnbits.com/) v1.0.0 or later
- reachable from the internet via clearnet or tor (receive only)
- HTTPS required if not accessing over tor

## Attach send

For **url**, enter the URL to your LNbits web interface. It must start with https://. Onion URLs are not supported for sending.

For **admin key**, follow these steps:

1. Go to your LNbits web interface
2. Create a new wallet for Stacker News:

![](https://m.stacker.news/107021)

3. Copy and paste the admin key:

![](https://m.stacker.news/107022)

## Attach receive

For **url**, enter the URL to your LNbits web interface. http:// is supported for onion URLs.

For **invoice key**, follow the steps to [attach send](#attach-send) and copy the invoice/read key instead of the admin key:

![](https://m.stacker.news/107024)
