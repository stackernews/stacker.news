-- AlterTable
ALTER TABLE "Sub" ADD COLUMN     "billPaidUntil" TIMESTAMP(3);

-- we want to denomalize billPaidUntil into a job so that the application
-- doesn't have to concern itself too much with territory billing jobs
-- and think about future state
CREATE OR REPLACE FUNCTION update_territory_billing()
RETURNS TRIGGER AS $$
BEGIN
    IF (TG_OP = 'UPDATE') THEN
        -- delete the old job
        DELETE FROM pgboss.job
            WHERE name = 'territoryBilling'
            AND data->>'subName' = OLD."name";
    END IF;

    IF (NEW."billPaidUntil" IS NOT NULL) THEN
        -- create a new job
        INSERT INTO pgboss.job (name, data, startafter, keepuntil)
            VALUES (
                'territoryBilling',
                jsonb_build_object('subName', NEW.name),
                NEW."billPaidUntil",
                NEW."billPaidUntil" + interval '1 day');
    END IF;

    RETURN NEW;
EXCEPTION WHEN undefined_table THEN
    return NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS update_territory_billing_trigger ON "Sub";
CREATE TRIGGER update_territory_billing_trigger
AFTER INSERT OR UPDATE ON "Sub"
FOR EACH ROW
WHEN (NEW.status = 'ACTIVE')
EXECUTE PROCEDURE update_territory_billing();

-- migrate existing data to have billPaidUntil
UPDATE "Sub"
SET "billPaidUntil" =
    (CASE
        WHEN "billingType" = 'MONTHLY' THEN "billedLastAt" + interval '1 month'
        WHEN "billingType" = 'YEARLY' THEN "billedLastAt" + interval '1 year'
        ELSE NULL
    END);

