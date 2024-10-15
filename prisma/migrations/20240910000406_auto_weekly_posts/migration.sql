CREATE OR REPLACE FUNCTION schedule_weekly_posts_job()
RETURNS INTEGER
LANGUAGE plpgsql
AS $$
DECLARE
BEGIN
    INSERT INTO pgboss.schedule (name, cron, timezone, data)
    VALUES
    (
        'weeklyPost-meme-mon', '0 10 * * 1', 'America/Chicago',
        jsonb_build_object(
            'title', 'Meme Monday - Best Bitcoin Meme Gets 10,000 Sats',
            'text',  E'Time for another round of Meme Monday!\n\nWe have another 10,000 sats up for grabs for this week''s winner.\n\nThe sats will be given to the stacker with the best Bitcoin meme as voted by the "top" filter on this thread at 10am CT tomorrow.\n\nTo post an image on SN, check out our docs [here](https://stacker.news/faq#how-do-i-post-images-on-stacker-news).\n\nSend your best 👇',
            'bounty', 10000)
    ),
    (
        'weeklyPost-what-wed', '0 10 * * 3', 'America/Chicago',
        jsonb_build_object(
            'title', 'What are you working on this week?',
            'text',  E'Calling all stackers!\n\nLeave a comment below to let the SN community know what you''re working on this week. It doesn''t matter how big or small your project is, or how much progress you''ve made.\n\nJust share what you''re up to, and let the community know if you want any feedback or help.'
        )
    ),
    (
        'weeklyPost-fact-fri', '0 10 * * 5', 'America/Chicago',
        jsonb_build_object(
            'title', 'Fun Fact Friday - Best Fun Fact Gets 10,000 Sats',
            'text',  E'Let''s hear all your best fun facts, any topic counts!\n\nThe best comment as voted by the "top" filter at 10am CT tomorrow gets 10,000 sats.\n\nBonus sats for including a source link to your fun fact!\n\nSend your best 👇',
            'bounty', 10000)
    ) ON CONFLICT DO NOTHING;
    return 0;
EXCEPTION WHEN OTHERS THEN
    return 0;
END;
$$;

SELECT schedule_weekly_posts_job();
DROP FUNCTION IF EXISTS schedule_weekly_posts_job;