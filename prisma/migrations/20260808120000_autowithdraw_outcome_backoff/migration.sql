CREATE OR REPLACE FUNCTION user_auto_withdraw() RETURNS TRIGGER AS $$
DECLARE
BEGIN
    INSERT INTO pgboss.job (name, data)
    SELECT 'autoWithdraw', jsonb_build_object('id', NEW.id)
    WHERE NOT EXISTS (
        SELECT 1
        FROM pgboss.job
        WHERE name = 'autoWithdraw'
        AND data->>'id' = NEW.id::TEXT
        AND (
            state IN ('created', 'active', 'retry')
            OR (state = 'failed' AND startedon > now() - interval '1 minute')
        )
    )
    -- Pending withdrawals block until they settle. Failed withdrawals block for an
    -- hour from their terminal transition, regardless of the next withdrawal amount.
    AND NOT EXISTS (
        SELECT 1
        FROM "PayOutBolt11"
        WHERE "userId" = NEW.id
        AND "payOutType" = 'WITHDRAWAL'
        AND (
            status IS NULL
            OR (
                status <> 'CONFIRMED'
                AND updated_at > now() - interval '1 hour'
            )
        )
    )
    AND EXISTS (
        SELECT 1
        FROM "Wallet" w
        JOIN "WalletProtocol" wp ON w.id = wp."walletId"
        WHERE w."userId" = NEW.id
        AND wp."enabled" = true
        AND wp.send = false
    );
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;
