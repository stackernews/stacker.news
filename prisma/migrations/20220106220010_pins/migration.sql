-- AlterTable
ALTER TABLE "Item" ADD COLUMN     "pinId" INTEGER,
ALTER COLUMN "updated_at" SET DEFAULT CURRENT_TIMESTAMP;

-- CreateTable
CREATE TABLE "Pin" (
    "id" SERIAL NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "cron" TEXT,
    "timezone" TEXT,
    "position" INTEGER NOT NULL,

    PRIMARY KEY ("id")
);

-- AddForeignKey
ALTER TABLE "Item" ADD FOREIGN KEY ("pinId") REFERENCES "Pin"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- pin upserts add new pgboss.schedule
CREATE OR REPLACE FUNCTION pin_upsert_trigger_func() RETURNS TRIGGER AS $$
    BEGIN
        -- only schedule if pin has new.cron set
        IF new.cron IS NOT NULL THEN
        -- pgboss updates when inserts have the same name
            INSERT INTO pgboss.schedule (name, cron, timezone)
            VALUES ('repin-' || new.id, new.cron, new.timezone)
            ON CONFLICT (name) DO UPDATE SET
            cron = EXCLUDED.cron,
            timezone = EXCLUDED.timezone,
            data = EXCLUDED.data,
            options = EXCLUDED.options,
            updated_on = now();
        -- if old.cron is set but new.cron isn't ... we need to delete the job
        ELSIF old.cron IS NOT NULL AND new.cron IS NULL THEN
            DELETE FROM pgboss.schedule where name = 'repin-' || new.id;
        END IF;

        RETURN new;
    END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS pin_upsert_trigger ON "Pin";
CREATE TRIGGER pin_upsert_trigger
   AFTER INSERT OR UPDATE ON "Pin"
   FOR EACH ROW EXECUTE PROCEDURE pin_upsert_trigger_func();

-- pin delete removes from pgboss.schedule
CREATE OR REPLACE FUNCTION pin_delete_trigger_func() RETURNS TRIGGER AS $$
    BEGIN
        DELETE FROM pgboss.schedule where name = 'repin-' || old.id;
        RETURN NULL;
    END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS pin_delete_trigger ON "Pin";
CREATE TRIGGER pin_delete_trigger
   AFTER DELETE ON "Pin"
   FOR EACH ROW EXECUTE PROCEDURE pin_delete_trigger_func();