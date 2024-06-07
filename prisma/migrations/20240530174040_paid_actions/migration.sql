-- CreateEnum
CREATE TYPE "InvoiceActionType" AS ENUM ('BUY_CREDITS', 'ITEM_CREATE', 'ITEM_UPDATE', 'ZAP', 'DOWN_ZAP', 'DONATE', 'POLL_VOTE', 'TERRITORY_CREATE', 'TERRITORY_UPDATE', 'TERRITORY_BILLING', 'TERRITORY_UNARCHIVE');

-- CreateEnum
CREATE TYPE "InvoiceActionState" AS ENUM ('PENDING', 'PENDING_HELD', 'HELD', 'PAID', 'FAILED');

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

-- AlterTable
ALTER TABLE "PollBlindVote" ADD COLUMN     "invoiceActionState" "InvoiceActionState",
ADD COLUMN     "invoiceId" INTEGER;

-- AddForeignKey
ALTER TABLE "PollBlindVote" ADD CONSTRAINT "PollBlindVote_invoiceId_fkey" FOREIGN KEY ("invoiceId") REFERENCES "Invoice"("id") ON DELETE SET NULL ON UPDATE CASCADE;

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

CREATE OR REPLACE FUNCTION ncomments_after_comment(_id INTEGER) RETURNS INTEGER AS $$
DECLARE
    item "Item";
    user_trust DOUBLE PRECISION;
BEGIN
    SELECT * INTO item FROM "Item" WHERE id = _id;
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
    SELECT item.created_at, item.updated_at, p.id, p."userId", item.id, item."userId", nlevel(item.path) - nlevel(p.path)
    FROM "Item" p
    WHERE p.path @> item.path AND p.id <> item.id AND p."userId" <> item."userId";

    RETURN 0;
END;
$$ LANGUAGE plpgsql;

-- don't index items unless they are paid
DROP TRIGGER IF EXISTS index_item ON "Item";
CREATE TRIGGER index_item
    AFTER INSERT OR UPDATE ON "Item"
    FOR EACH ROW
    WHEN (NEW."invoiceActionState" IS NULL OR NEW."invoiceActionState" = 'PAID')
    EXECUTE PROCEDURE index_item();

CREATE OR REPLACE FUNCTION bounty_paid_after_act(item_id INTEGER, user_id INTEGER)
RETURNS INTEGER
LANGUAGE plpgsql
AS $$
DECLARE
    root_id INTEGER;
    item_bounty INTEGER;
    sats_paid INTEGER;
BEGIN
    -- get root item
    SELECT "rootId" INTO root_id FROM "Item" WHERE id = item_id;

    -- check if root item is 1. a bounty, 2. actor is the OP, 3. hasn't paid yet
    SELECT bounty
    INTO item_bounty
    FROM "Item"
    WHERE id = root_id
    AND "userId" = user_id
    AND ("bountyPaidTo" IS NULL OR item_id <> any ("bountyPaidTo"));

    -- if it is get the bounty amount
    IF item_bounty IS NOT NULL THEN
        -- check if the cumulative sats sent to this item by user_id is >= to bounty
        SELECT coalesce(sum("ItemAct"."msats"), 0)/1000
        INTO sats_paid
        FROM "ItemAct"
        WHERE "ItemAct"."userId" = user_id
        AND "ItemAct"."itemId" = item_id
        AND "ItemAct".act IN ('TIP','FEE');
        IF sats_paid >= item_bounty THEN
            UPDATE "Item"
            SET "bountyPaidTo" = array_append("bountyPaidTo", item_id)
            WHERE id = root_id;
        END IF;
    END IF;

    RETURN 0;
END;
$$;

CREATE OR REPLACE FUNCTION referral_act(item_act_id INTEGER)
RETURNS INTEGER
LANGUAGE plpgsql
AS $$
DECLARE
    act_act "ItemActType";
    act_msats BIGINT;
    act_item_id INTEGER;
    act_user_id INTEGER;
    referrer_id INTEGER;
    referral_msats BIGINT;
    fwd_ref_msats BIGINT;
    total_fwd_ref_msats BIGINT := 0;
    fwd_entry record;
BEGIN
    -- get the sats for the action that haven't already been forwarded
    SELECT msats, act, "userId", "itemId"
    INTO act_msats, act_act, act_user_id, act_item_id
    FROM "ItemAct"
    WHERE id = item_act_id;

    referral_msats := CEIL(act_msats * .21);

    -- take 21% of the act where the referrer is the actor's referrer
    IF act_act IN ('BOOST', 'STREAM') THEN
        SELECT "referrerId" INTO referrer_id FROM users WHERE id = act_user_id;

        IF referrer_id IS NULL THEN
            RETURN 0;
        END IF;

        INSERT INTO "ReferralAct" ("referrerId", "itemActId", msats, created_at, updated_at)
            VALUES(referrer_id, item_act_id, referral_msats, now_utc(), now_utc());
        UPDATE users
        SET msats = msats + referral_msats, "stackedMsats" = "stackedMsats" + referral_msats
        WHERE id = referrer_id;
    -- take 21% of the fee where the referrer is the item's creator (and/or the item's forward users)
    ELSIF act_act = 'FEE' THEN
        FOR fwd_entry IN
            SELECT users."referrerId" AS referrer_id, "ItemForward"."pct" AS pct
            FROM "ItemForward"
            JOIN users ON users.id = "ItemForward"."userId"
            WHERE "ItemForward"."itemId" = act_item_id
        LOOP
            -- fwd_msats represents the sats for this forward recipient from this particular tip action
            fwd_ref_msats := referral_msats * fwd_entry.pct / 100;
            -- keep track of how many msats have been forwarded, so we can give any remaining to OP
            total_fwd_ref_msats := fwd_ref_msats + total_fwd_ref_msats;

            -- no referrer or tipping their own referee, no referral act
            CONTINUE WHEN fwd_entry.referrer_id IS NULL OR fwd_entry.referrer_id = act_user_id;

            INSERT INTO "ReferralAct" ("referrerId", "itemActId", msats, created_at, updated_at)
            VALUES (fwd_entry.referrer_id, item_act_id, fwd_ref_msats, now_utc(), now_utc());

            UPDATE users
            SET msats = msats + fwd_ref_msats, "stackedMsats" = "stackedMsats" + fwd_ref_msats
            WHERE id = fwd_entry.referrer_id;
        END LOOP;

        -- Give OP any remaining msats after forwards have been applied
        IF referral_msats - total_fwd_ref_msats > 0 THEN
            SELECT users."referrerId" INTO referrer_id
            FROM "Item"
            JOIN users ON users.id = "Item"."userId"
            WHERE "Item".id = act_item_id;

            IF referrer_id IS NULL OR referrer_id = act_user_id THEN
                RETURN 0;
            END IF;

            INSERT INTO "ReferralAct" ("referrerId", "itemActId", msats, created_at, updated_at)
            VALUES (referrer_id, item_act_id, referral_msats - total_fwd_ref_msats, now_utc(), now_utc());

            UPDATE users
            SET msats = msats + referral_msats - total_fwd_ref_msats,
                "stackedMsats" = "stackedMsats" + referral_msats - total_fwd_ref_msats
            WHERE id = referrer_id;
        END IF;
    END IF;

    RETURN 0;
END;
$$;

-- remove special case for anon
CREATE OR REPLACE FUNCTION sats_after_tip(item_id INTEGER, user_id INTEGER, tip_msats BIGINT) RETURNS INTEGER AS $$
DECLARE
    item "Item";
BEGIN
    SELECT * FROM "Item" WHERE id = item_id INTO item;

    UPDATE "Item"
    SET "msats" = "msats" + tip_msats,
        "lastZapAt" = now()
    WHERE id = item.id;

    UPDATE "Item"
    SET "commentMsats" = "commentMsats" + tip_msats
    WHERE id <> item.id and path @> item.path;

    RETURN 1;
END;
$$ LANGUAGE plpgsql;