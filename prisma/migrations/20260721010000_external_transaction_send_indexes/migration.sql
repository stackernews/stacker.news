-- Keep one unresolved or settled send per invoice. Only a definitive provider
-- failure releases the hash for another attempt.
CREATE UNIQUE INDEX "ExternalTransaction_send_hash_protected_key"
ON "ExternalTransaction"("userId", "hash")
WHERE "direction" = 'SEND'::"ExternalTransactionDirection"
  AND "hash" IS NOT NULL
  AND "outcome" IS DISTINCT FROM 'FAILED'::"ExternalTransactionOutcome";

CREATE INDEX "ExternalTransaction_send_lnaddr_lookup_idx"
ON "ExternalTransaction"("userId", lower("sourceValue"), "amountMsats", "created_at")
WHERE "direction" = 'SEND'::"ExternalTransactionDirection"
  AND "sourceType" = 'LN_ADDR'::"ExternalTransactionSourceType"
  AND "sourceValue" IS NOT NULL
  AND "amountMsats" IS NOT NULL
  AND "outcome" IS DISTINCT FROM 'FAILED'::"ExternalTransactionOutcome";

-- Browser claims are user-scoped and ordered by the due lease.
CREATE INDEX "ExternalTransaction_userId_due_send_idx"
ON "ExternalTransaction"("userId", "nextCheckAt", "id")
WHERE "direction" = 'SEND'::"ExternalTransactionDirection"
  AND "outcome" IS NULL;
