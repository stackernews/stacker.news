# This image uses fedora 40 because the official pre-built lndk binaries require
# glibc 2.39 which is not available on debian or ubuntu images.
FROM fedora:40
RUN useradd -u 1000 -m lndk
USER lndk
RUN curl --proto '=https' --tlsv1.2 -LsSf https://github.com/lndk-org/lndk/releases/download/v0.2.0/lndk-installer.sh | sh
RUN echo 'source /home/lndk/.cargo/env' >> $HOME/.bashrc
WORKDIR /home/lndk
EXPOSE 7000
ENV PATH="/home/lndk/.cargo/bin:${PATH}"