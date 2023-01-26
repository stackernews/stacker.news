-- Store root ids of all existing items
UPDATE "Item"
SET "rootId" = ltree2text(subltree(path, 0, 1))::integer
WHERE "parentId" IS NOT NULL;

CREATE OR REPLACE FUNCTION update_item_path() RETURNS TRIGGER AS $$
    DECLARE
        npath ltree;
        root_id INTEGER;
    BEGIN
        IF NEW."parentId" IS NULL THEN
            SELECT NEW.id::text::ltree INTO npath;
            NEW."path" = npath;
        ELSEIF TG_OP = 'INSERT' OR OLD."parentId" IS NULL OR OLD."parentId" != NEW."parentId" THEN
            SELECT "path" || NEW.id::text, ltree2text(subltree("path", 0, 1))::integer
            FROM "Item"
            WHERE id = NEW."parentId"
            INTO npath, root_id;

            IF npath IS NULL THEN
                RAISE EXCEPTION 'Invalid parent_id %', NEW."parentId";
            END IF;
            NEW."path" = npath;
            NEW."rootId" = root_id;
        END IF;
        RETURN NEW;
    END;
$$ LANGUAGE plpgsql;