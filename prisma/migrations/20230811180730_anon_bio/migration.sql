set transaction isolation level serializable;
-- hack ... prisma doesn't know about our other schemas (e.g. pgboss)
-- and this is only really a problem on their "shadow database"
-- so we catch the exception it throws and ignore it
CREATE OR REPLACE FUNCTION create_anon_bio()
RETURNS INTEGER
LANGUAGE plpgsql
AS $$
DECLARE
BEGIN
    -- give anon a bio
    PERFORM create_bio('@anon''s bio', 'account of stackers just passing through', 27);
    -- hide anon from top users and dont give them a hat
    UPDATE users set "hideFromTopUsers" = true, "hideCowboyHat" = true where id = 27;
    return 0;
EXCEPTION WHEN sqlstate '42P01' THEN
    return 0;
END;
$$;

SELECT create_anon_bio();
DROP FUNCTION IF EXISTS create_anon_bio();
