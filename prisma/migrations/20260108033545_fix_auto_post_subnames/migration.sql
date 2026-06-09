CREATE OR REPLACE FUNCTION fix_auto_post_subnames()
RETURNS INTEGER
LANGUAGE plpgsql
AS $$
DECLARE
BEGIN
    UPDATE pgboss.schedule
    SET data = jsonb_set(
        data - 'subName',
        '{subNames}',
        to_jsonb(ARRAY[data->>'subName'])
    )
    WHERE data->>'subName' IS NOT NULL;

    return 0;
EXCEPTION WHEN OTHERS THEN
    return 0;
END;
$$;

SELECT fix_auto_post_subnames();
DROP FUNCTION IF EXISTS fix_auto_post_subnames;
