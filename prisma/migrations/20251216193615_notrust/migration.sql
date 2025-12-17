-- AlterTable
ALTER TABLE "Item" ADD COLUMN     "commentDownMsats" BIGINT NOT NULL DEFAULT 0,
ADD COLUMN     "downMsats" BIGINT NOT NULL DEFAULT 0;

-- for all downzaps, denormalize the downMsats and commentDownMsats of ancestors
WITH downzaps AS (
    UPDATE "Item"
    SET "downMsats" = subquery."downMsats"
    FROM (
        SELECT "ItemPayIn"."itemId" AS "itemId", SUM("PayIn".mcost) AS "downMsats"
        FROM "ItemPayIn"
        JOIN "PayIn" ON "PayIn"."id" = "ItemPayIn"."payInId"
        WHERE "PayIn"."payInType" = 'DOWN_ZAP'
        AND "PayIn"."payInState" = 'PAID'
        GROUP BY "ItemPayIn"."itemId"
    ) subquery
    WHERE "Item"."id" = subquery."itemId"
    RETURNING "Item".*
)
UPDATE "Item"
SET "commentDownMsats" = subquery."commentDownMsats"
FROM (
    SELECT b.id AS "itemId", SUM(a."downMsats") AS "commentDownMsats"
    FROM downzaps a
    JOIN "Item" b ON b.path <@ a.path AND a.id <> b.id
    GROUP BY b.id
) subquery
WHERE "Item"."id" = subquery."itemId";

CREATE OR REPLACE FUNCTION ranktop_base_exp(
  "msats"              numeric,
  "boost"              numeric,
  "oldBoost"           numeric,
  "commentMsats"       numeric,
  "downMsats"           numeric,
  "commentDownMsats"  numeric
) RETURNS double precision
LANGUAGE sql IMMUTABLE PARALLEL SAFE AS $$
  SELECT
    (
    (COALESCE("msats",0)::double precision
       + (COALESCE("boost",0)::double precision + COALESCE("oldBoost",0)::double precision) * 1000.0
       + COALESCE("commentMsats",0)::double precision * 0.1
      ) * 0.3
      - COALESCE("downMsats",0)::double precision
      - COALESCE("commentDownMsats",0)::double precision * 0.1
    )
$$;

ALTER TABLE "Item"
  ADD COLUMN ranktop double precision GENERATED ALWAYS AS (
    ranktop_base_exp("msats", "boost", "oldBoost", "commentMsats", "downMsats", "commentDownMsats")
  ) STORED NOT NULL;

-- Static exponential ORDER BY key in log-space (H=8h ⇒ λ ≈ 0.086643/h)
ALTER TABLE "Item"
  ADD COLUMN rankhot double precision GENERATED ALWAYS AS (
    CASE
      WHEN ranktop_base_exp("msats", "boost", "oldBoost", "commentMsats", "downMsats", "commentDownMsats") > 0
        THEN LN(ranktop_base_exp("msats", "boost", "oldBoost", "commentMsats", "downMsats", "commentDownMsats")) + 0.086643 * (EXTRACT(EPOCH FROM "Item".created_at) / 3600.0)
      ELSE -1e300
    END
  ) STORED NOT NULL;

ALTER TABLE "Item" ADD COLUMN "rankboost" DOUBLE PRECISION GENERATED ALWAYS AS (
    (COALESCE("boost",0)::double precision)
        * 1000.0
        * 0.3
    - COALESCE("downMsats",0)::double precision
) STORED NOT NULL;

CREATE INDEX "Item_ranktop_idx" ON "Item"("ranktop");
CREATE INDEX "Item_rankhot_idx" ON "Item"("rankhot");
CREATE INDEX "Item_rankboost_idx" ON "Item"("rankboost");

CREATE INDEX "Item_subName_rankboost_idx" ON "Item"("subName", "rankboost");
CREATE INDEX "Item_subName_created_at_idx" ON "Item"("subName", "created_at");
CREATE INDEX "Item_subName_ranktop_idx" ON "Item"("subName", "ranktop");
CREATE INDEX "Item_subName_rankhot_idx" ON "Item"("subName", "rankhot");

CREATE INDEX "Item_total_boost_idx" ON "Item"(("boost" + "oldBoost"));

CREATE OR REPLACE FUNCTION update_weekly_posts_job()
RETURNS INTEGER
LANGUAGE plpgsql
AS $$
DECLARE
BEGIN
    UPDATE pgboss.schedule
    SET data = jsonb_build_object(
        'title', 'Meme Monday - Top Meme Goes in the Newsletter',
        'text',  E'Time for another round of Meme Monday!\n\nThe week''s winner, as determined by the "top" filter on this thread, will go in this week''s newsletter and get eternal bragging rights.\n\nSend your best 👇',
        'subName', 'memes')
    WHERE name = 'weeklyPost-meme-mon';

    return 0;
EXCEPTION WHEN OTHERS THEN
    return 0;
END;
$$;

SELECT update_weekly_posts_job();
DROP FUNCTION IF EXISTS update_weekly_posts_job;

-- remove hot_score_view

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

-- add cowboy credits
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