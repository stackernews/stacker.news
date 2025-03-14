-- replace context JSON column with foreign key to invoice
ALTER TABLE "WalletLog" ADD COLUMN "invoiceId" INTEGER;
ALTER TABLE "WalletLog" DROP COLUMN "context";
ALTER TABLE "WalletLog" ADD CONSTRAINT "WalletLog_invoiceId_fkey" FOREIGN KEY ("invoiceId") REFERENCES "Invoice"("id") ON DELETE SET NULL ON UPDATE CASCADE;
