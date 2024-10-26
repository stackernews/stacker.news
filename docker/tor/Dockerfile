FROM debian:bookworm

RUN apt-get update -y \
    && apt-get install -y tor bash openssl netcat-traditional privoxy \
    && apt-get clean \
    && rm -rf /var/lib/apt/lists/* /tmp/* /var/tmp/*

ADD torrc /etc/tor/torrc.template
ADD tor.sh /tor.sh
ADD services.conf /services.conf
ADD privoxy.conf  /etc/privoxy/config
RUN mkdir -p /tordata && groupadd -g 1000 tor && useradd -u 1000 -g 1000 -m tor && chown -R tor:tor /tordata
EXPOSE 9050 9051 7050 7051
VOLUME "/tordata"
USER tor
ENTRYPOINT [ "bash", "/tor.sh" ]
