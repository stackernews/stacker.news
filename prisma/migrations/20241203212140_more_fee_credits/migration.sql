/*
  Warnings:

  - You are about to drop the column `zapCredits` on the `ItemUserAgg` table. All the data in the column will be lost.

*/
-- AlterTable
ALTER TABLE "Item" ADD COLUMN     "commentMcredits" BIGINT NOT NULL DEFAULT 0;

-- AlterTable
ALTER TABLE "ItemUserAgg" DROP COLUMN "zapCredits";

-- AlterTable
ALTER TABLE "users" ADD COLUMN     "stackedMcredits" BIGINT NOT NULL DEFAULT 0;
