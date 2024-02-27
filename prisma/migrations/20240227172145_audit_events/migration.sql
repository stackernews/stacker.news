-- CreateEnum
CREATE TYPE "AuditEventType" AS ENUM ('TERRITORY_TRANSFER');

-- CreateTable
CREATE TABLE "AuditEvent" (
    "id" SERIAL NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "type" "AuditEventType" NOT NULL,
    "userId" INTEGER[],
    "event" JSONB,

    CONSTRAINT "AuditEvent_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TerritoryTransfer" (
    "id" SERIAL NOT NULL,
    "eventId" INTEGER NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "oldUserId" INTEGER NOT NULL,
    "newUserId" INTEGER NOT NULL,
    "subName" CITEXT NOT NULL,

    CONSTRAINT "TerritoryTransfer_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "TerritoryTransfer_eventId_key" ON "TerritoryTransfer"("eventId");

-- AddForeignKey
ALTER TABLE "TerritoryTransfer" ADD CONSTRAINT "TerritoryTransfer_eventId_fkey" FOREIGN KEY ("eventId") REFERENCES "AuditEvent"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TerritoryTransfer" ADD CONSTRAINT "TerritoryTransfer_oldUserId_fkey" FOREIGN KEY ("oldUserId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TerritoryTransfer" ADD CONSTRAINT "TerritoryTransfer_newUserId_fkey" FOREIGN KEY ("newUserId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TerritoryTransfer" ADD CONSTRAINT "TerritoryTransfer_subName_fkey" FOREIGN KEY ("subName") REFERENCES "Sub"("name") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE INDEX "AuditEvent.type_userId_index" ON "AuditEvent"("type", "userId");
CREATE INDEX "TerritoryTransfer.newUserId_index" ON "TerritoryTransfer"("created_at", "newUserId");
CREATE INDEX "TerritoryTransfer.oldUserId_index" ON "TerritoryTransfer"("created_at", "oldUserId");

-- track territory transfers via triggers on Sub table
CREATE OR REPLACE FUNCTION audit_event_territory_transfer()
RETURNS TRIGGER AS $$
DECLARE
    event_id INTEGER;
    transfer "TerritoryTransfer"%ROWTYPE;
BEGIN
    INSERT INTO "AuditEvent" ("type", "userId")
    VALUES ('TERRITORY_TRANSFER', ARRAY[OLD."userId", NEW."userId"])
    RETURNING "id" INTO event_id;

    INSERT INTO "TerritoryTransfer" ("eventId", "oldUserId", "newUserId", "subName")
    VALUES (event_id, OLD."userId", NEW."userId", OLD."name")
    RETURNING * INTO transfer;

    UPDATE "AuditEvent" SET "event" = to_jsonb(transfer) WHERE "id" = event_id;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS territory_transfer_trigger ON "Sub";
CREATE TRIGGER audit_event_territory_transfer_trigger
AFTER UPDATE ON "Sub" FOR EACH ROW WHEN (NEW."userId" <> OLD."userId")
EXECUTE PROCEDURE audit_event_territory_transfer();

