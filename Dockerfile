# syntax=docker/dockerfile:1

FROM node:18.17.0-bullseye

ENV NODE_ENV=development

WORKDIR /app

EXPOSE 3000

RUN npm install --loglevel verbose --legacy-peer-deps
RUN npx prisma migrate dev
CMD npm run dev