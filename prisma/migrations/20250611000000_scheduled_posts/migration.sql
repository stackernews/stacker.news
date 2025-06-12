-- Add fields for scheduled posts to the Item model
ALTER TABLE "Item" ADD COLUMN "scheduledAt" TIMESTAMP(3);
ALTER TABLE "Item" ADD COLUMN "isScheduled" BOOLEAN NOT NULL DEFAULT FALSE;

-- Create indexes for efficient querying of scheduled posts
CREATE INDEX "Item_scheduledAt_idx" ON "Item"("scheduledAt");
CREATE INDEX "Item_isScheduled_idx" ON "Item"("isScheduled");
CREATE INDEX "Item_isScheduled_scheduledAt_idx" ON "Item"("isScheduled", "scheduledAt");

-- Update stored functions to filter out scheduled posts from comments for non-owners

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
    || '    AND ("Item"."isScheduled" = false OR "Item"."userId" = $3) '
    ||      _order_by || ' '
    || '    LIMIT $4 '
    || '    OFFSET $5) '
    || '    UNION ALL '
    || '    (SELECT "Item".*, b.level + 1, ROW_NUMBER() OVER (PARTITION BY "Item"."parentId" ' || _order_by || ') as rn '
    || '    FROM "Item" '
    || '    JOIN base b ON "Item"."parentId" = b.id '
    || '    LEFT JOIN hot_score_view g(id, "hotScore", "subHotScore") ON g.id = "Item".id '
    || '    WHERE b.level < $7 AND (b.level = 1 OR b.rn <= $6) '
    || '    AND ("Item"."isScheduled" = false OR "Item"."userId" = $3)) '
    || ') '
    || 'SELECT "Item".*, '
    || '    "Item".created_at at time zone ''UTC'' AS "createdAt", '
    || '    "Item".updated_at at time zone ''UTC'' AS "updatedAt", '
    || '    "Item"."invoicePaidAt" at time zone ''UTC'' AS "invoicePaidAtUTC", '
    || '    to_jsonb(users.*) || jsonb_build_object(''meMute'', "Mute"."mutedId" IS NOT NULL) AS user, '
    || '    COALESCE("ItemAct"."meMsats", 0) AS "meMsats", '
    || '    COALESCE("ItemAct"."mePendingMsats", 0) as "mePendingMsats", '
    || '    COALESCE("ItemAct"."meDontLikeMsats", 0) AS "meDontLikeMsats", '
    || '    COALESCE("ItemAct"."meMcredits", 0) AS "meMcredits", '
    || '    COALESCE("ItemAct"."mePendingMcredits", 0) as "mePendingMcredits", '
    || '    "Bookmark"."itemId" IS NOT NULL AS "meBookmark", '
    || '    "ThreadSubscription"."itemId" IS NOT NULL AS "meSubscription", '
    || '    g.hot_score AS "hotScore", g.sub_hot_score AS "subHotScore" '
    || 'FROM base "Item" '
    || 'JOIN users ON users.id = "Item"."userId" '
    || '    LEFT JOIN "Mute" ON "Mute"."muterId" = $3 AND "Mute"."mutedId" = "Item"."userId" '
    || '    LEFT JOIN "Bookmark" ON "Bookmark"."userId" = $3 AND "Bookmark"."itemId" = "Item".id '
    || '    LEFT JOIN "ThreadSubscription" ON "ThreadSubscription"."userId" = $3 AND "ThreadSubscription"."itemId" = "Item".id '
    || '    LEFT JOIN hot_score_view g ON g.id = "Item".id '
    || 'LEFT JOIN LATERAL ( '
    || '    SELECT "itemId", '
    || '        sum("ItemAct".msats) FILTER (WHERE "invoiceActionState" IS DISTINCT FROM ''FAILED'' AND "InvoiceForward".id IS NOT NULL AND (act = ''FEE'' OR act = ''TIP'')) AS "meMsats", '
    || '        sum("ItemAct".msats) FILTER (WHERE "invoiceActionState" IS DISTINCT FROM ''FAILED'' AND "InvoiceForward".id IS NULL AND (act = ''FEE'' OR act = ''TIP'')) AS "meMcredits", '
    || '        sum("ItemAct".msats) FILTER (WHERE "invoiceActionState" IS NOT DISTINCT FROM ''PENDING'' AND "InvoiceForward".id IS NOT NULL AND (act = ''FEE'' OR act = ''TIP'')) AS "mePendingMsats", '
    || '        sum("ItemAct".msats) FILTER (WHERE "invoiceActionState" IS NOT DISTINCT FROM ''PENDING'' AND "InvoiceForward".id IS NULL AND (act = ''FEE'' OR act = ''TIP'')) AS "mePendingMcredits", '
    || '        sum("ItemAct".msats) FILTER (WHERE "invoiceActionState" IS DISTINCT FROM ''FAILED'' AND act = ''DONT_LIKE_THIS'') AS "meDontLikeMsats" '
    || '    FROM "ItemAct" '
    || '    LEFT JOIN "Invoice" ON "Invoice".id = "ItemAct"."invoiceId" '
    || '    LEFT JOIN "InvoiceForward" ON "InvoiceForward"."invoiceId" = "Invoice"."id" '
    || '    WHERE "ItemAct"."userId" = $3 '
    || '    AND "ItemAct"."itemId" = "Item".id '
    || '    GROUP BY "ItemAct"."itemId" '
    || ') "ItemAct" ON true '
    || 'WHERE ("Item".level = 1 OR "Item".rn <= $6 - "Item".level + 2) ' || _where || ' '
    USING _item_id, _global_seed, _me_id, _limit, _offset, _grandchild_limit, _level, _where, _order_by;

    EXECUTE ''
        || 'SELECT COALESCE(jsonb_agg(sub), ''[]''::jsonb) AS comments '
        || 'FROM  ( '
        || '    SELECT "Item".*, item_comments_zaprank_with_me_limited("Item".id, $2, $3, $4, $5, $6, $7 - 1, $8, $9) AS comments '
        || '    FROM t_item "Item" '
        || '    WHERE  "Item"."parentId" = $1 '
        ||      _order_by
        || ' ) sub '
    INTO result
    USING _item_id, _global_seed, _me_id, _limit, _offset, _grandchild_limit, _level, _where, _order_by;

    RETURN result;
END
$$;

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

    EXECUTE 'CREATE TEMP TABLE IF NOT EXISTS t_item ON COMMIT DROP AS '
    || 'WITH RECURSIVE base AS ( '
    || '    (SELECT "Item".*, 1 as level '
    || '    FROM "Item" '
    || '    LEFT JOIN hot_score_view g(id, "hotScore", "subHotScore") ON g.id = "Item".id '
    || '    WHERE "Item"."parentId" = $1 '
    || '    AND ("Item"."isScheduled" = false OR "Item"."userId" = $3) '
    ||      _order_by || ') '
    || '    UNION ALL '
    || '    (SELECT "Item".*, b.level + 1 '
    || '    FROM "Item" '
    || '    JOIN base b ON "Item"."parentId" = b.id '
    || '    LEFT JOIN hot_score_view g(id, "hotScore", "subHotScore") ON g.id = "Item".id '
    || '    WHERE b.level < $2 '
    || '    AND ("Item"."isScheduled" = false OR "Item"."userId" = $3)) '
    || ') '
    || 'SELECT "Item".*, '
    || '    "Item".created_at at time zone ''UTC'' AS "createdAt", '
    || '    "Item".updated_at at time zone ''UTC'' AS "updatedAt", '
    || '    "Item"."invoicePaidAt" at time zone ''UTC'' AS "invoicePaidAtUTC", '
    || '    to_jsonb(users.*) || jsonb_build_object(''meMute'', "Mute"."mutedId" IS NOT NULL) AS user, '
    || '    COALESCE("ItemAct"."meMsats", 0) AS "meMsats", '
    || '    COALESCE("ItemAct"."mePendingMsats", 0) as "mePendingMsats", '
    || '    COALESCE("ItemAct"."meDontLikeMsats", 0) AS "meDontLikeMsats", '
    || '    COALESCE("ItemAct"."meMcredits", 0) AS "meMcredits", '
    || '    COALESCE("ItemAct"."mePendingMcredits", 0) as "mePendingMcredits", '
    || '    "Bookmark"."itemId" IS NOT NULL AS "meBookmark", '
    || '    "ThreadSubscription"."itemId" IS NOT NULL AS "meSubscription", '
    || '    g.hot_score AS "hotScore", g.sub_hot_score AS "subHotScore" '
    || 'FROM base "Item" '
    || 'JOIN users ON users.id = "Item"."userId" '
    || '    LEFT JOIN "Mute" ON "Mute"."muterId" = $3 AND "Mute"."mutedId" = "Item"."userId" '
    || '    LEFT JOIN "Bookmark" ON "Bookmark"."userId" = $3 AND "Bookmark"."itemId" = "Item".id '
    || '    LEFT JOIN "ThreadSubscription" ON "ThreadSubscription"."userId" = $3 AND "ThreadSubscription"."itemId" = "Item".id '
    || '    LEFT JOIN hot_score_view g ON g.id = "Item".id '
    || 'LEFT JOIN LATERAL ( '
    || '    SELECT "itemId", '
    || '        sum("ItemAct".msats) FILTER (WHERE "invoiceActionState" IS DISTINCT FROM ''FAILED'' AND "InvoiceForward".id IS NOT NULL AND (act = ''FEE'' OR act = ''TIP'')) AS "meMsats", '
    || '        sum("ItemAct".msats) FILTER (WHERE "invoiceActionState" IS DISTINCT FROM ''FAILED'' AND "InvoiceForward".id IS NULL AND (act = ''FEE'' OR act = ''TIP'')) AS "meMcredits", '
    || '        sum("ItemAct".msats) FILTER (WHERE "invoiceActionState" IS NOT DISTINCT FROM ''PENDING'' AND "InvoiceForward".id IS NOT NULL AND (act = ''FEE'' OR act = ''TIP'')) AS "mePendingMsats", '
    || '        sum("ItemAct".msats) FILTER (WHERE "invoiceActionState" IS NOT DISTINCT FROM ''PENDING'' AND "InvoiceForward".id IS NULL AND (act = ''FEE'' OR act = ''TIP'')) AS "mePendingMcredits", '
    || '        sum("ItemAct".msats) FILTER (WHERE "invoiceActionState" IS DISTINCT FROM ''FAILED'' AND act = ''DONT_LIKE_THIS'') AS "meDontLikeMsats" '
    || '    FROM "ItemAct" '
    || '    LEFT JOIN "Invoice" ON "Invoice".id = "ItemAct"."invoiceId" '
    || '    LEFT JOIN "InvoiceForward" ON "InvoiceForward"."invoiceId" = "Invoice"."id" '
    || '    WHERE "ItemAct"."userId" = $3 '
    || '    AND "ItemAct"."itemId" = "Item".id '
    || '    GROUP BY "ItemAct"."itemId" '
    || ') "ItemAct" ON true '
    || _where || ' '
    USING _item_id, _level, _me_id, _global_seed, _where, _order_by;

    EXECUTE ''
        || 'SELECT COALESCE(jsonb_agg(sub), ''[]''::jsonb) AS comments '
        || 'FROM  ( '
        || '    SELECT "Item".*, item_comments_zaprank_with_me("Item".id, $6, $5, $2 - 1, $3, $4) AS comments '
        || '    FROM t_item "Item" '
        || '    WHERE  "Item"."parentId" = $1 '
        ||      _order_by
        || ' ) sub '
    INTO result
    USING _item_id, _level, _where, _order_by, _me_id, _global_seed;

    RETURN result;
END
$$;

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

    EXECUTE 'CREATE TEMP TABLE IF NOT EXISTS t_item ON COMMIT DROP AS '
    || 'WITH RECURSIVE base AS ( '
    || '    (SELECT "Item".*, 1 as level '
    || '    FROM "Item" '
    || '    WHERE "Item"."parentId" = $1 '
    || '    AND "Item"."isScheduled" = false '
    ||      _order_by || ') '
    || '    UNION ALL '
    || '    (SELECT "Item".*, b.level + 1 '
    || '    FROM "Item" '
    || '    JOIN base b ON "Item"."parentId" = b.id '
    || '    WHERE b.level < $2 '
    || '    AND "Item"."isScheduled" = false) '
    || ') '
    || 'SELECT "Item".*, '
    || '    "Item".created_at at time zone ''UTC'' AS "createdAt", '
    || '    "Item".updated_at at time zone ''UTC'' AS "updatedAt", '
    || '    "Item"."invoicePaidAt" at time zone ''UTC'' AS "invoicePaidAtUTC", '
    || '    to_jsonb(users.*) AS user '
    || 'FROM base "Item" '
    || 'JOIN users ON users.id = "Item"."userId" '
    || _where || ' '
    USING _item_id, _level, _where, _order_by;

    EXECUTE ''
        || 'SELECT COALESCE(jsonb_agg(sub), ''[]''::jsonb) AS comments '
        || 'FROM  ( '
        || '    SELECT "Item".*, item_comments("Item".id, $2 - 1, $3, $4) AS comments '
        || '    FROM t_item "Item" '
        || '    WHERE  "Item"."parentId" = $1 '
        ||      _order_by
        || ' ) sub '
    INTO result
    USING _item_id, _level, _where, _order_by;

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
    || '    AND "Item"."isScheduled" = false '
    ||      _order_by || ' '
    || '    LIMIT $2 '
    || '    OFFSET $3) '
    || '    UNION ALL '
    || '    (SELECT "Item".*, b.level + 1, ROW_NUMBER() OVER (PARTITION BY "Item"."parentId" ' || _order_by || ') as rn '
    || '    FROM "Item" '
    || '    JOIN base b ON "Item"."parentId" = b.id '
    || '    WHERE b.level < $5 AND (b.level = 1 OR b.rn <= $4) '
    || '    AND "Item"."isScheduled" = false) '
    || ') '
    || 'SELECT "Item".*, '
    || '    "Item".created_at at time zone ''UTC'' AS "createdAt", '
    || '    "Item".updated_at at time zone ''UTC'' AS "updatedAt", '
    || '    "Item"."invoicePaidAt" at time zone ''UTC'' AS "invoicePaidAtUTC", '
    || '    to_jsonb(users.*) AS user '
    || 'FROM base "Item" '
    || 'JOIN users ON users.id = "Item"."userId" '
    || 'WHERE ("Item".level = 1 OR "Item".rn <= $4 - "Item".level + 2) ' || _where || ' '
    USING _item_id, _limit, _offset, _grandchild_limit, _level, _where, _order_by;

    EXECUTE ''
        || 'SELECT COALESCE(jsonb_agg(sub), ''[]''::jsonb) AS comments '
        || 'FROM  ( '
        || '    SELECT "Item".*, item_comments_limited("Item".id, $2, $3, $4, $5 - 1, $6, $7) AS comments '
        || '    FROM t_item "Item" '
        || '    WHERE  "Item"."parentId" = $1 '
        ||      _order_by
        || ' ) sub '
    INTO result
    USING _item_id, _limit, _offset, _grandchild_limit, _level, _where, _order_by;

    RETURN result;
END
$$;
