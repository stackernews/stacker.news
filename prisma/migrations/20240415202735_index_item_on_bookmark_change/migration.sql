CREATE OR REPLACE FUNCTION index_bookmarked_item() RETURNS TRIGGER AS $$
    BEGIN
        -- if a bookmark was created or updated, `NEW` will be used
        IF NEW IS NOT NULL THEN
            INSERT INTO pgboss.job (name, data) VALUES ('indexItem', jsonb_build_object('id', NEW."itemId"));
            RETURN NEW;
        END IF;
        -- if a bookmark was deleted, `OLD` will be used
        IF OLD IS NOT NULL THEN
            INSERT INTO pgboss.job (name, data) VALUES ('indexItem', jsonb_build_object('id', OLD."itemId"));
            RETURN OLD;
        END IF;
        -- This should never be reached
        RETURN NULL;
    END;
$$ LANGUAGE plpgsql;

-- Re-index the bookmarked item when a bookmark changes, so bookmarks are searchable
DROP TRIGGER IF EXISTS index_bookmarked_item ON "Bookmark";
CREATE TRIGGER index_bookmarked_item
    AFTER INSERT OR UPDATE OR DELETE ON "Bookmark"
    FOR EACH ROW
    EXECUTE PROCEDURE index_bookmarked_item();