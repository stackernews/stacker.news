-- charge the user for the auction item
CREATE OR REPLACE FUNCTION run_auction(item_id INTEGER) RETURNS void AS $$
    DECLARE
        bid INTEGER;
        user_id INTEGER;
        user_msats INTEGER;
        item_status "Status";
    BEGIN
        PERFORM ASSERT_SERIALIZED();

        -- extract data we need
        SELECT ("maxBid" * 1000 / 30 / 24 / 60), "userId", status INTO bid, user_id, item_status FROM "Item" WHERE id = item_id;
        SELECT msats INTO user_msats FROM users WHERE id = user_id;

        -- check if user wallet has enough sats
        IF bid > user_msats THEN
            -- if not, set status = NOSATS and noSatsAt to now_utc if not already set
            IF item_status <> 'NOSATS' THEN
                UPDATE "Item" SET status = 'NOSATS', "noSatsAt" = now_utc() WHERE id = item_id;
            END IF;
        ELSE
            -- if so, deduct from user
            UPDATE users SET msats = msats - bid WHERE id = user_id;
            -- update item status = ACTIVE and noSatsAt = null if NOSATS
            IF item_status = 'NOSATS' THEN
                UPDATE "Item" SET status = 'ACTIVE', "noSatsAt" = null WHERE id = item_id;
            END IF;
        END IF;
    END;
$$ LANGUAGE plpgsql;