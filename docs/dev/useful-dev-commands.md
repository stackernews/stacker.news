# Useful dev commands

### `nvm use 18`
Switch to use nodejs version 18 in your current shell

### `docker-compose up --build -d`
Bring up stacker news app via local docker services

### `docker-compose down`
Take down stacker news app via local docker services

### `DATABASE_URL=postgresql://sn:password@localhost:5431/stackernews?schema=public npx prisma migrate dev --create-only`
Create a new prisma migration based on comparing [`schema.prisma`](../prisma/schema.prisma) against your local database

### `DATABASE_URL=postgresql://sn:password@localhost:5431/stackernews?schema=public npx prisma migrate dev`
Create and apply a new prisma migration based on comparing [`schema.prisma`](../prisma/schema.prisma) against your local database

### `npx prisma generate`
Generate the local copy of the prisma ORM client in `node_modules`. This should only be needed to get Intellisense in your editor locally.

### `DATABASE_URL=postgresql://sn:password@localhost:5431/stackernews?schema=public node prisma/seed.js`
Seed your local database

### `psql "postgresql://sn:password@localhost:5431/stackernews"`
Connect to your local database via `psql`

### `docker network connect stackernews_default polar-n1-alice`
Connect your local polar lnd node to the shared docker network (container name may vary)

### `docker network inspect stackernews_default`
Review local docker network