/*
  Warnings:

  - You are about to drop the column `itemActId` on the `Cure` table. All the data in the column will be lost.
  - You are about to drop the column `itemActId` on the `Infection` table. All the data in the column will be lost.
  - You are about to drop the column `invoiceActionState` on the `Item` table. All the data in the column will be lost.
  - You are about to drop the column `invoiceId` on the `Item` table. All the data in the column will be lost.
  - You are about to drop the column `invoicePaidAt` on the `Item` table. All the data in the column will be lost.
  - You are about to drop the column `latitude` on the `Item` table. All the data in the column will be lost.
  - You are about to drop the column `longitude` on the `Item` table. All the data in the column will be lost.
  - You are about to drop the column `maxBid` on the `Item` table. All the data in the column will be lost.
  - You are about to drop the column `maxSalary` on the `Item` table. All the data in the column will be lost.
  - You are about to drop the column `minSalary` on the `Item` table. All the data in the column will be lost.
  - You are about to drop the column `paidImgLink` on the `Item` table. All the data in the column will be lost.
  - You are about to drop the column `weightedComments` on the `Item` table. All the data in the column will be lost.
  - You are about to drop the column `invoiceActionState` on the `PollVote` table. All the data in the column will be lost.
  - You are about to drop the column `invoiceId` on the `PollVote` table. All the data in the column will be lost.
  - You are about to drop the column `invoiceActionState` on the `Upload` table. All the data in the column will be lost.
  - You are about to drop the column `invoiceId` on the `Upload` table. All the data in the column will be lost.
  - You are about to drop the column `invoiceId` on the `WalletLog` table. All the data in the column will be lost.
  - You are about to drop the column `withdrawalId` on the `WalletLog` table. All the data in the column will be lost.
  - You are about to drop the column `disableFreebies` on the `users` table. All the data in the column will be lost.
  - You are about to drop the column `freeComments` on the `users` table. All the data in the column will be lost.
  - You are about to drop the column `freePosts` on the `users` table. All the data in the column will be lost.
  - You are about to drop the column `greeterMode` on the `users` table. All the data in the column will be lost.
  - You are about to drop the column `hideWalletBalance` on the `users` table. All the data in the column will be lost.
  - You are about to drop the column `hideWalletRecvPrompt` on the `users` table. All the data in the column will be lost.
  - You are about to drop the column `hideWelcomeBanner` on the `users` table. All the data in the column will be lost.
  - You are about to drop the column `image` on the `users` table. All the data in the column will be lost.
  - You are about to drop the column `lastCheckedJobs` on the `users` table. All the data in the column will be lost.
  - You are about to drop the column `lnAddr` on the `users` table. All the data in the column will be lost.
  - You are about to drop the column `noteJobIndicator` on the `users` table. All the data in the column will be lost.
  - You are about to drop the column `proxyReceive` on the `users` table. All the data in the column will be lost.
  - You are about to drop the column `slashtagId` on the `users` table. All the data in the column will be lost.
  - You are about to drop the column `trust` on the `users` table. All the data in the column will be lost.
  - You are about to drop the column `upvoteTrust` on the `users` table. All the data in the column will be lost.
  - You are about to drop the column `withdrawMaxFeeDefault` on the `users` table. All the data in the column will be lost.
  - You are about to drop the `Arc` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `DirectPayment` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `Donation` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `Invoice` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `InvoiceForward` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `ItemAct` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `LnWith` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `Log` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `Message` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `PollBlindVote` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `ReferralAct` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `SubAct` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `Withdrawl` table. If the table is not empty, all the data it contains will be lost.

*/

DROP MATERIALIZED VIEW IF EXISTS hot_score_view;
DROP MATERIALIZED VIEW IF EXISTS item_growth_days;
DROP MATERIALIZED VIEW IF EXISTS item_growth_hours;
DROP MATERIALIZED VIEW IF EXISTS item_growth_months;
DROP MATERIALIZED VIEW IF EXISTS reg_growth_days;
DROP MATERIALIZED VIEW IF EXISTS reg_growth_hours;
DROP MATERIALIZED VIEW IF EXISTS reg_growth_months;
DROP MATERIALIZED VIEW IF EXISTS rewards_days;
DROP MATERIALIZED VIEW IF EXISTS rewards_today;
DROP MATERIALIZED VIEW IF EXISTS sat_rank_tender_view;
DROP MATERIALIZED VIEW IF EXISTS sat_rank_wwm_view;
DROP MATERIALIZED VIEW IF EXISTS spender_growth_days;
DROP MATERIALIZED VIEW IF EXISTS spender_growth_hours;
DROP MATERIALIZED VIEW IF EXISTS spender_growth_months;
DROP MATERIALIZED VIEW IF EXISTS spending_growth_days;
DROP MATERIALIZED VIEW IF EXISTS spending_growth_hours;
DROP MATERIALIZED VIEW IF EXISTS spending_growth_months;
DROP MATERIALIZED VIEW IF EXISTS stackers_growth_days;
DROP MATERIALIZED VIEW IF EXISTS stackers_growth_hours;
DROP MATERIALIZED VIEW IF EXISTS stackers_growth_months;
DROP MATERIALIZED VIEW IF EXISTS stacking_growth_days;
DROP MATERIALIZED VIEW IF EXISTS stacking_growth_hours;
DROP MATERIALIZED VIEW IF EXISTS stacking_growth_months;
DROP MATERIALIZED VIEW IF EXISTS sub_stats_days;
DROP MATERIALIZED VIEW IF EXISTS sub_stats_hours;
DROP MATERIALIZED VIEW IF EXISTS sub_stats_months;
DROP MATERIALIZED VIEW IF EXISTS user_stats_days;
DROP MATERIALIZED VIEW IF EXISTS user_stats_hours;
DROP MATERIALIZED VIEW IF EXISTS user_stats_months;
DROP MATERIALIZED VIEW IF EXISTS user_values_days;
DROP MATERIALIZED VIEW IF EXISTS user_values_today;
DROP MATERIALIZED VIEW IF EXISTS zap_rank_personal_view;
DROP MATERIALIZED VIEW IF EXISTS zap_rank_tender_view;
DROP MATERIALIZED VIEW IF EXISTS zap_rank_wwm_view;

-- DropForeignKey
ALTER TABLE "Arc" DROP CONSTRAINT "Arc_fromId_fkey";

-- DropForeignKey
ALTER TABLE "Arc" DROP CONSTRAINT "Arc_toId_fkey";

-- DropForeignKey
ALTER TABLE "Cure" DROP CONSTRAINT "Cure_itemActId_fkey";

-- DropForeignKey
ALTER TABLE "DirectPayment" DROP CONSTRAINT "DirectPayment_protocolId_fkey";

-- DropForeignKey
ALTER TABLE "DirectPayment" DROP CONSTRAINT "DirectPayment_receiverId_fkey";

-- DropForeignKey
ALTER TABLE "DirectPayment" DROP CONSTRAINT "DirectPayment_senderId_fkey";

-- DropForeignKey
ALTER TABLE "Donation" DROP CONSTRAINT "Donation_userId_fkey";

-- DropForeignKey
ALTER TABLE "Infection" DROP CONSTRAINT "Infection_itemActId_fkey";

-- DropForeignKey
ALTER TABLE "Invoice" DROP CONSTRAINT "Invoice_predecessorId_fkey";

-- DropForeignKey
ALTER TABLE "Invoice" DROP CONSTRAINT "Invoice_userId_fkey";

-- DropForeignKey
ALTER TABLE "InvoiceForward" DROP CONSTRAINT "InvoiceForward_invoiceId_fkey";

-- DropForeignKey
ALTER TABLE "InvoiceForward" DROP CONSTRAINT "InvoiceForward_protocolId_fkey";

-- DropForeignKey
ALTER TABLE "InvoiceForward" DROP CONSTRAINT "InvoiceForward_withdrawlId_fkey";

-- DropForeignKey
ALTER TABLE "Item" DROP CONSTRAINT "Item_invoiceId_fkey";

-- DropForeignKey
ALTER TABLE "Item" DROP CONSTRAINT "Item_subName_fkey";

-- DropForeignKey
ALTER TABLE "ItemAct" DROP CONSTRAINT "ItemAct_invoiceId_fkey";

-- DropForeignKey
ALTER TABLE "ItemAct" DROP CONSTRAINT "ItemAct_itemId_fkey";

-- DropForeignKey
ALTER TABLE "ItemAct" DROP CONSTRAINT "ItemAct_userId_fkey";

-- DropForeignKey
ALTER TABLE "LnWith" DROP CONSTRAINT "LnWith_payInId_fkey";

-- DropForeignKey
ALTER TABLE "Message" DROP CONSTRAINT "Message_userId_fkey";

-- DropForeignKey
ALTER TABLE "PollBlindVote" DROP CONSTRAINT "PollBlindVote_invoiceId_fkey";

-- DropForeignKey
ALTER TABLE "PollBlindVote" DROP CONSTRAINT "PollBlindVote_itemId_fkey";

-- DropForeignKey
ALTER TABLE "PollBlindVote" DROP CONSTRAINT "PollBlindVote_userId_fkey";

-- DropForeignKey
ALTER TABLE "PollVote" DROP CONSTRAINT "PollVote_invoiceId_fkey";

-- DropForeignKey
ALTER TABLE "ReferralAct" DROP CONSTRAINT "ReferralAct_itemActId_fkey";

-- DropForeignKey
ALTER TABLE "ReferralAct" DROP CONSTRAINT "ReferralAct_referrerId_fkey";

-- DropForeignKey
ALTER TABLE "SubAct" DROP CONSTRAINT "SubAct_subName_fkey";

-- DropForeignKey
ALTER TABLE "SubAct" DROP CONSTRAINT "SubAct_userId_fkey";

-- DropForeignKey
ALTER TABLE "Upload" DROP CONSTRAINT "Upload_invoiceId_fkey";

-- DropForeignKey
ALTER TABLE "WalletLog" DROP CONSTRAINT "WalletLog_invoiceId_fkey";

-- DropForeignKey
ALTER TABLE "WalletLog" DROP CONSTRAINT "WalletLog_withdrawalId_fkey";

-- DropForeignKey
ALTER TABLE "Withdrawl" DROP CONSTRAINT "Withdrawl_protocolId_fkey";

-- DropForeignKey
ALTER TABLE "Withdrawl" DROP CONSTRAINT "Withdrawl_userId_fkey";

-- DropIndex
DROP INDEX "Cure_itemActId_unique";

-- DropIndex
DROP INDEX "Infection_itemActId_unique";

-- DropIndex
DROP INDEX "Item.maxBid_index";

-- DropIndex
DROP INDEX "Item.subName_index";

-- DropIndex
DROP INDEX "Item_invoiceActionState_idx";

-- DropIndex
DROP INDEX "Item_invoiceId_idx";

-- DropIndex
DROP INDEX "Item_invoicePaidAt_idx";

-- DropIndex
DROP INDEX "Item_subName_created_at_idx";

-- DropIndex
DROP INDEX "Item_subName_rankboost_idx";

-- DropIndex
DROP INDEX "Item_subName_rankhot_idx";

-- DropIndex
DROP INDEX "Item_subName_ranktop_idx";

-- DropIndex
DROP INDEX "PollVote_invoiceActionState_idx";

-- DropIndex
DROP INDEX "PollVote_invoiceId_idx";

-- DropIndex
DROP INDEX "Upload_invoiceActionState_idx";

-- DropIndex
DROP INDEX "Upload_invoiceId_idx";

-- DropIndex
DROP INDEX "users.slashtagId_unique";

-- AlterTable
ALTER TABLE "Cure" DROP COLUMN "itemActId";

-- AlterTable
ALTER TABLE "Infection" DROP COLUMN "itemActId";

CREATE OR REPLACE FUNCTION index_item() RETURNS TRIGGER AS $$
    BEGIN
        -- only index items that have been paid for
        IF EXISTS (SELECT 1 FROM "ItemPayIn" JOIN "PayIn" ON "PayIn".id = "ItemPayIn"."payInId" WHERE "itemId" = NEW.id AND "payInType" = 'ITEM_CREATE' AND "payInState" = 'PAID') THEN
            INSERT INTO pgboss.job (name, data, priority) VALUES ('indexItem', jsonb_build_object('id', NEW.id), -100);
        END IF;
        RETURN NEW;
    END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS index_item ON "Item";
CREATE TRIGGER index_item
    AFTER INSERT OR UPDATE ON "Item"
    FOR EACH ROW
    EXECUTE PROCEDURE index_item();

-- AlterTable
ALTER TABLE "Item" DROP COLUMN "invoiceActionState",
DROP COLUMN "invoiceId",
DROP COLUMN "invoicePaidAt",
DROP COLUMN "latitude",
DROP COLUMN "longitude",
DROP COLUMN "maxBid",
DROP COLUMN "maxSalary",
DROP COLUMN "minSalary",
DROP COLUMN "paidImgLink";

-- AlterTable
ALTER TABLE "PollVote" DROP COLUMN "invoiceActionState",
DROP COLUMN "invoiceId";

-- AlterTable
ALTER TABLE "Upload" DROP COLUMN "invoiceActionState",
DROP COLUMN "invoiceId";

-- AlterTable
ALTER TABLE "WalletLog" DROP COLUMN "invoiceId",
DROP COLUMN "withdrawalId";

-- AlterTable
ALTER TABLE "users" DROP COLUMN "disableFreebies",
DROP COLUMN "freeComments",
DROP COLUMN "freePosts",
DROP COLUMN "greeterMode",
DROP COLUMN "hideWalletBalance",
DROP COLUMN "hideWalletRecvPrompt",
DROP COLUMN "hideWelcomeBanner",
DROP COLUMN "image",
DROP COLUMN "lastCheckedJobs",
DROP COLUMN "lnAddr",
DROP COLUMN "noteJobIndicator",
DROP COLUMN "proxyReceive",
DROP COLUMN "slashtagId",
DROP COLUMN "trust",
DROP COLUMN "upvoteTrust",
DROP COLUMN "withdrawMaxFeeDefault";

-- DropTable
DROP TABLE "Arc";

-- DropTable
DROP TABLE "DirectPayment";

-- DropTable
DROP TABLE "Donation";

-- DropTable
DROP TABLE "Invoice";

-- DropTable
DROP TABLE "InvoiceForward";

-- DropTable
DROP TABLE "ItemAct";

-- DropTable
DROP TABLE "LnWith";

-- DropTable
DROP TABLE "Log";

-- DropTable
DROP TABLE "Message";

-- DropTable
DROP TABLE "PollBlindVote";

-- DropTable
DROP TABLE "ReferralAct";

-- DropTable
DROP TABLE "SubAct";

-- DropTable
DROP TABLE "Withdrawl";

-- DropEnum
DROP TYPE "InvoiceActionState";

-- DropEnum
DROP TYPE "InvoiceActionType";

-- DropEnum
DROP TYPE "ItemActType";

-- DropEnum
DROP TYPE "SubActType";

TRUNCATE TABLE "WalletLog";

-- CreateIndex
CREATE INDEX "WalletLog_created_at_idx" ON "WalletLog"("created_at");

-- CreateIndex
CREATE INDEX "WalletLog_protocolId_idx" ON "WalletLog"("protocolId");

-- AddForeignKey
ALTER TABLE "Item" ADD CONSTRAINT "Item_subName_fkey" FOREIGN KEY ("subName") REFERENCES "Sub"("name") ON DELETE SET NULL ON UPDATE CASCADE;

DROP FUNCTION IF EXISTS create_scheduled_jobs;
DROP FUNCTION IF EXISTS get_territory_revenue;
DROP FUNCTION IF EXISTS get_custodial_token_type;
DROP FUNCTION IF EXISTS invite_drain;
DROP FUNCTION IF EXISTS invoice_set_user_cancel_default;
DROP FUNCTION IF EXISTS item_comments_with_me;
DROP FUNCTION IF EXISTS item_growth;
DROP FUNCTION IF EXISTS reg_growth;
DROP FUNCTION IF EXISTS rewards;
DROP FUNCTION IF EXISTS schedule_territory_revenue;
DROP FUNCTION IF EXISTS set_timezone_utc_currentdb;
DROP FUNCTION IF EXISTS spender_growth;
DROP FUNCTION IF EXISTS spending_growth;
DROP FUNCTION IF EXISTS stacking_growth;
DROP FUNCTION IF EXISTS stackers_growth;
DROP FUNCTION IF EXISTS sub_stats;
DROP FUNCTION IF EXISTS update_ranked_views_jobs;
DROP FUNCTION IF EXISTS upload_fees;
DROP FUNCTION IF EXISTS user_stats;
DROP FUNCTION IF EXISTS user_values;