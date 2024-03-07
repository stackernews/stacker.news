# syntax=docker/dockerfile:1

FROM node:18.17.0-bullseye

ENV NODE_ENV=development

WORKDIR /app

EXPOSE 3000

RUN npm ci --loglevel verbose --legacy-peer-deps
CMD npx prisma migrate dev && npm run dev