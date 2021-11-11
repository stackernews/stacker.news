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

    UPDATE users SET msats = msats - (act_sats * 1000) WHERE id = user_id;

    CASE act
      when 'VOTE', 'BOOST' then
        -- if we've already voted, then this is boost (doing this here prevents any potential
        -- race)
        IF EXISTS (SELECT 1 FROM "ItemAct" WHERE "itemId" = item_id AND "userId" = user_id AND "ItemAct".act = 'VOTE') OR act = 'BOOST' THEN
            INSERT INTO "ItemAct" (sats, "itemId", "userId", act, created_at, updated_at)
            VALUES (act_sats, item_id, user_id, 'BOOST', now_utc(), now_utc());

        -- this is a vote
        ELSE
          -- only 1 sat votes are allowed
          IF act_sats > 1 THEN
            RAISE EXCEPTION 'SN_EXCEEDS_ACT_SAT_LIMIT';
          END IF;

          INSERT INTO "ItemAct" (sats, "itemId", "userId", act, created_at, updated_at)
            VALUES (1, item_id, user_id, 'VOTE', now_utc(), now_utc());

          -- give the item's user 1 sat
          UPDATE users SET msats = msats + 1000 WHERE id = (SELECT "userId" FROM "Item" WHERE id = item_id);
        END IF;
      when 'TIP' then
        INSERT INTO "ItemAct" (sats, "itemId", "userId", act, created_at, updated_at)
            VALUES (act_sats, item_id, user_id, 'TIP', now_utc(), now_utc());
        -- give the item's user act_sats
        UPDATE users SET msats = msats + (act_sats * 1000) WHERE id = (SELECT "userId" FROM "Item" WHERE id = item_id);
    END case;

    RETURN act_sats;
END;
$$;