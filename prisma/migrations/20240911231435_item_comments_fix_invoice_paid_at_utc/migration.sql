-- fix missing time zone cast for "Item"."invoicePaidAt"
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
        || '    "Item"."invoicePaidAt" at time zone ''UTC'' AS "invoicePaidAtUTC", '
        || '    to_jsonb(users.*) as user '
        || '    FROM "Item" '
        || '    JOIN users ON users.id = "Item"."userId" '
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