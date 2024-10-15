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
        -- delete any old uploads that are no longer attached
        DELETE FROM "ItemUpload" WHERE "itemId" = item.id AND "uploadId" <> ANY(upload_ids);
        -- insert any new uploads that are not already attached
        INSERT INTO "ItemUpload" ("itemId", "uploadId")
            SELECT item.id, * FROM UNNEST(upload_ids) ON CONFLICT DO NOTHING;
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

    IF item."pollExpiresAt" IS NULL THEN
        UPDATE "Item" SET "pollExpiresAt" = NULL
        WHERE id = item.id;
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
