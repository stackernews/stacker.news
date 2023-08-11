-- make excaption for anon users
CREATE OR REPLACE FUNCTION sats_after_tip(item_id INTEGER, user_id INTEGER, tip_msats BIGINT) RETURNS INTEGER AS $$
DECLARE
    item "Item";
BEGIN
    SELECT * FROM "Item" WHERE id = item_id INTO item;
    IF user_id <> 27 AND item."userId" = user_id THEN
        RETURN 0;
    END IF;

    UPDATE "Item"
    SET "msats" = "msats" + tip_msats
    WHERE id = item.id;

    UPDATE "Item"
    SET "commentMsats" = "commentMsats" + tip_msats
    WHERE id <> item.id and path @> item.path;

    RETURN 1;
END;
$$ LANGUAGE plpgsql;