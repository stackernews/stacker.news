-- fix missing ON CONFLICT DO NOTHING for item uploads
CREATE OR REPLACE FUNCTION create_item(
    jitem JSONB, forward JSONB, poll_options JSONB, spam_within INTERVAL, upload_ids INTEGER[])
RETURNS "Item"
LANGUAGE plpgsql
AS $$
DECLARE
    user_msats BIGINT;
    cost_msats BIGINT := 1000;
    base_cost_msats BIGINT := 1000;
    freebie BOOLEAN;
    allow_freebies BOOLEAN := true;
    item "Item";
    med_votes FLOAT;
    select_clause TEXT;
BEGIN
    PERFORM ASSERT_SERIALIZED();

    -- access fields with appropriate types
    item := jsonb_populate_record(NULL::"Item", jitem);

    SELECT msats INTO user_msats FROM users WHERE id = item."userId";

    -- if this is a post, get the base cost of the sub
    IF item."parentId" IS NULL AND item."subName" IS NOT NULL THEN
        SELECT "baseCost" * 1000, "baseCost" * 1000, "allowFreebies"
        INTO base_cost_msats, cost_msats, allow_freebies
        FROM "Sub"
        WHERE name = item."subName";
    END IF;

    IF item."maxBid" IS NULL THEN
        -- spam multiplier
        cost_msats := cost_msats * POWER(10, item_spam(item."parentId", item."userId", spam_within));
        IF item."userId" = 27 THEN
            -- anon multiplier
            cost_msats := cost_msats * 100;
        END IF;
    END IF;

    -- add image fees
    IF upload_ids IS NOT NULL THEN
        cost_msats := cost_msats + (SELECT "nUnpaid" * "imageFeeMsats" FROM image_fees_info(item."userId", upload_ids));
        UPDATE "Upload" SET paid = 't' WHERE id = ANY(upload_ids);
    END IF;

    -- it's only a freebie if it's no greater than the base cost, they have less than the cost, and boost = 0
    freebie := allow_freebies
        AND (cost_msats <= base_cost_msats)
        AND (user_msats < cost_msats)
        AND (item.boost IS NULL OR item.boost = 0)
        AND item."userId" <> 27;

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

    -- record attachments
    IF upload_ids IS NOT NULL THEN
        INSERT INTO "ItemUpload" ("itemId", "uploadId")
            SELECT item.id, * FROM UNNEST(upload_ids) ON CONFLICT DO NOTHING;
    END IF;

    -- schedule imgproxy job
    INSERT INTO pgboss.job (name, data, retrylimit, retrybackoff, startafter)
    VALUES ('imgproxy', jsonb_build_object('id', item.id), 21, true, now() + interval '5 seconds');

    RETURN item;
END;
$$;
