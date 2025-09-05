-- AlterEnum
ALTER TYPE "WalletProtocolName" ADD VALUE 'CLINK'; COMMIT;

-- AlterEnum
ALTER TYPE "WalletRecvProtocolName" ADD VALUE 'CLINK'; COMMIT;

-- AlterEnum
ALTER TYPE "WalletSendProtocolName" ADD VALUE 'CLINK'; COMMIT;

UPDATE "WalletTemplate"
SET
    "sendProtocols" = array_append("sendProtocols", 'CLINK'),
    "recvProtocols" = array_append("recvProtocols", 'CLINK')
WHERE "name" = 'SHOCKWALLET';

-- CreateTable
CREATE TABLE "WalletSendClink" (
    "id" SERIAL NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "protocolId" INTEGER NOT NULL,
    "ndebitId" INTEGER NOT NULL,

    CONSTRAINT "WalletSendClink_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "WalletRecvClink" (
    "id" SERIAL NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "protocolId" INTEGER NOT NULL,
    "noffer" TEXT NOT NULL,

    CONSTRAINT "WalletRecvClink_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "WalletSendClink_protocolId_key" ON "WalletSendClink"("protocolId");

-- CreateIndex
CREATE UNIQUE INDEX "WalletSendClink_ndebitId_key" ON "WalletSendClink"("ndebitId");

-- CreateIndex
CREATE UNIQUE INDEX "WalletRecvClink_protocolId_key" ON "WalletRecvClink"("protocolId");

-- AddForeignKey
ALTER TABLE "WalletSendClink" ADD CONSTRAINT "WalletSendClink_protocolId_fkey" FOREIGN KEY ("protocolId") REFERENCES "WalletProtocol"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WalletSendClink" ADD CONSTRAINT "WalletSendClink_ndebitId_fkey" FOREIGN KEY ("ndebitId") REFERENCES "Vault"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WalletRecvClink" ADD CONSTRAINT "WalletRecvClink_protocolId_fkey" FOREIGN KEY ("protocolId") REFERENCES "WalletProtocol"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE TRIGGER wallet_to_jsonb
    AFTER INSERT OR UPDATE ON "WalletRecvClink"
    FOR EACH ROW
    EXECUTE PROCEDURE wallet_to_jsonb();

CREATE TRIGGER wallet_to_jsonb
    AFTER INSERT OR UPDATE ON "WalletSendClink"
    FOR EACH ROW
    EXECUTE PROCEDURE wallet_to_jsonb();

CREATE TRIGGER wallet_clear_vault
   AFTER DELETE ON "WalletSendClink"
   FOR EACH ROW
   EXECUTE PROCEDURE wallet_clear_vault();
