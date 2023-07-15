FROM ghcr.io/puppeteer/puppeteer:18.2.1

EXPOSE 5678

USER root
WORKDIR /home/pptruser

ENV PUPPETEER_SKIP_DOWNLOAD true
COPY ./package*.json ./
RUN npm ci

COPY . .

CMD [ "node", "index.js" ]
USER pptruser