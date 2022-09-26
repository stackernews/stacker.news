# syntax=docker/dockerfile:1

FROM node:14.17.0

ENV NODE_ENV=development

WORKDIR /app

EXPOSE 3000

CMD npm install --loglevel verbose; npx prisma migrate dev; npm run dev; node worker/index.js