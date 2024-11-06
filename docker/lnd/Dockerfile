FROM polarlightning/lnd:0.18.0-beta

ARG LN_NODE_FOR
ENV LN_NODE_FOR=$LN_NODE_FOR

RUN apt-get update -y \
  && apt-get install -y jq \
  && apt-get clean \
  && rm -rf /var/lib/apt/lists/* /tmp/* /var/tmp/*

COPY ["./$LN_NODE_FOR/regtest/*", "/home/lnd/.lnd/data/chain/bitcoin/regtest/"]
COPY ["./$LN_NODE_FOR/tls.*", "/home/lnd/.lnd/"]