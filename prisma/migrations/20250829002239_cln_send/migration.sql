-- AlterEnum
ALTER TYPE "WalletSendProtocolName" ADD VALUE 'CLN_REST'; COMMIT;

UPDATE "WalletTemplate" SET "sendProtocols" = array_append("sendProtocols", 'CLN_REST') WHERE "name" = 'CLN';

-- CreateTable
CREATE TABLE "WalletSendCLNRest" (
    "id" SERIAL NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "protocolId" INTEGER NOT NULL,
    "socket" TEXT NOT NULL,
    "runeVaultId" INTEGER NOT NULL,

    CONSTRAINT "WalletSendCLNRest_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "WalletSendCLNRest_protocolId_key" ON "WalletSendCLNRest"("protocolId");

-- CreateIndex
CREATE UNIQUE INDEX "WalletSendCLNRest_runeVaultId_key" ON "WalletSendCLNRest"("runeVaultId");

-- AddForeignKey
ALTER TABLE "WalletSendCLNRest" ADD CONSTRAINT "WalletSendCLNRest_protocolId_fkey" FOREIGN KEY ("protocolId") REFERENCES "WalletProtocol"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WalletSendCLNRest" ADD CONSTRAINT "WalletSendCLNRest_runeVaultId_fkey" FOREIGN KEY ("runeVaultId") REFERENCES "Vault"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

CREATE TRIGGER wallet_to_jsonb
    AFTER INSERT OR UPDATE ON "WalletSendCLNRest"
    FOR EACH ROW
    EXECUTE PROCEDURE wallet_to_jsonb();

CREATE TRIGGER wallet_clear_vault
   AFTER DELETE ON "WalletSendCLNRest"
   FOR EACH ROW
   EXECUTE PROCEDURE wallet_clear_vault();