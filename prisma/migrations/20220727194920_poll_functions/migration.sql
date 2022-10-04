-- create poll
-- charges us to create poll
-- adds poll options to poll
CREATE OR REPLACE FUNCTION create_poll(title TEXT, poll_cost INTEGER, boost INTEGER, user_id INTEGER, options TEXT[])
RETURNS "Item"
LANGUAGE plpgsql
AS $$
DECLARE
    item "Item";
    option TEXT;
BEGIN
    PERFORM ASSERT_SERIALIZED();

    item := create_item(title, null, null, boost, null, user_id);

    UPDATE "Item" set "pollCost" = poll_cost where id = item.id;
    FOREACH option IN ARRAY options LOOP
        INSERT INTO "PollOption" (created_at, updated_at, "itemId", "option") values (now_utc(), now_utc(), item.id, option);
    END LOOP;

    RETURN item;
END;
$$;