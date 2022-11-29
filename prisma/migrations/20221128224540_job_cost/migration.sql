CREATE OR REPLACE FUNCTION create_job(
    title TEXT, url TEXT, text TEXT, user_id INTEGER, job_bid INTEGER, job_company TEXT,
    job_location TEXT, job_remote BOOLEAN, job_upload_id INTEGER)
RETURNS "Item"
LANGUAGE plpgsql
AS $$
DECLARE
    item "Item";
    user_msats BIGINT;
    cost_msats BIGINT;
BEGIN
    PERFORM ASSERT_SERIALIZED();

    -- 1000 sats to create a job
    cost_msats := 1000000;

    SELECT msats
    INTO user_msats
    FROM users
    WHERE id = user_id;

    IF cost_msats > user_msats THEN
        RAISE EXCEPTION 'SN_INSUFFICIENT_FUNDS';
    END IF;

    -- create item
    INSERT INTO "Item" (title, url, text, "userId", "maxBid", company, location, remote, "uploadId", "subName", "statusUpdatedAt", created_at, updated_at)
    VALUES (title, url, text, user_id, job_bid, job_company, job_location, job_remote, job_upload_id, 'jobs', now_utc(), now_utc(), now_utc()) RETURNING * INTO item;

    -- deduct from user
    UPDATE users SET msats = msats - cost_msats WHERE id = user_id;

    -- record fee
    INSERT INTO "ItemAct" (msats, "itemId", "userId", act, created_at, updated_at)
        VALUES (cost_msats, item.id, user_id, 'FEE', now_utc(), now_utc());

    -- run_auction
    EXECUTE run_auction(item.id);

    RETURN item;
END;
$$;