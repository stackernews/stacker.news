CREATE OR REPLACE FUNCTION run_auction(item_id INTEGER) RETURNS void AS $$
    DECLARE
        bid INTEGER;
        user_id INTEGER;
        user_msats INTEGER;
        item_status "Status";
        status_updated_at timestamp(3);
    BEGIN
        PERFORM ASSERT_SERIALIZED();

        -- extract data we need
        SELECT "maxBid" * 1000, "userId", status, "statusUpdatedAt" INTO bid, user_id, item_status, status_updated_at FROM "Item" WHERE id = item_id;
        SELECT msats INTO user_msats FROM users WHERE id = user_id;

        -- 0 bid items expire after 30 days unless updated
        IF bid = 0 THEN
            IF item_status <> 'STOPPED' THEN
                IF status_updated_at < now_utc() - INTERVAL '30 days' THEN
                    UPDATE "Item" SET status = 'STOPPED', "statusUpdatedAt" = now_utc() WHERE id = item_id;
                ELSEIF item_status = 'NOSATS' THEN
                    UPDATE "Item" SET status = 'ACTIVE' WHERE id = item_id;
                END IF;
            END IF;
            RETURN;
        END IF;

        -- check if user wallet has enough sats
        IF bid > user_msats THEN
            -- if not, set status = NOSATS and statusUpdatedAt to now_utc if not already set
            IF item_status <> 'NOSATS' THEN
                UPDATE "Item" SET status = 'NOSATS', "statusUpdatedAt" = now_utc() WHERE id = item_id;
            END IF;
        ELSE
            -- if so, deduct from user
            UPDATE users SET msats = msats - bid WHERE id = user_id;

            -- create an item act
            INSERT INTO "ItemAct" (sats, "itemId", "userId", act, created_at, updated_at)
            VALUES (bid / 1000, item_id, user_id, 'STREAM', now_utc(), now_utc());

            -- update item status = ACTIVE and statusUpdatedAt = now_utc if NOSATS
            IF item_status = 'NOSATS' THEN
                UPDATE "Item" SET status = 'ACTIVE', "statusUpdatedAt" = now_utc() WHERE id = item_id;
            END IF;
        END IF;
    END;
$$ LANGUAGE plpgsql;