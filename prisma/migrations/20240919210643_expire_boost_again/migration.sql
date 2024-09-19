CREATE OR REPLACE FUNCTION expire_boost_jobs()
RETURNS INTEGER
LANGUAGE plpgsql
AS $$
DECLARE
BEGIN
    INSERT INTO pgboss.job (name, data, retrylimit, retrybackoff, startafter, expirein)
    SELECT 'expireBoost', jsonb_build_object('id', "Item".id), 21, true, now(), interval '1 days'
    FROM "Item"
    WHERE "Item".boost > 0 ON CONFLICT DO NOTHING;
    return 0;
EXCEPTION WHEN OTHERS THEN
    return 0;
END;
$$;

SELECT expire_boost_jobs();
DROP FUNCTION IF EXISTS expire_boost_jobs;