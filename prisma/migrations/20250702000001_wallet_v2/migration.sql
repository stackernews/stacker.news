-- CreateEnum
CREATE TYPE "WalletProtocolName" AS ENUM ('NWC', 'LNBITS', 'PHOENIXD', 'BLINK', 'WEBLN', 'LN_ADDR', 'LNC', 'CLN_REST', 'LND_GRPC');

-- CreateEnum
CREATE TYPE "WalletSendProtocolName" AS ENUM ('NWC', 'LNBITS', 'PHOENIXD', 'BLINK', 'WEBLN', 'LNC');

-- CreateEnum
CREATE TYPE "WalletRecvProtocolName" AS ENUM ('NWC', 'LNBITS', 'PHOENIXD', 'BLINK', 'LN_ADDR', 'CLN_REST', 'LND_GRPC');

-- CreateEnum
CREATE TYPE "WalletName" AS ENUM (
    'ALBY',
    'BLINK',
    'BLIXT',
    'CASHU_ME',
    'CLN',
    'COINOS',
    'FOUNTAIN',
    'LIFPAY',
    'LNBITS',
    'LND',
    'MINIBITS',
    'NPUB_CASH',
    'PHOENIXD',
    'PRIMAL',
    'RIZFUL',
    'SHOCKWALLET',
    'SPEED',
    'STRIKE',
    'VOLTAGE',
    'WALLET_OF_SATOSHI',
    'ZBD',
    'ZEUS',
    'NWC',
    'LN_ADDR',
    'CASH_APP'
);

-- CreateTable
CREATE TABLE "WalletTemplate" (
    "name" "WalletName" NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "sendProtocols" "WalletSendProtocolName"[],
    "recvProtocols" "WalletRecvProtocolName"[],

    CONSTRAINT "WalletTemplate_pkey" PRIMARY KEY ("name")
);

INSERT INTO "WalletTemplate" (name, "sendProtocols", "recvProtocols") VALUES
    ('ALBY',
        ARRAY['NWC', 'WEBLN']::"WalletSendProtocolName"[],
        ARRAY['NWC', 'LN_ADDR']::"WalletRecvProtocolName"[]),
    ('BLINK',
        ARRAY['BLINK']::"WalletSendProtocolName"[],
        ARRAY['BLINK', 'LN_ADDR']::"WalletRecvProtocolName"[]),
    ('BLIXT',
        ARRAY[]::"WalletSendProtocolName"[],
        ARRAY['LN_ADDR']::"WalletRecvProtocolName"[]),
    ('CASHU_ME',
        ARRAY['NWC']::"WalletSendProtocolName"[],
        ARRAY['LN_ADDR']::"WalletRecvProtocolName"[]),
    ('CLN',
        ARRAY[]::"WalletSendProtocolName"[],
        ARRAY['CLN_REST']::"WalletRecvProtocolName"[]),
    ('COINOS',
        ARRAY['NWC']::"WalletSendProtocolName"[],
        ARRAY['NWC', 'LN_ADDR']::"WalletRecvProtocolName"[]),
    ('FOUNTAIN',
        ARRAY[]::"WalletSendProtocolName"[],
        ARRAY['LN_ADDR']::"WalletRecvProtocolName"[]),
    ('LIFPAY',
        ARRAY['NWC']::"WalletSendProtocolName"[],
        ARRAY['NWC', 'LN_ADDR']::"WalletRecvProtocolName"[]),
    ('LNBITS',
        ARRAY['LNBITS']::"WalletSendProtocolName"[],
        ARRAY['LNBITS']::"WalletRecvProtocolName"[]),
    ('LND',
        ARRAY['LNC']::"WalletSendProtocolName"[],
        ARRAY['LND_GRPC']::"WalletRecvProtocolName"[]),
    ('MINIBITS',
        ARRAY['NWC']::"WalletSendProtocolName"[],
        ARRAY['LN_ADDR']::"WalletRecvProtocolName"[]),
    ('NPUB_CASH',
        ARRAY[]::"WalletSendProtocolName"[],
        ARRAY['LN_ADDR']::"WalletRecvProtocolName"[]),
    ('PHOENIXD',
        ARRAY['PHOENIXD']::"WalletSendProtocolName"[],
        ARRAY['PHOENIXD']::"WalletRecvProtocolName"[]),
    ('PRIMAL',
        ARRAY['NWC']::"WalletSendProtocolName"[],
        ARRAY['NWC', 'LN_ADDR']::"WalletRecvProtocolName"[]),
    ('RIZFUL',
        ARRAY['NWC']::"WalletSendProtocolName"[],
        ARRAY['NWC', 'LN_ADDR']::"WalletRecvProtocolName"[]),
    ('SHOCKWALLET',
        ARRAY[]::"WalletSendProtocolName"[],
        ARRAY['LN_ADDR']::"WalletRecvProtocolName"[]),
    ('SPEED',
        ARRAY[]::"WalletSendProtocolName"[],
        ARRAY['LN_ADDR']::"WalletRecvProtocolName"[]),
    ('STRIKE',
        ARRAY[]::"WalletSendProtocolName"[],
        ARRAY['LN_ADDR']::"WalletRecvProtocolName"[]),
    ('VOLTAGE',
        ARRAY[]::"WalletSendProtocolName"[],
        ARRAY['LN_ADDR']::"WalletRecvProtocolName"[]),
    ('WALLET_OF_SATOSHI',
        ARRAY[]::"WalletSendProtocolName"[],
        ARRAY['LN_ADDR']::"WalletRecvProtocolName"[]),
    ('ZBD',
        ARRAY[]::"WalletSendProtocolName"[],
        ARRAY['LN_ADDR']::"WalletRecvProtocolName"[]),
    ('ZEUS',
        ARRAY[]::"WalletSendProtocolName"[],
        ARRAY['LN_ADDR']::"WalletRecvProtocolName"[]),
    ('NWC',
        ARRAY['NWC']::"WalletSendProtocolName"[],
        ARRAY['NWC']::"WalletRecvProtocolName"[]),
    ('LN_ADDR',
        ARRAY[]::"WalletSendProtocolName"[],
        ARRAY['LN_ADDR']::"WalletRecvProtocolName"[]),
    ('CASH_APP',
        ARRAY[]::"WalletSendProtocolName"[],
        ARRAY['LN_ADDR']::"WalletRecvProtocolName"[]);

ALTER TABLE "Wallet" RENAME TO "WalletV1";
ALTER TABLE "WalletV1" RENAME CONSTRAINT "Wallet_pkey" TO "WalletV1_pkey";
ALTER INDEX "Wallet_userId_idx" RENAME TO "WalletV1_userId_idx";

-- CreateTable
CREATE TABLE "Wallet" (
    "id" SERIAL NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "priority" INTEGER NOT NULL DEFAULT 0,
    "userId" INTEGER NOT NULL,
    "templateName" "WalletName" NOT NULL,

    CONSTRAINT "Wallet_pkey" PRIMARY KEY ("id")
);

-- CreateEnum
CREATE TYPE "WalletProtocolStatus" AS ENUM ('OK', 'WARNING', 'ERROR');

-- CreateTable
CREATE TABLE "WalletProtocol" (
    "id" SERIAL NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "config" JSONB,
    "walletId" INTEGER NOT NULL,
    "send" BOOLEAN NOT NULL,
    "name" "WalletProtocolName" NOT NULL,
    "enabled" BOOLEAN NOT NULL DEFAULT true,
    "status" "WalletProtocolStatus" NOT NULL DEFAULT 'OK',

    CONSTRAINT "WalletProtocol_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "WalletSendNWC" (
    "id" SERIAL NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "protocolId" INTEGER NOT NULL,
    "urlVaultId" INTEGER NOT NULL,

    CONSTRAINT "WalletSendNWC_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "WalletSendLNbits" (
    "id" SERIAL NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "protocolId" INTEGER NOT NULL,
    "url" TEXT NOT NULL,
    "apiKeyVaultId" INTEGER NOT NULL,

    CONSTRAINT "WalletSendLNbits_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "WalletSendPhoenixd" (
    "id" SERIAL NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "protocolId" INTEGER NOT NULL,
    "url" TEXT NOT NULL,
    "apiKeyVaultId" INTEGER NOT NULL,

    CONSTRAINT "WalletSendPhoenixd_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "WalletSendBlink" (
    "id" SERIAL NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "protocolId" INTEGER NOT NULL,
    "currencyVaultId" INTEGER NOT NULL,
    "apiKeyVaultId" INTEGER NOT NULL,

    CONSTRAINT "WalletSendBlink_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "WalletSendWebLN" (
    "id" SERIAL NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "protocolId" INTEGER NOT NULL,

    CONSTRAINT "WalletSendWebLN_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "WalletSendLNC" (
    "id" SERIAL NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "protocolId" INTEGER NOT NULL,
    "pairingPhraseVaultId" INTEGER NOT NULL,
    "localKeyVaultId" INTEGER NOT NULL,
    "remoteKeyVaultId" INTEGER NOT NULL,
    "serverHostVaultId" INTEGER NOT NULL,

    CONSTRAINT "WalletSendLNC_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "WalletRecvNWC" (
    "id" SERIAL NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "protocolId" INTEGER NOT NULL,
    "url" TEXT NOT NULL,

    CONSTRAINT "WalletRecvNWC_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "WalletRecvLNbits" (
    "id" SERIAL NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "protocolId" INTEGER NOT NULL,
    "url" TEXT NOT NULL,
    "apiKey" TEXT NOT NULL,

    CONSTRAINT "WalletRecvLNbits_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "WalletRecvPhoenixd" (
    "id" SERIAL NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "protocolId" INTEGER NOT NULL,
    "url" TEXT NOT NULL,
    "apiKey" TEXT NOT NULL,

    CONSTRAINT "WalletRecvPhoenixd_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "WalletRecvBlink" (
    "id" SERIAL NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "protocolId" INTEGER NOT NULL,
    "currency" TEXT NOT NULL,
    "apiKey" TEXT NOT NULL,

    CONSTRAINT "WalletRecvBlink_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "WalletRecvLightningAddress" (
    "id" SERIAL NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "protocolId" INTEGER NOT NULL,
    "address" TEXT NOT NULL,

    CONSTRAINT "WalletRecvLightningAddress_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "WalletRecvCLNRest" (
    "id" SERIAL NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "protocolId" INTEGER NOT NULL,
    "socket" TEXT NOT NULL,
    "rune" TEXT NOT NULL,
    "cert" TEXT,

    CONSTRAINT "WalletRecvCLNRest_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "WalletRecvLNDGRPC" (
    "id" SERIAL NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "protocolId" INTEGER NOT NULL,
    "socket" TEXT NOT NULL,
    "macaroon" TEXT NOT NULL,
    "cert" TEXT,

    CONSTRAINT "WalletRecvLNDGRPC_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Wallet_userId_idx" ON "Wallet"("userId");

-- CreateIndex
CREATE INDEX "Wallet_templateName_idx" ON "Wallet"("templateName");

-- CreateIndex
CREATE INDEX "WalletProtocol_walletId_idx" ON "WalletProtocol"("walletId");

-- CreateIndex
CREATE UNIQUE INDEX "WalletProtocol_walletId_send_name_key" ON "WalletProtocol"("walletId", "send", "name");

-- CreateIndex
CREATE UNIQUE INDEX "WalletSendNWC_protocolId_key" ON "WalletSendNWC"("protocolId");

-- CreateIndex
CREATE UNIQUE INDEX "WalletSendNWC_urlVaultId_key" ON "WalletSendNWC"("urlVaultId");

-- CreateIndex
CREATE UNIQUE INDEX "WalletSendLNbits_protocolId_key" ON "WalletSendLNbits"("protocolId");

-- CreateIndex
CREATE UNIQUE INDEX "WalletSendLNbits_apiKeyVaultId_key" ON "WalletSendLNbits"("apiKeyVaultId");

-- CreateIndex
CREATE UNIQUE INDEX "WalletSendPhoenixd_protocolId_key" ON "WalletSendPhoenixd"("protocolId");

-- CreateIndex
CREATE UNIQUE INDEX "WalletSendPhoenixd_apiKeyVaultId_key" ON "WalletSendPhoenixd"("apiKeyVaultId");

-- CreateIndex
CREATE UNIQUE INDEX "WalletSendBlink_protocolId_key" ON "WalletSendBlink"("protocolId");

-- CreateIndex
CREATE UNIQUE INDEX "WalletSendBlink_apiKeyVaultId_key" ON "WalletSendBlink"("apiKeyVaultId");

-- CreateIndex
CREATE UNIQUE INDEX "WalletSendBlink_currencyVaultId_key" ON "WalletSendBlink"("currencyVaultId");

-- CreateIndex
CREATE UNIQUE INDEX "WalletSendWebLN_protocolId_key" ON "WalletSendWebLN"("protocolId");

-- CreateIndex
CREATE UNIQUE INDEX "WalletSendLNC_protocolId_key" ON "WalletSendLNC"("protocolId");

-- CreateIndex
CREATE UNIQUE INDEX "WalletSendLNC_pairingPhraseVaultId_key" ON "WalletSendLNC"("pairingPhraseVaultId");

-- CreateIndex
CREATE UNIQUE INDEX "WalletSendLNC_localKeyVaultId_key" ON "WalletSendLNC"("localKeyVaultId");

-- CreateIndex
CREATE UNIQUE INDEX "WalletSendLNC_remoteKeyVaultId_key" ON "WalletSendLNC"("remoteKeyVaultId");

-- CreateIndex
CREATE UNIQUE INDEX "WalletSendLNC_serverHostVaultId_key" ON "WalletSendLNC"("serverHostVaultId");

-- CreateIndex
CREATE UNIQUE INDEX "WalletRecvNWC_protocolId_key" ON "WalletRecvNWC"("protocolId");

-- CreateIndex
CREATE UNIQUE INDEX "WalletRecvLNbits_protocolId_key" ON "WalletRecvLNbits"("protocolId");

-- CreateIndex
CREATE UNIQUE INDEX "WalletRecvPhoenixd_protocolId_key" ON "WalletRecvPhoenixd"("protocolId");

-- CreateIndex
CREATE UNIQUE INDEX "WalletRecvBlink_protocolId_key" ON "WalletRecvBlink"("protocolId");

-- CreateIndex
CREATE UNIQUE INDEX "WalletRecvLightningAddress_protocolId_key" ON "WalletRecvLightningAddress"("protocolId");

-- CreateIndex
CREATE UNIQUE INDEX "WalletRecvCLNRest_protocolId_key" ON "WalletRecvCLNRest"("protocolId");

-- CreateIndex
CREATE UNIQUE INDEX "WalletRecvLNDGRPC_protocolId_key" ON "WalletRecvLNDGRPC"("protocolId");

-- AddForeignKey
ALTER TABLE "WalletProtocol" ADD CONSTRAINT "WalletProtocol_walletId_fkey" FOREIGN KEY ("walletId") REFERENCES "Wallet"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WalletSendNWC" ADD CONSTRAINT "WalletSendNWC_protocolId_fkey" FOREIGN KEY ("protocolId") REFERENCES "WalletProtocol"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WalletSendNWC" ADD CONSTRAINT "WalletSendNWC_urlVaultId_fkey" FOREIGN KEY ("urlVaultId") REFERENCES "Vault"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WalletSendLNbits" ADD CONSTRAINT "WalletSendLNbits_protocolId_fkey" FOREIGN KEY ("protocolId") REFERENCES "WalletProtocol"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WalletSendLNbits" ADD CONSTRAINT "WalletSendLNbits_apiKeyVaultId_fkey" FOREIGN KEY ("apiKeyVaultId") REFERENCES "Vault"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WalletSendPhoenixd" ADD CONSTRAINT "WalletSendPhoenixd_protocolId_fkey" FOREIGN KEY ("protocolId") REFERENCES "WalletProtocol"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WalletSendPhoenixd" ADD CONSTRAINT "WalletSendPhoenixd_apiKeyVaultId_fkey" FOREIGN KEY ("apiKeyVaultId") REFERENCES "Vault"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WalletSendBlink" ADD CONSTRAINT "WalletSendBlink_protocolId_fkey" FOREIGN KEY ("protocolId") REFERENCES "WalletProtocol"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WalletSendBlink" ADD CONSTRAINT "WalletSendBlink_currencyVaultId_fkey" FOREIGN KEY ("currencyVaultId") REFERENCES "Vault"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WalletSendBlink" ADD CONSTRAINT "WalletSendBlink_apiKeyVaultId_fkey" FOREIGN KEY ("apiKeyVaultId") REFERENCES "Vault"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WalletSendWebLN" ADD CONSTRAINT "WalletSendWebLN_protocolId_fkey" FOREIGN KEY ("protocolId") REFERENCES "WalletProtocol"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WalletSendLNC" ADD CONSTRAINT "WalletSendLNC_protocolId_fkey" FOREIGN KEY ("protocolId") REFERENCES "WalletProtocol"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WalletSendLNC" ADD CONSTRAINT "WalletSendLNC_pairingPhraseVaultId_fkey" FOREIGN KEY ("pairingPhraseVaultId") REFERENCES "Vault"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WalletSendLNC" ADD CONSTRAINT "WalletSendLNC_localKeyVaultId_fkey" FOREIGN KEY ("localKeyVaultId") REFERENCES "Vault"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WalletSendLNC" ADD CONSTRAINT "WalletSendLNC_remoteKeyVaultId_fkey" FOREIGN KEY ("remoteKeyVaultId") REFERENCES "Vault"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WalletSendLNC" ADD CONSTRAINT "WalletSendLNC_serverHostVaultId_fkey" FOREIGN KEY ("serverHostVaultId") REFERENCES "Vault"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WalletRecvNWC" ADD CONSTRAINT "WalletRecvNWC_protocolId_fkey" FOREIGN KEY ("protocolId") REFERENCES "WalletProtocol"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WalletRecvLNbits" ADD CONSTRAINT "WalletRecvLNbits_protocolId_fkey" FOREIGN KEY ("protocolId") REFERENCES "WalletProtocol"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WalletRecvPhoenixd" ADD CONSTRAINT "WalletRecvPhoenixd_protocolId_fkey" FOREIGN KEY ("protocolId") REFERENCES "WalletProtocol"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WalletRecvBlink" ADD CONSTRAINT "WalletRecvBlink_protocolId_fkey" FOREIGN KEY ("protocolId") REFERENCES "WalletProtocol"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WalletRecvLightningAddress" ADD CONSTRAINT "WalletRecvLightningAddress_protocolId_fkey" FOREIGN KEY ("protocolId") REFERENCES "WalletProtocol"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WalletRecvCLNRest" ADD CONSTRAINT "WalletRecvCLNRest_protocolId_fkey" FOREIGN KEY ("protocolId") REFERENCES "WalletProtocol"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WalletRecvLNDGRPC" ADD CONSTRAINT "WalletRecvLNDGRPC_protocolId_fkey" FOREIGN KEY ("protocolId") REFERENCES "WalletProtocol"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Wallet" ADD CONSTRAINT "Wallet_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Wallet" ADD CONSTRAINT "Wallet_templateName_fkey" FOREIGN KEY ("templateName") REFERENCES "WalletTemplate"("name") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE OR REPLACE FUNCTION wallet_check_support()
RETURNS TRIGGER AS $$
DECLARE
    template "WalletTemplate";
BEGIN
    SELECT t.* INTO template
    FROM "Wallet" w
    JOIN "WalletTemplate" t ON w."templateName" = t.name
    WHERE w.id = NEW."walletId";

    IF NEW."send" THEN
        IF NOT NEW."name"::text::"WalletSendProtocolName" = ANY(template."sendProtocols") THEN
            RAISE EXCEPTION 'Wallet % does not support send protocol %', template.name, NEW."name";
        END IF;
    ELSE
        IF NOT NEW."name"::text::"WalletRecvProtocolName" = ANY(template."recvProtocols") THEN
            RAISE EXCEPTION 'Wallet % does not support receive protocol %', template.name, NEW."name";
        END IF;
    END IF;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE CONSTRAINT TRIGGER wallet_check_support
    AFTER INSERT OR UPDATE ON "WalletProtocol"
    FOR EACH ROW
    EXECUTE FUNCTION wallet_check_support();

CREATE OR REPLACE FUNCTION wallet_to_jsonb()
RETURNS TRIGGER AS $$
DECLARE
    wallet jsonb;
    vault jsonb;
    col_name text;
    vault_id int;
    base_name text;
BEGIN
    wallet := to_jsonb(NEW);

    FOR col_name IN
        SELECT key::text
        FROM jsonb_each(wallet)
        WHERE key::text LIKE '%VaultId'
    LOOP
        vault_id := (wallet->>col_name)::int;
        -- remove 'VaultId' suffix
        base_name := substring(col_name from 1 for length(col_name)-7);

        SELECT jsonb_build_object('id', v.id, 'iv', v.iv, 'value', v.value) INTO vault
        FROM "Vault" v
        WHERE v.id = vault_id;

        IF vault IS NOT NULL THEN
            wallet := jsonb_set(wallet, array[base_name], vault) - col_name;
        END IF;
    END LOOP;

    UPDATE "WalletProtocol"
    SET
        config = wallet,
        updated_at = NOW()
    WHERE id = NEW."protocolId";

    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER wallet_to_jsonb
    AFTER INSERT OR UPDATE ON "WalletSendNWC"
    FOR EACH ROW
    EXECUTE PROCEDURE wallet_to_jsonb();

CREATE TRIGGER wallet_to_jsonb
    AFTER INSERT OR UPDATE ON "WalletSendLNbits"
    FOR EACH ROW
    EXECUTE PROCEDURE wallet_to_jsonb();

CREATE TRIGGER wallet_to_jsonb
    AFTER INSERT OR UPDATE ON "WalletSendPhoenixd"
    FOR EACH ROW
    EXECUTE PROCEDURE wallet_to_jsonb();

CREATE TRIGGER wallet_to_jsonb
    AFTER INSERT OR UPDATE ON "WalletSendBlink"
    FOR EACH ROW
    EXECUTE PROCEDURE wallet_to_jsonb();

CREATE TRIGGER wallet_to_jsonb
    AFTER INSERT OR UPDATE ON "WalletSendWebLN"
    FOR EACH ROW
    EXECUTE PROCEDURE wallet_to_jsonb();

CREATE TRIGGER wallet_to_jsonb
    AFTER INSERT OR UPDATE ON "WalletSendLNC"
    FOR EACH ROW
    EXECUTE PROCEDURE wallet_to_jsonb();

CREATE TRIGGER wallet_to_jsonb
    AFTER INSERT OR UPDATE ON "WalletRecvNWC"
    FOR EACH ROW
    EXECUTE PROCEDURE wallet_to_jsonb();

CREATE TRIGGER wallet_to_jsonb
    AFTER INSERT OR UPDATE ON "WalletRecvLNbits"
    FOR EACH ROW
    EXECUTE PROCEDURE wallet_to_jsonb();

CREATE TRIGGER wallet_to_jsonb
    AFTER INSERT OR UPDATE ON "WalletRecvPhoenixd"
    FOR EACH ROW
    EXECUTE PROCEDURE wallet_to_jsonb();

CREATE TRIGGER wallet_to_jsonb
    AFTER INSERT OR UPDATE ON "WalletRecvBlink"
    FOR EACH ROW
    EXECUTE PROCEDURE wallet_to_jsonb();

CREATE TRIGGER wallet_to_jsonb
    AFTER INSERT OR UPDATE ON "WalletRecvLightningAddress"
    FOR EACH ROW
    EXECUTE PROCEDURE wallet_to_jsonb();

CREATE TRIGGER wallet_to_jsonb
    AFTER INSERT OR UPDATE ON "WalletRecvCLNRest"
    FOR EACH ROW
    EXECUTE PROCEDURE wallet_to_jsonb();

CREATE TRIGGER wallet_to_jsonb
    AFTER INSERT OR UPDATE ON "WalletRecvLNDGRPC"
    FOR EACH ROW
    EXECUTE PROCEDURE wallet_to_jsonb();

CREATE OR REPLACE FUNCTION wallet_clear_vault()
RETURNS TRIGGER AS $$
DECLARE
    wallet jsonb;
    col_name text;
    vault_id int;
BEGIN
    wallet := to_jsonb(OLD);

    FOR col_name IN
        SELECT key::text
        FROM jsonb_each(wallet)
        WHERE key::text LIKE '%VaultId'
    LOOP
        vault_id := (wallet->>col_name)::int;
        DELETE FROM "Vault" WHERE id = vault_id;
    END LOOP;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER wallet_clear_vault
    AFTER DELETE ON "WalletSendNWC"
    FOR EACH ROW
    EXECUTE PROCEDURE wallet_clear_vault();

CREATE TRIGGER wallet_clear_vault
    AFTER DELETE ON "WalletSendLNbits"
    FOR EACH ROW
    EXECUTE PROCEDURE wallet_clear_vault();

CREATE TRIGGER wallet_clear_vault
    AFTER DELETE ON "WalletSendPhoenixd"
    FOR EACH ROW
    EXECUTE PROCEDURE wallet_clear_vault();

CREATE TRIGGER wallet_clear_vault
    AFTER DELETE ON "WalletSendBlink"
    FOR EACH ROW
    EXECUTE PROCEDURE wallet_clear_vault();

CREATE TRIGGER wallet_clear_vault
    AFTER DELETE ON "WalletSendWebLN"
    FOR EACH ROW
    EXECUTE PROCEDURE wallet_clear_vault();

CREATE TRIGGER wallet_clear_vault
    AFTER DELETE ON "WalletSendLNC"
    FOR EACH ROW
    EXECUTE PROCEDURE wallet_clear_vault();

CREATE OR REPLACE FUNCTION wallet_updated_at_trigger() RETURNS TRIGGER AS $$
DECLARE
    user_id INT;
BEGIN
    IF TG_TABLE_NAME = 'WalletProtocol' THEN
        SELECT w."userId" INTO user_id
        FROM "Wallet" w
        WHERE w.id = CASE
            WHEN TG_OP = 'DELETE' THEN OLD."walletId"
            ELSE NEW."walletId"
        END;
    ELSE
        SELECT w."userId" INTO user_id
        FROM "Wallet" w
        WHERE w.id = NEW.id;
    END IF;

    UPDATE "users" u
    SET "walletsUpdatedAt" = NOW()
    WHERE u.id = user_id;

    RETURN NULL;
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE TRIGGER wallet_updated_at_trigger
AFTER INSERT OR UPDATE OR DELETE ON "WalletProtocol"
FOR EACH ROW EXECUTE PROCEDURE wallet_updated_at_trigger();

CREATE OR REPLACE TRIGGER wallet_updated_at_trigger
AFTER INSERT OR UPDATE OR DELETE ON "Wallet"
FOR EACH ROW EXECUTE PROCEDURE wallet_updated_at_trigger();

CREATE OR REPLACE FUNCTION user_auto_withdraw() RETURNS TRIGGER AS $$
DECLARE
BEGIN
    INSERT INTO pgboss.job (name, data)
    SELECT 'autoWithdraw', jsonb_build_object('id', NEW.id)
    -- only if there isn't already a pending job for this user
    WHERE NOT EXISTS (
        SELECT *
        FROM pgboss.job
        WHERE name = 'autoWithdraw'
        AND data->>'id' = NEW.id::TEXT
        AND state = 'created'
    )
    AND EXISTS (
        SELECT *
        FROM "Wallet" w
        JOIN "WalletProtocol" wp ON w.id = wp."walletId"
        WHERE w."userId" = NEW.id
        AND wp."enabled" = true
        AND wp.send = false
    );
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION get_or_create_wallet(
    user_id INT,
    template_name "WalletName",
    priority INT
)
RETURNS INT AS
$$
DECLARE
    walletId INT;
BEGIN
    SELECT w.id INTO walletId
    FROM "Wallet" w
    WHERE w."userId" = user_id AND w."templateName" = template_name;

    IF NOT FOUND THEN
        walletId := create_wallet(user_id, template_name, priority);
    END IF;

    RETURN walletId;
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION create_wallet(
    user_id INT,
    template_name "WalletName",
    priority INT
)
RETURNS INT AS
$$
DECLARE
    walletId INT;
BEGIN
    INSERT INTO "Wallet" ("userId", "templateName", "priority")
    SELECT user_id, template_name, priority
    FROM "WalletTemplate" t
    WHERE t.name = template_name
    RETURNING id INTO walletId;

    RETURN walletId;
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION create_wallet_protocol(
    id INT,
    wallet_id INT,
    send BOOLEAN,
    protocol_name "WalletProtocolName",
    enabled BOOLEAN
)
RETURNS INT AS
$$
DECLARE
    protocolId INT;
BEGIN
    INSERT INTO "WalletProtocol" ("id", "walletId", "send", "name", "enabled")
    VALUES (CASE WHEN send THEN nextval('"WalletProtocol_id_seq"') ELSE id END, wallet_id, send, protocol_name, enabled)
    RETURNING "WalletProtocol"."id" INTO protocolId;

    RETURN protocolId;
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION wallet_v2_migration()
RETURNS void AS
$$
DECLARE
    row RECORD;
BEGIN
    -- In the old wallet schema, send and receive were stored in the same table that linked to a row in the Wallet table.
    -- Foreign keys in other tables pointed to that row in the Wallet table.
    -- In the new schema, send and receive are stored in separate tables and they point to individual rows in the WalletProtocol table.
    -- Therefore, to be able to point the foreign keys to the new WalletProtocol table, we need to keep the same id, but only for the receive wallets
    -- because that's what the foreign keys were pointing to in the old schema.
    -- To avoid generating an id via the sequence that we already inserted manually, we let the sequence start at the highest Wallet id of the old schema.
    PERFORM setval('"WalletProtocol_id_seq"', (SELECT MAX(id) FROM "WalletV1"));

    FOR row IN
        SELECT w1.*, w2."userId", w2."priority", w2."enabled"
        FROM "WalletLNbits" w1
        JOIN "WalletV1" w2 ON w1."walletId" = w2.id
    LOOP
        DECLARE
            walletId INT;
            protocolId INT;
        BEGIN
            walletId := get_or_create_wallet(row."userId", 'LNBITS', row."priority");

            IF row."adminKeyId" IS NOT NULL THEN
                protocolId := create_wallet_protocol(row."walletId", walletId, true, 'LNBITS', row."enabled");
                INSERT INTO "WalletSendLNbits" ("protocolId", "url", "apiKeyVaultId")
                VALUES (protocolId, row."url", row."adminKeyId");
            END IF;

            IF NULLIF(row."invoiceKey", '') IS NOT NULL THEN
                protocolId := create_wallet_protocol(row."walletId", walletId, false, 'LNBITS', row."enabled");
                INSERT INTO "WalletRecvLNbits" ("protocolId", "url", "apiKey")
                VALUES (protocolId, row."url", row."invoiceKey");
            END IF;
        END;
    END LOOP;

    FOR row IN
        SELECT w1.*, w2."userId", w2."userId", w2."priority", w2."enabled"
        FROM "WalletPhoenixd" w1
        JOIN "WalletV1" w2 ON w1."walletId" = w2.id
    LOOP
        DECLARE
            walletId INT;
            protocolId INT;
        BEGIN
            walletId := get_or_create_wallet(row."userId", 'PHOENIXD', row."priority");

            IF row."primaryPasswordId" IS NOT NULL THEN
                protocolId := create_wallet_protocol(row."walletId", walletId, true, 'PHOENIXD', row."enabled");
                INSERT INTO "WalletSendPhoenixd" ("protocolId", "url", "apiKeyVaultId")
                VALUES (protocolId, row."url", row."primaryPasswordId");
            END IF;

            IF NULLIF(row."secondaryPassword", '') IS NOT NULL THEN
                protocolId := create_wallet_protocol(row."walletId", walletId, false, 'PHOENIXD', row."enabled");
                INSERT INTO "WalletRecvPhoenixd" ("protocolId", "url", "apiKey")
                VALUES (protocolId, row."url", row."secondaryPassword");
            END IF;
        END;
    END LOOP;

    FOR row IN
        SELECT w1.*, w2."userId", w2."userId", w2."priority", w2."enabled"
        FROM "WalletBlink" w1
        JOIN "WalletV1" w2 ON w1."walletId" = w2.id
    LOOP
        DECLARE
            walletId INT;
            protocolId INT;
        BEGIN
            walletId := get_or_create_wallet(row."userId", 'BLINK', row."priority");

            IF row."apiKeyId" IS NOT NULL AND row."currencyId" IS NOT NULL THEN
                protocolId := create_wallet_protocol(row."walletId", walletId, true, 'BLINK', row."enabled");
                INSERT INTO "WalletSendBlink" ("protocolId", "apiKeyVaultId", "currencyVaultId")
                VALUES (protocolId, row."apiKeyId", row."currencyId");
            END IF;

            IF NULLIF(row."apiKeyRecv", '') IS NOT NULL AND NULLIF(row."currencyRecv", '') IS NOT NULL THEN
                protocolId := create_wallet_protocol(row."walletId", walletId, false, 'BLINK', row."enabled");
                INSERT INTO "WalletRecvBlink" ("protocolId", "apiKey", "currency")
                VALUES (protocolId, row."apiKeyRecv", row."currencyRecv");
            END IF;
        END;
    END LOOP;

    FOR row IN
        SELECT w1.*, w2."userId", w2."userId", w2."priority", w2."enabled"
        FROM "WalletLND" w1
        JOIN "WalletV1" w2 ON w1."walletId" = w2.id
    LOOP
        DECLARE
            walletId INT;
            protocolId INT;
        BEGIN
            walletId := get_or_create_wallet(row."userId", 'LND', row."priority");

            protocolId := create_wallet_protocol(row."walletId", walletId, false, 'LND_GRPC', row."enabled");
            INSERT INTO "WalletRecvLNDGRPC" ("protocolId", "socket", "macaroon", "cert")
            VALUES (protocolId, row."socket", row."macaroon", row."cert");
        END;
    END LOOP;

    FOR row IN
        SELECT w1.*, w2."userId", w2."userId", w2."priority", w2."enabled"
        FROM "WalletLNC" w1
        JOIN "WalletV1" w2 ON w1."walletId" = w2.id
    LOOP
        DECLARE
            walletId INT;
            protocolId INT;
        BEGIN
            walletId := get_or_create_wallet(row."userId", 'LND', row."priority");

            protocolId := create_wallet_protocol(row."walletId", walletId, true, 'LNC', row."enabled");
            INSERT INTO "WalletSendLNC" ("protocolId", "pairingPhraseVaultId", "localKeyVaultId", "remoteKeyVaultId", "serverHostVaultId")
            VALUES (protocolId, row."pairingPhraseId", row."localKeyId", row."remoteKeyId", row."serverHostId");
        END;
    END LOOP;

    FOR row IN
        SELECT w1.*, w2."userId", w2."userId", w2."priority", w2."enabled"
        FROM "WalletCLN" w1
        JOIN "WalletV1" w2 ON w1."walletId" = w2.id
    LOOP
        DECLARE
            walletId INT;
            protocolId INT;
        BEGIN
            walletId := get_or_create_wallet(row."userId", 'CLN', row."priority");

            protocolId := create_wallet_protocol(row."walletId", walletId, false, 'CLN_REST', row."enabled");
            INSERT INTO "WalletRecvCLNRest" ("protocolId", "socket", "rune", "cert")
            VALUES (protocolId, row."socket", row."rune", row."cert");
        END;
    END LOOP;

    FOR row IN
        SELECT w1.*, w2."userId", w2."userId", w2."priority", w2."enabled"
        FROM "WalletNWC" w1
        JOIN "WalletV1" w2 ON w1."walletId" = w2.id
    LOOP
        DECLARE
            walletId INT;
            protocolId INT;
            relay TEXT;
            walletName "WalletName";
        BEGIN
            relay := substring(row."nwcUrlRecv" from 'relay=([^&]+)');

            IF relay LIKE '%getalby.com%' THEN
                walletName := 'ALBY';
            ELSIF relay LIKE '%rizful.com%' THEN
                walletName := 'RIZFUL';
            ELSIF relay LIKE '%primal.net%' THEN
                walletName := 'PRIMAL';
            ELSIF relay LIKE '%coinos.io%' THEN
                walletName := 'COINOS';
            ELSE
                walletName := 'NWC';
            END IF;

            walletId := get_or_create_wallet(row."userId", walletName, row."priority");

            -- we assume here that the wallet to receive is the same as the wallet to send
            -- since we can't check which relay is used for the send connection because it's encrypted.
            -- but in 99% if not 100% of the cases, it's the same wallet.
            IF NULLIF(row."nwcUrlRecv", '') IS NOT NULL THEN
                protocolId := create_wallet_protocol(row."walletId", walletId, false, 'NWC', row."enabled");
                INSERT INTO "WalletRecvNWC" ("protocolId", "url")
                VALUES (protocolId, row."nwcUrlRecv");
            END IF;

            IF row."nwcUrlId" IS NOT NULL THEN
                protocolId := create_wallet_protocol(row."walletId", walletId, true, 'NWC', row."enabled");
                INSERT INTO "WalletSendNWC" ("protocolId", "urlVaultId")
                VALUES (protocolId, row."nwcUrlId");
            END IF;
        END;
    END LOOP;

    FOR row IN
        SELECT w1.*, w2."userId", w2."userId", w2."priority", w2."enabled"
        FROM "WalletLightningAddress" w1
        JOIN "WalletV1" w2 ON w1."walletId" = w2.id
    LOOP
        DECLARE
            walletId INT;
            protocolId INT;
            domain TEXT;
            walletName "WalletName";
        BEGIN
            domain := split_part(row."address", '@', 2);

            IF domain LIKE '%walletofsatoshi.com' THEN
                walletName := 'WALLET_OF_SATOSHI';
            ELSIF domain LIKE '%getalby.com' THEN
                walletName := 'ALBY';
            ELSIF domain LIKE '%coinos.io' THEN
                walletName := 'COINOS';
            ELSIF domain LIKE '%speed.app' OR domain LIKE '%tryspeed.com' THEN
                walletName := 'SPEED';
            ELSIF domain LIKE '%blink.sv' THEN
                walletName := 'BLINK';
            ELSIF domain LIKE '%zbd.gg' THEN
                walletName := 'ZBD';
            ELSIF domain LIKE '%strike.me' THEN
                walletName := 'STRIKE';
            ELSIF domain LIKE '%primal.net' THEN
                walletName := 'PRIMAL';
            ELSIF domain LIKE '%minibits.cash' THEN
                walletName := 'MINIBITS';
            ELSIF domain LIKE '%npub.cash' THEN
                walletName := 'NPUB_CASH';
            ELSIF domain LIKE '%zeuspay.com' THEN
                walletName := 'ZEUS';
            ELSIF domain LIKE '%fountain.fm' THEN
                walletName := 'FOUNTAIN';
            ELSIF domain LIKE '%lifpay.me' THEN
                walletName := 'LIFPAY';
            ELSIF domain LIKE '%rizful.com' THEN
                walletName := 'RIZFUL';
            ELSIF domain LIKE '%vlt.ge' THEN
                walletName := 'VOLTAGE';
            ELSIF domain LIKE '%blixtwallet.com' THEN
                walletName := 'BLIXT';
            ELSIF domain LIKE '%shockwallet.app' THEN
                walletName := 'SHOCKWALLET';
            ELSE
                walletName := 'LN_ADDR';
            END IF;

            walletId := get_or_create_wallet(row."userId", walletName, row."priority");

            protocolId := create_wallet_protocol(row."walletId", walletId, false, 'LN_ADDR', row."enabled");
            INSERT INTO "WalletRecvLightningAddress" ("protocolId", "address")
            VALUES (protocolId, row."address");
        END;
    END LOOP;

    FOR row IN
        SELECT w1.*, w2."userId", w2."userId", w2."priority", w2."enabled"
        FROM "WalletWebLN" w1
        JOIN "WalletV1" w2 ON w1."walletId" = w2.id
    LOOP
        DECLARE
            walletId INT;
            protocolId INT;
        BEGIN
            walletId := get_or_create_wallet(row."userId", 'ALBY', row."priority");

            protocolId := create_wallet_protocol(row."walletId", walletId, true, 'WEBLN', row."enabled");
            INSERT INTO "WalletSendWebLN" ("protocolId")
            VALUES (protocolId);
        END;
    END LOOP;
END;
$$ LANGUAGE plpgsql;

SELECT wallet_v2_migration();

DROP FUNCTION wallet_v2_migration();
DROP FUNCTION get_or_create_wallet(INT, "WalletName", INT);
DROP FUNCTION create_wallet(INT, "WalletName", INT);
DROP FUNCTION create_wallet_protocol(INT, INT, BOOLEAN, "WalletProtocolName", BOOLEAN);

-- drop old tables
DROP TABLE "WalletBlink";
DROP TABLE "WalletCLN";
DROP TABLE "WalletLNC";
DROP TABLE "WalletLND";
DROP TABLE "WalletLNbits";
DROP TABLE "WalletLightningAddress";
DROP TABLE "WalletNWC";
DROP TABLE "WalletPhoenixd";
DROP TABLE "WalletWebLN";

-- update foreign keys
ALTER TABLE "Withdrawl" DROP CONSTRAINT "Withdrawl_walletId_fkey";
ALTER TABLE "Withdrawl" RENAME COLUMN "walletId" TO "protocolId";
ALTER TABLE "Withdrawl" ADD CONSTRAINT "Withdrawl_protocolId_fkey" FOREIGN KEY ("protocolId") REFERENCES "WalletProtocol"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER INDEX "Withdrawl_walletId_idx" RENAME TO "Withdrawl_protocolId_idx";

ALTER TABLE "DirectPayment" DROP CONSTRAINT "DirectPayment_walletId_fkey";
ALTER TABLE "DirectPayment" RENAME COLUMN "walletId" TO "protocolId";
ALTER TABLE "DirectPayment" ADD CONSTRAINT "DirectPayment_protocolId_fkey" FOREIGN KEY ("protocolId") REFERENCES "WalletProtocol"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "InvoiceForward" DROP CONSTRAINT "InvoiceForward_walletId_fkey";
ALTER TABLE "InvoiceForward" RENAME COLUMN "walletId" TO "protocolId";
ALTER TABLE "InvoiceForward" ADD CONSTRAINT "InvoiceForward_protocolId_fkey" FOREIGN KEY ("protocolId") REFERENCES "WalletProtocol"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER INDEX "InvoiceForward_walletId_idx" RENAME TO "InvoiceForward_protocolId_idx";

-- now drop Wallet table because nothing points to it anymore
DROP TABLE "WalletV1";

-- drop old function used for the JSON trigger
DROP FUNCTION wallet_wallet_type_as_jsonb;

-- wallet logs now point to the new WalletProtocol table instead of to the old WalletType enum
ALTER TABLE "WalletLog"
    DROP COLUMN "wallet",
    ADD COLUMN "protocolId" INTEGER;

DROP TYPE "WalletType";
ALTER TABLE "WalletLog" ADD CONSTRAINT "WalletLog_protocolId_fkey" FOREIGN KEY ("protocolId") REFERENCES "WalletProtocol"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AlterTable
ALTER TABLE "users" ADD COLUMN     "showPassphrase" BOOLEAN NOT NULL DEFAULT true;

-- Update LogLevel enum to be more consistent with wallet logger API
ALTER TYPE "LogLevel" RENAME TO "LogLevelV1";
CREATE TYPE "LogLevel" AS ENUM ('OK', 'DEBUG', 'INFO', 'WARNING', 'ERROR');
ALTER TABLE "WalletLog" ALTER COLUMN "level" TYPE "LogLevel" USING (CASE WHEN "level"::text = 'SUCCESS' THEN 'OK'::"LogLevel" WHEN "level"::text = 'WARN' THEN 'WARNING'::"LogLevel" ELSE "level"::text::"LogLevel" END);
ALTER TABLE "Log" ALTER COLUMN "level" TYPE "LogLevel" USING (CASE WHEN "level"::text = 'SUCCESS' THEN 'OK'::"LogLevel" WHEN "level"::text = 'WARN' THEN 'WARNING'::"LogLevel" ELSE "level"::text::"LogLevel" END);
DROP TYPE "LogLevelV1";
