DROP FUNCTION IF EXISTS create_poll(
    title TEXT, text TEXT, poll_cost INTEGER, boost INTEGER, user_id INTEGER,
    options TEXT[], fwd_user_id INTEGER, spam_within INTERVAL);

CREATE OR REPLACE FUNCTION create_poll(
    sub TEXT, title TEXT, text TEXT, poll_cost INTEGER, boost INTEGER, user_id INTEGER,
    options TEXT[], fwd_user_id INTEGER, spam_within INTERVAL)
RETURNS "Item"
LANGUAGE plpgsql
AS $$
DECLARE
    item "Item";
    option TEXT;
BEGIN
    PERFORM ASSERT_SERIALIZED();

    item := create_item(sub, title, null, text, boost, null, null, user_id, fwd_user_id, spam_within);

    UPDATE "Item" set "pollCost" = poll_cost where id = item.id;
    FOREACH option IN ARRAY options LOOP
        INSERT INTO "PollOption" (created_at, updated_at, "itemId", "option") values (now_utc(), now_utc(), item.id, option);
    END LOOP;

    RETURN item;
END;
$$;

DROP FUNCTION IF EXISTS update_poll(
    id INTEGER, title TEXT, text TEXT, boost INTEGER,
    options TEXT[], fwd_user_id INTEGER, has_img_link BOOLEAN);

CREATE OR REPLACE FUNCTION update_poll(
    sub TEXT, id INTEGER, title TEXT, text TEXT, boost INTEGER,
    options TEXT[], fwd_user_id INTEGER)
RETURNS "Item"
LANGUAGE plpgsql
AS $$
DECLARE
    item "Item";
    option TEXT;
BEGIN
    PERFORM ASSERT_SERIALIZED();

    item := update_item(sub, id, title, null, text, boost, null, fwd_user_id);

    FOREACH option IN ARRAY options LOOP
        INSERT INTO "PollOption" (created_at, updated_at, "itemId", "option") values (now_utc(), now_utc(), item.id, option);
    END LOOP;

    RETURN item;
END;
$$;

-- when creating bio, set bio flag so they won't appear on first page
CREATE OR REPLACE FUNCTION create_bio(title TEXT, text TEXT, user_id INTEGER)
RETURNS "Item"
LANGUAGE plpgsql
AS $$
DECLARE
    item "Item";
BEGIN
    PERFORM ASSERT_SERIALIZED();

    SELECT * INTO item FROM create_item(NULL, title, NULL, text, 0, NULL, NULL, user_id, NULL, '0');

    UPDATE "Item" SET bio = true WHERE id = item.id;
    UPDATE users SET "bioId" = item.id WHERE id = user_id;

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
    SELECT * INTO item FROM update_item('jobs', item_id, item_title, item_url, item_text, 0, NULL, NULL);

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