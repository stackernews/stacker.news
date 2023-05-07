CREATE OR REPLACE FUNCTION item_comments_with_me(_item_id int, _me_id int, _level int, _where text, _order_by text)
  RETURNS jsonb
  LANGUAGE plpgsql STABLE PARALLEL SAFE AS
$$
DECLARE
    result  jsonb;
BEGIN
    IF _level < 1 THEN
        RETURN '[]'::jsonb;
    END IF;

    EXECUTE ''
        || 'SELECT COALESCE(jsonb_agg(sub), ''[]''::jsonb) AS comments '
        || 'FROM  ( '
        || '    SELECT "Item".*, "Item".created_at AS "createdAt", "Item".updated_at AS "updatedAt", '
        || '    item_comments_with_me("Item".id, $5, $2 - 1, $3, $4) AS comments, to_jsonb(users.*) as user, '
        || '    COALESCE("ItemAct"."meMsats", 0) AS "meMsats", COALESCE("ItemAct"."meDontLike", false) AS "meDontLike", '
        || '    "Bookmark"."itemId" IS NOT NULL AS "meBookmark" '
        || '    FROM "Item" p '
        || '    JOIN "Item" ON "Item"."parentId" = p.id '
        || '    JOIN users ON users.id = "Item"."userId" '
        || '    LEFT JOIN "Bookmark" ON "Bookmark"."itemId" = "Item".id AND "Bookmark"."userId" = $5 '
        || '    LEFT JOIN LATERAL ( '
        || '        SELECT "itemId", sum("ItemAct".msats) FILTER (WHERE act = ''FEE'' OR act = ''TIP'') AS "meMsats", '
        || '            bool_or(act = ''DONT_LIKE_THIS'') AS "meDontLike" '
        || '        FROM "ItemAct" '
        || '        WHERE "ItemAct"."userId" = $5 '
        || '        AND "ItemAct"."itemId" = "Item".id '
        || '        GROUP BY "ItemAct"."itemId" '
        || '    ) "ItemAct" ON true '
        || '    WHERE  p.id = $1 ' || _where || ' '
        ||      _order_by
        || ' ) sub'
    INTO result USING _item_id, _level, _where, _order_by, _me_id;
    RETURN result;
END
$$;