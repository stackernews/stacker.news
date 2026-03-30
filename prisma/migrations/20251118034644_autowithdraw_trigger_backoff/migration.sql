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
            state = 'created'
            OR
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