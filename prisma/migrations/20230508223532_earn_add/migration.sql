CREATE OR REPLACE FUNCTION earn(user_id INTEGER, earn_msats BIGINT, created_at TIMESTAMP(3),
    type "EarnType", type_id INTEGER, rank INTEGER)
RETURNS void AS $$
DECLARE
BEGIN
    PERFORM ASSERT_SERIALIZED();
    -- insert into earn
    INSERT INTO "Earn" (msats, "userId", created_at, type, "typeId", rank)
    VALUES (earn_msats, user_id, created_at, type, type_id, rank);

    -- give the user the sats
    UPDATE users
    SET msats = msats + earn_msats, "stackedMsats" = "stackedMsats" + earn_msats
    WHERE id = user_id;

    IF type = 'POST' OR type = 'COMMENT' THEN
        PERFORM sats_after_tip(type_id, NULL, earn_msats);
    END IF;
END;
$$ LANGUAGE plpgsql;