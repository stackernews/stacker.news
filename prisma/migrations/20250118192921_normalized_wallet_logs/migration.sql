-- AlterTable
ALTER TABLE "WalletLog" ADD COLUMN     "invoiceId" INTEGER;

-- AddForeignKey
ALTER TABLE "WalletLog" ADD CONSTRAINT "WalletLog_invoiceId_fkey" FOREIGN KEY ("invoiceId") REFERENCES "Invoice"("id") ON DELETE SET NULL ON UPDATE CASCADE;
