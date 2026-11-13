FROM debian:stable-slim AS lnd_base

ARG LND_VERSION
ENV PATH=/opt/lnd:$PATH

RUN apt-get update -y \
  && apt-get install -y curl gosu wait-for-it \
  && apt-get clean \
  && rm -rf /var/lib/apt/lists/* /tmp/* /var/tmp/*

RUN SYS_ARCH="$(dpkg --print-architecture)" \
  && curl -SLO https://github.com/lightningnetwork/lnd/releases/download/v${LND_VERSION}/lnd-linux-${SYS_ARCH}-v${LND_VERSION}.tar.gz \
  && tar -xzf *.tar.gz \
  && mkdir /opt/lnd \
  && mv ./lnd-linux-${SYS_ARCH}-v${LND_VERSION}/* /opt/lnd \
  && rm *.tar.gz

RUN curl -SLO https://raw.githubusercontent.com/lightningnetwork/lnd/master/contrib/lncli.bash-completion \
  && mkdir -p /etc/bash_completion.d \
  && mv lncli.bash-completion /etc/bash_completion.d/ \
  && curl -SLO https://raw.githubusercontent.com/scop/bash-completion/master/bash_completion \
  && mv bash_completion /usr/share/bash-completion/

COPY docker-entrypoint.sh /entrypoint.sh
COPY bashrc /home/lnd/.bashrc

RUN chmod a+x /entrypoint.sh

VOLUME ["/home/lnd/.lnd"]

EXPOSE 9735 8080 10000

ENTRYPOINT ["/entrypoint.sh"]

CMD ["lnd"]

FROM lnd_base

ARG LN_NODE_FOR
ENV LN_NODE_FOR=$LN_NODE_FOR

RUN apt-get update -y \
  && apt-get install -y jq \
  && apt-get clean \
  && rm -rf /var/lib/apt/lists/* /tmp/* /var/tmp/*

COPY ["./$LN_NODE_FOR/regtest/*", "/home/lnd/.lnd/data/chain/bitcoin/regtest/"]
COPY ["./$LN_NODE_FOR/tls.*", "/home/lnd/.lnd/"]

ADD tor-entrypoint.sh /tor-entrypoint
RUN chmod +x /tor-entrypoint