FROM node:24.22.1-bookworm@sha256:5630d96570d4ca4a8523fda3d169d0114554d0f48293e1ae3db6be7c79b42a17 AS patched_node

FROM ghcr.io/puppeteer/puppeteer:25.16.0@sha256:956a72e3d523c76606efaad23392fbe33950370189f749715222c7427f57392b

EXPOSE 5678

USER root
WORKDIR /home/pptruser

# Pin node
COPY --from=patched_node /usr/local/bin/node /usr/local/bin/node
ENV NODE_VERSION=24.22.1
RUN node -e "require('node:assert/strict').equal(process.version, 'v24.22.1')"

ENV PUPPETEER_SKIP_DOWNLOAD=true
COPY ./package*.json ./
RUN npm ci

COPY . .

ADD https://deb.debian.org/debian/pool/main/f/fonts-noto-color-emoji/fonts-noto-color-emoji_0~20200916-1_all.deb fonts-noto-color-emoji.deb
RUN dpkg -i fonts-noto-color-emoji.deb
RUN find $(pwd) -name "chrome" -type f | head -n 1 | xargs -I{} ln -s {} /usr/local/bin/chrome

CMD [ "node", "index.js" ]
USER pptruser
