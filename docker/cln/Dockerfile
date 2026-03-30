FROM polarlightning/clightning:24.11

# make sure that wallet and identity is persisted across rebuilds
# https://docs.corelightning.org/docs/grpc#generating-custom-certificates-optional
COPY ["./hsm_secret", "./ca-key.pem", "./ca.pem", "./server-key.pem", "./server.pem", "./client-key.pem", "./client.pem", "/home/clightning/.lightning/regtest/"]