-- AlterTable
ALTER TABLE "users" ADD COLUMN "stackedMsats" INTEGER NOT NULL DEFAULT 0;

-- update the stacked value for all users
UPDATE users
SET "stackedMsats" = subquery.stacked
FROM (SELECT users.id, COALESCE(SUM("ItemAct".sats)*1000 + COALESCE((SELECT SUM(msats) FROM "Earn" WHERE "userId" = users.id),0),0) AS stacked
        FROM users
        LEFT JOIN "Item" ON "Item"."userId" = users.id
        LEFT JOIN "ItemAct" ON "ItemAct"."itemId" = "Item".id AND "ItemAct"."userId" <> users.id AND "ItemAct".act <> 'BOOST'
        GROUP BY users.id) subquery
WHERE users.id = subquery.id;

-- item_act needs to take into account stacked
CREATE OR REPLACE FUNCTION item_act(item_id INTEGER, user_id INTEGER, act "ItemActType", act_sats INTEGER)
RETURNS INTEGER
LANGUAGE plpgsql
AS $$
DECLARE
    user_sats INTEGER;
BEGIN
    PERFORM ASSERT_SERIALIZED();

    SELECT (msats / 1000) INTO user_sats FROM users WHERE id = user_id;
    IF act_sats > user_sats THEN
        RAISE EXCEPTION 'SN_INSUFFICIENT_FUNDS';
    END IF;

    -- deduct sats from actor
    UPDATE users SET msats = msats - (act_sats * 1000) WHERE id = user_id;

    IF act = 'BOOST' THEN
        INSERT INTO "ItemAct" (sats, "itemId", "userId", act, created_at, updated_at)
        VALUES (act_sats, item_id, user_id, 'BOOST', now_utc(), now_utc());
    ELSE
        -- add sats to actee's balance and stacked count
        UPDATE users
        SET msats = msats + (act_sats * 1000), "stackedMsats" = "stackedMsats" + (act_sats * 1000)
        WHERE id = (SELECT "userId" FROM "Item" WHERE id = item_id);

        -- if they have already voted, this is a tip
        IF EXISTS (SELECT 1 FROM "ItemAct" WHERE "itemId" = item_id AND "userId" = user_id AND "ItemAct".act = 'VOTE') THEN
            INSERT INTO "ItemAct" (sats, "itemId", "userId", act, created_at, updated_at)
            VALUES (act_sats, item_id, user_id, 'TIP', now_utc(), now_utc());
        ELSE
            -- else this is a vote with a possible extra tip
            INSERT INTO "ItemAct" (sats, "itemId", "userId", act, created_at, updated_at)
                VALUES (1, item_id, user_id, 'VOTE', now_utc(), now_utc());
            act_sats := act_sats - 1;

            -- if we have sats left after vote, leave them as a tip
            IF act_sats > 0 THEN
                INSERT INTO "ItemAct" (sats, "itemId", "userId", act, created_at, updated_at)
                    VALUES (act_sats, item_id, user_id, 'TIP', now_utc(), now_utc());
            END IF;

            RETURN 1;
        END IF;
    END IF;

    RETURN 0;
END;
$$;

-- earn needs to take into account stacked
CREATE OR REPLACE FUNCTION earn(user_id INTEGER, earn_msats INTEGER) RETURNS void AS $$
    DECLARE
    BEGIN
        PERFORM ASSERT_SERIALIZED();
        -- insert into earn
        INSERT INTO "Earn" (msats, "userId") VALUES (earn_msats, user_id);
        -- give the user the sats
        UPDATE users
        SET msats = msats + earn_msats, "stackedMsats" = "stackedMsats" + earn_msats
        WHERE id = user_id;
    END;
$$ LANGUAGE plpgsql;

