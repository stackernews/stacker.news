-- AlterEnum
ALTER TYPE "InvoiceActionType" ADD VALUE 'LNURLP';

-- AlterTable
ALTER TABLE "users" ADD COLUMN     "lnurlpP2P" BOOLEAN NOT NULL DEFAULT false;
