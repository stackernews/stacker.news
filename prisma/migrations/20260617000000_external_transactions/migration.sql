-- CreateEnum
CREATE TYPE "ExternalTransactionDirection" AS ENUM ('SEND', 'RECEIVE');

-- CreateEnum
CREATE TYPE "ExternalTransactionSettlementStatus" AS ENUM ('PENDING', 'SETTLED', 'FAILED', 'UNKNOWN');

-- CreateEnum
CREATE TYPE "ExternalTransactionSourceType" AS ENUM ('BOLT11', 'LN_ADDR');

-- CreateEnum
CREATE TYPE "ExternalTransactionUnknownReason" AS ENUM (
    'TRANSIENT_CHECK_FAILED',
    'PERMISSION_REQUIRED',
    'VERIFICATION_UNSUPPORTED',
    'PROOF_UNAVAILABLE',
    'STATUS_UNAVAILABLE'
);

-- CreateTable
CREATE TABLE "ExternalTransaction" (
    "id" SERIAL NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "direction" "ExternalTransactionDirection" NOT NULL,
    "settlementStatus" "ExternalTransactionSettlementStatus" NOT NULL DEFAULT 'PENDING',
    "settlementStatusChangedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "userId" INTEGER NOT NULL,
    "walletId" INTEGER NOT NULL,
    "protocolId" INTEGER NOT NULL,
    "bolt11" TEXT,
    "hash" TEXT,
    "preimage" TEXT,
    "amountMsats" BIGINT,
    "feeMsats" BIGINT,
    "maxFeeLimitMsats" BIGINT,
    "invoiceExpiresAt" TIMESTAMP(3),
    "settledAt" TIMESTAMP(3),
    "error" TEXT,
    "unknownReason" "ExternalTransactionUnknownReason",
    "unknownMessage" TEXT,
    "sourceType" "ExternalTransactionSourceType",
    "sourceValue" TEXT,
    "verificationContext" JSONB,

    CONSTRAINT "ExternalTransaction_pkey" PRIMARY KEY ("id")
);

-- AlterTable
ALTER TABLE "WalletLog" ADD COLUMN "externalTransactionId" INTEGER;

-- CreateIndex
CREATE INDEX "ExternalTransaction_created_at_idx" ON "ExternalTransaction"("created_at");

-- CreateIndex
CREATE INDEX "ExternalTransaction_userId_created_at_idx" ON "ExternalTransaction"("userId", "created_at");

-- CreateIndex
CREATE INDEX "ExternalTransaction_walletId_created_at_idx" ON "ExternalTransaction"("walletId", "created_at");

-- CreateIndex
CREATE INDEX "ExternalTransaction_protocolId_created_at_idx" ON "ExternalTransaction"("protocolId", "created_at");

-- CreateIndex
CREATE INDEX "ExternalTransaction_hash_idx" ON "ExternalTransaction"("hash");

-- CreateIndex
CREATE INDEX "ExternalTransaction_send_hash_lookup_idx"
ON "ExternalTransaction"("userId", "walletId", "protocolId", "hash", "settlementStatus")
WHERE "direction" = 'SEND'::"ExternalTransactionDirection"
  AND "settlementStatus" IN (
    'PENDING'::"ExternalTransactionSettlementStatus",
    'UNKNOWN'::"ExternalTransactionSettlementStatus",
    'SETTLED'::"ExternalTransactionSettlementStatus"
  );

-- CreateIndex
CREATE INDEX "ExternalTransaction_send_lnaddr_lookup_idx"
ON "ExternalTransaction"("userId", "walletId", "protocolId", "sourceType", lower("sourceValue"), "amountMsats", "settlementStatus")
WHERE "direction" = 'SEND'::"ExternalTransactionDirection"
  AND "sourceType" = 'LN_ADDR'::"ExternalTransactionSourceType"
  AND "sourceValue" IS NOT NULL
  AND "amountMsats" IS NOT NULL
  AND "settlementStatus" IN (
    'PENDING'::"ExternalTransactionSettlementStatus",
    'UNKNOWN'::"ExternalTransactionSettlementStatus",
    'SETTLED'::"ExternalTransactionSettlementStatus"
  );

-- CreateIndex
CREATE INDEX "ExternalTransaction_direction_settlementStatus_updated_at_idx" ON "ExternalTransaction"("direction", "settlementStatus", "updated_at");

-- CreateIndex
CREATE INDEX "WalletLog_externalTransactionId_idx" ON "WalletLog"("externalTransactionId");

-- AddForeignKey
ALTER TABLE "ExternalTransaction" ADD CONSTRAINT "ExternalTransaction_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ExternalTransaction" ADD CONSTRAINT "ExternalTransaction_walletId_fkey" FOREIGN KEY ("walletId") REFERENCES "Wallet"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ExternalTransaction" ADD CONSTRAINT "ExternalTransaction_protocolId_fkey" FOREIGN KEY ("protocolId") REFERENCES "WalletProtocol"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WalletLog" ADD CONSTRAINT "WalletLog_externalTransactionId_fkey" FOREIGN KEY ("externalTransactionId") REFERENCES "ExternalTransaction"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE OR REPLACE FUNCTION schedule_external_transaction_checks()
RETURNS INTEGER
LANGUAGE plpgsql
AS $$
DECLARE
BEGIN
    -- every minute: this batch reaper drives the tail recheck cadence for pending receives and
    -- backstops a broken chain (the per-tx pg-boss check jobs self-re-arm through the hot window)
    INSERT INTO pgboss.schedule (name, cron, timezone)
    VALUES ('checkPendingExternalTransactions', '* * * * *', 'America/Chicago') ON CONFLICT DO NOTHING;
    return 0;
EXCEPTION WHEN OTHERS THEN
    -- pg-boss may not be installed in lightweight test databases.
    return 0;
END;
$$;

SELECT schedule_external_transaction_checks();
DROP FUNCTION schedule_external_transaction_checks();
