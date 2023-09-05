ALTER TABLE "users"
ADD COLUMN "nostrCrossposting" boolean;

UPDATE "users"
SET "nostrCrossposting" = false;

CREATE INDEX "nostrCrossposting_index" ON "users"("nostrCrossposting");
