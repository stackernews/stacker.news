# This image uses fedora 40 because the official pre-built lndk binaries require
# glibc 2.39 which is not available on debian or ubuntu images.
FROM fedora:40

ENV INSTALLER_DOWNLOAD_URL="https://github.com/stackernews/lndk/releases/download/v0.2.0-maxfee"

RUN useradd -u 1000 -m lndk
RUN mkdir -p /home/lndk/.lndk 
COPY ["./tls-*", "/home/lndk/.lndk"]
RUN chown 1000:1000 -Rvf /home/lndk/.lndk && \
    chmod 644 /home/lndk/.lndk/tls-cert.pem && \
    chmod 600 /home/lndk/.lndk/tls-key.pem

USER lndk
RUN curl --proto '=https' --tlsv1.2 -LsSf $INSTALLER_DOWNLOAD_URL/lndk-installer.sh | sh
RUN echo 'source /home/lndk/.cargo/env' >> $HOME/.bashrc
WORKDIR /home/lndk
EXPOSE 7000
ENV PATH="/home/lndk/.cargo/bin:${PATH}"