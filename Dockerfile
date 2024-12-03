# syntax=docker/dockerfile:1

FROM node:18.20.4-bullseye

# ENV NODE_ENV=production

WORKDIR /app

EXPOSE 3000

# COPY . .
# SHELL ["/bin/bash", "-c"] 
# RUN set -a && source .env.development && source .env.production && set +a
# RUN cp .env.development .env.production
# RUN npm ci --legacy-peer-deps --loglevel verbose
# RUN npm run build --verbose
CMD ["/bin/bash"]
