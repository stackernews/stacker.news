# syntax=docker/dockerfile:1

FROM node:18.17.0-bullseye

ENV NODE_ENV=development

WORKDIR /app

EXPOSE 3000

EXPOSE 9229

EXPOSE 9230

EXPOSE 9231

EXPOSE 9232

CMD npm install --loglevel verbose --legacy-peer-deps; npx prisma migrate dev; npm run dev