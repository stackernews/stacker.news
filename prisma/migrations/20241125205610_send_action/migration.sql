-- AlterTable
ALTER TABLE "users" ADD COLUMN     "directReceive" BOOLEAN NOT NULL DEFAULT false;

-- CreateTable
CREATE TABLE "DirectPayment" (
    "id" SERIAL NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "senderId" INTEGER,
    "receiverId" INTEGER,
    "preimage" TEXT,
    "bolt11" TEXT,
    "walletId" INTEGER,
    "comment" TEXT,
    "desc" TEXT,
    "lud18Data" JSONB,
    "msats" BIGINT NOT NULL,
    "hash" TEXT,
    CONSTRAINT "DirectPayment_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "DirectPayment_preimage_key" ON "DirectPayment"("preimage");

-- CreateIndex
CREATE INDEX "DirectPayment_created_at_idx" ON "DirectPayment"("created_at");

-- CreateIndex
CREATE INDEX "DirectPayment_senderId_idx" ON "DirectPayment"("senderId");

-- CreateIndex
CREATE INDEX "DirectPayment_receiverId_idx" ON "DirectPayment"("receiverId");

-- AddForeignKey
ALTER TABLE "DirectPayment" ADD CONSTRAINT "DirectPayment_senderId_fkey" FOREIGN KEY ("senderId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DirectPayment" ADD CONSTRAINT "DirectPayment_receiverId_fkey" FOREIGN KEY ("receiverId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DirectPayment" ADD CONSTRAINT "DirectPayment_walletId_fkey" FOREIGN KEY ("walletId") REFERENCES "Wallet"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- drop dead functions replaced by paid/paying action state machines
DROP FUNCTION IF EXISTS confirm_invoice;
DROP FUNCTION IF EXISTS create_withdrawl;
DROP FUNCTION IF EXISTS confirm_withdrawl;
DROP FUNCTION IF EXISTS reverse_withdrawl;

-- CreateIndex
CREATE UNIQUE INDEX "InvoiceForward_withdrawlId_key" ON "InvoiceForward"("withdrawlId");

-- CreateIndex
CREATE UNIQUE INDEX "DirectPayment_hash_key" ON "DirectPayment"("hash");