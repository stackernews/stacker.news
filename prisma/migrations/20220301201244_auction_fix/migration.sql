-- take a bid and return whether they have enough funds to support it
CREATE OR REPLACE FUNCTION run_auction(item_id INTEGER, bid INTEGER) RETURNS BOOLEAN AS $$
    DECLARE
        bpm_msats INTEGER;
        user_id INTEGER;
        user_msats INTEGER;
        item_status "Status";
    BEGIN
        PERFORM ASSERT_SERIALIZED();

        bpm_msats := (bid * 5) / 216;

        -- extract data we need
        SELECT "userId", status INTO user_id, item_status FROM "Item" WHERE id = item_id;
        SELECT msats INTO user_msats FROM users WHERE id = user_id;

        -- check if user wallet has enough sats
        IF bpm_msats > user_msats THEN
            -- if not, set status = NOSATS and statusUpdatedAt to now_utc if not already set
            IF item_status <> 'NOSATS' THEN
                UPDATE "Item" SET status = 'NOSATS', "statusUpdatedAt" = now_utc() WHERE id = item_id;
            END IF;

            RETURN false;
        ELSE
            -- if so, deduct from user
            UPDATE users SET msats = msats - bpm_msats WHERE id = user_id;
            -- update item status = ACTIVE and statusUpdatedAt = null if NOSATS
            IF item_status = 'NOSATS' THEN
                UPDATE "Item" SET status = 'ACTIVE', "statusUpdatedAt" = now_utc() WHERE id = item_id;
            END IF;

            RETURN true;
        END IF;
    END;
$$ LANGUAGE plpgsql;