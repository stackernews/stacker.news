ALTER TABLE "users" ADD COLUMN "nostrCrossposting" BOOLEAN NOT NULL DEFAULT false;

CREATE INDEX "nostrCrossposting_index" ON "users"("nostrCrossposting");
