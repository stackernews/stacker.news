# syntax=docker/dockerfile:1

FROM node:18.20.4-bullseye

ENV NODE_ENV=development

ARG UID
ARG GID
RUN groupadd -fg "$GID" apprunner
RUN useradd -om -u "$UID" -g "$GID" apprunner
USER apprunner

WORKDIR /app