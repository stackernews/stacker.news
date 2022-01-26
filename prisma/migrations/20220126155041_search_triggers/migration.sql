CREATE OR REPLACE FUNCTION index_item() RETURNS TRIGGER AS $$
    BEGIN
        -- insert indexItem pgboss.job with id
        INSERT INTO pgboss.job (name, data) VALUES ('indexItem', jsonb_build_object('id', NEW.id));
        -- insert indexItem pgboss.job from parentId if there's a parentId
        IF NEW."parentId" IS NOT NULL THEN
            INSERT INTO pgboss.job (name, data) VALUES ('indexItem', jsonb_build_object('id', NEW."parentId"));
        END IF;
        RETURN NEW;
    END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS index_item ON "Item";
CREATE TRIGGER index_item
    AFTER INSERT OR UPDATE ON "Item"
    FOR EACH ROW
    EXECUTE PROCEDURE index_item();

CREATE OR REPLACE FUNCTION index_item_after_act() RETURNS TRIGGER AS $$
    BEGIN
        -- insert indexItem pgboss.job with itemId
        INSERT INTO pgboss.job (name, data) VALUES ('indexItem', jsonb_build_object('id', NEW."itemId"));
        RETURN NEW;
    END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS index_item_after_act ON "ItemAct";
CREATE TRIGGER index_item_after_act
    AFTER INSERT ON "ItemAct"
    FOR EACH ROW
    EXECUTE PROCEDURE index_item_after_act();