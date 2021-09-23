CREATE OR REPLACE FUNCTION create_bio(title TEXT, text TEXT, user_id INTEGER)
RETURNS "Item"
LANGUAGE plpgsql
AS $$
DECLARE
    item "Item";
BEGIN
    PERFORM ASSERT_SERIALIZED();

    SELECT * INTO item FROM create_item(title, NULL, text, 0, NULL, user_id);

    UPDATE users SET "bioId" = item.id WHERE id = user_id;

    RETURN item;
END;
$$;