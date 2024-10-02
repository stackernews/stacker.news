# https://github.com/JonasProgrammer/docker-postgres-ip4r
FROM postgres:13.16

RUN apt-get update \
    && apt-get install --no-install-recommends -y postgresql-13-ip4r \
    && rm -rf /var/lib/apt/lists/*
