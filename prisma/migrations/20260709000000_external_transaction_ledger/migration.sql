-- CreateEnum
CREATE TYPE "ExternalTransactionLedgerType" AS ENUM ('OBLIGATION', 'FULFILLMENT', 'UNKNOWN', 'ERROR', 'TIMEOUT', 'CORRECTION');

-- CreateEnum
CREATE TYPE "ExternalTransactionLedgerSide" AS ENUM ('DEBIT', 'CREDIT');

-- CreateEnum
CREATE TYPE "ExternalTransactionLedgerSource" AS ENUM ('ACCRUAL', 'SETTLEMENT');

-- CreateTable
CREATE TABLE "ExternalTransactionLedger" (
    "id" SERIAL NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "externalTransactionId" INTEGER NOT NULL,
    "userId" INTEGER NOT NULL,
    "walletId" INTEGER NOT NULL,
    "protocolId" INTEGER NOT NULL,
    "direction" "ExternalTransactionDirection" NOT NULL,
    "type" "ExternalTransactionLedgerType" NOT NULL,
    "side" "ExternalTransactionLedgerSide" NOT NULL,
    "source" "ExternalTransactionLedgerSource" NOT NULL,
    "amountMsats" BIGINT NOT NULL,

    CONSTRAINT "ExternalTransactionLedger_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ExternalTransactionLedger_externalTransactionId_idx" ON "ExternalTransactionLedger"("externalTransactionId");

-- CreateIndex
CREATE INDEX "ExternalTransactionLedger_userId_created_at_idx" ON "ExternalTransactionLedger"("userId", "created_at");

-- CreateIndex
CREATE INDEX "ExternalTransactionLedger_walletId_created_at_idx" ON "ExternalTransactionLedger"("walletId", "created_at");

-- CreateIndex
CREATE INDEX "ExternalTransactionLedger_protocolId_created_at_idx" ON "ExternalTransactionLedger"("protocolId", "created_at");

-- CreateIndex
CREATE INDEX "ExternalTransactionLedger_type_idx" ON "ExternalTransactionLedger"("type");

-- AddForeignKey
ALTER TABLE "ExternalTransactionLedger" ADD CONSTRAINT "ExternalTransactionLedger_externalTransactionId_fkey" FOREIGN KEY ("externalTransactionId") REFERENCES "ExternalTransaction"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ExternalTransactionLedger" ADD CONSTRAINT "ExternalTransactionLedger_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ExternalTransactionLedger" ADD CONSTRAINT "ExternalTransactionLedger_walletId_fkey" FOREIGN KEY ("walletId") REFERENCES "Wallet"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ExternalTransactionLedger" ADD CONSTRAINT "ExternalTransactionLedger_protocolId_fkey" FOREIGN KEY ("protocolId") REFERENCES "WalletProtocol"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- magnitude only; the sign is carried by "side"
ALTER TABLE "ExternalTransactionLedger"
  ADD CONSTRAINT "ExternalTransactionLedger_amount_nonneg" CHECK ("amountMsats" >= 0);

-- exactly one OBLIGATION per transaction (the balance is opened once)
CREATE UNIQUE INDEX "ExternalTransactionLedger_obligation_uniq"
  ON "ExternalTransactionLedger" ("externalTransactionId")
  WHERE "type" = 'OBLIGATION'::"ExternalTransactionLedgerType";

-- at most one whole-obligation terminal closer per transaction. FULFILLMENT (partial settlements) and
-- CORRECTION are intentionally excluded.
CREATE UNIQUE INDEX "ExternalTransactionLedger_terminal_uniq"
  ON "ExternalTransactionLedger" ("externalTransactionId")
  WHERE "type" IN (
    'UNKNOWN'::"ExternalTransactionLedgerType",
    'ERROR'::"ExternalTransactionLedgerType",
    'TIMEOUT'::"ExternalTransactionLedgerType"
  );

-- append-only guard: block UPDATE. INSERT (booking) and DELETE (the privacy cascade) are NOT guarded,
-- so they remain allowed; TRUNCATE is blocked as optional hardening.
CREATE OR REPLACE FUNCTION external_transaction_ledger_immutable()
RETURNS TRIGGER AS $$
BEGIN
  RAISE EXCEPTION 'ExternalTransactionLedger is append-only; % is not allowed', TG_OP;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER external_transaction_ledger_no_update
  BEFORE UPDATE ON "ExternalTransactionLedger"
  FOR EACH ROW EXECUTE FUNCTION external_transaction_ledger_immutable();

CREATE TRIGGER external_transaction_ledger_no_truncate
  BEFORE TRUNCATE ON "ExternalTransactionLedger"
  FOR EACH STATEMENT EXECUTE FUNCTION external_transaction_ledger_immutable();
