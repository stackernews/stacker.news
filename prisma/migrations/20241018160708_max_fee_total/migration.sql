-- AlterTable
ALTER TABLE "users" ADD COLUMN     "autoWithdrawMaxFeeTotal" INTEGER;

-- set max total fee for users with autowithdrawals enabled to not interfere with them.
-- we set it to 0 instead of 1 because that preserves old behavior.
UPDATE "users"
SET "autoWithdrawMaxFeeTotal" = 0
WHERE "autoWithdrawMaxFeePercent" IS NOT NULL;
