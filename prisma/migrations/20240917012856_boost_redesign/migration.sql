-- AlterTable
ALTER TABLE "Item" ADD COLUMN "oldBoost" INTEGER NOT NULL DEFAULT 0;


CREATE OR REPLACE FUNCTION expire_boost_jobs()
RETURNS INTEGER
LANGUAGE plpgsql
AS $$
DECLARE
BEGIN
    INSERT INTO pgboss.job (name, data, retrylimit, retrybackoff, startafter, expirein)
    SELECT 'expireBoost', jsonb_build_object('id', "Item".id), 21, true, now(), interval '1 days'
    FROM "Item"
    WHERE "Item".boost > 0 ON CONFLICT DO NOTHING;
    return 0;
EXCEPTION WHEN OTHERS THEN
    return 0;
END;
$$;

SELECT expire_boost_jobs();
DROP FUNCTION IF EXISTS expire_boost_jobs;

-- fold all STREAM "ItemAct" into a single row per item (it's defunct)
INSERT INTO "ItemAct" (created_at, updated_at, msats, act, "itemId", "userId")
SELECT MAX("ItemAct".created_at), MAX("ItemAct".updated_at), sum("ItemAct".msats), 'BOOST', "ItemAct"."itemId", "ItemAct"."userId"
FROM "ItemAct"
WHERE "ItemAct".act = 'STREAM'
GROUP BY "ItemAct"."itemId", "ItemAct"."userId";

-- drop all STREAM "ItemAct" rows
DELETE FROM "ItemAct"
WHERE "ItemAct".act = 'STREAM';

-- AlterEnum
ALTER TYPE "InvoiceActionType" ADD VALUE 'BOOST';

-- increase boost per vote
CREATE OR REPLACE VIEW zap_rank_personal_constants AS
SELECT
10000.0 AS boost_per_vote,
1.2 AS vote_power,
1.3 AS vote_decay,
3.0 AS age_wait_hours,
0.5 AS comment_scaler,
1.2 AS boost_power,
1.6 AS boost_decay,
616 AS global_viewer_id,
interval '7 days' AS item_age_bound,
interval '7 days' AS user_last_seen_bound,
0.9 AS max_personal_viewer_vote_ratio,
0.1 AS min_viewer_votes;

DROP FUNCTION IF EXISTS run_auction(item_id INTEGER);