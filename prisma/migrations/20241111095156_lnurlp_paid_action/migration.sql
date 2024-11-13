-- AlterEnum
ALTER TYPE "InvoiceActionType" ADD VALUE 'RECEIVE';

-- AlterTable
ALTER TABLE "users" ADD COLUMN     "proxyReceive" BOOLEAN NOT NULL DEFAULT false;
