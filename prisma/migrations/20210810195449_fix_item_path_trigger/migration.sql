-- Only update path if we have conditions that require us to reset it
CREATE OR REPLACE FUNCTION update_item_path() RETURNS TRIGGER AS $$
    DECLARE
        npath ltree;
    BEGIN
        IF NEW."parentId" IS NULL THEN
            SELECT NEW.id::text::ltree INTO npath;
            NEW."path" = npath;
        ELSEIF TG_OP = 'INSERT' OR OLD."parentId" IS NULL OR OLD."parentId" != NEW."parentId" THEN
            SELECT "path" || NEW.id::text FROM "Item" WHERE id = NEW."parentId" INTO npath;
            IF npath IS NULL THEN
                RAISE EXCEPTION 'Invalid parent_id %', NEW."parentId";
            END IF;
            NEW."path" = npath;
        END IF;
        RETURN NEW;
    END;
$$ LANGUAGE plpgsql;
