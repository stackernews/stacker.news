DROP INDEX IF EXISTS "PayOutBolt11_hash_key";
-- only allow one payOutBolt11 with the same hash to have no status (pending) or success
CREATE UNIQUE INDEX "PayOutBolt11_hash_key" ON "PayOutBolt11"("hash") WHERE "status" IS NULL OR "status" = 'CONFIRMED';