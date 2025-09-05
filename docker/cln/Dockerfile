FROM polarlightning/clightning:24.11

# make sure that wallet and identity is persisted across rebuilds.
# server certificates contain stacker_lnd as a custom domain.
# see https://docs.corelightning.org/docs/grpc#generating-custom-certificates-optional
# since CLNRest in CLNv23.08 seems to use client certificates, they also contain stacker_lnd as a custom domain.
# see https://github.com/ElementsProject/lightning/tree/v23.08/plugins/clnrest#configuration
COPY ["./hsm_secret", "./ca-key.pem", "./ca.pem", "./server-key.pem", "./server.pem", "./client-key.pem", "./client.pem", "/home/clightning/.lightning/regtest/"]