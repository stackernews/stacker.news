FROM rust:1.78

RUN wget https://github.com/benthecarman/nostr-wallet-connect-lnd/archive/9d53490f0a0cf655030e4ef4d32b478d7f29af5b.zip \
 && unzip 9d53490f0a0cf655030e4ef4d32b478d7f29af5b.zip

WORKDIR nostr-wallet-connect-lnd-9d53490f0a0cf655030e4ef4d32b478d7f29af5b

RUN apt-get update -y \
  && apt-get install -y cmake \
  && apt-get clean \
  && rm -rf /var/lib/apt/lists/* /tmp/* /var/tmp/*
RUN cargo build --release && cargo install --path .

COPY keys.json .
