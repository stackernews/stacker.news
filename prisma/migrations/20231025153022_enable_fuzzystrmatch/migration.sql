-- This is required to use `levenshtein` builtin functions
CREATE EXTENSION IF NOT EXISTS fuzzystrmatch;

CREATE OR REPLACE FUNCTION edit_nym(user_id INTEGER, new_nym TEXT, cost_sats BIGINT)
RETURNS void
LANGUAGE plpgsql
AS $$
DECLARE
    user_msats BIGINT;
    cost_msats BIGINT;
BEGIN
    PERFORM ASSERT_SERIALIZED();

    SELECT msats INTO user_msats FROM users WHERE id = user_id;

    cost_msats := 1000 * cost_sats;

    IF cost_msats > user_msats THEN
        RAISE EXCEPTION 'SN_INSUFFICIENT_FUNDS';
    END IF;

    UPDATE users SET msats = msats - cost_msats, name = new_nym WHERE id = user_id;

    -- TODO track the fee paid for the name change in some new table
END;
$$;
