        -- This is an empty migration.
CREATE OR REPLACE FUNCTION check_pending_bolt11s()
RETURNS INTEGER
LANGUAGE plpgsql
AS $$
DECLARE
BEGIN
    UPDATE pgboss.schedule SET name = 'checkPendingPayInBolt11s', cron = '*/5 * * * *' WHERE name = 'checkPendingDeposits';
    UPDATE pgboss.schedule SET name = 'checkPendingPayOutBolt11s', cron = '*/5 * * * *' WHERE name = 'checkPendingWithdrawals';
    return 0;
EXCEPTION WHEN OTHERS THEN
    return 0;
END;
$$;

SELECT check_pending_bolt11s();
DROP FUNCTION check_pending_bolt11s();