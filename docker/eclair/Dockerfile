# based on https://github.com/LN-Zap/bolt12-playground
FROM acinq/eclair:0.11.0


ENTRYPOINT JAVA_OPTS="${JAVA_OPTS}" eclair-node/bin/eclair-node.sh "-Declair.datadir=${ECLAIR_DATADIR}"

#################
# Builder image #
#################
FROM maven:3.8.6-openjdk-11-slim AS builder

RUN apt-get update \
    && apt-get install -y --no-install-recommends \
    git \
    && apt-get clean \
    && rm -rf /var/lib/apt/lists/*

# References for eclair
ARG ECLAIR_REF=b73a009a1d7d7ea3a158776cd233512b9a538550
ARG ECLAIR_PLUGINS_REF=cdc26dda96774fdc3b54075df078587574891fb7

WORKDIR /usr/src/eclair
RUN git clone https://github.com/ACINQ/eclair.git . \
    && git reset --hard ${ECLAIR_REF}
RUN mvn install -pl eclair-node -am -DskipTests -Dgit.commit.id=notag -Dgit.commit.id.abbrev=notag

WORKDIR /usr/src/eclair-plugins
RUN git clone https://github.com/ACINQ/eclair-plugins.git . \
    && git reset --hard ${ECLAIR_PLUGINS_REF}
WORKDIR /usr/src/eclair-plugins/bolt12-tip-jar
RUN mvn package -DskipTests

# ###############
# # final image #
# ###############
FROM openjdk:11.0.16-jre-slim-bullseye
WORKDIR /opt

# Add utils
RUN apt-get update \
    && apt-get install -y --no-install-recommends \
    bash jq curl unzip \
    && apt-get clean \
    && rm -rf /var/lib/apt/lists/*

# copy and install eclair-cli executable
COPY --from=builder /usr/src/eclair/eclair-core/eclair-cli .
RUN chmod +x eclair-cli && mv eclair-cli /sbin/eclair-cli

# we only need the eclair-node.zip to run
COPY --from=builder /usr/src/eclair/eclair-node/target/eclair-node-*.zip ./eclair-node.zip
RUN unzip eclair-node.zip && mv eclair-node-* eclair-node && chmod +x eclair-node/bin/eclair-node.sh

# copy and install bolt12-tip-jar plugin
COPY --from=builder /usr/src/eclair-plugins/bolt12-tip-jar/target/bolt12-tip-jar-0.10.1-SNAPSHOT.jar .

ENV ECLAIR_DATADIR=/data
ENV JAVA_OPTS=

RUN mkdir -p "$ECLAIR_DATADIR"
VOLUME [ "/data" ]

ARG LN_NODE_FOR
ENV LN_NODE_FOR=$LN_NODE_FOR
COPY ["./$LN_NODE_FOR/*", "/data"]

# ENTRYPOINT JAVA_OPTS="${JAVA_OPTS}" eclair-node/bin/eclair-node.sh "-Declair.datadir=${ECLAIR_DATADIR}"
ENTRYPOINT JAVA_OPTS="${JAVA_OPTS}" eclair-node/bin/eclair-node.sh bolt12-tip-jar-0.10.1-SNAPSHOT.jar "-Declair.datadir=${ECLAIR_DATADIR}"