    CREATE OR REPLACE FUNCTION timestamp_item_on_insert() RETURNS TRIGGER AS $$
        BEGIN
            IF NEW."subName" THEN
                RETURN NEW;
            END IF;
            -- insert indexItem pgboss.job with itemId
            INSERT INTO pgboss.job (name, data, startafter) VALUES ('timestampItem', jsonb_build_object('id', NEW.id), now() + interval '10 minutes');
            RETURN NEW;
        END;
    $$ LANGUAGE plpgsql;

    DROP TRIGGER IF EXISTS timestamp_item_on_insert ON "Item";
    CREATE TRIGGER timestamp_item_on_insert
        AFTER INSERT ON "Item"
        FOR EACH ROW
        EXECUTE PROCEDURE timestamp_item_on_insert();