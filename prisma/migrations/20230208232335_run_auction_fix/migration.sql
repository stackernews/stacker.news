CREATE OR REPLACE FUNCTION run_auction(item_id INTEGER) RETURNS void AS $$
    DECLARE
        bid_sats INTEGER;
        user_msats BIGINT;
        user_id INTEGER;
        item_status "Status";
        status_updated_at timestamp(3);
    BEGIN
        PERFORM ASSERT_SERIALIZED();

        -- extract data we need
        SELECT "maxBid", "userId", status, "statusUpdatedAt"
        INTO bid_sats, user_id, item_status, status_updated_at
        FROM "Item"
        WHERE id = item_id;

        SELECT msats INTO user_msats FROM users WHERE id = user_id;

        -- 0 bid items expire after 30 days unless updated
        IF bid_sats = 0 THEN
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
        IF bid_sats * 1000 > user_msats THEN
            -- if not, set status = NOSATS and statusUpdatedAt to now_utc if not already set
            IF item_status <> 'NOSATS' THEN
                UPDATE "Item" SET status = 'NOSATS', "statusUpdatedAt" = now_utc() WHERE id = item_id;
            ELSEIF status_updated_at < now_utc() - INTERVAL '30 days' THEN
                UPDATE "Item" SET status = 'STOPPED', "statusUpdatedAt" = now_utc() WHERE id = item_id;
            END IF;
        ELSE
            PERFORM item_act(item_id, user_id, 'STREAM', bid_sats);

            -- update item status = ACTIVE and statusUpdatedAt = now_utc if NOSATS
            IF item_status = 'NOSATS' THEN
                UPDATE "Item" SET status = 'ACTIVE', "statusUpdatedAt" = now_utc() WHERE id = item_id;
            END IF;
        END IF;
    END;
$$ LANGUAGE plpgsql;