#!/bin/bash

ONION_DOMAIN=""

if [ -f /home/lnd/.tor/hidden_service/hostname ]; then
    ONION_DOMAIN=$(cat /home/lnd/.tor/hidden_service/hostname)
fi

# expand or strip the onion domain argument
if [ -n "$ONION_DOMAIN" ]; then
    args=$(echo "$@" | sed -e "s/\${ONION_DOMAIN}/$ONION_DOMAIN/g")
else
    args=$(echo "$@" | sed -e "s/--tlsextradomain=\${ONION_DOMAIN}//g")
fi

# Execute the original entry point script with the modified command line``
/entrypoint.sh $args