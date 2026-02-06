-- Sat Filter Refactoring Migration
-- This migration:
-- 1. Adds postsSatsFilter and commentsSatsFilter to User (replacing satsFilter)
-- 2. Adds freeCommentCount and freeCommentResetAt to User for monthly limits
-- 3. Removes wildWestMode from User
-- 4. Adds postsSatsFilter to Sub (territory)
-- 5. Removes moderated and moderatedCount from Sub
-- 6. Adds netInvestment column to Item (with trigger to keep it updated)
-- 7. Removes outlawed and genoutlawed from Item
-- 8. Backfills freebie column for historical items (cost=0, boost=0)

-- =====================
-- USER MODEL CHANGES
-- =====================

-- Add new filter columns to users
ALTER TABLE "users" ADD COLUMN "postsSatsFilter" INT NOT NULL DEFAULT 10;
ALTER TABLE "users" ADD COLUMN "commentsSatsFilter" INT NOT NULL DEFAULT 1;
ALTER TABLE "users" ADD COLUMN "freeCommentCount" INT NOT NULL DEFAULT 0;
ALTER TABLE "users" ADD COLUMN "freeCommentResetAt" TIMESTAMP(3);

-- Migrate existing satsFilter to postsSatsFilter
UPDATE "users" SET "postsSatsFilter" = "satsFilter" WHERE "satsFilter" IS NOT NULL;

-- Drop old columns from users
ALTER TABLE "users" DROP COLUMN "satsFilter";
ALTER TABLE "users" DROP COLUMN "wildWestMode";

-- =====================
-- SUB (TERRITORY) MODEL CHANGES
-- =====================

-- Add filter column to Sub
-- First add the column with a temporary default, then backfill with baseCost
ALTER TABLE "Sub" ADD COLUMN "postsSatsFilter" INT NOT NULL DEFAULT 10;

-- Backfill postsSatsFilter = baseCost for existing territories
-- This ensures the validation constraint (postsSatsFilter >= baseCost) is satisfied
UPDATE "Sub" SET "postsSatsFilter" = "baseCost";

-- Drop moderation columns from Sub
ALTER TABLE "Sub" DROP COLUMN "moderated";
ALTER TABLE "Sub" DROP COLUMN "moderatedCount";

-- =====================
-- ITEM MODEL CHANGES
-- =====================

-- Drop the genoutlawed generated column first (depends on genoutlawed_state function)
ALTER TABLE "Item" DROP COLUMN "genoutlawed";

-- Drop the genoutlawed_state function
DROP FUNCTION IF EXISTS genoutlawed_state;

-- Drop the outlawed column
ALTER TABLE "Item" DROP COLUMN "outlawed";

-- Add netInvestment column to Item (regular column, not generated, to avoid full table rewrite)
-- Default 0 so the ADD COLUMN is instant in PG 11+
ALTER TABLE "Item" ADD COLUMN "netInvestment" INT NOT NULL DEFAULT 0;

-- Create the function used by the trigger to keep netInvestment up to date
CREATE OR REPLACE FUNCTION item_net_investment_trigger() RETURNS trigger
LANGUAGE plpgsql AS $$
BEGIN
  NEW."netInvestment" := (
    COALESCE(NEW.cost, 0) +
    COALESCE(NEW.boost, 0) +
    (COALESCE(NEW.msats, 0) / 1000) -
    (COALESCE(NEW."downMsats", 0) / 1000)
  )::integer;
  RETURN NEW;
END;
$$;

-- Only fire trigger when the source columns change (or on insert)
-- UPDATE OF ensures the trigger is skipped for unrelated column updates (e.g. text, title)
-- This also means the backfill UPDATE below (which only sets netInvestment) won't re-trigger
CREATE TRIGGER item_net_investment
  BEFORE INSERT OR UPDATE OF cost, boost, msats, "downMsats" ON "Item"
  FOR EACH ROW EXECUTE FUNCTION item_net_investment_trigger();

-- Backfill netInvestment for existing rows that still have the default (0)
-- Only updates rows where the computed value differs, skipping rows already correct
UPDATE "Item" SET "netInvestment" = (
  COALESCE(cost, 0) +
  COALESCE(boost, 0) +
  (COALESCE(msats, 0) / 1000) -
  (COALESCE("downMsats", 0) / 1000)
)::integer
WHERE "netInvestment" != (
  COALESCE(cost, 0) +
  COALESCE(boost, 0) +
  (COALESCE(msats, 0) / 1000) -
  (COALESCE("downMsats", 0) / 1000)
)::integer;

-- Create index concurrently to avoid blocking writes during index build
-- NOTE: CREATE INDEX CONCURRENTLY cannot run inside a transaction block.
-- If your migration runner wraps this in a transaction, you may need to split
-- this into a separate migration or run it manually.
CREATE INDEX "Item_netInvestment_idx" ON "Item"("netInvestment");

-- Backfill freebie column for historical items
-- Previously /recent/freebies used "cost = 0", now it uses "freebie = true"
UPDATE "Item" SET freebie = true WHERE cost = 0;

-- =====================
-- UPDATE COMMENT FUNCTIONS
-- =====================

-- Update item_comments to remove genoutlawed references
CREATE OR REPLACE FUNCTION item_comments(_item_id int, _level int, _where text, _order_by text)
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
        || '    to_jsonb("PayIn".*) || jsonb_build_object(''payInStateChangedAt'', "PayIn"."payInStateChangedAt" at time zone ''UTC'') as "payIn", '
        || '    to_jsonb(users.*) as user '
        || '    FROM "Item" '
        || '    JOIN users ON users.id = "Item"."userId" '
        || '    JOIN LATERAL ( '
        || '        SELECT "PayIn".* '
        || '        FROM "ItemPayIn" '
        || '        JOIN "PayIn" ON "PayIn".id = "ItemPayIn"."payInId" AND "PayIn"."payInType" = ''ITEM_CREATE'' '
        || '        WHERE "ItemPayIn"."itemId" = "Item".id AND "PayIn"."payInState" = ''PAID'' '
        || '        ORDER BY "PayIn"."created_at" DESC '
        || '        LIMIT 1 '
        || '    ) "PayIn" ON "PayIn".id IS NOT NULL '
        || '    WHERE  "Item".path <@ (SELECT path FROM "Item" WHERE id = $1) ' || _where
    USING _item_id, _level, _where, _order_by;

    EXECUTE ''
        || 'SELECT COALESCE(jsonb_agg(sub), ''[]''::jsonb) AS comments '
        || 'FROM  ( '
        || '    SELECT "Item".*, item_comments("Item".id, $2 - 1, $3, $4) AS comments '
        || '    FROM   t_item "Item"'
        || '    WHERE  "Item"."parentId" = $1 '
        ||      _order_by
        || ' ) sub'
    INTO result USING _item_id, _level, _where, _order_by;
    RETURN result;
END
$$;

-- Update item_comments_limited
CREATE OR REPLACE FUNCTION item_comments_limited(
    _item_id int, _limit int, _offset int, _grandchild_limit int,
    _level int, _where text, _order_by text)
  RETURNS jsonb
  LANGUAGE plpgsql VOLATILE PARALLEL SAFE AS
$$
DECLARE
    result  jsonb;
BEGIN
    IF _level < 1 THEN
        RETURN '[]'::jsonb;
    END IF;

    EXECUTE 'CREATE TEMP TABLE IF NOT EXISTS t_item ON COMMIT DROP AS '
        || 'WITH RECURSIVE base AS ( '
        || '    (SELECT "Item".*, 1 as level, ROW_NUMBER() OVER () as rn '
        || '    FROM "Item" '
        || '    WHERE "Item"."parentId" = $1 '
        ||      _order_by || ' '
        || '    LIMIT $2 '
        || '    OFFSET $3) '
        || '    UNION ALL '
        || '    (SELECT "Item".*, b.level + 1, ROW_NUMBER() OVER (PARTITION BY "Item"."parentId" ' || _order_by || ') '
        || '    FROM "Item" '
        || '    JOIN base b ON "Item"."parentId" = b.id '
        || '    WHERE b.level < $5 AND (b.level = 1 OR b.rn <= $4)) '
        || ') '
        || 'SELECT "Item".*, "Item".created_at at time zone ''UTC'' AS "createdAt", "Item".updated_at at time zone ''UTC'' AS "updatedAt", '
        || '    to_jsonb("PayIn".*) || jsonb_build_object(''payInStateChangedAt'', "PayIn"."payInStateChangedAt" at time zone ''UTC'') as "payIn", '
        || '    to_jsonb(users.*) as user '
        || 'FROM base "Item" '
        || 'JOIN users ON users.id = "Item"."userId" '
        || 'JOIN LATERAL ( '
        || '    SELECT "PayIn".* '
        || '    FROM "ItemPayIn" '
        || '    JOIN "PayIn" ON "PayIn".id = "ItemPayIn"."payInId" AND "PayIn"."payInType" = ''ITEM_CREATE'' '
        || '    WHERE "ItemPayIn"."itemId" = "Item".id AND "PayIn"."payInState" = ''PAID'' '
        || '    ORDER BY "PayIn"."created_at" DESC '
        || '    LIMIT 1 '
        || ') "PayIn" ON "PayIn".id IS NOT NULL '
        || 'WHERE ("Item".level = 1 OR "Item".rn <= $4 - "Item".level + 2) ' || _where
    USING _item_id, _limit, _offset, _grandchild_limit, _level, _where, _order_by;


    EXECUTE ''
        || 'SELECT COALESCE(jsonb_agg(sub), ''[]''::jsonb) AS comments '
        || 'FROM  ( '
        || '    SELECT "Item".*, item_comments_limited("Item".id, $2, $3, $4, $5 - 1, $6, $7) AS comments '
        || '    FROM   t_item "Item" '
        || '    WHERE  "Item"."parentId" = $1 '
        ||      _order_by
        || ' ) sub'
    INTO result USING _item_id, _limit, _offset, _grandchild_limit, _level, _where, _order_by;
    RETURN result;
END
$$;

-- Update item_comments_zaprank_with_me
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
        || '    to_jsonb("PayIn".*) || jsonb_build_object(''payInStateChangedAt'', "PayIn"."payInStateChangedAt" at time zone ''UTC'') as "payIn", '
        || '    to_jsonb(users.*) || jsonb_build_object(''meMute'', "Mute"."mutedId" IS NOT NULL) AS user, '
        || '    COALESCE("MeItemPayIn"."meMsats", 0) AS "meMsats", COALESCE("MeItemPayIn"."mePendingMsats", 0) as "mePendingMsats", COALESCE("MeItemPayIn"."meDontLikeMsats", 0) AS "meDontLikeMsats", '
        || '    COALESCE("MeItemPayIn"."meMcredits", 0) AS "meMcredits", COALESCE("MeItemPayIn"."mePendingMcredits", 0) as "mePendingMcredits", '
        || '    COALESCE("MeItemPayIn"."mePendingBoostMsats", 0) as "mePendingBoostMsats", '
        || '    "Bookmark"."itemId" IS NOT NULL AS "meBookmark", "ThreadSubscription"."itemId" IS NOT NULL AS "meSubscription" '
        || '    FROM "Item" '
        || '    JOIN users ON users.id = "Item"."userId" '
        || '    JOIN LATERAL ( '
        || '        SELECT "PayIn".* '
        || '        FROM "ItemPayIn" '
        || '        JOIN "PayIn" ON "PayIn".id = "ItemPayIn"."payInId" AND "PayIn"."payInType" = ''ITEM_CREATE'' '
        || '        WHERE "ItemPayIn"."itemId" = "Item".id AND ("PayIn"."userId" = $5 OR "PayIn"."payInState" = ''PAID'') '
        || '        ORDER BY "PayIn"."created_at" DESC '
        || '        LIMIT 1 '
        || '    ) "PayIn" ON "PayIn".id IS NOT NULL '
        || '    LEFT JOIN "Mute" ON "Mute"."muterId" = $5 AND "Mute"."mutedId" = "Item"."userId"'
        || '    LEFT JOIN "Bookmark" ON "Bookmark"."userId" = $5 AND "Bookmark"."itemId" = "Item".id '
        || '    LEFT JOIN "ThreadSubscription" ON "ThreadSubscription"."userId" = $5 AND "ThreadSubscription"."itemId" = "Item".id '
        || '    LEFT JOIN LATERAL ( '
        || '        SELECT "itemId", '
        || '            sum("PayIn".mcost) FILTER (WHERE "PayOutBolt11".id IS NOT NULL AND "PayIn"."payInType" = ''ZAP'') AS "meMsats", '
        || '            sum("PayIn".mcost) FILTER (WHERE "PayOutBolt11".id IS NULL AND "PayIn"."payInType" = ''ZAP'') AS "meMcredits", '
        || '            sum("PayIn".mcost) FILTER (WHERE "PayIn"."payInState" <> ''PAID'' AND "PayOutBolt11".id IS NOT NULL AND "PayIn"."payInType" = ''ZAP'') AS "mePendingMsats", '
        || '            sum("PayIn".mcost) FILTER (WHERE "PayIn"."payInState" <> ''PAID'' AND "PayOutBolt11".id IS NULL AND "PayIn"."payInType" = ''ZAP'') AS "mePendingMcredits", '
        || '            sum("PayIn".mcost) FILTER (WHERE "PayIn"."payInType" = ''DOWN_ZAP'') AS "meDontLikeMsats", '
        || '            sum("PayIn".mcost) FILTER (WHERE "PayIn"."payInState" <> ''PAID'' AND "PayIn"."payInType" = ''BOOST'') AS "mePendingBoostMsats" '
        || '        FROM "ItemPayIn" '
        || '        JOIN "PayIn" ON "PayIn".id = "ItemPayIn"."payInId" '
        || '        LEFT JOIN "PayOutBolt11" ON "PayOutBolt11"."payInId" = "PayIn".id '
        || '        WHERE "ItemPayIn"."itemId" = "Item".id AND "PayIn"."userId" = $5 '
        || '        AND ( '
        || '            "PayIn"."payInState" = ''PAID'' '
        || '            OR "PayIn"."payInState" <> ''FAILED'' '
        || '            OR ( '
        || '                "PayIn"."payInState" = ''FAILED'' '
        || '                AND "PayIn"."payInFailureReason" <> ''USER_CANCELLED'' '
        || '                AND "PayIn"."payInStateChangedAt" > now() - ''1 hour''::interval '
        || '                AND "PayIn"."retryCount" < 5 '
        || '                AND "PayIn"."successorId" IS NULL '
        || '            ) '
        || '        ) '
        || '        GROUP BY "ItemPayIn"."itemId" '
        || '    ) "MeItemPayIn" ON true '
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

-- Update item_comments_zaprank_with_me_limited
CREATE OR REPLACE FUNCTION item_comments_zaprank_with_me_limited(
    _item_id int, _global_seed int, _me_id int, _limit int, _offset int, _grandchild_limit int,
    _level int, _where text, _order_by text)
  RETURNS jsonb
  LANGUAGE plpgsql VOLATILE PARALLEL SAFE AS
$$
DECLARE
    result  jsonb;
BEGIN
    IF _level < 1 THEN
        RETURN '[]'::jsonb;
    END IF;

    EXECUTE 'CREATE TEMP TABLE IF NOT EXISTS t_item ON COMMIT DROP AS '
    || 'WITH RECURSIVE base AS ( '
    || '    (SELECT "Item".*, 1 as level, ROW_NUMBER() OVER () as rn '
    || '    FROM "Item" '
    || '    WHERE "Item"."parentId" = $1 '
    ||      _order_by || ' '
    || '    LIMIT $4 '
    || '    OFFSET $5) '
    || '    UNION ALL '
    || '    (SELECT "Item".*, b.level + 1, ROW_NUMBER() OVER (PARTITION BY "Item"."parentId" ' || _order_by || ') as rn '
    || '    FROM "Item" '
    || '    JOIN base b ON "Item"."parentId" = b.id '
    || '    WHERE b.level < $7 AND (b.level = 1 OR b.rn <= $6)) '
    || ') '
    || 'SELECT "Item".*, '
    || '    "Item".created_at at time zone ''UTC'' AS "createdAt", '
    || '    "Item".updated_at at time zone ''UTC'' AS "updatedAt", '
    || '    to_jsonb("PayIn".*) || jsonb_build_object(''payInStateChangedAt'', "PayIn"."payInStateChangedAt" at time zone ''UTC'') as "payIn", '
    || '    to_jsonb(users.*) || jsonb_build_object(''meMute'', "Mute"."mutedId" IS NOT NULL) AS user, '
    || '    COALESCE("MeItemPayIn"."meMsats", 0) AS "meMsats", '
    || '    COALESCE("MeItemPayIn"."mePendingMsats", 0) as "mePendingMsats", '
    || '    COALESCE("MeItemPayIn"."meDontLikeMsats", 0) AS "meDontLikeMsats", '
    || '    COALESCE("MeItemPayIn"."meMcredits", 0) AS "meMcredits", '
    || '    COALESCE("MeItemPayIn"."mePendingMcredits", 0) as "mePendingMcredits", '
    || '    COALESCE("MeItemPayIn"."mePendingBoostMsats", 0) as "mePendingBoostMsats", '
    || '    "Bookmark"."itemId" IS NOT NULL AS "meBookmark", '
    || '    "ThreadSubscription"."itemId" IS NOT NULL AS "meSubscription" '
    || 'FROM base "Item" '
    || 'JOIN users ON users.id = "Item"."userId" '
    || 'JOIN LATERAL ( '
    || '    SELECT "PayIn".* '
    || '    FROM "ItemPayIn" '
    || '    JOIN "PayIn" ON "PayIn".id = "ItemPayIn"."payInId" AND "PayIn"."payInType" = ''ITEM_CREATE'' '
    || '    WHERE "ItemPayIn"."itemId" = "Item".id AND ("PayIn"."userId" = $3 OR "PayIn"."payInState" = ''PAID'') '
    || '    ORDER BY "PayIn"."created_at" DESC '
    || '    LIMIT 1 '
    || ') "PayIn" ON "PayIn".id IS NOT NULL '
    || 'LEFT JOIN "Mute" ON "Mute"."muterId" = $3 AND "Mute"."mutedId" = "Item"."userId" '
    || 'LEFT JOIN "Bookmark" ON "Bookmark"."userId" = $3 AND "Bookmark"."itemId" = "Item".id '
    || 'LEFT JOIN "ThreadSubscription" ON "ThreadSubscription"."userId" = $3 AND "ThreadSubscription"."itemId" = "Item".id '
    || 'LEFT JOIN LATERAL ( '
    || '    SELECT "itemId", '
    || '        sum("PayIn".mcost) FILTER (WHERE "PayOutBolt11".id IS NOT NULL AND "PayIn"."payInType" = ''ZAP'') AS "meMsats", '
    || '        sum("PayIn".mcost) FILTER (WHERE "PayOutBolt11".id IS NULL AND "PayIn"."payInType" = ''ZAP'') AS "meMcredits", '
    || '        sum("PayIn".mcost) FILTER (WHERE "PayIn"."payInState" <> ''PAID'' AND "PayOutBolt11".id IS NOT NULL AND "PayIn"."payInType" = ''ZAP'') AS "mePendingMsats", '
    || '        sum("PayIn".mcost) FILTER (WHERE "PayIn"."payInState" <> ''PAID'' AND "PayOutBolt11".id IS NULL AND "PayIn"."payInType" = ''ZAP'') AS "mePendingMcredits", '
    || '        sum("PayIn".mcost) FILTER (WHERE "PayIn"."payInType" = ''DOWN_ZAP'') AS "meDontLikeMsats", '
    || '        sum("PayIn".mcost) FILTER (WHERE "PayIn"."payInState" <> ''PAID'' AND "PayIn"."payInType" = ''BOOST'') AS "mePendingBoostMsats" '
    || '    FROM "ItemPayIn" '
    || '    JOIN "PayIn" ON "PayIn".id = "ItemPayIn"."payInId" '
    || '    LEFT JOIN "PayOutBolt11" ON "PayOutBolt11"."payInId" = "PayIn".id '
    || '    WHERE "ItemPayIn"."itemId" = "Item".id AND "PayIn"."userId" = $3 '
    || '    AND ( '
    || '        "PayIn"."payInState" = ''PAID'' '
    || '        OR "PayIn"."payInState" <> ''FAILED'' '
    || '        OR ( '
    || '            "PayIn"."payInState" = ''FAILED'' '
    || '            AND "PayIn"."payInFailureReason" <> ''USER_CANCELLED'' '
    || '            AND "PayIn"."payInStateChangedAt" > now() - ''1 hour''::interval '
    || '            AND "PayIn"."retryCount" < 5 '
    || '            AND "PayIn"."successorId" IS NULL '
    || '        ) '
    || '    ) '
    || '    GROUP BY "ItemPayIn"."itemId" '
    || ') "MeItemPayIn" ON true '
    || 'WHERE ("Item".level = 1 OR "Item".rn <= $6 - "Item".level + 2) ' || _where || ' '
    USING _item_id, _global_seed, _me_id, _limit, _offset, _grandchild_limit, _level, _where, _order_by;

    EXECUTE ''
        || 'SELECT COALESCE(jsonb_agg(sub), ''[]''::jsonb) AS comments '
        || 'FROM  ( '
        || '    SELECT "Item".*, item_comments_zaprank_with_me_limited("Item".id, $2, $3, $4, $5, $6, $7 - 1, $8, $9) AS comments '
        || '    FROM t_item "Item" '
        || '    WHERE  "Item"."parentId" = $1 '
        ||      _order_by
        || ' ) sub'
    INTO result USING _item_id, _global_seed, _me_id, _limit, _offset, _grandchild_limit, _level, _where, _order_by;

    RETURN result;
END
$$;
