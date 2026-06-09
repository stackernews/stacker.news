CREATE OR REPLACE FUNCTION check_pending_bolt11s()
RETURNS INTEGER
LANGUAGE plpgsql
AS $$
DECLARE
BEGIN
    UPDATE pgboss.schedule SET name = 'checkPendingPayInBolt11s', cron = '*/5 * * * *' WHERE name = 'checkPendingDeposits';
    UPDATE pgboss.schedule SET name = 'checkPendingPayOutBolt11s', cron = '*/5 * * * *' WHERE name = 'checkPendingWithdrawals';
    INSERT INTO pgboss.schedule (name, cron, timezone) VALUES ('checkPendingPayInInvoiceCreations', '*/5 * * * *', 'America/Chicago') ON CONFLICT DO NOTHING;
    return 0;
EXCEPTION WHEN OTHERS THEN
    return 0;
END;
$$;

SELECT check_pending_bolt11s();
DROP FUNCTION check_pending_bolt11s();

-- migrates these functions to use payIn instead of invoice

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
        || '    to_jsonb(users.*) as user, '
        || '    g.hot_score AS "hotScore", g.sub_hot_score AS "subHotScore" '
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
        || '    LEFT JOIN hot_score_view g ON g.id = "Item".id '
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
        || '    LEFT JOIN hot_score_view g(id, "hotScore", "subHotScore") ON g.id = "Item".id '
        || '    WHERE "Item"."parentId" = $1 '
        ||      _order_by || ' '
        || '    LIMIT $2 '
        || '    OFFSET $3) '
        || '    UNION ALL '
        || '    (SELECT "Item".*, b.level + 1, ROW_NUMBER() OVER (PARTITION BY "Item"."parentId" ' || _order_by || ') '
        || '    FROM "Item" '
        || '    JOIN base b ON "Item"."parentId" = b.id '
        || '    LEFT JOIN hot_score_view g(id, "hotScore", "subHotScore") ON g.id = "Item".id '
        || '    WHERE b.level < $5 AND (b.level = 1 OR b.rn <= $4)) '
        || ') '
        || 'SELECT "Item".*, "Item".created_at at time zone ''UTC'' AS "createdAt", "Item".updated_at at time zone ''UTC'' AS "updatedAt", '
        || '    to_jsonb("PayIn".*) || jsonb_build_object(''payInStateChangedAt'', "PayIn"."payInStateChangedAt" at time zone ''UTC'') as "payIn", '
        || '    to_jsonb(users.*) as user, '
        || '    g.hot_score AS "hotScore", g.sub_hot_score AS "subHotScore" '
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
        || 'LEFT JOIN hot_score_view g ON g.id = "Item".id '
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
        || '    "Bookmark"."itemId" IS NOT NULL AS "meBookmark", "ThreadSubscription"."itemId" IS NOT NULL AS "meSubscription", '
        || '    g.hot_score AS "hotScore", g.sub_hot_score AS "subHotScore" '
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
        || '    LEFT JOIN hot_score_view g ON g.id = "Item".id '
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


-- add limit and offset
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
    || '    LEFT JOIN hot_score_view g(id, "hotScore", "subHotScore") ON g.id = "Item".id '
    || '    WHERE "Item"."parentId" = $1 '
    ||      _order_by || ' '
    || '    LIMIT $4 '
    || '    OFFSET $5) '
    || '    UNION ALL '
    || '    (SELECT "Item".*, b.level + 1, ROW_NUMBER() OVER (PARTITION BY "Item"."parentId" ' || _order_by || ') as rn '
    || '    FROM "Item" '
    || '    JOIN base b ON "Item"."parentId" = b.id '
    || '    LEFT JOIN hot_score_view g(id, "hotScore", "subHotScore") ON g.id = "Item".id '
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
    || '    "ThreadSubscription"."itemId" IS NOT NULL AS "meSubscription", '
    || '    g.hot_score AS "hotScore", g.sub_hot_score AS "subHotScore" '
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
    || 'LEFT JOIN hot_score_view g ON g.id = "Item".id '
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
    || '    WHERE "ItemPayIn"."itemId" = "Item".id AND "PayIn"."userId" = $5 '
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