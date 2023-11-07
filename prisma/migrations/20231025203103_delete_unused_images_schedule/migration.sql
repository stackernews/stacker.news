-- add 'deleteUnusedImages' job
CREATE OR REPLACE FUNCTION create_delete_unused_images_job()
RETURNS INTEGER
LANGUAGE plpgsql
AS $$
DECLARE
BEGIN
    INSERT INTO pgboss.schedule (name, cron, timezone) VALUES ('deleteUnusedImages', '0 * * * *', 'America/Chicago') ON CONFLICT DO NOTHING;
    return 0;
EXCEPTION WHEN OTHERS THEN
    return 0;
END;
$$;

SELECT create_delete_unused_images_job();

DROP FUNCTION create_delete_unused_images_job;
