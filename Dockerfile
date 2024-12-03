# syntax=docker/dockerfile:1

FROM node:18.20.4-bullseye

WORKDIR /app

EXPOSE 3000

COPY . .
RUN npm ci --legacy-peer-deps --loglevel verbose
RUN npm run build --verbose
CMD ["/bin/bash"]
