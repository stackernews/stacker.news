-- CreateEnum
CREATE TYPE "WalletProtocol" AS ENUM ('NWC', 'LNBITS', 'PHOENIXD', 'BLINK', 'WEBLN', 'LN_ADDR', 'LNC', 'CLN_REST', 'LND_GRPC');

-- CreateEnum
CREATE TYPE "WalletSendProtocol" AS ENUM ('NWC', 'LNBITS', 'PHOENIXD', 'BLINK', 'WEBLN', 'LNC');

-- CreateEnum
CREATE TYPE "WalletRecvProtocol" AS ENUM ('NWC', 'LNBITS', 'PHOENIXD', 'BLINK', 'LN_ADDR', 'CLN_REST', 'LND_GRPC');

-- CreateTable
CREATE TABLE "WalletTemplate" (
    "id" SERIAL NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "name" TEXT NOT NULL,
    "image" TEXT,
    "description" TEXT,
    "sendProtocols" "WalletSendProtocol"[],
    "recvProtocols" "WalletRecvProtocol"[],

    CONSTRAINT "WalletTemplate_pkey" PRIMARY KEY ("id")
);

INSERT INTO "WalletTemplate" (name, "sendProtocols", "recvProtocols") VALUES
    ('ALBY_BROWSER_EXTENSION',
        ARRAY['WEBLN']::"WalletSendProtocol"[],
        ARRAY[]::"WalletRecvProtocol"[]),
    ('ALBY_HUB',
        ARRAY['NWC']::"WalletSendProtocol"[],
        ARRAY['NWC', 'LN_ADDR']::"WalletRecvProtocol"[]),
    ('BLINK',
        ARRAY['BLINK']::"WalletSendProtocol"[],
        ARRAY['BLINK', 'LN_ADDR']::"WalletRecvProtocol"[]),
    ('BLIXT',
        ARRAY[]::"WalletSendProtocol"[],
        ARRAY['LN_ADDR']::"WalletRecvProtocol"[]),
    ('CASHU.ME',
        ARRAY['NWC']::"WalletSendProtocol"[],
        ARRAY['LN_ADDR']::"WalletRecvProtocol"[]),
    ('CLN',
        ARRAY[]::"WalletSendProtocol"[],
        ARRAY['CLN_REST']::"WalletRecvProtocol"[]),
    ('COINOS',
        ARRAY['NWC']::"WalletSendProtocol"[],
        ARRAY['NWC', 'LN_ADDR']::"WalletRecvProtocol"[]),
    ('CUSTOM',
        ARRAY['NWC']::"WalletSendProtocol"[],
        ARRAY['NWC', 'LN_ADDR']::"WalletRecvProtocol"[]),
    ('FOUNTAIN',
        ARRAY[]::"WalletSendProtocol"[],
        ARRAY['LN_ADDR']::"WalletRecvProtocol"[]),
    ('LIFPAY',
        ARRAY['NWC']::"WalletSendProtocol"[],
        ARRAY['NWC', 'LN_ADDR']::"WalletRecvProtocol"[]),
    ('LNBITS',
        ARRAY['LNBITS']::"WalletSendProtocol"[],
        ARRAY['LNBITS']::"WalletRecvProtocol"[]),
    ('LND',
        ARRAY['LNC']::"WalletSendProtocol"[],
        ARRAY['LND_GRPC']::"WalletRecvProtocol"[]),
    ('MINIBITS',
        ARRAY['NWC']::"WalletSendProtocol"[],
        ARRAY['LN_ADDR']::"WalletRecvProtocol"[]),
    ('NPUB.CASH',
        ARRAY[]::"WalletSendProtocol"[],
        ARRAY['LN_ADDR']::"WalletRecvProtocol"[]),
    ('PHOENIXD',
        ARRAY['PHOENIXD']::"WalletSendProtocol"[],
        ARRAY['PHOENIXD']::"WalletRecvProtocol"[]),
    ('PRIMAL',
        ARRAY['NWC']::"WalletSendProtocol"[],
        ARRAY['LN_ADDR']::"WalletRecvProtocol"[]),
    ('RIZFUL',
        ARRAY['NWC']::"WalletSendProtocol"[],
        ARRAY['NWC', 'LN_ADDR']::"WalletRecvProtocol"[]),
    ('SHOCKWALLET',
        ARRAY[]::"WalletSendProtocol"[],
        ARRAY['LN_ADDR']::"WalletRecvProtocol"[]),
    ('SPEED',
        ARRAY[]::"WalletSendProtocol"[],
        ARRAY['LN_ADDR']::"WalletRecvProtocol"[]),
    ('STRIKE',
        ARRAY[]::"WalletSendProtocol"[],
        ARRAY['LN_ADDR']::"WalletRecvProtocol"[]),
    ('VOLTAGE',
        ARRAY[]::"WalletSendProtocol"[],
        ARRAY['LN_ADDR']::"WalletRecvProtocol"[]),
    ('WALLET_OF_SATOSHI',
        ARRAY[]::"WalletSendProtocol"[],
        ARRAY['LN_ADDR']::"WalletRecvProtocol"[]),
    ('ZBD',
        ARRAY[]::"WalletSendProtocol"[],
        ARRAY['LN_ADDR']::"WalletRecvProtocol"[]),
    ('ZEUS',
        ARRAY[]::"WalletSendProtocol"[],
        ARRAY['LN_ADDR']::"WalletRecvProtocol"[]);

-- CreateTable
CREATE TABLE "UserWallet" (
    "id" SERIAL NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "enabled" BOOLEAN NOT NULL DEFAULT true,
    "priority" INTEGER NOT NULL DEFAULT 0,
    "userId" INTEGER NOT NULL,
    "templateId" INTEGER NOT NULL,

    CONSTRAINT "UserWallet_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ProtocolWallet" (
    "id" SERIAL NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "json" JSONB,
    "walletId" INTEGER NOT NULL,
    "send" BOOLEAN NOT NULL,
    "protocol" "WalletProtocol" NOT NULL,

    CONSTRAINT "ProtocolWallet_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "WalletSendNWC" (
    "id" SERIAL NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "walletId" INTEGER NOT NULL,
    "urlVaultId" INTEGER NOT NULL,

    CONSTRAINT "WalletSendNWC_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "WalletSendLNbits" (
    "id" SERIAL NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "walletId" INTEGER NOT NULL,
    "url" TEXT NOT NULL,
    "apiKeyVaultId" INTEGER NOT NULL,

    CONSTRAINT "WalletSendLNbits_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "WalletSendPhoenixd" (
    "id" SERIAL NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "walletId" INTEGER NOT NULL,
    "url" TEXT NOT NULL,
    "apiKeyVaultId" INTEGER NOT NULL,

    CONSTRAINT "WalletSendPhoenixd_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "WalletSendBlink" (
    "id" SERIAL NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "walletId" INTEGER NOT NULL,
    "currencyVaultId" INTEGER NOT NULL,
    "apiKeyVaultId" INTEGER NOT NULL,

    CONSTRAINT "WalletSendBlink_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "WalletSendWebLN" (
    "id" SERIAL NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "walletId" INTEGER NOT NULL,

    CONSTRAINT "WalletSendWebLN_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "WalletSendLNC" (
    "id" SERIAL NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "walletId" INTEGER NOT NULL,
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
    "walletId" INTEGER NOT NULL,
    "url" TEXT NOT NULL,

    CONSTRAINT "WalletRecvNWC_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "WalletRecvLNbits" (
    "id" SERIAL NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "walletId" INTEGER NOT NULL,
    "url" TEXT NOT NULL,
    "apiKey" TEXT NOT NULL,

    CONSTRAINT "WalletRecvLNbits_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "WalletRecvPhoenixd" (
    "id" SERIAL NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "walletId" INTEGER NOT NULL,
    "url" TEXT NOT NULL,
    "apiKey" TEXT NOT NULL,

    CONSTRAINT "WalletRecvPhoenixd_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "WalletRecvBlink" (
    "id" SERIAL NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "walletId" INTEGER NOT NULL,
    "currency" TEXT NOT NULL,
    "apiKey" TEXT NOT NULL,

    CONSTRAINT "WalletRecvBlink_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "WalletRecvLightningAddress" (
    "id" SERIAL NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "walletId" INTEGER NOT NULL,
    "address" TEXT NOT NULL,

    CONSTRAINT "WalletRecvLightningAddress_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "WalletRecvCLNRest" (
    "id" SERIAL NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "walletId" INTEGER NOT NULL,
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
    "walletId" INTEGER NOT NULL,
    "socket" TEXT NOT NULL,
    "macaroon" TEXT NOT NULL,
    "cert" TEXT,

    CONSTRAINT "WalletRecvLNDGRPC_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "UserWallet_userId_idx" ON "UserWallet"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "ProtocolWallet_walletId_send_protocol_key" ON "ProtocolWallet"("walletId", "send", "protocol");

-- CreateIndex
CREATE UNIQUE INDEX "WalletSendNWC_walletId_key" ON "WalletSendNWC"("walletId");

-- CreateIndex
CREATE UNIQUE INDEX "WalletSendNWC_urlVaultId_key" ON "WalletSendNWC"("urlVaultId");

-- CreateIndex
CREATE UNIQUE INDEX "WalletSendLNbits_walletId_key" ON "WalletSendLNbits"("walletId");

-- CreateIndex
CREATE UNIQUE INDEX "WalletSendLNbits_apiKeyVaultId_key" ON "WalletSendLNbits"("apiKeyVaultId");

-- CreateIndex
CREATE UNIQUE INDEX "WalletSendPhoenixd_walletId_key" ON "WalletSendPhoenixd"("walletId");

-- CreateIndex
CREATE UNIQUE INDEX "WalletSendPhoenixd_apiKeyVaultId_key" ON "WalletSendPhoenixd"("apiKeyVaultId");

-- CreateIndex
CREATE UNIQUE INDEX "WalletSendBlink_walletId_key" ON "WalletSendBlink"("walletId");

-- CreateIndex
CREATE UNIQUE INDEX "WalletSendBlink_apiKeyVaultId_key" ON "WalletSendBlink"("apiKeyVaultId");

-- CreateIndex
CREATE UNIQUE INDEX "WalletSendBlink_currencyVaultId_key" ON "WalletSendBlink"("currencyVaultId");

-- CreateIndex
CREATE UNIQUE INDEX "WalletSendWebLN_walletId_key" ON "WalletSendWebLN"("walletId");

-- CreateIndex
CREATE UNIQUE INDEX "WalletSendLNC_walletId_key" ON "WalletSendLNC"("walletId");

-- CreateIndex
CREATE UNIQUE INDEX "WalletSendLNC_pairingPhraseVaultId_key" ON "WalletSendLNC"("pairingPhraseVaultId");

-- CreateIndex
CREATE UNIQUE INDEX "WalletSendLNC_localKeyVaultId_key" ON "WalletSendLNC"("localKeyVaultId");

-- CreateIndex
CREATE UNIQUE INDEX "WalletSendLNC_remoteKeyVaultId_key" ON "WalletSendLNC"("remoteKeyVaultId");

-- CreateIndex
CREATE UNIQUE INDEX "WalletSendLNC_serverHostVaultId_key" ON "WalletSendLNC"("serverHostVaultId");

-- CreateIndex
CREATE UNIQUE INDEX "WalletRecvNWC_walletId_key" ON "WalletRecvNWC"("walletId");

-- CreateIndex
CREATE UNIQUE INDEX "WalletRecvLNbits_walletId_key" ON "WalletRecvLNbits"("walletId");

-- CreateIndex
CREATE UNIQUE INDEX "WalletRecvPhoenixd_walletId_key" ON "WalletRecvPhoenixd"("walletId");

-- CreateIndex
CREATE UNIQUE INDEX "WalletRecvBlink_walletId_key" ON "WalletRecvBlink"("walletId");

-- CreateIndex
CREATE UNIQUE INDEX "WalletRecvLightningAddress_walletId_key" ON "WalletRecvLightningAddress"("walletId");

-- CreateIndex
CREATE UNIQUE INDEX "WalletRecvCLNRest_walletId_key" ON "WalletRecvCLNRest"("walletId");

-- CreateIndex
CREATE UNIQUE INDEX "WalletRecvLNDGRPC_walletId_key" ON "WalletRecvLNDGRPC"("walletId");

-- AddForeignKey
ALTER TABLE "ProtocolWallet" ADD CONSTRAINT "ProtocolWallet_walletId_fkey" FOREIGN KEY ("walletId") REFERENCES "UserWallet"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WalletSendNWC" ADD CONSTRAINT "WalletSendNWC_walletId_fkey" FOREIGN KEY ("walletId") REFERENCES "ProtocolWallet"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WalletSendNWC" ADD CONSTRAINT "WalletSendNWC_urlVaultId_fkey" FOREIGN KEY ("urlVaultId") REFERENCES "Vault"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WalletSendLNbits" ADD CONSTRAINT "WalletSendLNbits_walletId_fkey" FOREIGN KEY ("walletId") REFERENCES "ProtocolWallet"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WalletSendLNbits" ADD CONSTRAINT "WalletSendLNbits_apiKeyVaultId_fkey" FOREIGN KEY ("apiKeyVaultId") REFERENCES "Vault"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WalletSendPhoenixd" ADD CONSTRAINT "WalletSendPhoenixd_walletId_fkey" FOREIGN KEY ("walletId") REFERENCES "ProtocolWallet"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WalletSendPhoenixd" ADD CONSTRAINT "WalletSendPhoenixd_apiKeyVaultId_fkey" FOREIGN KEY ("apiKeyVaultId") REFERENCES "Vault"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WalletSendBlink" ADD CONSTRAINT "WalletSendBlink_walletId_fkey" FOREIGN KEY ("walletId") REFERENCES "ProtocolWallet"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WalletSendBlink" ADD CONSTRAINT "WalletSendBlink_currencyVaultId_fkey" FOREIGN KEY ("currencyVaultId") REFERENCES "Vault"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WalletSendBlink" ADD CONSTRAINT "WalletSendBlink_apiKeyVaultId_fkey" FOREIGN KEY ("apiKeyVaultId") REFERENCES "Vault"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WalletSendWebLN" ADD CONSTRAINT "WalletSendWebLN_walletId_fkey" FOREIGN KEY ("walletId") REFERENCES "ProtocolWallet"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WalletSendLNC" ADD CONSTRAINT "WalletSendLNC_walletId_fkey" FOREIGN KEY ("walletId") REFERENCES "ProtocolWallet"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WalletSendLNC" ADD CONSTRAINT "WalletSendLNC_pairingPhraseVaultId_fkey" FOREIGN KEY ("pairingPhraseVaultId") REFERENCES "Vault"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WalletSendLNC" ADD CONSTRAINT "WalletSendLNC_localKeyVaultId_fkey" FOREIGN KEY ("localKeyVaultId") REFERENCES "Vault"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WalletSendLNC" ADD CONSTRAINT "WalletSendLNC_remoteKeyVaultId_fkey" FOREIGN KEY ("remoteKeyVaultId") REFERENCES "Vault"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WalletSendLNC" ADD CONSTRAINT "WalletSendLNC_serverHostVaultId_fkey" FOREIGN KEY ("serverHostVaultId") REFERENCES "Vault"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WalletRecvNWC" ADD CONSTRAINT "WalletRecvNWC_walletId_fkey" FOREIGN KEY ("walletId") REFERENCES "ProtocolWallet"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WalletRecvLNbits" ADD CONSTRAINT "WalletRecvLNbits_walletId_fkey" FOREIGN KEY ("walletId") REFERENCES "ProtocolWallet"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WalletRecvPhoenixd" ADD CONSTRAINT "WalletRecvPhoenixd_walletId_fkey" FOREIGN KEY ("walletId") REFERENCES "ProtocolWallet"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WalletRecvBlink" ADD CONSTRAINT "WalletRecvBlink_walletId_fkey" FOREIGN KEY ("walletId") REFERENCES "ProtocolWallet"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WalletRecvLightningAddress" ADD CONSTRAINT "WalletRecvLightningAddress_walletId_fkey" FOREIGN KEY ("walletId") REFERENCES "ProtocolWallet"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WalletRecvCLNRest" ADD CONSTRAINT "WalletRecvCLNRest_walletId_fkey" FOREIGN KEY ("walletId") REFERENCES "ProtocolWallet"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WalletRecvLNDGRPC" ADD CONSTRAINT "WalletRecvLNDGRPC_walletId_fkey" FOREIGN KEY ("walletId") REFERENCES "ProtocolWallet"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UserWallet" ADD CONSTRAINT "UserWallet_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UserWallet" ADD CONSTRAINT "UserWallet_templateId_fkey" FOREIGN KEY ("templateId") REFERENCES "WalletTemplate"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE OR REPLACE FUNCTION wallet_check_support()
RETURNS TRIGGER AS $$
DECLARE
    template "WalletTemplate";
    direction TEXT;
    protocol TEXT;
BEGIN
    direction := TG_ARGV[0];
    protocol := TG_ARGV[1];

    SELECT t.* INTO template
    FROM "ProtocolWallet" pw
    JOIN "UserWallet" uw ON pw."walletId" = uw.id
    JOIN "WalletTemplate" t ON uw."templateId" = t.id
    WHERE pw.id = NEW."walletId";

    IF direction = 'SEND' THEN
        IF NOT protocol::"WalletSendProtocol" = ANY(template."sendProtocols") THEN
            RAISE EXCEPTION 'Wallet % does not support send protocol %', template.name, protocol;
        END IF;
    ELSIF direction = 'RECEIVE' THEN
        IF NOT protocol::"WalletRecvProtocol" = ANY(template."recvProtocols") THEN
            RAISE EXCEPTION 'Wallet % does not support receive protocol %', template.name, protocol;
        END IF;
    END IF;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER wallet_check_support
    BEFORE INSERT OR UPDATE ON "WalletSendNWC"
    FOR EACH ROW
    EXECUTE FUNCTION wallet_check_support('SEND', 'NWC');

CREATE TRIGGER wallet_check_support
    BEFORE INSERT OR UPDATE ON "WalletSendLNbits"
    FOR EACH ROW
    EXECUTE FUNCTION wallet_check_support('SEND', 'LNBITS');

CREATE TRIGGER wallet_check_support
    BEFORE INSERT OR UPDATE ON "WalletSendPhoenixd"
    FOR EACH ROW
    EXECUTE FUNCTION wallet_check_support('SEND', 'PHOENIXD');

CREATE TRIGGER wallet_check_support
    BEFORE INSERT OR UPDATE ON "WalletSendBlink"
    FOR EACH ROW
    EXECUTE FUNCTION wallet_check_support('SEND', 'BLINK');

CREATE TRIGGER wallet_check_support
    BEFORE INSERT OR UPDATE ON "WalletSendWebLN"
    FOR EACH ROW
    EXECUTE FUNCTION wallet_check_support('SEND', 'WEBLN');

CREATE TRIGGER wallet_check_support
    BEFORE INSERT OR UPDATE ON "WalletSendLNC"
    FOR EACH ROW
    EXECUTE FUNCTION wallet_check_support('SEND', 'LNC');

CREATE TRIGGER wallet_check_support
    BEFORE INSERT OR UPDATE ON "WalletRecvNWC"
    FOR EACH ROW
    EXECUTE FUNCTION wallet_check_support('RECEIVE', 'NWC');

CREATE TRIGGER wallet_check_support
    BEFORE INSERT OR UPDATE ON "WalletRecvLNbits"
    FOR EACH ROW
    EXECUTE FUNCTION wallet_check_support('RECEIVE', 'LNBITS');

CREATE TRIGGER wallet_check_support
    BEFORE INSERT OR UPDATE ON "WalletRecvPhoenixd"
    FOR EACH ROW
    EXECUTE FUNCTION wallet_check_support('RECEIVE', 'PHOENIXD');

CREATE TRIGGER wallet_check_support
    BEFORE INSERT OR UPDATE ON "WalletRecvBlink"
    FOR EACH ROW
    EXECUTE FUNCTION wallet_check_support('RECEIVE', 'BLINK');

CREATE TRIGGER wallet_check_support
    BEFORE INSERT OR UPDATE ON "WalletRecvLightningAddress"
    FOR EACH ROW
    EXECUTE FUNCTION wallet_check_support('RECEIVE', 'LN_ADDR');

CREATE TRIGGER wallet_check_support
    BEFORE INSERT OR UPDATE ON "WalletRecvCLNRest"
    FOR EACH ROW
    EXECUTE FUNCTION wallet_check_support('RECEIVE', 'CLN_REST');

CREATE TRIGGER wallet_check_support
    BEFORE INSERT OR UPDATE ON "WalletRecvLNDGRPC"
    FOR EACH ROW
    EXECUTE FUNCTION wallet_check_support('RECEIVE', 'LND_GRPC');

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

        SELECT jsonb_build_object('iv', v.iv, 'value', v.value) INTO vault
        FROM "Vault" v
        WHERE v.id = vault_id;

        IF vault IS NOT NULL THEN
            wallet := jsonb_set(wallet, array[base_name], vault) - col_name;
        END IF;
    END LOOP;

    UPDATE "ProtocolWallet"
    SET json = wallet
    WHERE id = NEW."walletId";

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

CREATE OR REPLACE FUNCTION wallet_updated_at_trigger() RETURNS TRIGGER AS $$
BEGIN
    UPDATE "users" u
    SET "walletsUpdatedAt" = NOW()
    FROM "UserWallet" uw
    WHERE u.id = uw."userId"
    AND uw.id = CASE
        WHEN TG_OP = 'DELETE'
        THEN OLD."walletId"
        ELSE NEW."walletId"
    END;
    RETURN NULL;
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE TRIGGER wallet_updated_at_trigger
AFTER INSERT OR UPDATE OR DELETE ON "ProtocolWallet"
FOR EACH ROW EXECUTE PROCEDURE wallet_updated_at_trigger();

CREATE OR REPLACE FUNCTION get_or_create_user_wallet(
    user_id INT,
    template_name TEXT,
    priority INT,
    enabled BOOLEAN
)
RETURNS INT AS
$$
DECLARE
    userWalletId INT;
BEGIN
    SELECT uw.id INTO userWalletId
    FROM "UserWallet" uw
    JOIN "WalletTemplate" t ON uw."templateId" = t.id
    WHERE uw."userId" = user_id AND t.name = template_name;

    IF NOT FOUND THEN
        userWalletId := create_user_wallet(user_id, template_name, priority, enabled);
    END IF;

    RETURN userWalletId;
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION create_user_wallet(
    user_id INT,
    template_name TEXT,
    priority INT,
    enabled BOOLEAN
)
RETURNS INT AS
$$
DECLARE
    userWalletId INT;
BEGIN
    INSERT INTO "UserWallet" ("userId", "templateId", "priority", "enabled")
    SELECT user_id, t.id, priority, enabled
    FROM "WalletTemplate" t
    WHERE t.name = template_name
    RETURNING id INTO userWalletId;

    RETURN userWalletId;
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION create_protocol_wallet(
    id INT,
    user_wallet_id INT,
    send BOOLEAN,
    protocol "WalletProtocol",
    user_id INT,
    template_name TEXT,
    priority INT,
    enabled BOOLEAN
)
RETURNS INT AS
$$
DECLARE
    userWalletId INT;
    protocolWalletId INT;
BEGIN
    INSERT INTO "ProtocolWallet" ("id", "walletId", "send", "protocol")
    VALUES (CASE WHEN send THEN nextval('"ProtocolWallet_id_seq"') ELSE id END, user_wallet_id, send, protocol)
    RETURNING "ProtocolWallet"."id" INTO protocolWalletId;

    RETURN protocolWalletId;
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
    -- In the new schema, send and receive are stored in separate tables and they point to individual rows in the ProtocolWallet table.
    -- Therefore, to be able to point the foreign keys to the new ProtocolWallet table, we need to keep the same id, but only for the receive wallets
    -- because that's what the foreign keys were pointing to in the old schema.
    -- To avoid generating an id via the sequence that we already inserted manually, we let the sequence start at the highest Wallet id of the old schema.
    PERFORM setval('"ProtocolWallet_id_seq"', (SELECT MAX(id)+1 FROM "Wallet"));

    FOR row IN
        SELECT w1.*, w2."userId", w2."priority", w2."enabled"
        FROM "WalletLNbits" w1
        JOIN "Wallet" w2 ON w1."walletId" = w2.id
    LOOP
        DECLARE
            userWalletId INT;
            protocolWalletId INT;
        BEGIN
            userWalletId := get_or_create_user_wallet(row."userId", 'LNBITS', row."priority", row."enabled");

            IF row."adminKeyId" IS NOT NULL THEN
                protocolWalletId := create_protocol_wallet(row."walletId", userWalletId, true, 'LNBITS', row."userId", 'LNBITS', row."priority", row."enabled");
                INSERT INTO "WalletSendLNbits" ("walletId", "url", "apiKeyVaultId")
                VALUES (protocolWalletId, row."url", row."adminKeyId");
            END IF;

            IF row."invoiceKey" IS NOT NULL THEN
                protocolWalletId := create_protocol_wallet(row."walletId", userWalletId, false, 'LNBITS', row."userId", 'LNBITS', row."priority", row."enabled");
                INSERT INTO "WalletRecvLNbits" ("walletId", "url", "apiKey")
                VALUES (protocolWalletId, row."url", row."invoiceKey");
            END IF;
        END;
    END LOOP;

    FOR row IN
        SELECT w1.*, w2."userId", w2."userId", w2."priority", w2."enabled"
        FROM "WalletPhoenixd" w1
        JOIN "Wallet" w2 ON w1."walletId" = w2.id
    LOOP
        DECLARE
            userWalletId INT;
            protocolWalletId INT;
        BEGIN
            userWalletId := get_or_create_user_wallet(row."userId", 'PHOENIXD', row."priority", row."enabled");

            IF row."primaryPasswordId" IS NOT NULL THEN
                protocolWalletId := create_protocol_wallet(row."walletId", userWalletId, true, 'PHOENIXD', row."userId", 'PHOENIXD', row."priority", row."enabled");
                INSERT INTO "WalletSendPhoenixd" ("walletId", "url", "apiKeyVaultId")
                VALUES (protocolWalletId, row."url", row."primaryPasswordId");
            END IF;

            IF row."secondaryPassword" IS NOT NULL THEN
                protocolWalletId := create_protocol_wallet(row."walletId", userWalletId, false, 'PHOENIXD', row."userId", 'PHOENIXD', row."priority", row."enabled");
                INSERT INTO "WalletRecvPhoenixd" ("walletId", "url", "apiKey")
                VALUES (protocolWalletId, row."url", row."secondaryPassword");
            END IF;
        END;
    END LOOP;

    FOR row IN
        SELECT w1.*, w2."userId", w2."userId", w2."priority", w2."enabled"
        FROM "WalletBlink" w1
        JOIN "Wallet" w2 ON w1."walletId" = w2.id
    LOOP
        DECLARE
            userWalletId INT;
            protocolWalletId INT;
        BEGIN
            userWalletId := get_or_create_user_wallet(row."userId", 'BLINK', row."priority", row."enabled");

            IF row."apiKeyId" IS NOT NULL AND row."currencyId" IS NOT NULL THEN
                protocolWalletId := create_protocol_wallet(row."walletId", userWalletId, true, 'BLINK', row."userId", 'BLINK', row."priority", row."enabled");
                INSERT INTO "WalletSendBlink" ("walletId", "apiKeyVaultId", "currencyVaultId")
                VALUES (protocolWalletId, row."apiKeyId", row."currencyId");
            END IF;

            IF row."apiKeyRecv" IS NOT NULL AND row."currencyRecv" IS NOT NULL THEN
                protocolWalletId := create_protocol_wallet(row."walletId", userWalletId, false, 'BLINK', row."userId", 'BLINK', row."priority", row."enabled");
                INSERT INTO "WalletRecvBlink" ("walletId", "apiKey", "currency")
                VALUES (protocolWalletId, row."apiKeyRecv", row."currencyRecv");
            END IF;
        END;
    END LOOP;

    FOR row IN
        SELECT w1.*, w2."userId", w2."userId", w2."priority", w2."enabled"
        FROM "WalletLND" w1
        JOIN "Wallet" w2 ON w1."walletId" = w2.id
    LOOP
        DECLARE
            userWalletId INT;
            protocolWalletId INT;
        BEGIN
            userWalletId := get_or_create_user_wallet(row."userId", 'LND', row."priority", row."enabled");

            protocolWalletId := create_protocol_wallet(row."walletId", userWalletId, false, 'LND_GRPC', row."userId", 'LND', row."priority", row."enabled");
            INSERT INTO "WalletRecvLNDGRPC" ("walletId", "socket", "macaroon", "cert")
            VALUES (protocolWalletId, row."socket", row."macaroon", row."cert");
        END;
    END LOOP;

    FOR row IN
        SELECT w1.*, w2."userId", w2."userId", w2."priority", w2."enabled"
        FROM "WalletLNC" w1
        JOIN "Wallet" w2 ON w1."walletId" = w2.id
    LOOP
        DECLARE
            userWalletId INT;
            protocolWalletId INT;
        BEGIN
            userWalletId := get_or_create_user_wallet(row."userId", 'LND', row."priority", row."enabled");

            protocolWalletId := create_protocol_wallet(row."walletId", userWalletId, true, 'LNC', row."userId", 'LND', row."priority", row."enabled");
            INSERT INTO "WalletSendLNC" ("walletId", "pairingPhraseVaultId", "localKeyVaultId", "remoteKeyVaultId", "serverHostVaultId")
            VALUES (protocolWalletId, row."pairingPhraseId", row."localKeyId", row."remoteKeyId", row."serverHostId");
        END;
    END LOOP;

    FOR row IN
        SELECT w1.*, w2."userId", w2."userId", w2."priority", w2."enabled"
        FROM "WalletCLN" w1
        JOIN "Wallet" w2 ON w1."walletId" = w2.id
    LOOP
        DECLARE
            userWalletId INT;
            protocolWalletId INT;
        BEGIN
            userWalletId := get_or_create_user_wallet(row."userId", 'CLN', row."priority", row."enabled");

            protocolWalletId := create_protocol_wallet(row."walletId", userWalletId, false, 'CLN_REST', row."userId", 'CLN', row."priority", row."enabled");
            INSERT INTO "WalletRecvCLNRest" ("walletId", "socket", "rune", "cert")
            VALUES (protocolWalletId, row."socket", row."rune", row."cert");
        END;
    END LOOP;

    FOR row IN
        SELECT w1.*, w2."userId", w2."userId", w2."priority", w2."enabled"
        FROM "WalletNWC" w1
        JOIN "Wallet" w2 ON w1."walletId" = w2.id
    LOOP
        DECLARE
            userWalletId INT;
            protocolWalletId INT;
            relay TEXT;
            walletName TEXT;
        BEGIN
            relay := substring(row."nwcUrlRecv" from 'relay=([^&]+)');

            IF relay LIKE '%getalby.com%' THEN
                walletName := 'ALBY_HUB';
            ELSIF relay LIKE '%rizful.com%' THEN
                walletName := 'RIZFUL';
            ELSIF relay LIKE '%primal.net%' THEN
                walletName := 'PRIMAL';
            ELSE
                walletName := 'CUSTOM';
            END IF;

            userWalletId := get_or_create_user_wallet(row."userId", walletName, row."priority", row."enabled");

            -- we assume here that the wallet to receive is the same as the wallet to send
            -- since we can't check which relay is used for the send connection because it's encrypted.
            -- but in 99% if not 100% of the cases, it's the same wallet.
            IF row."nwcUrlRecv" IS NOT NULL THEN
                protocolWalletId := create_protocol_wallet(row."walletId", userWalletId, false, 'NWC', row."userId", walletName, row."priority", row."enabled");
                INSERT INTO "WalletRecvNWC" ("walletId", "url")
                VALUES (protocolWalletId, row."nwcUrlRecv");
            END IF;

            IF row."nwcUrlId" IS NOT NULL THEN
                protocolWalletId := create_protocol_wallet(row."walletId", userWalletId, true, 'NWC', row."userId", walletName, row."priority", row."enabled");
                INSERT INTO "WalletSendNWC" ("walletId", "urlVaultId")
                VALUES (protocolWalletId, row."nwcUrlId");
            END IF;
        END;
    END LOOP;

    FOR row IN
        SELECT w1.*, w2."userId", w2."userId", w2."priority", w2."enabled"
        FROM "WalletLightningAddress" w1
        JOIN "Wallet" w2 ON w1."walletId" = w2.id
    LOOP
        DECLARE
            userWalletId INT;
            protocolWalletId INT;
            domain TEXT;
            walletName TEXT;
        BEGIN
            domain := split_part(row."address", '@', 2);

            IF domain LIKE '%walletofsatoshi.com' THEN
                walletName := 'WALLET_OF_SATOSHI';
            ELSIF domain LIKE '%getalby.com' THEN
                walletName := 'ALBY_HUB';
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
                walletName := 'NPUB.CASH';
            ELSIF domain LIKE '%zeuspay.com' THEN
                walletName := 'ZEUS';
            ELSIF domain LIKE '%zeuspay.com' THEN
                walletName := 'ZEUSPAY';
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
                walletName := 'CUSTOM';
            END IF;

            userWalletId := get_or_create_user_wallet(row."userId", walletName, row."priority", row."enabled");

            protocolWalletId := create_protocol_wallet(row."walletId", userWalletId, false, 'LN_ADDR', row."userId", walletName, row."priority", row."enabled");
            INSERT INTO "WalletRecvLightningAddress" ("walletId", "address")
            VALUES (protocolWalletId, row."address");
        END;
    END LOOP;

    FOR row IN
        SELECT w1.*, w2."userId", w2."userId", w2."priority", w2."enabled"
        FROM "WalletWebLN" w1
        JOIN "Wallet" w2 ON w1."walletId" = w2.id
    LOOP
        DECLARE
            userWalletId INT;
            protocolWalletId INT;
        BEGIN
            userWalletId := get_or_create_user_wallet(row."userId", 'ALBY_BROWSER_EXTENSION', row."priority", row."enabled");

            protocolWalletId := create_protocol_wallet(row."walletId", userWalletId, true, 'WEBLN', row."userId", 'ALBY_BROWSER_EXTENSION', row."priority", row."enabled");
            INSERT INTO "WalletSendWebLN" ("walletId")
            VALUES (protocolWalletId);
        END;
    END LOOP;
END;
$$ LANGUAGE plpgsql;

SELECT wallet_v2_migration();

DROP FUNCTION wallet_v2_migration();
DROP FUNCTION get_or_create_user_wallet(INT, TEXT, INT, BOOLEAN);
DROP FUNCTION create_user_wallet(INT, TEXT, INT, BOOLEAN);
DROP FUNCTION create_protocol_wallet(INT, INT, BOOLEAN, "WalletProtocol", INT, TEXT, INT, BOOLEAN);

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
-- TODO: make sure ids are stable during migration such that new foreign keys pointing to ProtocolWallet can be added
ALTER TABLE "Withdrawl" DROP CONSTRAINT "Withdrawl_walletId_fkey";
ALTER TABLE "Withdrawl" ADD CONSTRAINT "Withdrawl_walletId_fkey" FOREIGN KEY ("walletId") REFERENCES "ProtocolWallet"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "DirectPayment" DROP CONSTRAINT "DirectPayment_walletId_fkey";
ALTER TABLE "DirectPayment" ADD CONSTRAINT "DirectPayment_walletId_fkey" FOREIGN KEY ("walletId") REFERENCES "ProtocolWallet"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "InvoiceForward" DROP CONSTRAINT "InvoiceForward_walletId_fkey";
ALTER TABLE "InvoiceForward" ADD CONSTRAINT "InvoiceForward_walletId_fkey" FOREIGN KEY ("walletId") REFERENCES "ProtocolWallet"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- now drop Wallet table because nothing points to it anymore
DROP TABLE "Wallet";

-- drop old function used for the JSON trigger
DROP FUNCTION wallet_wallet_type_as_jsonb;

-- wallet logs now point to the new ProtocolWallet table instead of to the old WalletType enum
ALTER TABLE "WalletLog"
    DROP COLUMN "wallet",
    ADD COLUMN "walletId" INTEGER NOT NULL;

DROP TYPE "WalletType";
ALTER TABLE "WalletLog" ADD CONSTRAINT "WalletLog_walletId_fkey" FOREIGN KEY ("walletId") REFERENCES "ProtocolWallet"("id") ON DELETE CASCADE ON UPDATE CASCADE;
