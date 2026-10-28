# syntax=docker/dockerfile:1
FROM dhi.io/node:22.23.4-debian13-dev@sha256:c904931fe7a507809b338fda960e9606a755c928d9115031a2165d5ca0b1e62d AS builder
USER root
RUN apt-get update && apt-get install -y --no-install-recommends python3 make g++ \
    && rm -rf /var/lib/apt/lists/*
WORKDIR /app
COPY package.json package-lock.json .npmrc .node-version ./
COPY prisma ./prisma
RUN npm ci --include=dev && node node_modules/prisma/build/index.js generate
COPY . .

# Next loads public app settings from .env.production.
ARG SN_BUILD_COMMIT
ENV NODE_ENV=production SN_BUILD_COMMIT=${SN_BUILD_COMMIT} NEXT_TELEMETRY_DISABLED=1
RUN test -n "$SN_BUILD_COMMIT"
# Let build-time imports construct clients without production secrets.
RUN --network=none DATABASE_URL=postgresql://build:build@127.0.0.1:1/build \
    OPENSEARCH_URL=http://127.0.0.1:1 LND_MAINTENANCE=true \
    NODE_OPTIONS=--max-old-space-size=6144 npm run build
RUN npm prune --omit=dev --ignore-scripts && rm -rf .next/cache

FROM dhi.io/node:22.23.4-debian13@sha256:7390ab11306fa78b4e3f47acaa08bddcaaabac850a01996d153a2e805360a741
ARG SN_BUILD_COMMIT
ENV NODE_ENV=production SN_BUILD_COMMIT=${SN_BUILD_COMMIT} NEXT_TELEMETRY_DISABLED=1 PORT=8080 HOME=/tmp
WORKDIR /app
COPY --from=builder --chown=1000:1000 /app /app
USER 1000:1000
EXPOSE 8080
ENTRYPOINT ["node"]
CMD ["--trace-warnings", "--max-old-space-size=4096", "--max-semi-space-size=128", "node_modules/next/dist/bin/next", "start", "--hostname", "0.0.0.0", "--port", "8080", "--keepAliveTimeout", "120000"]
