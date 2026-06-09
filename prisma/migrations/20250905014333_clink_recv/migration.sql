-- AlterEnum
ALTER TYPE "WalletProtocolName" ADD VALUE 'CLINK'; COMMIT;

-- AlterEnum
ALTER TYPE "WalletRecvProtocolName" ADD VALUE 'CLINK'; COMMIT;

UPDATE "WalletTemplate"
SET "recvProtocols" = array_prepend('CLINK', "recvProtocols")
WHERE "name" = 'SHOCKWALLET';

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
CREATE UNIQUE INDEX "WalletRecvClink_protocolId_key" ON "WalletRecvClink"("protocolId");

-- AddForeignKey
ALTER TABLE "WalletRecvClink" ADD CONSTRAINT "WalletRecvClink_protocolId_fkey" FOREIGN KEY ("protocolId") REFERENCES "WalletProtocol"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE TRIGGER wallet_to_jsonb
    AFTER INSERT OR UPDATE ON "WalletRecvClink"
    FOR EACH ROW
    EXECUTE PROCEDURE wallet_to_jsonb();
