-- modify it to take DONT_LIKE_THIS
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

    IF act = 'VOTE' OR act = 'TIP' THEN
        -- add sats to actee's balance and stacked count
        UPDATE users
        SET msats = msats + (act_sats * 1000), "stackedMsats" = "stackedMsats" + (act_sats * 1000)
        WHERE id = (SELECT COALESCE("fwdUserId", "userId") FROM "Item" WHERE id = item_id);

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
    ELSE -- BOOST, POLL, DONT_LIKE_THIS
        INSERT INTO "ItemAct" (sats, "itemId", "userId", act, created_at, updated_at)
        VALUES (act_sats, item_id, user_id, act, now_utc(), now_utc());
    END IF;

    RETURN 0;
END;
$$;

CREATE OR REPLACE FUNCTION weighted_downvotes_after_act() RETURNS TRIGGER AS $$
DECLARE
    user_trust DOUBLE PRECISION;
BEGIN
    -- grab user's trust who is upvoting
    SELECT trust INTO user_trust FROM users WHERE id = NEW."userId";
    -- update item
    UPDATE "Item"
        SET "weightedDownVotes" = "weightedDownVotes" + user_trust
        WHERE id = NEW."itemId" AND "userId" <> NEW."userId";
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS weighted_downvotes_after_act ON "ItemAct";
CREATE TRIGGER weighted_downvotes_after_act
    AFTER INSERT ON "ItemAct"
    FOR EACH ROW
    WHEN (NEW.act = 'DONT_LIKE_THIS')
    EXECUTE PROCEDURE weighted_downvotes_after_act();

ALTER TABLE "Item" ADD CONSTRAINT "weighted_votes_positive" CHECK ("weightedVotes" >= 0) NOT VALID;
ALTER TABLE "Item" ADD CONSTRAINT "weighted_down_votes_positive" CHECK ("weightedDownVotes" >= 0) NOT VALID;