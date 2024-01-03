-- AlterTable
ALTER TABLE "Sub" ADD COLUMN     "statusUpdatedAt" TIMESTAMP(3);

-- CreateIndex
CREATE INDEX "Sub_statusUpdatedAt_idx" ON "Sub"("statusUpdatedAt");

CREATE OR REPLACE FUNCTION reset_territory_billing_job()
RETURNS INTEGER
LANGUAGE plpgsql
AS $$
DECLARE
BEGIN
    DELETE FROM pgboss.job where name = 'territoryBilling';
    INSERT INTO pgboss.job (name, data, startafter, keepuntil)
    SELECT 'territoryBilling', json_build_object('subName', name),
    "billedLastAt" + CASE WHEN "billingType" = 'MONTHLY' THEN interval '1 month' ELSE interval '1 year' END,
    "billedLastAt" + CASE WHEN "billingType" = 'MONTHLY' THEN interval '1 month 1 day' ELSE interval '1 year 1 day' END
    FROM "Sub"
    WHERE "billingType" <> 'ONCE';
    return 0;
EXCEPTION WHEN OTHERS THEN
    return 0;
END;
$$;

SELECT reset_territory_billing_job();
DROP FUNCTION reset_territory_billing_job();