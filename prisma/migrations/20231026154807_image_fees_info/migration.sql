-- function to calculate image fees info for given user and upload ids
CREATE OR REPLACE FUNCTION image_fees_info(user_id INTEGER, upload_ids INTEGER[])
RETURNS TABLE (
    "bytes24h" INTEGER,
    "bytesUnpaid" INTEGER,
    "nUnpaid" INTEGER,
    "imageFeeMsats" BIGINT
)
LANGUAGE plpgsql
AS $$
BEGIN
    RETURN QUERY SELECT
        uploadinfo.*,
        CASE
            -- anons always pay 100 sats per image
            WHEN user_id = 27 THEN 100000::BIGINT
            ELSE CASE
            -- 10 MB are free per stacker and 24 hours
            WHEN uploadinfo."bytes24h" + uploadinfo."bytesUnpaid" <= 10 * 1024 * 1024 THEN 0::BIGINT
            WHEN uploadinfo."bytes24h" + uploadinfo."bytesUnpaid" <= 25 * 1024 * 1024 THEN 10000::BIGINT
            WHEN uploadinfo."bytes24h" + uploadinfo."bytesUnpaid" <= 50 * 1024 * 1024 THEN 100000::BIGINT
            WHEN uploadinfo."bytes24h" + uploadinfo."bytesUnpaid" <= 100 * 1024 * 1024 THEN 1000000::BIGINT
            ELSE 10000000::BIGINT
        END
    END AS "imageFeeMsats"
    FROM (
        SELECT
            -- how much bytes did stacker upload in last 24 hours?
            COALESCE(SUM(size) FILTER(WHERE paid = 't' AND created_at >= NOW() - interval '24 hours'), 0)::INTEGER AS "bytes24h",
            -- how much unpaid bytes do they want to upload now?
            COALESCE(SUM(size) FILTER(WHERE paid = 'f' AND id = ANY(upload_ids)), 0)::INTEGER AS "bytesUnpaid",
            -- how many unpaid images do they want to upload now?
            COALESCE(COUNT(id) FILTER(WHERE paid = 'f' AND id = ANY(upload_ids)), 0)::INTEGER AS "nUnpaid"
        FROM "Upload"
        WHERE "Upload"."userId" = user_id
    ) uploadinfo;
    RETURN;
END;
$$;

-- add image fees
CREATE OR REPLACE FUNCTION create_item(
    jitem JSONB, forward JSONB, poll_options JSONB, spam_within INTERVAL, upload_ids INTEGER[])
RETURNS "Item"
LANGUAGE plpgsql
AS $$
DECLARE
    user_msats BIGINT;
    cost_msats BIGINT;
    freebie BOOLEAN;
    item "Item";
    med_votes FLOAT;
    select_clause TEXT;
BEGIN
    PERFORM ASSERT_SERIALIZED();

    -- access fields with appropriate types
    item := jsonb_populate_record(NULL::"Item", jitem);

    SELECT msats INTO user_msats FROM users WHERE id = item."userId";

    IF item."maxBid" IS NOT NULL THEN
        cost_msats := 1000000;
    ELSE
        cost_msats := 1000 * POWER(10, item_spam(item."parentId", item."userId", spam_within));
    END IF;

    -- add image fees
    IF upload_ids IS NOT NULL THEN
        cost_msats := cost_msats + (SELECT "nUnpaid" * "imageFeeMsats" FROM image_fees_info(item."userId", upload_ids));
        UPDATE "Upload" SET paid = 't' WHERE id = ANY(upload_ids);
    END IF;

    -- it's only a freebie if it's a 1 sat cost, they have < 1 sat, and boost = 0
    freebie := (cost_msats <= 1000) AND (user_msats < 1000) AND (item.boost IS NULL OR item.boost = 0);

    IF NOT freebie AND cost_msats > user_msats THEN
        RAISE EXCEPTION 'SN_INSUFFICIENT_FUNDS';
    END IF;

    -- get this user's median item score
    SELECT COALESCE(
        percentile_cont(0.5) WITHIN GROUP(
            ORDER BY "weightedVotes" - "weightedDownVotes"), 0)
        INTO med_votes FROM "Item" WHERE "userId" = item."userId";

    -- if their median votes are positive, start at 0
    -- if the median votes are negative, start their post with that many down votes
    -- basically: if their median post is bad, presume this post is too
    -- addendum: if they're an anon poster, always start at 0
    IF med_votes >= 0 OR item."userId" = 27 THEN
        med_votes := 0;
    ELSE
        med_votes := ABS(med_votes);
    END IF;

    -- there's no great way to set default column values when using json_populate_record
    -- so we need to only select fields with non-null values that way when func input
    -- does not include a value, the default value is used instead of null
    SELECT string_agg(quote_ident(key), ',') INTO select_clause
    FROM jsonb_object_keys(jsonb_strip_nulls(jitem)) k(key);
    -- insert the item
    EXECUTE format($fmt$
        INSERT INTO "Item" (%s, "weightedDownVotes", freebie)
        SELECT %1$s, %L, %L
        FROM jsonb_populate_record(NULL::"Item", %L) RETURNING *
    $fmt$, select_clause, med_votes, freebie, jitem) INTO item;

    INSERT INTO "ItemForward" ("itemId", "userId", "pct")
        SELECT item.id, "userId", "pct" FROM jsonb_populate_recordset(NULL::"ItemForward", forward);

    -- Automatically subscribe to one's own posts
    INSERT INTO "ThreadSubscription" ("itemId", "userId")
    VALUES (item.id, item."userId");

    -- Automatically subscribe forward recipients to the new post
    INSERT INTO "ThreadSubscription" ("itemId", "userId")
        SELECT item.id, "userId" FROM jsonb_populate_recordset(NULL::"ItemForward", forward);

    INSERT INTO "PollOption" ("itemId", "option")
        SELECT item.id, "option" FROM jsonb_array_elements_text(poll_options) o("option");

    IF NOT freebie THEN
        UPDATE users SET msats = msats - cost_msats WHERE id = item."userId";

        INSERT INTO "ItemAct" (msats, "itemId", "userId", act)
        VALUES (cost_msats, item.id, item."userId", 'FEE');
    END IF;

    -- if this item has boost
    IF item.boost > 0 THEN
        PERFORM item_act(item.id, item."userId", 'BOOST', item.boost);
    END IF;

    -- if this is a job
    IF item."maxBid" IS NOT NULL THEN
        PERFORM run_auction(item.id);
    END IF;

    -- if this is a bio
    IF item.bio THEN
        UPDATE users SET "bioId" = item.id WHERE id = item."userId";
    END IF;

    -- schedule imgproxy job
    INSERT INTO pgboss.job (name, data, retrylimit, retrybackoff, startafter)
    VALUES ('imgproxy', jsonb_build_object('id', item.id), 21, true, now() + interval '5 seconds');

    RETURN item;
END;
$$;

-- add image fees
CREATE OR REPLACE FUNCTION update_item(
    jitem JSONB, forward JSONB, poll_options JSONB, upload_ids INTEGER[])
RETURNS "Item"
LANGUAGE plpgsql
AS $$
DECLARE
    user_msats INTEGER;
    cost_msats BIGINT;
    item "Item";
    select_clause TEXT;
BEGIN
    PERFORM ASSERT_SERIALIZED();

    item := jsonb_populate_record(NULL::"Item", jitem);

    SELECT msats INTO user_msats FROM users WHERE id = item."userId";
    cost_msats := 0;

    -- add image fees
    IF upload_ids IS NOT NULL THEN
        cost_msats := cost_msats + (SELECT "nUnpaid" * "imageFeeMsats" FROM image_fees_info(item."userId", upload_ids));
        UPDATE "Upload" SET paid = 't' WHERE id = ANY(upload_ids);
    END IF;

    IF cost_msats > 0 AND cost_msats > user_msats THEN
        RAISE EXCEPTION 'SN_INSUFFICIENT_FUNDS';
    ELSE
        UPDATE users SET msats = msats - cost_msats WHERE id = item."userId";
        INSERT INTO "ItemAct" (msats, "itemId", "userId", act)
        VALUES (cost_msats, item.id, item."userId", 'FEE');
    END IF;

    IF item.boost > 0 THEN
        UPDATE "Item" SET boost = boost + item.boost WHERE id = item.id;
        PERFORM item_act(item.id, item."userId", 'BOOST', item.boost);
    END IF;

    IF item.status IS NOT NULL THEN
        UPDATE "Item" SET "statusUpdatedAt" = now_utc()
        WHERE id = item.id AND status <> item.status;
    END IF;

    SELECT string_agg(quote_ident(key), ',') INTO select_clause
    FROM jsonb_object_keys(jsonb_strip_nulls(jitem)) k(key)
    WHERE key <> 'boost';

    EXECUTE format($fmt$
        UPDATE "Item" SET (%s) = (
            SELECT %1$s
            FROM jsonb_populate_record(NULL::"Item", %L)
        ) WHERE id = %L RETURNING *
    $fmt$, select_clause, jitem, item.id) INTO item;

    -- Delete any old thread subs if the user is no longer a fwd recipient
    DELETE FROM "ThreadSubscription"
    WHERE "itemId" = item.id
    -- they aren't in the new forward list
    AND NOT EXISTS (SELECT 1 FROM jsonb_populate_recordset(NULL::"ItemForward", forward) as nf WHERE "ThreadSubscription"."userId" = nf."userId")
    -- and they are in the old forward list
    AND EXISTS (SELECT 1 FROM "ItemForward" WHERE "ItemForward"."itemId" = item.id AND "ItemForward"."userId" = "ThreadSubscription"."userId" );

    -- Automatically subscribe any new forward recipients to the post
    INSERT INTO "ThreadSubscription" ("itemId", "userId")
        SELECT item.id, "userId" FROM jsonb_populate_recordset(NULL::"ItemForward", forward)
        EXCEPT
            SELECT item.id, "userId" FROM "ItemForward" WHERE "itemId" = item.id;

    -- Delete all old forward entries, to recreate in next command
    DELETE FROM "ItemForward" WHERE "itemId" = item.id;

    INSERT INTO "ItemForward" ("itemId", "userId", "pct")
        SELECT item.id, "userId", "pct" FROM jsonb_populate_recordset(NULL::"ItemForward", forward);

    INSERT INTO "PollOption" ("itemId", "option")
        SELECT item.id, "option" FROM jsonb_array_elements_text(poll_options) o("option");

    -- if this is a job
    IF item."maxBid" IS NOT NULL THEN
        PERFORM run_auction(item.id);
    END IF;

    -- schedule imgproxy job
    INSERT INTO pgboss.job (name, data, retrylimit, retrybackoff, startafter)
    VALUES ('imgproxy', jsonb_build_object('id', item.id), 21, true, now() + interval '5 seconds');

    RETURN item;
END;
$$;
