#!/bin/bash

ONION_DOMAIN=""

if [ -f /home/lnd/.tor/hidden_service/hostname ]; then
    ONION_DOMAIN=$(cat /home/lnd/.tor/hidden_service/hostname)
fi

# expand the cmd arguments 
args=$(echo "$@" | sed -e "s/\${ONION_DOMAIN}/$ONION_DOMAIN/g")

# Execute the original entry point script with the modified command line``
/entrypoint.sh $args