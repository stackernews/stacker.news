FROM node:18.20.4-bullseye

# Install ffmpeg
RUN apt-get update -y && apt-get install --no-install-recommends -y ffmpeg && apt-get clean

WORKDIR /app

COPY package*.json ./
RUN npm install

COPY . .

EXPOSE 3002

CMD ["node", "server.js"]