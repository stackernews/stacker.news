-- AlterEnum
ALTER TYPE "ItemActType" ADD VALUE 'DONT_LIKE_THIS';

-- AlterTable
ALTER TABLE "Item" ADD COLUMN     "weightedDownVotes" DOUBLE PRECISION NOT NULL DEFAULT 0;

-- AlterTable
ALTER TABLE "users" ADD COLUMN     "wildWestMode" BOOLEAN NOT NULL DEFAULT false;
