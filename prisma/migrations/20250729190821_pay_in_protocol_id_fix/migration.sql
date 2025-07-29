/*
  Warnings:

  - You are about to drop the column `protocolId` on the `PayIn` table. All the data in the column will be lost.

*/
-- DropForeignKey
ALTER TABLE "PayIn" DROP CONSTRAINT "PayIn_protocolId_fkey";

-- AlterTable
ALTER TABLE "PayIn" DROP COLUMN "protocolId";

-- AlterTable
ALTER TABLE "PayInBolt11" ADD COLUMN     "protocolId" INTEGER;

-- AddForeignKey
ALTER TABLE "PayInBolt11" ADD CONSTRAINT "PayInBolt11_protocolId_fkey" FOREIGN KEY ("protocolId") REFERENCES "WalletProtocol"("id") ON DELETE SET NULL ON UPDATE CASCADE;
