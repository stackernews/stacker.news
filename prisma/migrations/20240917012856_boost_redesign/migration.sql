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
SELECT MAX("ItemAct".created_at), MAX("ItemAct".updated_at), sum("ItemAct".msats), 'STREAM', "ItemAct"."itemId", "ItemAct"."userId"
FROM "ItemAct"
WHERE "ItemAct".act = 'STREAM'
GROUP BY "ItemAct"."itemId", "ItemAct"."userId";

-- drop all STREAM "ItemAct" rows
DELETE FROM "ItemAct"
WHERE "ItemAct".act = 'STREAM';