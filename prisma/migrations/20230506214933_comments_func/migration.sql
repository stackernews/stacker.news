CREATE OR REPLACE FUNCTION item_comments(_item_id int, _level int, _where text, _order_by text)
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
        || '    item_comments("Item".id, $2 - 1, $3, $4) AS comments '
        || '    FROM   "Item" p '
        || '    JOIN   "Item" ON "Item"."parentId" = p.id '
        || '    WHERE  p.id = $1 '
        ||      _where || ' '
        ||      _order_by
        || ' ) sub'
    INTO result USING _item_id, _level, _where, _order_by;
    RETURN result;
END
$$;