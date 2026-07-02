ALTER TABLE "ExternalTransaction" ADD COLUMN "duplicateConfirmed" BOOLEAN NOT NULL DEFAULT false;

DROP INDEX IF EXISTS "ExternalTransaction_send_hash_lookup_idx";
DROP INDEX IF EXISTS "ExternalTransaction_send_lnaddr_lookup_idx";

CREATE INDEX "ExternalTransaction_send_hash_lookup_idx"
ON "ExternalTransaction"("userId", "hash", "settlementStatus")
WHERE "direction" = 'SEND'::"ExternalTransactionDirection"
  AND "hash" IS NOT NULL
  AND "settlementStatus" IN (
    'PENDING'::"ExternalTransactionSettlementStatus",
    'UNKNOWN'::"ExternalTransactionSettlementStatus",
    'SETTLED'::"ExternalTransactionSettlementStatus"
  );

CREATE INDEX "ExternalTransaction_send_lnaddr_lookup_idx"
ON "ExternalTransaction"("userId", "sourceType", lower("sourceValue"), "amountMsats", "settlementStatus")
WHERE "direction" = 'SEND'::"ExternalTransactionDirection"
  AND "sourceType" = 'LN_ADDR'::"ExternalTransactionSourceType"
  AND "sourceValue" IS NOT NULL
  AND "amountMsats" IS NOT NULL
  AND "settlementStatus" IN (
    'PENDING'::"ExternalTransactionSettlementStatus",
    'UNKNOWN'::"ExternalTransactionSettlementStatus",
    'SETTLED'::"ExternalTransactionSettlementStatus"
  );

CREATE UNIQUE INDEX "ExternalTransaction_send_hash_unconfirmed_key"
ON "ExternalTransaction"("userId", "hash")
WHERE "direction" = 'SEND'::"ExternalTransactionDirection"
  AND "hash" IS NOT NULL
  AND "duplicateConfirmed" = false
  AND "settlementStatus" IN (
    'PENDING'::"ExternalTransactionSettlementStatus",
    'UNKNOWN'::"ExternalTransactionSettlementStatus",
    'SETTLED'::"ExternalTransactionSettlementStatus"
  );

CREATE UNIQUE INDEX "ExternalTransaction_send_lnaddr_unconfirmed_key"
ON "ExternalTransaction"("userId", lower("sourceValue"), "amountMsats")
WHERE "direction" = 'SEND'::"ExternalTransactionDirection"
  AND "sourceType" = 'LN_ADDR'::"ExternalTransactionSourceType"
  AND "sourceValue" IS NOT NULL
  AND "amountMsats" IS NOT NULL
  AND "duplicateConfirmed" = false
  AND "settlementStatus" IN (
    'PENDING'::"ExternalTransactionSettlementStatus",
    'UNKNOWN'::"ExternalTransactionSettlementStatus"
  );
