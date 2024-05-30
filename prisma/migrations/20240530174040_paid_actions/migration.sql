-- CreateEnum
CREATE TYPE "InvoiceActionType" AS ENUM ('BUY_CREDITS', 'ITEM_CREATE', 'ITEM_UPDATE', 'ZAP', 'DOWN_ZAP', 'DONATE', 'POLL_VOTE', 'TERRITORY_CREATE', 'TERRITORY_UPDATE', 'TERRITORY_BILLING');

-- CreateEnum
CREATE TYPE "InvoiceActionState" AS ENUM ('PENDING', 'PAID', 'FAILED');

-- AlterTable
ALTER TABLE "Invoice" ADD COLUMN     "actionState" "InvoiceActionState",
ADD COLUMN     "actionType" "InvoiceActionType";

-- AlterTable
ALTER TABLE "Item" ADD COLUMN     "invoiceActionState" "InvoiceActionState",
ADD COLUMN     "invoiceId" INTEGER;

-- AlterTable
ALTER TABLE "ItemAct" ADD COLUMN     "invoiceActionState" "InvoiceActionState",
ADD COLUMN     "invoiceId" INTEGER;

-- AlterTable
ALTER TABLE "PollVote" ADD COLUMN     "invoiceActionState" "InvoiceActionState",
ADD COLUMN     "invoiceId" INTEGER;

-- AlterTable
ALTER TABLE "Upload" ADD COLUMN     "invoiceActionState" "InvoiceActionState",
ADD COLUMN     "invoiceId" INTEGER;

-- AddForeignKey
ALTER TABLE "Upload" ADD CONSTRAINT "Upload_invoiceId_fkey" FOREIGN KEY ("invoiceId") REFERENCES "Invoice"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Item" ADD CONSTRAINT "Item_invoiceId_fkey" FOREIGN KEY ("invoiceId") REFERENCES "Invoice"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PollVote" ADD CONSTRAINT "PollVote_invoiceId_fkey" FOREIGN KEY ("invoiceId") REFERENCES "Invoice"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ItemAct" ADD CONSTRAINT "ItemAct_invoiceId_fkey" FOREIGN KEY ("invoiceId") REFERENCES "Invoice"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- CreateIndex
CREATE INDEX "Item_invoiceId_idx" ON "Item"("invoiceId");

-- CreateIndex
CREATE INDEX "ItemAct_invoiceId_idx" ON "ItemAct"("invoiceId");

-- CreateIndex
CREATE INDEX "PollVote_invoiceId_idx" ON "PollVote"("invoiceId");

-- CreateIndex
CREATE INDEX "Upload_invoiceId_idx" ON "Upload"("invoiceId");

DROP TRIGGER IF EXISTS timestamp_item_on_insert ON "Item";
DROP FUNCTION IF EXISTS timestamp_item_on_insert;

-- new ncomments after comment
DROP TRIGGER IF EXISTS ncomments_after_comment_trigger ON "Item";
DROP FUNCTION IF EXISTS ncomments_after_comment;

CREATE OR REPLACE FUNCTION ncomments_after_comment(id INTEGER) RETURNS INTEGER AS $$
DECLARE
    item "Item";
    user_trust DOUBLE PRECISION;
BEGIN
    SELECT * INTO item FROM "Item" WHERE id = id;
    -- grab user's trust who is commenting
    SELECT trust INTO user_trust FROM users WHERE id = item."userId";

    UPDATE "Item"
    SET "lastCommentAt" = now_utc(), "ncomments" = "ncomments" + 1
    WHERE id <> item.id and path @> item.path;

    -- we only want to add the user's trust to weightedComments if they aren't
    -- already the author of a descendant comment
    UPDATE "Item"
    SET "weightedComments" = "weightedComments" + user_trust
    FROM (
        -- for every ancestor of the new comment, return the ones that don't have
        -- the same author in their descendants
        SELECT p.id
        FROM "Item" p
        -- all decendants of p that aren't the new comment
        JOIN "Item" c ON c.path <@ p.path AND c.id <> item.id
        -- p is an ancestor of this comment, it isn't itself, and it doesn't have the same author
        WHERE p.path @> item.path AND p.id <> item.id AND p."userId" <> item."userId"
        GROUP BY p.id
        -- only return p if it doesn't have any descendants with the same author as the comment
        HAVING bool_and(c."userId" <> item."userId")
    ) fresh
    WHERE "Item".id = fresh.id;

    -- insert the comment into the reply table for every ancestor
    INSERT INTO "Reply" (created_at, updated_at, "ancestorId", "ancestorUserId", "itemId", "userId", level)
    SELECT item.created_at, item.updated_at, p.id, p."userId", item.id, NEW."userId", nlevel(item.path) - nlevel(p.path)
    FROM "Item" p
    WHERE p.path @> item.path AND p.id <> item.id AND p."userId" <> item."userId";

    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- don't index items unless they are paid
DROP TRIGGER IF EXISTS index_item ON "Item";
CREATE TRIGGER index_item
    AFTER INSERT OR UPDATE ON "Item"
    FOR EACH ROW
    WHERE (NEW."invoiceActionState" IS NULL OR NEW."invoiceActionState" = 'PAID')
    EXECUTE PROCEDURE index_item();