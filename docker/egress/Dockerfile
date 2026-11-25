# syntax=docker/dockerfile:1
FROM golang:1.26-bookworm@sha256:5de7c99eb78ca5e515a4c340235d0955ec5964a5071c492c15503d7c267da473 AS build
WORKDIR /src
RUN git init && git remote add origin https://github.com/stripe/smokescreen.git && \
    git fetch --depth=1 origin 5b4b7aabca9bc70a8435358d648edd03294c299e && git checkout FETCH_HEAD
RUN --mount=type=cache,target=/root/.cache/go-build \
    CGO_ENABLED=0 go build -mod=vendor -trimpath -ldflags='-s -w' -o /smokescreen .

FROM debian:bookworm-slim@sha256:734a72b3d6142a71993b4bc580ca01d8ca687f77a2c422d96a961d3376b179bc
COPY --from=build /smokescreen /smokescreen
COPY smokescreen.yaml /etc/egress/
USER 65532:65532
ENTRYPOINT ["/smokescreen", "--config-file", "/etc/egress/smokescreen.yaml"]
HEALTHCHECK --interval=5s --timeout=3s --retries=5 CMD bash -c '</dev/tcp/127.0.0.1/4750'
