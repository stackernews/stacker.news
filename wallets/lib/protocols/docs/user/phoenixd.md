---
title: Official Phoenixd Guide
id: 1212375
sub: meta
---

# Official Phoenixd Guide

last updated: September 8, 2025

Requirements:

- [phoenixd](https://phoenix.acinq.co/server)
- reachable from the internet via clearnet and HTTPS
- some experience with networking: HTTPS, reverse proxy, CORS

## Setup phoenixd

1. Download latest phoenixd release from Github [here](https://github.com/ACINQ/phoenixd/releases)
2. Unzip and run the `phoenixd` binary

see [official documentation](https://phoenix.acinq.co/server/get-started)


By default, it binds to 127.0.0.1 on port 9740. To make it reachable from the internet, you need to pass `--http-bind.ip=0.0.0.0` or run a reverse proxy.

You also need to enable Cross-Origin Resource Sharing (CORS) for sending.

Here is an example nginx site config with CORS and HTTPS:

```nginx
upstream phoenixd {
  server 127.0.0.1:9740;
}

server {
    server_name phoenixd.ekzy.is;
    listen      80;
    listen      [::]:80;

    return 301 https://phoenixd.ekzy.is$request_uri;
}

server {
    server_name         phoenixd.ekzy.is;
    listen              443 ssl;
    listen              [::]:443 ssl;

    ssl_certificate     /etc/letsencrypt/live/phoenixd.ekzy.is/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/phoenixd.ekzy.is/privkey.pem;

    location / {
      if ($request_method = OPTIONS) {
        return 204;
      }

      add_header 'Access-Control-Allow-Origin' '*' always;
      add_header 'Access-Control-Allow-Headers' '*' always;
      add_header 'Access-Control-Allow-Methods' 'GET,POST,OPTIONS,PUT,DELETE,PATCH' always;

      proxy_set_header Host $http_host;
      proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
      proxy_set_header X-Forwarded-Proto $scheme;
      proxy_set_header X-Forwarded-Prefix /;
      proxy_pass http://phoenixd$request_uri;
   }
}
```

## Attach send

Enter the URL to your phoenixd instance and what can be found as `http-password` in your phoenixd config (default location: ~/.phoenix/phoenix.conf).

see [official documentation](https://phoenix.acinq.co/server/api#security)

## Attach receive

Enter the URL to your phoenixd instance and what can be found as `http-password-limited-access` in your phoenixd config (default location: ~/.phoenix/phoenix.conf).

see [official documentation](https://phoenix.acinq.co/server/api#security)
