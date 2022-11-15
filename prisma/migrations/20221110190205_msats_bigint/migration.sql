-- AlterTable
ALTER TABLE "Earn" ALTER COLUMN "msats" SET DATA TYPE BIGINT;

-- AlterTable
ALTER TABLE "Invoice" ALTER COLUMN "msatsRequested" SET DATA TYPE BIGINT,
ALTER COLUMN "msatsReceived" SET DATA TYPE BIGINT;

-- AlterTable
ALTER TABLE "Item"
ALTER COLUMN "commentSats" SET DATA TYPE BIGINT,
ALTER COLUMN "sats" SET DATA TYPE BIGINT;

-- AlterTable
ALTER TABLE "Item" RENAME COLUMN "commentSats" TO "commentMsats";
ALTER TABLE "Item" RENAME COLUMN "sats" TO "msats";

-- update to msats
UPDATE "Item" SET
"commentMsats" = "commentMsats" * 1000,
"msats" = "msats" * 1000;

-- AlterTable
ALTER TABLE "ItemAct"
ALTER COLUMN "sats" SET DATA TYPE BIGINT;

-- AlterTable
ALTER TABLE "ItemAct" RENAME COLUMN "sats" TO "msats";

-- update to msats
UPDATE "ItemAct" SET
"msats" = "msats" * 1000;

-- AlterTable
ALTER TABLE "Withdrawl" ALTER COLUMN "msatsPaying" SET DATA TYPE BIGINT,
ALTER COLUMN "msatsPaid" SET DATA TYPE BIGINT,
ALTER COLUMN "msatsFeePaying" SET DATA TYPE BIGINT,
ALTER COLUMN "msatsFeePaid" SET DATA TYPE BIGINT;

-- AlterTable
ALTER TABLE "users" ALTER COLUMN "msats" SET DEFAULT 0,
ALTER COLUMN "msats" SET DATA TYPE BIGINT,
ALTER COLUMN "stackedMsats" SET DEFAULT 0,
ALTER COLUMN "stackedMsats" SET DATA TYPE BIGINT;