-- AlterTable
ALTER TABLE "Item" ADD COLUMN     "mcredits" BIGINT NOT NULL DEFAULT 0;

-- AlterTable
ALTER TABLE "ItemUserAgg" ADD COLUMN     "zapCredits" BIGINT NOT NULL DEFAULT 0;

-- AlterTable
ALTER TABLE "users" ADD COLUMN     "mcredits" BIGINT NOT NULL DEFAULT 0,
ADD COLUMN     "receiveCreditsBelowSats" INTEGER NOT NULL DEFAULT 10,
ADD COLUMN     "sendCreditsBelowSats" INTEGER NOT NULL DEFAULT 10;
