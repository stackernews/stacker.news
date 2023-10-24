-- function to manually deduct fees from user, for example for images fees
CREATE OR REPLACE FUNCTION user_fee(user_id INTEGER, item_id INTEGER, cost_msats BIGINT)
RETURNS users
LANGUAGE plpgsql
AS $$
DECLARE
    user users;
    user_msats BIGINT;
BEGIN
    PERFORM ASSERT_SERIALIZED();

    SELECT msats INTO user_msats FROM users WHERE id = user_id;
    IF cost_msats > user_msats THEN
        RAISE EXCEPTION 'SN_INSUFFICIENT_FUNDS';
    END IF;

    UPDATE users SET msats = msats - cost_msats WHERE id = user_id RETURNING * INTO user;

    INSERT INTO "ItemAct" (msats, "itemId", "userId", act)
    VALUES (cost_msats, item_id, user_id, 'FEE');

    RETURN user;
END;
$$;
