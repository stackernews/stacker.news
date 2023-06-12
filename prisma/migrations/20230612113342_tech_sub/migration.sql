INSERT INTO "Sub" ("name", "desc", "postTypes", "rankingType")
VALUES ('tech', 'everything tech related', '{LINK,DISCUSSION,POLL,BOUNTY}', 'WOT') ON CONFLICT DO NOTHING;