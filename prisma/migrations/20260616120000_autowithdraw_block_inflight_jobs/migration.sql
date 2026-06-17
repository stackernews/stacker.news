-- Block enqueuing a new autoWithdraw job while one is already in-flight
-- (created/active/retry), not just 'created'. pg-boss moves a job to 'active'
-- as soon as a worker picks it up, so the old 'created'-only guard let every
-- subsequent balance update queue a duplicate while a job was running.
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
        AND (
            -- in-flight: queued, running, or awaiting retry
            state IN ('created', 'active', 'retry')
            OR
            -- recently failed: brief backoff before re-enqueuing
            (state = 'failed' AND startedon > now() - interval '1 minutes')
        )
    )
    AND EXISTS (
        SELECT *
        FROM "Wallet" w
        JOIN "WalletProtocol" wp ON w.id = wp."walletId"
        WHERE w."userId" = NEW.id
        AND wp."enabled" = true
        AND wp.send = false
    );
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;
