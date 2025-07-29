/*
  Warnings:

  - You are about to drop the column `walletId` on the `PayOutBolt11` table. All the data in the column will be lost.

*/
-- DropForeignKey
ALTER TABLE "PayOutBolt11" DROP CONSTRAINT "PayOutBolt11_walletId_fkey";

-- DropIndex
DROP INDEX "PayOutBolt11_walletId_idx";

-- AlterTable
ALTER TABLE "PayIn" ADD COLUMN     "protocolId" INTEGER;

-- AlterTable
ALTER TABLE "PayOutBolt11" DROP COLUMN "walletId",
ADD COLUMN     "protocolId" INTEGER;

-- CreateIndex
CREATE INDEX "PayOutBolt11_protocolId_idx" ON "PayOutBolt11"("protocolId");

-- AddForeignKey
ALTER TABLE "PayIn" ADD CONSTRAINT "PayIn_protocolId_fkey" FOREIGN KEY ("protocolId") REFERENCES "WalletProtocol"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PayOutBolt11" ADD CONSTRAINT "PayOutBolt11_protocolId_fkey" FOREIGN KEY ("protocolId") REFERENCES "WalletProtocol"("id") ON DELETE SET NULL ON UPDATE CASCADE;
