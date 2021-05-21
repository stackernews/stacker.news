-- AlterEnum
ALTER TYPE "WithdrawlStatus" ADD VALUE 'UNKNOWN_FAILURE';

CREATE OR REPLACE FUNCTION assign_name() RETURNS TRIGGER AS $$
    DECLARE
    BEGIN
        -- if doesn't have a name, SPLIT email on @ and assign to name
        IF NEW.name IS NULL THEN
            NEW.name = SPLIT_PART(NEW.email, '@', 1);
        END IF;
        -- replace unsupported characters (non alphanum + _) in name with _
        NEW.name = REGEXP_REPLACE(NEW.name, '\W|_', '_', 'gi');
        -- while name exists append random number
        WHILE EXISTS (SELECT 1 FROM users WHERE name = NEW.name) LOOP
            NEW.name = NEW.name || floor(random() * 10 + 1)::int;
        END LOOP;

        RETURN NEW;
    END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER name_tgr
    BEFORE INSERT ON "users"
    FOR EACH ROW EXECUTE PROCEDURE assign_name();