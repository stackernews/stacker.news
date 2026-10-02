FROM ghcr.io/puppeteer/puppeteer:25.11.0

EXPOSE 5678

USER root
WORKDIR /home/pptruser

ENV PUPPETEER_SKIP_DOWNLOAD=true
COPY ./package*.json ./
RUN npm ci

COPY . .

ADD https://deb.debian.org/debian/pool/main/f/fonts-noto-color-emoji/fonts-noto-color-emoji_0~20200916-1_all.deb fonts-noto-color-emoji.deb
RUN dpkg -i fonts-noto-color-emoji.deb
RUN find $(pwd) -name "chrome" -type f | head -n 1 | xargs -I{} ln -s {} /usr/local/bin/chrome

CMD [ "node", "index.js" ]
USER pptruser

