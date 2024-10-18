-- AlterTable
ALTER TABLE "users" ADD COLUMN     "autoWithdrawMaxBaseFee" INTEGER;

-- set max_base_fee for users with autowithdrawals enabled to not interfere with them.
-- we set it to 0 instead of 1 because that preserves old behavior.
UPDATE "users"
SET "autoWithdrawMaxBaseFee" = 0
WHERE "autoWithdrawMaxFeePercent" IS NOT NULL;
