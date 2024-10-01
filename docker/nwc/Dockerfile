FROM rust:1.78

ARG KEY_FILE

RUN wget https://github.com/ekzyis/nostr-wallet-connect-lnd/archive/a02939c350191f8a6750a72d2456fbdf567e5848.zip \
 && unzip a02939c350191f8a6750a72d2456fbdf567e5848.zip

WORKDIR nostr-wallet-connect-lnd-a02939c350191f8a6750a72d2456fbdf567e5848

RUN apt-get update -y \
  && apt-get install -y cmake \
  && apt-get clean \
  && rm -rf /var/lib/apt/lists/* /tmp/* /var/tmp/*
RUN cargo build --release && cargo install --path .

COPY . .
