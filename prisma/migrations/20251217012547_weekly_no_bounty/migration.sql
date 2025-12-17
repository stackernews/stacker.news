CREATE OR REPLACE FUNCTION update_weekly_posts_job()
RETURNS INTEGER
LANGUAGE plpgsql
AS $$
DECLARE
BEGIN
    UPDATE pgboss.schedule
    SET data = jsonb_build_object(
        'title', 'Meme Monday - Top Meme Goes in the Newsletter',
        'text',  E'Time for another round of Meme Monday!\n\nThe week''s winner, as determined by the "top" filter on this thread, will go in this week''s newsletter and get eternal bragging rights.\n\nSend your best 👇',
        'subName', 'memes')
    WHERE name = 'weeklyPost-meme-mon';

    return 0;
EXCEPTION WHEN OTHERS THEN
    return 0;
END;
$$;

SELECT update_weekly_posts_job();
DROP FUNCTION IF EXISTS update_weekly_posts_job;