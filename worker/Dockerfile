# syntax=docker/dockerfile:1

FROM node:14.21.3-bullseye

ENV NODE_ENV=development

COPY wait-for-it.sh /usr/local/bin/wait-for-it.sh

WORKDIR /app

EXPOSE 8080