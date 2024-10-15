CREATE OR REPLACE FUNCTION index_bookmarked_item() RETURNS TRIGGER AS $$
    BEGIN
        -- if a bookmark was created or updated, `NEW` will be used
        IF NEW IS NOT NULL THEN
            INSERT INTO pgboss.job (name, data) VALUES ('indexItem', jsonb_build_object('id', NEW."itemId"));
            RETURN NEW;
        END IF;
        -- if a bookmark was deleted, `OLD` will be used
        IF OLD IS NOT NULL THEN
            -- include `updatedAt` in the `indexItem` job as `now()` to indicate when the indexed item should think it was updated
            -- this is to facilitate the fact that deleted bookmarks do not show up when re-indexing the item, and therefore
            -- we don't have a reliable way to calculate a more recent index version, to displace the prior version
            INSERT INTO pgboss.job (name, data) VALUES ('indexItem', jsonb_build_object('id', OLD."itemId", 'updatedAt', now()));
            RETURN OLD;
        END IF;
        -- This should never be reached
        RETURN NULL;
    END;
$$ LANGUAGE plpgsql;

-- Re-index the bookmarked item when a bookmark changes, so new bookmarks are searchable
DROP TRIGGER IF EXISTS index_bookmarked_item ON "Bookmark";
CREATE TRIGGER index_bookmarked_item
    AFTER INSERT OR UPDATE OR DELETE ON "Bookmark"
    FOR EACH ROW
    EXECUTE PROCEDURE index_bookmarked_item();

-- hack ... prisma doesn't know about our other schemas (e.g. pgboss)
-- and this is only really a problem on their "shadow database"
-- so we catch the exception it throws and ignore it
CREATE OR REPLACE FUNCTION reindex_all_current_bookmarked_items() RETURNS void AS $$
    BEGIN
        -- Re-index all existing bookmarked items so these bookmarks are searchable
        INSERT INTO pgboss.job (name, data, priority, startafter, expirein)
        SELECT 'indexItem', jsonb_build_object('id', "itemId"), -100, now() + interval '10 minutes', interval '1 day'
        FROM "Bookmark"
        GROUP BY "itemId";
    EXCEPTION WHEN OTHERS THEN
        -- catch the exception for prisma dev execution, but do nothing with it
    END;
$$ LANGUAGE plpgsql;

-- execute the function once
SELECT reindex_all_current_bookmarked_items();
-- then drop it since we don't need it anymore
DROP FUNCTION reindex_all_current_bookmarked_items();
