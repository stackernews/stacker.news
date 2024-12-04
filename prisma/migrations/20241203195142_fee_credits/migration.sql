-- AlterTable
ALTER TABLE "Item" ADD COLUMN     "mcredits" BIGINT NOT NULL DEFAULT 0,
ADD COLUMN     "commentMcredits" BIGINT NOT NULL DEFAULT 0;

-- AlterTable
ALTER TABLE "users" ADD COLUMN     "mcredits" BIGINT NOT NULL DEFAULT 0,
ADD COLUMN     "stackedMcredits" BIGINT NOT NULL DEFAULT 0,
ADD COLUMN     "receiveCreditsBelowSats" INTEGER NOT NULL DEFAULT 10,
ADD COLUMN     "sendCreditsBelowSats" INTEGER NOT NULL DEFAULT 10;

-- add mcredits check
ALTER TABLE users ADD CONSTRAINT "mcredits_positive" CHECK ("mcredits" >= 0) NOT VALID;
ALTER TABLE users ADD CONSTRAINT "stackedMcredits_positive" CHECK ("stackedMcredits" >= 0) NOT VALID;
