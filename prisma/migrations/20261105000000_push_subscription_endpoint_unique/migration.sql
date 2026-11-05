-- keep only the newest row for each endpoint
DELETE FROM "PushSubscription" a
USING "PushSubscription" b
WHERE a."endpoint" = b."endpoint"
  AND a."id" < b."id";

-- CreateIndex
CREATE UNIQUE INDEX "PushSubscription_endpoint_key" ON "PushSubscription"("endpoint");
