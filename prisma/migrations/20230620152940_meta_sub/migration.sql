INSERT INTO "Sub" ("name", "desc", "postTypes", "rankingType")
VALUES ('meta', 'everything about SN', '{LINK,DISCUSSION,POLL,BOUNTY}', 'WOT') ON CONFLICT DO NOTHING;

-- transfer all posts related to SN to meta
UPDATE "Item"
SET "subName" = 'meta'
WHERE lower(title) SIMILAR TO lower('(% )?SN( %)?|(% )?k00b( %)?|(% )?keyan( %)?|(% )?SNL( %)?');