# syntax=docker/dockerfile:1

FROM node:14.17.0

ENV NODE_ENV=development

WORKDIR /app

EXPOSE 8080
# Install dependencies
# COPY index.js .
CMD npm install pg pg-boss --loglevel verbose; node worker/index.js
# RUN node index.js