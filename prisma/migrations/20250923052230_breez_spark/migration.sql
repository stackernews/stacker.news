-- AlterEnum
ALTER TYPE "WalletName" ADD VALUE 'BREEZ'; COMMIT;

-- AlterEnum
ALTER TYPE "WalletProtocolName" ADD VALUE 'BREEZ_SPARK'; COMMIT;

-- AlterEnum
ALTER TYPE "WalletSendProtocolName" ADD VALUE 'BREEZ_SPARK'; COMMIT;

INSERT INTO "WalletTemplate" ("name", "sendProtocols", "recvProtocols")
VALUES ('BREEZ', '{BREEZ_SPARK}', '{LN_ADDR}');

-- CreateTable
CREATE TABLE "WalletSendBreezSpark" (
    "id" SERIAL NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "protocolId" INTEGER NOT NULL,
    "mnemonicVaultId" INTEGER NOT NULL,

    CONSTRAINT "WalletSendBreezSpark_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "WalletSendBreezSpark_protocolId_key" ON "WalletSendBreezSpark"("protocolId");

-- CreateIndex
CREATE UNIQUE INDEX "WalletSendBreezSpark_mnemonicVaultId_key" ON "WalletSendBreezSpark"("mnemonicVaultId");

-- AddForeignKey
ALTER TABLE "WalletSendBreezSpark" ADD CONSTRAINT "WalletSendBreezSpark_protocolId_fkey" FOREIGN KEY ("protocolId") REFERENCES "WalletProtocol"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WalletSendBreezSpark" ADD CONSTRAINT "WalletSendBreezSpark_mnemonicVaultId_fkey" FOREIGN KEY ("mnemonicVaultId") REFERENCES "Vault"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

CREATE TRIGGER wallet_to_jsonb
    AFTER INSERT OR UPDATE ON "WalletSendBreezSpark"
    FOR EACH ROW
    EXECUTE PROCEDURE wallet_to_jsonb();

CREATE TRIGGER wallet_clear_vault
   AFTER DELETE ON "WalletSendBreezSpark"
   FOR EACH ROW
   EXECUTE PROCEDURE wallet_clear_vault();
