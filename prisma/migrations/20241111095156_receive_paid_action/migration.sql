-- AlterEnum
ALTER TYPE "InvoiceActionType" ADD VALUE 'RECEIVE';

-- AlterTable
ALTER TABLE "users" ADD COLUMN     "proxyReceive" BOOLEAN NOT NULL DEFAULT false;

DROP FUNCTION IF EXISTS create_invoice;

-- Add unique index for Withdrawl table
-- to prevent multiple pending withdrawls with the same hash
CREATE UNIQUE INDEX "Withdrawl_hash_key_null_status"
ON "Withdrawl" (hash)
WHERE status IS NULL;
