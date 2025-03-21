ALTER TABLE "WalletLog"
    ADD COLUMN     "invoiceId" INTEGER,
    ADD COLUMN     "withdrawalId" INTEGER;

ALTER TABLE "WalletLog" ADD CONSTRAINT "WalletLog_invoiceId_fkey" FOREIGN KEY ("invoiceId") REFERENCES "Invoice"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "WalletLog" ADD CONSTRAINT "WalletLog_withdrawalId_fkey" FOREIGN KEY ("withdrawalId") REFERENCES "Withdrawl"("id") ON DELETE SET NULL ON UPDATE CASCADE;

TRUNCATE "WalletLog" RESTRICT;
