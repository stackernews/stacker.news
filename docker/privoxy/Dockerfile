FROM debian:bookworm-slim@sha256:734a72b3d6142a71993b4bc580ca01d8ca687f77a2c422d96a961d3376b179bc
RUN apt-get update && apt-get install -y --no-install-recommends privoxy \
    && rm -rf /var/lib/apt/lists/*
COPY config /etc/privoxy/config
USER privoxy
ENTRYPOINT ["privoxy", "--no-daemon", "/etc/privoxy/config"]
HEALTHCHECK --interval=5s --timeout=3s --retries=5 CMD bash -c '</dev/tcp/127.0.0.1/8118'
