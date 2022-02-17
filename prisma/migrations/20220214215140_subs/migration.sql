-- CreateEnum
CREATE TYPE "PostType" AS ENUM ('LINK', 'DISCUSSION', 'JOB');

-- CreateEnum
CREATE TYPE "RankingType" AS ENUM ('WOT', 'RECENT', 'AUCTION');

-- AlterTable
ALTER TABLE "Item" ADD COLUMN     "latitude" DOUBLE PRECISION,
ADD COLUMN     "location" TEXT,
ADD COLUMN     "longitude" DOUBLE PRECISION,
ADD COLUMN     "maxBid" INTEGER,
ADD COLUMN     "maxSalary" INTEGER,
ADD COLUMN     "minSalary" INTEGER,
ADD COLUMN     "remote" BOOLEAN,
ADD COLUMN     "subName" CITEXT;

-- CreateTable
CREATE TABLE "Sub" (
    "name" CITEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "postTypes" "PostType"[],
    "rankingType" "RankingType" NOT NULL,
    "baseCost" INTEGER NOT NULL DEFAULT 1,

    PRIMARY KEY ("name")
);

-- AddForeignKey
ALTER TABLE "Item" ADD FOREIGN KEY ("subName") REFERENCES "Sub"("name") ON DELETE SET NULL ON UPDATE CASCADE;


INSERT INTO "Sub" (name, created_at, updated_at, "postTypes", "rankingType", "baseCost")
VALUES ('jobs', now(), now(), '{JOB}', 'AUCTION', 10000)
ON CONFLICT DO NOTHING;