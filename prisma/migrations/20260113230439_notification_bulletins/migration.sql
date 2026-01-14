-- CreateEnum
CREATE TYPE "NotificationIconType" AS ENUM ('MAP');

-- CreateTable
CREATE TABLE "NotificationBulletin" (
    "id" SERIAL NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "title" TEXT NOT NULL,
    "text" TEXT NOT NULL,
    "iconType" "NotificationIconType",

    CONSTRAINT "NotificationBulletin_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "NotificationBulletin_created_at_idx" ON "NotificationBulletin"("created_at");

INSERT INTO "NotificationBulletin" ("title", "text", "iconType","created_at") VALUES (
    'Howdy stranger, welcome to Stacker News!',
    E'Check out our FAQ [**here**](/faq) or our guide [**here**](/guide). Get started by [**creating your bio**](https://stacker.news/me) and [**commenting in the Saloon**](https://stacker.news/daily).\n\nIf you''re here to earn sats, you''ll want to [**attach a wallet**](https://stacker.news/wallets).',
    'MAP',
    '2021-01-13 00:00:00');