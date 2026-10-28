# syntax=docker/dockerfile:1

ARG NODE_VERSION
FROM node:${NODE_VERSION}-bookworm

ENV NODE_ENV=development

ARG UID
ARG GID
RUN groupadd -fg "$GID" apprunner
RUN useradd -om -u "$UID" -g "$GID" apprunner
USER apprunner

WORKDIR /app
