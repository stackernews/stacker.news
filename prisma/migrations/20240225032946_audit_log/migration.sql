-- CreateTable
CREATE TABLE "AuditLog" (
    "id" SERIAL NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "table" TEXT NOT NULL,
    "message" TEXT,
    "old" JSONB NOT NULL,
    "new" JSONB NOT NULL,

    CONSTRAINT "AuditLog_pkey" PRIMARY KEY ("id")
);

CREATE OR REPLACE FUNCTION audit_territory_transfer()
RETURNS TRIGGER AS $$
BEGIN
    INSERT INTO "AuditLog"("table", message, old, new)
    VALUES (
        'Sub',
        '~' || OLD.name || ' was transferred from user with id ' || OLD."userId" || ' to user with id ' || NEW."userId",
        json_build_object('name', OLD."name", 'userId', OLD."userId"),
        json_build_object('name', NEW."name", 'userId', NEW."userId")
    );
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- track territory transfers
DROP TRIGGER IF EXISTS territory_transfer_trigger ON "Sub";
CREATE TRIGGER territory_transfer_trigger
AFTER UPDATE ON "Sub"
FOR EACH ROW
WHEN (NEW."userId" <> OLD."userId")
EXECUTE PROCEDURE audit_territory_transfer();

-- create index for notifications query
CREATE INDEX "AuditLog.new.userId" ON "AuditLog" (created_at, ((new->'userId')::integer));
