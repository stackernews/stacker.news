-- AlterEnum
ALTER TYPE "WalletName" ADD VALUE 'SPARK'; COMMIT;

-- AlterEnum
ALTER TYPE "WalletProtocolName" ADD VALUE 'SPARK'; COMMIT;

-- AlterEnum
ALTER TYPE "WalletSendProtocolName" ADD VALUE 'SPARK'; COMMIT;

-- AlterEnum
ALTER TYPE "WalletRecvProtocolName" ADD VALUE 'SPARK'; COMMIT;

INSERT INTO "WalletTemplate" ("name", "sendProtocols", "recvProtocols")
VALUES ('SPARK', '{SPARK}', '{SPARK}');

-- CreateTable
CREATE TABLE "WalletSendSpark" (
    "id" SERIAL NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "protocolId" INTEGER NOT NULL,
    "mnemonicVaultId" INTEGER NOT NULL,

    CONSTRAINT "WalletSendSpark_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "WalletSendSpark_protocolId_key" ON "WalletSendSpark"("protocolId");

-- CreateIndex
CREATE UNIQUE INDEX "WalletSendSpark_mnemonicVaultId_key" ON "WalletSendSpark"("mnemonicVaultId");

-- AddForeignKey
ALTER TABLE "WalletSendSpark" ADD CONSTRAINT "WalletSendSpark_protocolId_fkey" FOREIGN KEY ("protocolId") REFERENCES "WalletProtocol"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WalletSendSpark" ADD CONSTRAINT "WalletSendSpark_mnemonicVaultId_fkey" FOREIGN KEY ("mnemonicVaultId") REFERENCES "Vault"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

CREATE TABLE "WalletRecvSpark" (
    "id" SERIAL NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "protocolId" INTEGER NOT NULL,
    "identityPublicKey" TEXT NOT NULL,

    CONSTRAINT "WalletRecvSpark_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "WalletRecvSpark_protocolId_key" ON "WalletRecvSpark"("protocolId");

-- AddForeignKey
ALTER TABLE "WalletRecvSpark" ADD CONSTRAINT "WalletRecvSpark_protocolId_fkey" FOREIGN KEY ("protocolId") REFERENCES "WalletProtocol"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE TRIGGER wallet_to_jsonb
    AFTER INSERT OR UPDATE ON "WalletSendSpark"
    FOR EACH ROW
    EXECUTE PROCEDURE wallet_to_jsonb();

CREATE TRIGGER wallet_to_jsonb
    AFTER INSERT OR UPDATE ON "WalletRecvSpark"
    FOR EACH ROW
    EXECUTE PROCEDURE wallet_to_jsonb();

CREATE TRIGGER wallet_clear_vault
   AFTER DELETE ON "WalletSendSpark"
   FOR EACH ROW
   EXECUTE PROCEDURE wallet_clear_vault();
