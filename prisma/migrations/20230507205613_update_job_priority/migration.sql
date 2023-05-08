-- lower user streak job priority
CREATE OR REPLACE FUNCTION user_streak_check() RETURNS TRIGGER AS $$
DECLARE
BEGIN
    INSERT INTO pgboss.job (name, data, priority) VALUES ('checkStreak', jsonb_build_object('id', NEW.id), -1);
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- lower timestamp item job priority
CREATE OR REPLACE FUNCTION timestamp_item_on_insert() RETURNS TRIGGER AS $$
    BEGIN
        IF NEW."subName" = 'jobs' THEN
            RETURN NEW;
        END IF;
        INSERT INTO pgboss.job (name, data, startafter, priority) VALUES ('timestampItem', jsonb_build_object('id', NEW.id), now() + interval '10 minutes', -2);
        RETURN NEW;
    END;
$$ LANGUAGE plpgsql;

-- we just need to index this item because it triggers a reindex of the parent due to comment count denormalization
-- job priority should be low because it's not critical it happens immediately
CREATE OR REPLACE FUNCTION index_item() RETURNS TRIGGER AS $$
    BEGIN
        -- insert indexItem pgboss.job with id
        INSERT INTO pgboss.job (name, data, priority) VALUES ('indexItem', jsonb_build_object('id', NEW.id), -100);
        RETURN NEW;
    END;
$$ LANGUAGE plpgsql;

-- we can drop these triggers because item_acts denormalize into item and hit the item trigger
DROP TRIGGER IF EXISTS index_item_after_act ON "ItemAct";
DROP FUNCTION IF EXISTS index_item_after_act;