-- CreateEnum
CREATE TYPE "InvoiceActionType" AS ENUM ('BUY_CREDITS', 'ITEM_CREATE', 'ITEM_UPDATE', 'ZAP', 'DOWN_ZAP', 'DONATE', 'POLL_VOTE', 'TERRITORY_CREATE', 'TERRITORY_UPDATE', 'TERRITORY_BILLING', 'TERRITORY_UNARCHIVE');

-- CreateEnum
CREATE TYPE "InvoiceActionState" AS ENUM ('PENDING', 'PENDING_HELD', 'HELD', 'PAID', 'FAILED', 'RETRYING');

-- AlterTable
ALTER TABLE "Invoice" ADD COLUMN     "actionState" "InvoiceActionState",
ADD COLUMN     "actionType" "InvoiceActionType",
ADD COLUMN     "actionId" INTEGER;

-- AlterTable
ALTER TABLE "Item" ADD COLUMN     "invoiceActionState" "InvoiceActionState",
ADD COLUMN     "invoiceId" INTEGER,
ADD COLUMN     "invoicePaidAt" TIMESTAMP(3);

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

-- CreateIndex
CREATE INDEX "Withdrawl_hash_idx" ON "Withdrawl"("hash");

-- CreateTable
CREATE TABLE "ItemUserAgg" (
    "id" SERIAL NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "itemId" INTEGER NOT NULL,
    "userId" INTEGER NOT NULL,
    "zapSats" BIGINT NOT NULL DEFAULT 0,
    "downZapSats" BIGINT NOT NULL DEFAULT 0,

    CONSTRAINT "ItemUserAgg_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ItemUserAgg_itemId_idx" ON "ItemUserAgg"("itemId");

-- CreateIndex
CREATE INDEX "ItemUserAgg_userId_idx" ON "ItemUserAgg"("userId");

-- CreateIndex
CREATE INDEX "ItemUserAgg_created_at_idx" ON "ItemUserAgg"("created_at");

-- CreateIndex
CREATE UNIQUE INDEX "ItemUserAgg_itemId_userId_key" ON "ItemUserAgg"("itemId", "userId");

-- catch up existing data
INSERT INTO "ItemUserAgg" ("itemId", "userId", "zapSats", "downZapSats", "created_at", "updated_at")
SELECT "ItemAct"."itemId", "ItemAct"."userId",
    COALESCE(sum("ItemAct"."msats") FILTER(WHERE act = 'TIP' OR act = 'FEE') / 1000.0, 0) as "zapSats",
    COALESCE(sum("ItemAct"."msats") FILTER(WHERE act = 'DONT_LIKE_THIS') / 1000.0, 0) as "downZapSats",
    min("ItemAct"."created_at"), max("ItemAct"."created_at")
FROM "ItemAct"
JOIN "Item" ON "Item"."id" = "ItemAct"."itemId" AND "Item"."userId" <> "ItemAct"."userId"
WHERE act IN ('TIP', 'FEE', 'DONT_LIKE_THIS')
GROUP BY "ItemAct"."itemId", "ItemAct"."userId";

-- AddForeignKey
ALTER TABLE "ItemUserAgg" ADD CONSTRAINT "ItemUserAgg_itemId_fkey" FOREIGN KEY ("itemId") REFERENCES "Item"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ItemUserAgg" ADD CONSTRAINT "ItemUserAgg_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- we do this explicitly now
DROP TRIGGER IF EXISTS timestamp_item_on_insert ON "Item";
DROP FUNCTION IF EXISTS timestamp_item_on_insert;

-- we do this explicitly now
DROP TRIGGER IF EXISTS ncomments_after_comment_trigger ON "Item";
DROP FUNCTION IF EXISTS ncomments_after_comment;

-- don't index items unless they are paid
DROP TRIGGER IF EXISTS index_item ON "Item";
CREATE TRIGGER index_item
    AFTER INSERT OR UPDATE ON "Item"
    FOR EACH ROW
    WHEN (NEW."invoiceActionState" IS NULL OR NEW."invoiceActionState" = 'PAID')
    EXECUTE PROCEDURE index_item();

-- XXX these drops are backwards incompatible
-- we do this explicitly now
DROP FUNCTION IF EXISTS bounty_paid_after_act;

-- we are removing referrals temporarily
DROP FUNCTION IF EXISTS referral_act;

-- we do all these explicitly in js now
DROP FUNCTION IF EXISTS sats_after_tip;
DROP FUNCTION IF EXISTS weighted_votes_after_tip;
DROP FUNCTION IF EXISTS weighted_downvotes_after_act;
DROP FUNCTION IF EXISTS poll_vote;
DROP FUNCTION IF EXISTS item_act;
DROP FUNCTION IF EXISTS create_item;
DROP FUNCTION IF EXISTS update_item(jitem jsonb, forward jsonb, poll_options jsonb);
DROP FUNCTION IF EXISTS update_item(jitem jsonb, forward jsonb, poll_options jsonb, upload_ids integer[]);
DROP FUNCTION IF EXISTS create_poll(jitem jsonb, poll_options jsonb);
DROP FUNCTION IF EXISTS donate;

-- this is dead code
DROP FUNCTION IF EXISTS create_withdrawl(lnd_id TEXT, invoice TEXT, msats_amount BIGINT, msats_max_fee BIGINT, username TEXT, auto_withdraw BOOLEAN);

-- dont call nonexistant item_act ... we'll eventually replace this
CREATE OR REPLACE FUNCTION run_auction(item_id INTEGER) RETURNS void AS $$
    DECLARE
        bid_sats INTEGER;
        user_msats BIGINT;
        user_id INTEGER;
        item_status "Status";
        status_updated_at timestamp(3);
    BEGIN
        PERFORM ASSERT_SERIALIZED();

        -- extract data we need
        SELECT "maxBid", "userId", status, "statusUpdatedAt"
        INTO bid_sats, user_id, item_status, status_updated_at
        FROM "Item"
        WHERE id = item_id;

        SELECT msats INTO user_msats FROM users WHERE id = user_id;

        -- 0 bid items expire after 30 days unless updated
        IF bid_sats = 0 THEN
            IF item_status <> 'STOPPED' THEN
                IF status_updated_at < now_utc() - INTERVAL '30 days' THEN
                    UPDATE "Item" SET status = 'STOPPED', "statusUpdatedAt" = now_utc() WHERE id = item_id;
                ELSEIF item_status = 'NOSATS' THEN
                    UPDATE "Item" SET status = 'ACTIVE' WHERE id = item_id;
                END IF;
            END IF;
            RETURN;
        END IF;

        -- check if user wallet has enough sats
        IF bid_sats * 1000 > user_msats THEN
            -- if not, set status = NOSATS and statusUpdatedAt to now_utc if not already set
            IF item_status <> 'NOSATS' THEN
                UPDATE "Item" SET status = 'NOSATS', "statusUpdatedAt" = now_utc() WHERE id = item_id;
            ELSEIF status_updated_at < now_utc() - INTERVAL '30 days' THEN
                UPDATE "Item" SET status = 'STOPPED', "statusUpdatedAt" = now_utc() WHERE id = item_id;
            END IF;
        ELSE
            UPDATE users SET msats = msats - (bid_sats * 1000) WHERE id = user_id;

            INSERT INTO "ItemAct" (msats, "itemId", "userId", act, created_at, updated_at)
            VALUES (bid_sats * 1000, item_id, user_id, 'STREAM', now_utc(), now_utc());

            -- update item status = ACTIVE and statusUpdatedAt = now_utc if NOSATS
            IF item_status = 'NOSATS' THEN
                UPDATE "Item" SET status = 'ACTIVE', "statusUpdatedAt" = now_utc() WHERE id = item_id;
            END IF;
        END IF;
    END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION item_comments_zaprank_with_me(_item_id int, _global_seed int, _me_id int, _level int, _where text, _order_by text)
  RETURNS jsonb
  LANGUAGE plpgsql VOLATILE PARALLEL SAFE AS
$$
DECLARE
    result  jsonb;
BEGIN
    IF _level < 1 THEN
        RETURN '[]'::jsonb;
    END IF;

    EXECUTE 'CREATE TEMP TABLE IF NOT EXISTS t_item ON COMMIT DROP AS'
        || '    SELECT "Item".*, "Item".created_at at time zone ''UTC'' AS "createdAt", "Item".updated_at at time zone ''UTC'' AS "updatedAt", '
        || '    "Item"."invoicePaidAt" at time zone ''UTC'' AS "invoicePaidAtUTC", to_jsonb(users.*) || jsonb_build_object(''meMute'', "Mute"."mutedId" IS NOT NULL) AS user, '
        || '    COALESCE("ItemAct"."meMsats", 0) AS "meMsats", COALESCE("ItemAct"."mePendingMsats", 0) as "mePendingMsats", COALESCE("ItemAct"."meDontLikeMsats", 0) AS "meDontLikeMsats", '
        || '    "Bookmark"."itemId" IS NOT NULL AS "meBookmark", "ThreadSubscription"."itemId" IS NOT NULL AS "meSubscription", '
        || '    GREATEST(g.tf_hot_score, l.tf_hot_score) AS personal_hot_score, GREATEST(g.tf_top_score, l.tf_top_score) AS personal_top_score '
        || '    FROM "Item" '
        || '    JOIN users ON users.id = "Item"."userId" '
        || '    LEFT JOIN "Mute" ON "Mute"."muterId" = $5 AND "Mute"."mutedId" = "Item"."userId"'
        || '    LEFT JOIN "Bookmark" ON "Bookmark"."userId" = $5 AND "Bookmark"."itemId" = "Item".id '
        || '    LEFT JOIN "ThreadSubscription" ON "ThreadSubscription"."userId" = $5 AND "ThreadSubscription"."itemId" = "Item".id '
        || '    LEFT JOIN LATERAL ( '
        || '        SELECT sum("ItemAct".msats) FILTER (WHERE "invoiceActionState" IS DISTINCT FROM ''FAILED'' AND (act = ''FEE'' OR act = ''TIP'')) AS "meMsats", '
        || '            sum("ItemAct".msats) FILTER (WHERE "invoiceActionState" IS NOT DISTINCT FROM ''PENDING'' AND (act = ''FEE'' OR act = ''TIP'') AND "Item"."userId" <> $5) AS "mePendingMsats", '
        || '            sum("ItemAct".msats) FILTER (WHERE "invoiceActionState" IS DISTINCT FROM ''FAILED'' AND act = ''DONT_LIKE_THIS'') AS "meDontLikeMsats" '
        || '        FROM "ItemAct" '
        || '        WHERE "ItemAct"."userId" = $5 '
        || '        AND "ItemAct"."itemId" = "Item".id '
        || '        GROUP BY "ItemAct"."itemId" '
        || '    ) "ItemAct" ON true '
        || '    LEFT JOIN zap_rank_personal_view g ON g."viewerId" = $6 AND g.id = "Item".id '
        || '    LEFT JOIN zap_rank_personal_view l ON l."viewerId" = $5 AND l.id = g.id '
        || '    WHERE  "Item".path <@ (SELECT path FROM "Item" WHERE id = $1) ' || _where || ' '
    USING _item_id, _level, _where, _order_by, _me_id, _global_seed;

    EXECUTE ''
        || 'SELECT COALESCE(jsonb_agg(sub), ''[]''::jsonb) AS comments '
        || 'FROM  ( '
        || '    SELECT "Item".*, item_comments_zaprank_with_me("Item".id, $6, $5, $2 - 1, $3, $4) AS comments '
        || '    FROM t_item "Item" '
        || '    WHERE  "Item"."parentId" = $1 '
        ||      _order_by
        || ' ) sub'
    INTO result USING _item_id, _level, _where, _order_by, _me_id, _global_seed;

    RETURN result;
END
$$;

DROP MATERIALIZED VIEW IF EXISTS zap_rank_personal_view;
CREATE MATERIALIZED VIEW IF NOT EXISTS zap_rank_personal_view AS
WITH item_votes AS (
    SELECT "Item".id, "Item"."parentId", "Item".boost, "Item".created_at, "Item"."weightedComments", "ItemAct"."userId" AS "voterId",
        LOG((SUM("ItemAct".msats) FILTER (WHERE "ItemAct".act IN ('TIP', 'FEE'))) / 1000.0) AS "vote",
        GREATEST(LOG((SUM("ItemAct".msats) FILTER (WHERE "ItemAct".act = 'DONT_LIKE_THIS')) / 1000.0), 0) AS "downVote"
    FROM "Item"
    CROSS JOIN zap_rank_personal_constants
    JOIN "ItemAct" ON "ItemAct"."itemId" = "Item".id
    WHERE (
        ("ItemAct"."invoiceActionState" IS NULL OR "ItemAct"."invoiceActionState" = 'PAID')
        AND
        (
            ("ItemAct"."userId" <> "Item"."userId" AND "ItemAct".act IN ('TIP', 'FEE', 'DONT_LIKE_THIS'))
        OR
            ("ItemAct".act = 'BOOST' AND "ItemAct"."userId" = "Item"."userId")
        )
    )
    AND "Item".created_at >= now_utc() - item_age_bound
    GROUP BY "Item".id, "Item"."parentId", "Item".boost, "Item".created_at, "Item"."weightedComments", "ItemAct"."userId"
    HAVING SUM("ItemAct".msats) > 1000
), viewer_votes AS (
    SELECT item_votes.id, item_votes."parentId", item_votes.boost, item_votes.created_at,
        item_votes."weightedComments", "Arc"."fromId" AS "viewerId",
        GREATEST("Arc"."zapTrust", g."zapTrust", 0) * item_votes."vote" AS "weightedVote",
        GREATEST("Arc"."zapTrust", g."zapTrust", 0) * item_votes."downVote" AS "weightedDownVote"
    FROM item_votes
    CROSS JOIN zap_rank_personal_constants
    LEFT JOIN "Arc" ON "Arc"."toId" = item_votes."voterId"
    LEFT JOIN "Arc" g ON g."fromId" = global_viewer_id AND g."toId" = item_votes."voterId"
    AND ("Arc"."zapTrust" IS NOT NULL OR g."zapTrust" IS NOT NULL)
), viewer_weighted_votes AS (
    SELECT viewer_votes.id, viewer_votes."parentId", viewer_votes.boost, viewer_votes.created_at, viewer_votes."viewerId",
        viewer_votes."weightedComments", SUM(viewer_votes."weightedVote") AS "weightedVotes",
        SUM(viewer_votes."weightedDownVote") AS "weightedDownVotes"
    FROM viewer_votes
    GROUP BY viewer_votes.id, viewer_votes."parentId", viewer_votes.boost, viewer_votes.created_at, viewer_votes."viewerId", viewer_votes."weightedComments"
), viewer_zaprank AS (
    SELECT l.id, l."parentId", l.boost, l.created_at, l."viewerId", l."weightedComments",
        GREATEST(l."weightedVotes", g."weightedVotes") AS "weightedVotes", GREATEST(l."weightedDownVotes", g."weightedDownVotes") AS "weightedDownVotes"
    FROM viewer_weighted_votes l
    CROSS JOIN zap_rank_personal_constants
    JOIN users ON users.id = l."viewerId"
    JOIN viewer_weighted_votes g ON l.id = g.id AND g."viewerId" = global_viewer_id
    WHERE (l."weightedVotes" > min_viewer_votes
        AND g."weightedVotes" / l."weightedVotes" <= max_personal_viewer_vote_ratio
        AND users."lastSeenAt" >= now_utc() - user_last_seen_bound)
    OR l."viewerId" = global_viewer_id
    GROUP BY l.id, l."parentId", l.boost, l.created_at, l."viewerId", l."weightedVotes", l."weightedComments",
        g."weightedVotes", l."weightedDownVotes", g."weightedDownVotes", min_viewer_votes
    HAVING GREATEST(l."weightedVotes", g."weightedVotes") > min_viewer_votes OR l.boost > 0
), viewer_fractions_zaprank AS (
    SELECT z.*,
        (CASE WHEN z."weightedVotes" - z."weightedDownVotes" > 0 THEN
              GREATEST(z."weightedVotes" - z."weightedDownVotes", POWER(z."weightedVotes" - z."weightedDownVotes", vote_power))
            ELSE
                z."weightedVotes" - z."weightedDownVotes"
            END + z."weightedComments" * CASE WHEN z."parentId" IS NULL THEN comment_scaler ELSE 0 END) AS tf_numerator,
        POWER(GREATEST(age_wait_hours, EXTRACT(EPOCH FROM (now_utc() - z.created_at))/3600), vote_decay) AS decay_denominator,
        (POWER(z.boost/boost_per_vote, boost_power)
         /
         POWER(GREATEST(age_wait_hours, EXTRACT(EPOCH FROM (now_utc() - z.created_at))/3600), boost_decay)) AS boost_addend
    FROM viewer_zaprank z, zap_rank_personal_constants
)
SELECT z.id, z."parentId", z."viewerId",
    COALESCE(tf_numerator, 0) / decay_denominator + boost_addend AS tf_hot_score,
    COALESCE(tf_numerator, 0) AS tf_top_score
FROM viewer_fractions_zaprank z
WHERE tf_numerator > 0 OR boost_addend > 0;

CREATE UNIQUE INDEX IF NOT EXISTS zap_rank_personal_view_viewer_id_idx ON zap_rank_personal_view("viewerId", id);
CREATE INDEX IF NOT EXISTS hot_tf_zap_rank_personal_view_idx ON zap_rank_personal_view("viewerId", tf_hot_score DESC NULLS LAST, id DESC);
CREATE INDEX IF NOT EXISTS top_tf_zap_rank_personal_view_idx ON zap_rank_personal_view("viewerId", tf_top_score DESC NULLS LAST, id DESC);

CREATE OR REPLACE FUNCTION rewards(min TIMESTAMP(3), max TIMESTAMP(3), ival INTERVAL, date_part TEXT)
RETURNS TABLE (
    t TIMESTAMP(3), total BIGINT, donations BIGINT, fees BIGINT, boost BIGINT, jobs BIGINT, anons_stack BIGINT
)
LANGUAGE plpgsql
AS $$
DECLARE
BEGIN
    RETURN QUERY
    SELECT period.t,
        coalesce(FLOOR(sum(msats)), 0)::BIGINT as total,
        coalesce(FLOOR(sum(msats) FILTER(WHERE type = 'DONATION')), 0)::BIGINT as donations,
        coalesce(FLOOR(sum(msats) FILTER(WHERE type NOT IN ('BOOST', 'STREAM', 'DONATION', 'ANON'))), 0)::BIGINT as fees,
        coalesce(FLOOR(sum(msats) FILTER(WHERE type = 'BOOST')), 0)::BIGINT as boost,
        coalesce(FLOOR(sum(msats) FILTER(WHERE type = 'STREAM')), 0)::BIGINT as jobs,
        coalesce(FLOOR(sum(msats) FILTER(WHERE type = 'ANON')), 0)::BIGINT as anons_stack
    FROM generate_series(min, max, ival) period(t),
    LATERAL
    (
        (SELECT
            ("ItemAct".msats - COALESCE("ReferralAct".msats, 0)) * COALESCE("Sub"."rewardsPct", 100) * 0.01  as msats,
            act::text as type
          FROM "ItemAct"
          JOIN "Item" ON "Item"."id" = "ItemAct"."itemId"
          LEFT JOIN "Sub" ON "Sub"."name" = "Item"."subName"
          LEFT JOIN "ReferralAct" ON "ReferralAct"."itemActId" = "ItemAct".id
          WHERE date_trunc(date_part, "ItemAct".created_at AT TIME ZONE 'UTC' AT TIME ZONE 'America/Chicago') = period.t
            AND "ItemAct".act <> 'TIP'
            AND ("ItemAct"."invoiceActionState" IS NULL OR "ItemAct"."invoiceActionState" = 'PAID'))
          UNION ALL
        (SELECT sats * 1000 as msats, 'DONATION' as type
          FROM "Donation"
          WHERE date_trunc(date_part, "Donation".created_at AT TIME ZONE 'UTC' AT TIME ZONE 'America/Chicago') = period.t)
          UNION ALL
        -- any earnings from anon's stack that are not forwarded to other users
        (SELECT "ItemAct".msats, 'ANON' as type
          FROM "Item"
          JOIN "ItemAct" ON "ItemAct"."itemId" = "Item".id
          LEFT JOIN "ItemForward" ON "ItemForward"."itemId" = "Item".id
          WHERE "Item"."userId" = 27 AND "ItemAct".act = 'TIP'
          AND date_trunc(date_part, "ItemAct".created_at AT TIME ZONE 'UTC' AT TIME ZONE 'America/Chicago') = period.t
          AND ("ItemAct"."invoiceActionState" IS NULL OR "ItemAct"."invoiceActionState" = 'PAID')
          GROUP BY "ItemAct".id, "ItemAct".msats
          HAVING COUNT("ItemForward".id) = 0)
    ) x
    GROUP BY period.t;
END;
$$;

CREATE OR REPLACE FUNCTION user_values(
    min TIMESTAMP(3), max TIMESTAMP(3), ival INTERVAL, date_part TEXT,
    percentile_cutoff INTEGER DEFAULT 33,
    each_upvote_portion FLOAT DEFAULT 4.0,
    each_item_portion FLOAT DEFAULT 4.0,
    handicap_ids INTEGER[] DEFAULT '{616, 6030, 946, 4502}',
    handicap_zap_mult FLOAT DEFAULT 0.2)
RETURNS TABLE (
    t TIMESTAMP(3), id INTEGER, proportion FLOAT
)
LANGUAGE plpgsql
AS $$
DECLARE
    min_utc TIMESTAMP(3) := timezone('utc', min AT TIME ZONE 'America/Chicago');
BEGIN
    RETURN QUERY
    SELECT period.t, u."userId", u.total_proportion
    FROM generate_series(min, max, ival) period(t),
    LATERAL
        (WITH item_ratios AS (
            SELECT *,
                CASE WHEN "parentId" IS NULL THEN 'POST' ELSE 'COMMENT' END as type,
                CASE WHEN "weightedVotes" > 0 THEN "weightedVotes"/(sum("weightedVotes") OVER (PARTITION BY "parentId" IS NULL)) ELSE 0 END AS ratio
            FROM (
                SELECT *,
                    NTILE(100)  OVER (PARTITION BY "parentId" IS NULL ORDER BY ("weightedVotes"-"weightedDownVotes") desc) AS percentile,
                    ROW_NUMBER()  OVER (PARTITION BY "parentId" IS NULL ORDER BY ("weightedVotes"-"weightedDownVotes") desc) AS rank
                FROM
                    "Item"
                WHERE date_trunc(date_part, created_at AT TIME ZONE 'UTC' AT TIME ZONE 'America/Chicago') = period.t
                AND "weightedVotes" > 0
                AND "deletedAt" IS NULL
                AND NOT bio
                AND ("invoiceActionState" IS NULL OR "invoiceActionState" = 'PAID')
            ) x
            WHERE x.percentile <= percentile_cutoff
        ),
        -- get top upvoters of top posts and comments
        upvoter_islands AS (
            SELECT "ItemAct"."userId", item_ratios.id, item_ratios.ratio, item_ratios."parentId",
                "ItemAct".msats as tipped, "ItemAct".created_at as acted_at,
                ROW_NUMBER() OVER (partition by item_ratios.id order by "ItemAct".created_at asc)
                - ROW_NUMBER() OVER (partition by item_ratios.id, "ItemAct"."userId" order by "ItemAct".created_at asc) AS island
            FROM item_ratios
            JOIN "ItemAct" on "ItemAct"."itemId" = item_ratios.id
            WHERE act = 'TIP'
            AND date_trunc(date_part, "ItemAct".created_at AT TIME ZONE 'UTC' AT TIME ZONE 'America/Chicago') = period.t
            AND ("ItemAct"."invoiceActionState" IS NULL OR "ItemAct"."invoiceActionState" = 'PAID')
        ),
        -- isolate contiguous upzaps from the same user on the same item so that when we take the log
        -- of the upzaps it accounts for successive zaps and does not disproportionately reward them
        upvoters AS (
            SELECT "userId", upvoter_islands.id, ratio, "parentId", GREATEST(log(sum(tipped) / 1000), 0) as tipped, min(acted_at) as acted_at
            FROM upvoter_islands
            GROUP BY "userId", upvoter_islands.id, ratio, "parentId", island
        ),
        -- the relative contribution of each upvoter to the post/comment
        -- early multiplier: 10/ln(early_rank + e)
        -- we also weight by trust in a step wise fashion
        upvoter_ratios AS (
            SELECT "userId", sum(early_multiplier*tipped_ratio*ratio*CASE WHEN users.id = ANY (handicap_ids) THEN handicap_zap_mult ELSE FLOOR(users.trust*3)+handicap_zap_mult END) as upvoter_ratio,
                "parentId" IS NULL as "isPost", CASE WHEN "parentId" IS NULL THEN 'TIP_POST' ELSE 'TIP_COMMENT' END as type
            FROM (
                SELECT *,
                    10.0/LN(ROW_NUMBER() OVER (partition by upvoters.id order by acted_at asc) + EXP(1.0)) AS early_multiplier,
                    tipped::float/(sum(tipped) OVER (partition by upvoters.id)) tipped_ratio
                FROM upvoters
                WHERE tipped > 0
            ) u
            JOIN users on "userId" = users.id
            GROUP BY "userId", "parentId" IS NULL
        ),
        proportions AS (
            SELECT "userId", NULL as id, type, ROW_NUMBER() OVER (PARTITION BY "isPost" ORDER BY upvoter_ratio DESC) as rank,
                upvoter_ratio/(sum(upvoter_ratio) OVER (PARTITION BY "isPost"))/each_upvote_portion as proportion
            FROM upvoter_ratios
            WHERE upvoter_ratio > 0
            UNION ALL
            SELECT "userId", item_ratios.id, type, rank, ratio/each_item_portion as proportion
            FROM item_ratios
        )
        SELECT "userId", sum(proportions.proportion) AS total_proportion
        FROM proportions
        GROUP BY "userId"
        HAVING sum(proportions.proportion) > 0.000001) u;
END;
$$;

CREATE OR REPLACE FUNCTION sub_stats(min TIMESTAMP(3), max TIMESTAMP(3), ival INTERVAL, date_part TEXT)
RETURNS TABLE (
    t TIMESTAMP(3), sub_name CITEXT, comments BIGINT, posts BIGINT,
    msats_revenue BIGINT, msats_stacked BIGINT, msats_spent BIGINT)
LANGUAGE plpgsql
AS $$
DECLARE
    min_utc TIMESTAMP(3) := timezone('utc', min AT TIME ZONE 'America/Chicago');
BEGIN
    RETURN QUERY
    SELECT period.t,
        "subName" as sub_name,
        (sum(quantity) FILTER (WHERE type = 'COMMENT'))::BIGINT as comments,
        (sum(quantity) FILTER (WHERE type = 'POST'))::BIGINT as posts,
        (sum(quantity) FILTER (WHERE type = 'REVENUE'))::BIGINT as msats_revenue,
        (sum(quantity) FILTER (WHERE type = 'TIP'))::BIGINT as msats_stacked,
        (sum(quantity) FILTER (WHERE type IN ('BOOST', 'TIP', 'FEE', 'STREAM', 'POLL', 'DONT_LIKE_THIS', 'VOTE')))::BIGINT as msats_spent
    FROM generate_series(min, max, ival) period(t)
    LEFT JOIN (
        -- For msats_spent and msats_stacked
        (SELECT COALESCE("Item"."subName", root."subName") as "subName", "ItemAct"."msats" as quantity, act::TEXT as type, "ItemAct"."created_at"
            FROM "ItemAct"
            JOIN "Item" ON "Item"."id" = "ItemAct"."itemId"
            LEFT JOIN "Item" root ON "Item"."rootId" = root.id
            WHERE "ItemAct"."created_at" >= min_utc
                AND ("Item"."subName" IS NOT NULL OR root."subName" IS NOT NULL)
                AND ("ItemAct"."invoiceActionState" IS NULL OR "ItemAct"."invoiceActionState" = 'PAID'))
            UNION ALL
        (SELECT "subName", 1 as quantity, 'POST' as type, created_at
            FROM "Item"
            WHERE created_at >= min_utc
                AND "Item"."parentId" IS NULL
                AND "subName" IS NOT NULL)
            UNION ALL
        (SELECT root."subName", 1 as quantity, 'COMMENT' as type, "Item"."created_at"
            FROM "Item"
            JOIN "Item" root ON "Item"."rootId" = root."id"
            WHERE "Item"."created_at" >= min_utc
                AND root."subName" IS NOT NULL
                AND "Item"."parentId" IS NOT NULL)
            UNION ALL
        -- For msats_revenue
        (SELECT "subName", msats as quantity, type::TEXT as type, created_at
            FROM "SubAct"
            WHERE created_at >= min_utc)
    ) u ON period.t = date_trunc(date_part, u.created_at AT TIME ZONE 'UTC' AT TIME ZONE 'America/Chicago')
    GROUP BY "subName", period.t
    ORDER BY period.t ASC;
END;
$$;

CREATE OR REPLACE FUNCTION user_stats(min TIMESTAMP(3), max TIMESTAMP(3), ival INTERVAL, date_part TEXT)
RETURNS TABLE (
    t TIMESTAMP(3), id INTEGER, comments BIGINT, posts BIGINT, territories BIGINT,
    referrals BIGINT, msats_tipped BIGINT, msats_rewards BIGINT, msats_referrals BIGINT,
    msats_revenue BIGINT, msats_stacked BIGINT, msats_fees BIGINT, msats_donated BIGINT,
    msats_billing BIGINT, msats_spent BIGINT)
LANGUAGE plpgsql
AS $$
DECLARE
    min_utc TIMESTAMP(3) := timezone('utc', min AT TIME ZONE 'America/Chicago');
BEGIN
    RETURN QUERY
    SELECT period.t,
        "userId" as id,
        -- counts
        (sum(quantity) FILTER (WHERE type = 'COMMENT'))::BIGINT as comments,
        (sum(quantity) FILTER (WHERE type = 'POST'))::BIGINT as posts,
        (sum(quantity) FILTER (WHERE type = 'TERRITORY'))::BIGINT as territories,
        (sum(quantity) FILTER (WHERE type = 'REFERRAL'))::BIGINT as referrals,
        -- stacking
        (sum(quantity) FILTER (WHERE type = 'TIPPEE'))::BIGINT as msats_tipped,
        (sum(quantity) FILTER (WHERE type = 'EARN'))::BIGINT as msats_rewards,
        (sum(quantity) FILTER (WHERE type = 'REFERRAL_ACT'))::BIGINT as msats_referrals,
        (sum(quantity) FILTER (WHERE type = 'REVENUE'))::BIGINT as msats_revenue,
        (sum(quantity) FILTER (WHERE type IN ('TIPPEE', 'EARN', 'REFERRAL_ACT', 'REVENUE')))::BIGINT as msats_stacked,
        -- spending
        (sum(quantity) FILTER (WHERE type IN ('BOOST', 'TIP', 'FEE', 'STREAM', 'POLL', 'DONT_LIKE_THIS')))::BIGINT as msats_fees,
        (sum(quantity) FILTER (WHERE type = 'DONATION'))::BIGINT as msats_donated,
        (sum(quantity) FILTER (WHERE type = 'BILLING'))::BIGINT as msats_billing,
        (sum(quantity) FILTER (WHERE type IN ('BOOST', 'TIP', 'FEE', 'STREAM', 'POLL', 'DONT_LIKE_THIS', 'DONATION', 'BILLING')))::BIGINT as msats_spent
    FROM generate_series(min, max, ival) period(t)
    LEFT JOIN
    ((SELECT "userId", msats as quantity, act::TEXT as type, created_at
        FROM "ItemAct"
        WHERE created_at >= min_utc
        AND ("ItemAct"."invoiceActionState" IS NULL OR "ItemAct"."invoiceActionState" = 'PAID'))
        UNION ALL
    (SELECT "userId", sats*1000 as quantity, 'DONATION' as type, created_at
        FROM "Donation"
        WHERE created_at >= min_utc)
        UNION ALL
    (SELECT "userId", 1 as quantity,
        CASE WHEN "Item"."parentId" IS NULL THEN 'POST' ELSE 'COMMENT' END as type, created_at
        FROM "Item"
        WHERE created_at >= min_utc)
        UNION ALL
    (SELECT "referrerId" as "userId", 1 as quantity, 'REFERRAL' as type, created_at
        FROM users
        WHERE "referrerId" IS NOT NULL
        AND created_at >= min_utc)
        UNION ALL
    -- tips accounting for forwarding
    (SELECT "Item"."userId", floor("ItemAct".msats * (1-COALESCE(sum("ItemForward".pct)/100.0, 0))) as quantity, 'TIPPEE' as type, "ItemAct".created_at
        FROM "ItemAct"
        JOIN "Item" on "ItemAct"."itemId" = "Item".id
        LEFT JOIN "ItemForward" on "ItemForward"."itemId" = "Item".id
        WHERE "ItemAct".act = 'TIP'
        AND "ItemAct".created_at >= min_utc
        AND ("ItemAct"."invoiceActionState" IS NULL OR "ItemAct"."invoiceActionState" = 'PAID')
        GROUP BY "Item"."userId", "ItemAct".id, "ItemAct".msats, "ItemAct".created_at)
        UNION ALL
    -- tips where stacker is a forwardee
    (SELECT "ItemForward"."userId", floor("ItemAct".msats*("ItemForward".pct/100.0)) as quantity, 'TIPPEE' as type, "ItemAct".created_at
        FROM "ItemAct"
        JOIN "Item" on "ItemAct"."itemId" = "Item".id
        JOIN "ItemForward" on "ItemForward"."itemId" = "Item".id
        WHERE "ItemAct".act = 'TIP'
        AND "ItemAct".created_at >= min_utc
        AND ("ItemAct"."invoiceActionState" IS NULL OR "ItemAct"."invoiceActionState" = 'PAID'))
        UNION ALL
    (SELECT "userId", msats as quantity, 'EARN' as type, created_at
        FROM "Earn"
        WHERE created_at >= min_utc)
        UNION ALL
    (SELECT "referrerId" as "userId", msats as quantity, 'REFERRAL_ACT' as type, created_at
        FROM "ReferralAct"
        WHERE created_at >= min_utc)
        UNION ALL
    (SELECT "userId", msats as quantity, type::TEXT as type, created_at
        FROM "SubAct"
        WHERE created_at >= min_utc)
        UNION ALL
    (SELECT "userId", 1 as quantity, 'TERRITORY' as type, created_at
        FROM "Sub"
        WHERE status <> 'STOPPED'
        AND created_at >= min_utc)
    ) u ON period.t = date_trunc(date_part, u.created_at AT TIME ZONE 'UTC' AT TIME ZONE 'America/Chicago')
    GROUP BY "userId", period.t
    ORDER BY period.t ASC;
END;
$$;

CREATE OR REPLACE FUNCTION spending_growth(min TIMESTAMP(3), max TIMESTAMP(3), ival INTERVAL, date_part TEXT)
RETURNS TABLE (t TIMESTAMP(3), jobs BIGINT, boost BIGINT, fees BIGINT, tips BIGINT, donations BIGINT, territories BIGINT)
LANGUAGE plpgsql
AS $$
DECLARE
    min_utc TIMESTAMP(3) := timezone('utc', min AT TIME ZONE 'America/Chicago');
BEGIN
    RETURN QUERY
    SELECT period.t,
        coalesce(floor(sum(msats) FILTER (WHERE act = 'STREAM')/1000), 0)::BIGINT as jobs,
        coalesce(floor(sum(msats) FILTER (WHERE act = 'BOOST')/1000), 0)::BIGINT as boost,
        coalesce(floor(sum(msats) FILTER (WHERE act NOT IN ('BOOST', 'TIP', 'STREAM', 'DONATION', 'TERRITORY'))/1000), 0)::BIGINT as fees,
        coalesce(floor(sum(msats) FILTER (WHERE act = 'TIP')/1000), 0)::BIGINT as tips,
        coalesce(floor(sum(msats) FILTER (WHERE act = 'DONATION')/1000), 0)::BIGINT as donations,
        coalesce(floor(sum(msats) FILTER (WHERE act = 'TERRITORY')/1000), 0)::BIGINT as territories
    FROM generate_series(min, max, ival) period(t)
    LEFT JOIN
    ((SELECT "ItemAct".created_at, msats, act::text as act
        FROM "ItemAct"
        WHERE created_at >= min_utc
        AND ("ItemAct"."invoiceActionState" IS NULL OR "ItemAct"."invoiceActionState" = 'PAID'))
    UNION ALL
    (SELECT created_at, sats * 1000 as msats, 'DONATION' as act
        FROM "Donation"
        WHERE created_at >= min_utc)
    UNION ALL
    (SELECT created_at, msats, 'TERRITORY' as act
        FROM "SubAct"
        WHERE type = 'BILLING'
        AND created_at >= min_utc)
    ) u ON period.t = date_trunc(date_part, u.created_at AT TIME ZONE 'UTC' AT TIME ZONE 'America/Chicago')
    GROUP BY period.t
    ORDER BY period.t ASC;
END;
$$;

CREATE OR REPLACE FUNCTION stacking_growth(min TIMESTAMP(3), max TIMESTAMP(3), ival INTERVAL, date_part TEXT)
RETURNS TABLE (t TIMESTAMP(3), rewards BIGINT, posts BIGINT, comments BIGINT, referrals BIGINT, territories BIGINT)
LANGUAGE plpgsql
AS $$
DECLARE
    min_utc TIMESTAMP(3) := timezone('utc', min AT TIME ZONE 'America/Chicago');
BEGIN
    RETURN QUERY
    SELECT period.t,
        coalesce(floor(sum(airdrop)/1000),0)::BIGINT as rewards,
        coalesce(floor(sum(post)/1000),0)::BIGINT as posts,
        coalesce(floor(sum(comment)/1000),0)::BIGINT as comments,
        coalesce(floor(sum(referral)/1000),0)::BIGINT as referrals,
        coalesce(floor(sum(revenue)/1000),0)::BIGINT as territories
    FROM generate_series(min, max, ival) period(t)
    LEFT JOIN
    ((SELECT "ItemAct".created_at, 0 as airdrop,
        CASE WHEN "Item"."parentId" IS NULL THEN 0 ELSE "ItemAct".msats END as comment,
        CASE WHEN "Item"."parentId" IS NULL THEN "ItemAct".msats ELSE 0 END as post,
        0 as referral,
        0 as revenue
        FROM "ItemAct"
        JOIN "Item" on "ItemAct"."itemId" = "Item".id
        WHERE "ItemAct".act = 'TIP'
        AND "ItemAct".created_at >= min_utc
        AND ("ItemAct"."invoiceActionState" IS NULL OR "ItemAct"."invoiceActionState" = 'PAID'))
    UNION ALL
    (SELECT created_at, 0 as airdrop, 0 as post, 0 as comment, msats as referral, 0 as revenue
        FROM "ReferralAct"
        WHERE created_at >= min_utc)
    UNION ALL
    (SELECT created_at, msats as airdrop, 0 as post, 0 as comment, 0 as referral, 0 as revenue
        FROM "Earn"
        WHERE created_at >= min_utc)
    UNION ALL
        (SELECT created_at, 0 as airdrop, 0 as post, 0 as comment, 0 as referral, msats as revenue
            FROM "SubAct"
            WHERE type = 'REVENUE'
            AND created_at >= min_utc)
    ) u ON period.t = date_trunc(date_part, u.created_at AT TIME ZONE 'UTC' AT TIME ZONE 'America/Chicago')
    GROUP BY period.t
    ORDER BY period.t ASC;
END;
$$;

CREATE OR REPLACE FUNCTION stackers_growth(min TIMESTAMP(3), max TIMESTAMP(3), ival INTERVAL, date_part TEXT)
RETURNS TABLE (t TIMESTAMP(3), "userId" INT, type TEXT)
LANGUAGE plpgsql
AS $$
DECLARE
    min_utc TIMESTAMP(3) := timezone('utc', min AT TIME ZONE 'America/Chicago');
BEGIN
    RETURN QUERY
    SELECT period.t, u."userId", u.type
    FROM generate_series(min, max, ival) period(t)
    LEFT JOIN
    ((SELECT "ItemAct".created_at, "Item"."userId", CASE WHEN "Item"."parentId" IS NULL THEN 'POST' ELSE 'COMMENT' END as type
        FROM "ItemAct"
        JOIN "Item" on "ItemAct"."itemId" = "Item".id
        WHERE "ItemAct".act = 'TIP'
        AND "ItemAct".created_at >= min_utc
        AND ("ItemAct"."invoiceActionState" IS NULL OR "ItemAct"."invoiceActionState" = 'PAID'))
    UNION ALL
    (SELECT created_at, "Earn"."userId", 'EARN' as type
        FROM "Earn"
        WHERE created_at >= min_utc)
    UNION ALL
        (SELECT created_at, "ReferralAct"."referrerId" as "userId", 'REFERRAL' as type
        FROM "ReferralAct"
        WHERE created_at >= min_utc)
    UNION ALL
        (SELECT created_at, "SubAct"."userId", 'REVENUE' as type
            FROM "SubAct"
            WHERE "SubAct".type = 'REVENUE'
            AND created_at >= min_utc)
    ) u ON period.t = date_trunc(date_part, u.created_at AT TIME ZONE 'UTC' AT TIME ZONE 'America/Chicago')
    GROUP BY period.t, u."userId", u.type
    ORDER BY period.t ASC;
END;
$$;

CREATE OR REPLACE FUNCTION item_growth(min TIMESTAMP(3), max TIMESTAMP(3), ival INTERVAL, date_part TEXT)
RETURNS TABLE (t TIMESTAMP(3), comments BIGINT, jobs BIGINT, posts BIGINT, territories BIGINT, zaps BIGINT)
LANGUAGE plpgsql
AS $$
DECLARE
    min_utc TIMESTAMP(3) := timezone('utc', min AT TIME ZONE 'America/Chicago');
BEGIN
    RETURN QUERY
    SELECT period.t, count(*) FILTER (WHERE type = 'COMMENT') as comments,
            count(*) FILTER (WHERE type = 'JOB') as jobs,
            count(*) FILTER (WHERE type = 'POST') as posts,
            count(*) FILTER (WHERE type = 'TERRITORY') as territories,
            count(*) FILTER (WHERE type = 'ZAP') as zaps
    FROM generate_series(min, max, ival) period(t)
    LEFT JOIN
    ((SELECT created_at,
        CASE
            WHEN "subName" = 'jobs' THEN 'JOB'
            WHEN "parentId" IS NULL THEN 'POST'
            ELSE 'COMMENT' END as type
    FROM "Item"
    WHERE created_at >= min_utc
    AND ("Item"."invoiceActionState" IS NULL OR "Item"."invoiceActionState" = 'PAID'))
    UNION ALL
    (SELECT created_at, 'TERRITORY' as type
    FROM "Sub"
    WHERE created_at >= min_utc)
    UNION ALL
    (SELECT created_at, 'ZAP' as type
    FROM "ItemAct"
    WHERE act = 'TIP'
    AND ("ItemAct"."invoiceActionState" IS NULL OR "ItemAct"."invoiceActionState" = 'PAID')
    AND created_at >= min_utc)) u ON period.t = date_trunc(date_part, u.created_at AT TIME ZONE 'UTC' AT TIME ZONE 'America/Chicago')
    GROUP BY period.t
    ORDER BY period.t ASC;
END;
$$;

CREATE OR REPLACE FUNCTION spender_growth(min TIMESTAMP(3), max TIMESTAMP(3), ival INTERVAL, date_part TEXT)
RETURNS TABLE (t TIMESTAMP(3), "userId" INT, type TEXT)
LANGUAGE plpgsql
AS $$
DECLARE
    min_utc TIMESTAMP(3) := timezone('utc', min AT TIME ZONE 'America/Chicago');
BEGIN
    RETURN QUERY
    SELECT period.t, u."userId", u.type
    FROM generate_series(min, max, ival) period(t)
    LEFT JOIN
    ((SELECT "ItemAct".created_at, "ItemAct"."userId", act::text as type
        FROM "ItemAct"
        WHERE created_at >= min_utc
        AND ("ItemAct"."invoiceActionState" IS NULL OR "ItemAct"."invoiceActionState" = 'PAID'))
    UNION ALL
    (SELECT created_at, "Donation"."userId", 'DONATION' as type
        FROM "Donation"
        WHERE created_at >= min_utc)
    UNION ALL
    (SELECT created_at, "SubAct"."userId", 'TERRITORY' as type
            FROM "SubAct"
            WHERE "SubAct".type = 'BILLING'
            AND created_at >= min_utc)
    ) u ON period.t = date_trunc(date_part, u.created_at AT TIME ZONE 'UTC' AT TIME ZONE 'America/Chicago')
    GROUP BY period.t, u."userId", u.type
    ORDER BY period.t ASC;
END;
$$;