# syntax=docker/dockerfile:1

FROM node:18.20.4-bullseye

ENV NODE_ENV=development

RUN apt-get update \
    && apt-get install --no-install-recommends -y jq 

COPY docker-entrypoint.sh ./docker-entrypoint.sh
RUN chmod +x ./docker-entrypoint.sh

ARG UID
ARG GID
RUN groupadd -fg "$GID" apprunner
RUN useradd -om -u "$UID" -g "$GID" apprunner
USER apprunner

WORKDIR /app

ENTRYPOINT ["./docker-entrypoint.sh"]

CMD ["sh","-c","npm run worker:dev"]