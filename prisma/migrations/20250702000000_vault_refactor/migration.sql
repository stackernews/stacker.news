/*
  Warnings:

  - A unique constraint covering the columns `[apiKeyId]` on the table `WalletBlink` will be added. If there are existing duplicate values, this will fail.
  - A unique constraint covering the columns `[currencyId]` on the table `WalletBlink` will be added. If there are existing duplicate values, this will fail.
  - A unique constraint covering the columns `[adminKeyId]` on the table `WalletLNbits` will be added. If there are existing duplicate values, this will fail.
  - A unique constraint covering the columns `[nwcUrlId]` on the table `WalletNWC` will be added. If there are existing duplicate values, this will fail.
  - A unique constraint covering the columns `[primaryPasswordId]` on the table `WalletPhoenixd` will be added. If there are existing duplicate values, this will fail.

*/
-- AlterTable
ALTER TABLE "WalletBlink"
    ADD COLUMN "apiKeyId" INTEGER,
    ADD COLUMN "currencyId" INTEGER;

-- AlterTable
ALTER TABLE "WalletLNbits" ADD COLUMN "adminKeyId" INTEGER;

-- AlterTable
ALTER TABLE "WalletNWC" ADD COLUMN "nwcUrlId" INTEGER;

-- AlterTable
ALTER TABLE "WalletPhoenixd" ADD COLUMN "primaryPasswordId" INTEGER;

-- CreateTable
CREATE TABLE "Vault" (
    "id" SERIAL NOT NULL,
    "iv" TEXT NOT NULL,
    "value" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Vault_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "WalletLNC" (
    "id" SERIAL NOT NULL,
    "walletId" INTEGER NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "pairingPhraseId" INTEGER,
    "localKeyId" INTEGER,
    "remoteKeyId" INTEGER,
    "serverHostId" INTEGER,

    CONSTRAINT "WalletLNC_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "WalletWebLN" (
    "id" SERIAL NOT NULL,
    "walletId" INTEGER NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "WalletWebLN_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "WalletBlink_apiKeyId_key" ON "WalletBlink"("apiKeyId");

-- CreateIndex
CREATE UNIQUE INDEX "WalletBlink_currencyId_key" ON "WalletBlink"("currencyId");

-- CreateIndex
CREATE UNIQUE INDEX "WalletLNbits_adminKeyId_key" ON "WalletLNbits"("adminKeyId");

-- CreateIndex
CREATE UNIQUE INDEX "WalletNWC_nwcUrlId_key" ON "WalletNWC"("nwcUrlId");

-- CreateIndex
CREATE UNIQUE INDEX "WalletPhoenixd_primaryPasswordId_key" ON "WalletPhoenixd"("primaryPasswordId");

-- CreateIndex
CREATE UNIQUE INDEX "WalletLNC_walletId_key" ON "WalletLNC"("walletId");

-- CreateIndex
CREATE UNIQUE INDEX "WalletLNC_pairingPhraseId_key" ON "WalletLNC"("pairingPhraseId");

-- CreateIndex
CREATE UNIQUE INDEX "WalletLNC_localKeyId_key" ON "WalletLNC"("localKeyId");

-- CreateIndex
CREATE UNIQUE INDEX "WalletLNC_remoteKeyId_key" ON "WalletLNC"("remoteKeyId");

-- CreateIndex
CREATE UNIQUE INDEX "WalletLNC_serverHostId_key" ON "WalletLNC"("serverHostId");

-- CreateIndex
CREATE UNIQUE INDEX "WalletWebLN_walletId_key" ON "WalletWebLN"("walletId");

-- AddForeignKey
ALTER TABLE "WalletLNbits" ADD CONSTRAINT "WalletLNbits_adminKeyId_fkey" FOREIGN KEY ("adminKeyId") REFERENCES "Vault"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WalletNWC" ADD CONSTRAINT "WalletNWC_nwcUrlId_fkey" FOREIGN KEY ("nwcUrlId") REFERENCES "Vault"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WalletBlink" ADD CONSTRAINT "WalletBlink_apiKeyId_fkey" FOREIGN KEY ("apiKeyId") REFERENCES "Vault"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WalletBlink" ADD CONSTRAINT "WalletBlink_currencyId_fkey" FOREIGN KEY ("currencyId") REFERENCES "Vault"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WalletPhoenixd" ADD CONSTRAINT "WalletPhoenixd_primaryPasswordId_fkey" FOREIGN KEY ("primaryPasswordId") REFERENCES "Vault"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WalletLNC" ADD CONSTRAINT "WalletLNC_walletId_fkey" FOREIGN KEY ("walletId") REFERENCES "Wallet"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WalletLNC" ADD CONSTRAINT "WalletLNC_pairingPhraseId_fkey" FOREIGN KEY ("pairingPhraseId") REFERENCES "Vault"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WalletLNC" ADD CONSTRAINT "WalletLNC_localKeyId_fkey" FOREIGN KEY ("localKeyId") REFERENCES "Vault"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WalletLNC" ADD CONSTRAINT "WalletLNC_remoteKeyId_fkey" FOREIGN KEY ("remoteKeyId") REFERENCES "Vault"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WalletLNC" ADD CONSTRAINT "WalletLNC_serverHostId_fkey" FOREIGN KEY ("serverHostId") REFERENCES "Vault"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WalletWebLN" ADD CONSTRAINT "WalletWebLN_walletId_fkey" FOREIGN KEY ("walletId") REFERENCES "Wallet"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE TRIGGER wallet_lnc_as_jsonb
AFTER INSERT OR UPDATE ON "WalletLNC"
FOR EACH ROW EXECUTE PROCEDURE wallet_wallet_type_as_jsonb();

CREATE TRIGGER wallet_webln_as_jsonb
AFTER INSERT OR UPDATE ON "WalletWebLN"
FOR EACH ROW EXECUTE PROCEDURE wallet_wallet_type_as_jsonb();

CREATE OR REPLACE FUNCTION migrate_wallet_vault()
RETURNS void AS
$$
DECLARE
    vaultEntry "VaultEntry"%ROWTYPE;
BEGIN
    INSERT INTO "WalletWebLN"("walletId") SELECT id FROM "Wallet" WHERE type = 'WEBLN';
    INSERT INTO "WalletLNC"("walletId") SELECT id from "Wallet" WHERE type = 'LNC';

    FOR vaultEntry IN SELECT * FROM "VaultEntry" LOOP
        DECLARE
            vaultId INT;
            walletType "WalletType";
        BEGIN
            INSERT INTO "Vault" ("iv", "value")
            VALUES (vaultEntry."iv", vaultEntry."value")
            RETURNING id INTO vaultId;

            SELECT type INTO walletType
            FROM "Wallet"
            WHERE id = vaultEntry."walletId";

            CASE walletType
                WHEN 'LNBITS' THEN
                    UPDATE "WalletLNbits"
                    SET "adminKeyId" = vaultId
                    WHERE "walletId" = vaultEntry."walletId";
                WHEN 'NWC' THEN
                    UPDATE "WalletNWC"
                    SET "nwcUrlId" = vaultId
                    WHERE "walletId" = vaultEntry."walletId";
                WHEN 'BLINK' THEN
                    IF vaultEntry."key" = 'apiKey' THEN
                        UPDATE "WalletBlink"
                        SET "apiKeyId" = vaultId
                        WHERE "walletId" = vaultEntry."walletId";
                    ELSE
                        UPDATE "WalletBlink"
                        SET "currencyId" = vaultId
                        WHERE "walletId" = vaultEntry."walletId";
                    END IF;
                WHEN 'PHOENIXD' THEN
                    UPDATE "WalletPhoenixd"
                    SET "primaryPasswordId" = vaultId
                    WHERE "walletId" = vaultEntry."walletId";
                WHEN 'LNC' THEN
                    IF vaultEntry."key" = 'pairingPhrase' THEN
                        UPDATE "WalletLNC"
                        SET "pairingPhraseId" = vaultId
                        WHERE "walletId" = vaultEntry."walletId";
                    ELSIF vaultEntry."key" = 'localKey' THEN
                        UPDATE "WalletLNC"
                        SET "localKeyId" = vaultId
                        WHERE "walletId" = vaultEntry."walletId";
                    ELSIF vaultEntry."key" = 'remoteKey' THEN
                        UPDATE "WalletLNC"
                        SET "remoteKeyId" = vaultId
                        WHERE "walletId" = vaultEntry."walletId";
                    ELSIF vaultEntry."key" = 'serverHost' THEN
                        UPDATE "WalletLNC"
                        SET "serverHostId" = vaultId
                        WHERE "walletId" = vaultEntry."walletId";
                    END IF;
              END CASE;
        END;
    END LOOP;
END;
$$ LANGUAGE plpgsql;

SELECT migrate_wallet_vault();
DROP FUNCTION migrate_wallet_vault();

ALTER TABLE "VaultEntry" DROP CONSTRAINT "VaultEntry_userId_fkey";
ALTER TABLE "VaultEntry" DROP CONSTRAINT "VaultEntry_walletId_fkey";
DROP TABLE "VaultEntry";
