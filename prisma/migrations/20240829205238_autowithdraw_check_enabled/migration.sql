CREATE OR REPLACE FUNCTION user_auto_withdraw() RETURNS TRIGGER AS $$
DECLARE
BEGIN
    INSERT INTO pgboss.job (name, data)
    SELECT 'autoWithdraw', jsonb_build_object('id', NEW.id)
    -- only if there isn't already a pending job for this user
    WHERE NOT EXISTS (
        SELECT *
        FROM pgboss.job
        WHERE name = 'autoWithdraw'
        AND data->>'id' = NEW.id::TEXT
        AND state = 'created'
    )
    -- and they have an attached wallet (currently all are received only)
    AND EXISTS (
        SELECT *
        FROM "Wallet"
        WHERE "userId" = NEW.id
        AND enabled = TRUE
    );
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;