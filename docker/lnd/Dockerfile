FROM polarlightning/lnd:0.17.4-beta

ARG LN_NODE_FOR

COPY ["./$LN_NODE_FOR/regtest/*", "/home/lnd/.lnd/data/chain/bitcoin/regtest/"]
COPY ["./$LN_NODE_FOR/tls.*", "/home/lnd/.lnd/"]