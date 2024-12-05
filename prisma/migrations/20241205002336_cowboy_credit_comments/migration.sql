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
        || '    "Item"."invoicePaidAt" at time zone ''UTC'' AS "invoicePaidAtUTC", to_jsonb(users.*) || jsonb_build_object(''meMute'', "Mute"."mutedId" IS NOT NULL) AS user, '
        || '    COALESCE("ItemAct"."meMsats", 0) AS "meMsats", COALESCE("ItemAct"."mePendingMsats", 0) as "mePendingMsats", COALESCE("ItemAct"."meDontLikeMsats", 0) AS "meDontLikeMsats", '
        || '    COALESCE("ItemAct"."meMcredits", 0) AS "meMcredits", COALESCE("ItemAct"."mePendingMcredits", 0) as "mePendingMcredits", '
        || '    "Bookmark"."itemId" IS NOT NULL AS "meBookmark", "ThreadSubscription"."itemId" IS NOT NULL AS "meSubscription", '
        || '    GREATEST(g.tf_hot_score, l.tf_hot_score) AS personal_hot_score, GREATEST(g.tf_top_score, l.tf_top_score) AS personal_top_score '
        || '    FROM "Item" '
        || '    JOIN users ON users.id = "Item"."userId" '
        || '    LEFT JOIN "Mute" ON "Mute"."muterId" = $5 AND "Mute"."mutedId" = "Item"."userId"'
        || '    LEFT JOIN "Bookmark" ON "Bookmark"."userId" = $5 AND "Bookmark"."itemId" = "Item".id '
        || '    LEFT JOIN "ThreadSubscription" ON "ThreadSubscription"."userId" = $5 AND "ThreadSubscription"."itemId" = "Item".id '
        || '    LEFT JOIN LATERAL ( '
        || '        SELECT "itemId", '
        || '            sum("ItemAct".msats) FILTER (WHERE "invoiceActionState" IS DISTINCT FROM ''FAILED'' AND "InvoiceForward".id IS NOT NULL AND (act = ''FEE'' OR act = ''TIP'')) AS "meMsats", '
        || '            sum("ItemAct".msats) FILTER (WHERE "invoiceActionState" IS DISTINCT FROM ''FAILED'' AND "InvoiceForward".id IS NULL AND (act = ''FEE'' OR act = ''TIP'')) AS "meMcredits", '
        || '            sum("ItemAct".msats) FILTER (WHERE "invoiceActionState" IS NOT DISTINCT FROM ''PENDING'' AND "InvoiceForward".id IS NOT NULL AND (act = ''FEE'' OR act = ''TIP'')) AS "mePendingMsats", '
        || '            sum("ItemAct".msats) FILTER (WHERE "invoiceActionState" IS NOT DISTINCT FROM ''PENDING'' AND "InvoiceForward".id IS NULL AND (act = ''FEE'' OR act = ''TIP'')) AS "mePendingMcredits", '
        || '            sum("ItemAct".msats) FILTER (WHERE "invoiceActionState" IS DISTINCT FROM ''FAILED'' AND act = ''DONT_LIKE_THIS'') AS "meDontLikeMsats" '
        || '        FROM "ItemAct" '
        || '        LEFT JOIN "Invoice" ON "Invoice".id = "ItemAct"."invoiceId" '
        || '        LEFT JOIN "InvoiceForward" ON "InvoiceForward"."invoiceId" = "Invoice"."id" '
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