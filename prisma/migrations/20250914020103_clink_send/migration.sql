-- AlterEnum
ALTER TYPE "WalletSendProtocolName" ADD VALUE 'CLINK'; COMMIT;

UPDATE "WalletTemplate"
SET "sendProtocols" = array_prepend('CLINK', "sendProtocols")
WHERE "name" = 'SHOCKWALLET';

-- CreateTable
CREATE TABLE "WalletSendClink" (
    "id" SERIAL NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "protocolId" INTEGER NOT NULL,
    "ndebitVaultId" INTEGER NOT NULL,
    "secretKeyVaultId" INTEGER NOT NULL,

    CONSTRAINT "WalletSendClink_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "WalletSendClink_protocolId_key" ON "WalletSendClink"("protocolId");

-- CreateIndex
CREATE UNIQUE INDEX "WalletSendClink_ndebitVaultId_key" ON "WalletSendClink"("ndebitVaultId");

-- CreateIndex
CREATE UNIQUE INDEX "WalletSendClink_secretKeyVaultId_key" ON "WalletSendClink"("secretKeyVaultId");

-- AddForeignKey
ALTER TABLE "WalletSendClink" ADD CONSTRAINT "WalletSendClink_protocolId_fkey" FOREIGN KEY ("protocolId") REFERENCES "WalletProtocol"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WalletSendClink" ADD CONSTRAINT "WalletSendClink_ndebitVaultId_fkey" FOREIGN KEY ("ndebitVaultId") REFERENCES "Vault"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WalletSendClink" ADD CONSTRAINT "WalletSendClink_secretKeyVaultId_fkey" FOREIGN KEY ("secretKeyVaultId") REFERENCES "Vault"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

CREATE TRIGGER wallet_to_jsonb
    AFTER INSERT OR UPDATE ON "WalletSendClink"
    FOR EACH ROW
    EXECUTE PROCEDURE wallet_to_jsonb();

CREATE TRIGGER wallet_clear_vault
   AFTER DELETE ON "WalletSendClink"
   FOR EACH ROW
   EXECUTE PROCEDURE wallet_clear_vault();
