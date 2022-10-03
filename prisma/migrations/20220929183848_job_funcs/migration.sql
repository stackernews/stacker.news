-- charge the user for the auction item
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
            IF item_status <> 'STOPPED' AND status_updated_at < now_utc() - INTERVAL '30 days' THEN
                UPDATE "Item" SET status = 'STOPPED', "statusUpdatedAt" = now_utc() WHERE id = item_id;
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

-- when creating free item, set freebie flag so can be optionally viewed
CREATE OR REPLACE FUNCTION create_job(
    title TEXT, url TEXT, text TEXT, user_id INTEGER, job_bid INTEGER, job_company TEXT,
    job_location TEXT, job_remote BOOLEAN, job_upload_id INTEGER)
RETURNS "Item"
LANGUAGE plpgsql
AS $$
DECLARE
    item "Item";
BEGIN
    PERFORM ASSERT_SERIALIZED();
    -- create item
    SELECT * INTO item FROM create_item(title, url, text, 0, NULL, user_id, NULL, '0');

    -- update by adding additional fields
    UPDATE "Item"
    SET "maxBid" = job_bid, company = job_company, location = job_location, remote = job_remote, "uploadId" = job_upload_id, "subName" = 'jobs'
    WHERE id = item.id RETURNING * INTO item;

    -- run_auction
    EXECUTE run_auction(item.id);

    RETURN item;
END;
$$;

CREATE OR REPLACE FUNCTION update_job(item_id INTEGER,
    item_title TEXT, item_url TEXT, item_text TEXT, job_bid INTEGER, job_company TEXT,
    job_location TEXT, job_remote BOOLEAN, job_upload_id INTEGER, job_status "Status")
RETURNS "Item"
LANGUAGE plpgsql
AS $$
DECLARE
    user_msats INTEGER;
    item "Item";
BEGIN
    PERFORM ASSERT_SERIALIZED();
    -- update item
    SELECT * INTO item FROM update_item(item_id, item_title, item_url, item_text, 0, NULL);

    IF item.status <> job_status THEN
        UPDATE "Item"
        SET "maxBid" = job_bid, company = job_company, location = job_location, remote = job_remote, "uploadId" = job_upload_id, status = job_status, "statusUpdatedAt" = now_utc()
        WHERE id = item.id RETURNING * INTO item;
    ELSE
        UPDATE "Item"
        SET "maxBid" = job_bid, company = job_company, location = job_location, remote = job_remote, "uploadId" = job_upload_id
        WHERE id = item.id RETURNING * INTO item;
    END IF;

    -- run_auction
    EXECUTE run_auction(item.id);

    RETURN item;
END;
$$;