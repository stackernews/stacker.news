CREATE OR REPLACE FUNCTION timestamp_item_on_insert() RETURNS TRIGGER AS $$
    BEGIN
        IF NEW."subName" IS NOT NULL THEN
            RETURN NEW;
        END IF;
        -- insert indexItem pgboss.job with itemId
        INSERT INTO pgboss.job (name, data, startafter) VALUES ('timestampItem', jsonb_build_object('id', NEW.id), now() + interval '10 minutes');
        RETURN NEW;
    END;
$$ LANGUAGE plpgsql;