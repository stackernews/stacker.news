-- fix that trigger also runs when the wallet JSONB column is updated
-- https://github.com/stackernews/stacker.news/issues/2234

CREATE OR REPLACE FUNCTION check_wallet_trigger() RETURNS TRIGGER AS $$
DECLARE
    user_id INTEGER;
BEGIN
    IF TG_OP = 'UPDATE' AND OLD.wallet != NEW.wallet THEN
        -- the trigger that updates the wallet JSONB column triggered this trigger
        RETURN NULL;
    END IF;

    -- if TG_OP is DELETE, then NEW.userId is NULL
    user_id := CASE WHEN TG_OP = 'DELETE' THEN OLD."userId" ELSE NEW."userId" END;

    INSERT INTO pgboss.job (name, data, retrylimit, startafter, keepuntil)
    VALUES ('checkWallet', jsonb_build_object('userId', user_id), 21, now(), now() + interval '5 minutes');

    RETURN NULL;
END;
$$ LANGUAGE plpgsql;
