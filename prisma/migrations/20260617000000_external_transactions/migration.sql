-- CreateEnum
CREATE TYPE "ExternalTransactionDirection" AS ENUM ('SEND', 'RECEIVE');

-- CreateEnum
CREATE TYPE "ExternalTransactionOutcome" AS ENUM ('SETTLED', 'FAILED', 'EXPIRED', 'UNKNOWN');

-- CreateEnum
CREATE TYPE "ExternalTransactionSourceType" AS ENUM ('BOLT11', 'LN_ADDR');

-- CreateEnum
CREATE TYPE "ExternalTransactionUnknownReason" AS ENUM (
    'TRANSIENT_CHECK_FAILED',
    'PERMISSION_REQUIRED',
    'VERIFICATION_UNSUPPORTED',
    'STATUS_UNAVAILABLE',
    'RETENTION'
);

-- CreateTable
CREATE TABLE "ExternalTransaction" (
    "id" SERIAL NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "direction" "ExternalTransactionDirection" NOT NULL,
    -- NULL outcome means reconciliation is still open. nextCheckAt is the
    -- complete schedule and lease; it becomes NULL with the terminal outcome.
    "outcome" "ExternalTransactionOutcome",
    "nextCheckAt" TIMESTAMP(3) DEFAULT CURRENT_TIMESTAMP,
    "userId" INTEGER NOT NULL,
    "walletId" INTEGER NOT NULL,
    "protocolId" INTEGER NOT NULL,
    "bolt11" TEXT,
    "hash" TEXT,
    "preimage" TEXT,
    "amountMsats" BIGINT,
    "settledMsats" BIGINT,
    "actualFeeMsats" BIGINT,
    "maxFeeLimitMsats" BIGINT,
    "invoiceExpiresAt" TIMESTAMP(3) NOT NULL,
    "unknownReason" "ExternalTransactionUnknownReason",
    "sourceType" "ExternalTransactionSourceType",
    "sourceValue" TEXT,
    "verificationContext" JSONB,

    CONSTRAINT "ExternalTransaction_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "ExternalTransaction_lifecycle_check" CHECK (
      (
        "outcome" IS NULL
        AND "nextCheckAt" IS NOT NULL
        AND "unknownReason" IS NULL
      )
      OR
      (
        "outcome" IS NOT NULL
        AND "nextCheckAt" IS NULL
        AND (
          ("outcome" = 'UNKNOWN'::"ExternalTransactionOutcome" AND "unknownReason" IS NOT NULL)
          OR
          ("outcome" <> 'UNKNOWN'::"ExternalTransactionOutcome" AND "unknownReason" IS NULL)
        )
      )
    ),
    CONSTRAINT "ExternalTransaction_settled_amount_check" CHECK (
      "settledMsats" IS NULL OR "outcome" IS NOT DISTINCT FROM 'SETTLED'::"ExternalTransactionOutcome"
    ),
    CONSTRAINT "ExternalTransaction_actual_fee_check" CHECK (
      "actualFeeMsats" IS NULL
      OR (
        "outcome" IS NOT DISTINCT FROM 'SETTLED'::"ExternalTransactionOutcome"
        AND "actualFeeMsats" >= 0
      )
    )
);

-- AlterTable
ALTER TABLE "WalletLog" ADD COLUMN "externalTransactionId" INTEGER;

-- CreateIndex
CREATE INDEX "ExternalTransaction_userId_created_at_id_idx" ON "ExternalTransaction"("userId", "created_at", "id");

-- CreateIndex
CREATE INDEX "ExternalTransaction_userId_unresolved_receive_idx"
ON "ExternalTransaction"("userId", "invoiceExpiresAt")
WHERE "direction" = 'RECEIVE'::"ExternalTransactionDirection"
  AND (
    "outcome" IS NULL
    OR "outcome" = 'UNKNOWN'::"ExternalTransactionOutcome"
  );

-- CreateIndex
CREATE INDEX "ExternalTransaction_walletId_created_at_id_idx" ON "ExternalTransaction"("walletId", "created_at", "id");

-- CreateIndex
CREATE INDEX "ExternalTransaction_protocolId_idx" ON "ExternalTransaction"("protocolId");

-- CreateIndex
CREATE INDEX "ExternalTransaction_hash_idx" ON "ExternalTransaction"("hash");

-- CreateIndex
CREATE INDEX "ExternalTransaction_nextCheckAt_idx"
ON "ExternalTransaction"("nextCheckAt")
WHERE "nextCheckAt" IS NOT NULL;

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
    -- every minute: the worker repeatedly sweeps due nextCheckAt leases during the tick
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
