FROM debian:bookworm-slim
RUN useradd -u 1000 -m lncd

ARG VERSION=0.3.1
ARG REPO=stackernews/lncd
ARG DOWNLOAD_URL=https://github.com/$REPO/releases/download/$VERSION/lncd

RUN mkdir -p /home/lncd 
ADD certs /home/lncd/certs

ENV LNCD_TLS_CERT_PATH=/home/lncd/certs/cert.pem
ENV LNCD_TLS_KEY_PATH=/home/lncd/certs/key.pem

RUN chown 1000:1000 -Rvf /home/lncd/ &&\
apt-get update && apt-get install -y curl &&\
apt-get clean && rm -rf /var/lib/apt/lists/*

USER lncd
RUN curl --proto '=https' --tlsv1.2 -LsSf $DOWNLOAD_URL -o /home/lncd/lncd && chmod +x /home/lncd/lncd
WORKDIR /home/lncd
EXPOSE 7167

CMD ["./lncd"]