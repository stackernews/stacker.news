-- CreateEnum
CREATE TYPE "WalletSendProtocol" AS ENUM ('NWC', 'LNBITS', 'PHOENIXD', 'BLINK', 'WEBLN', 'LNC');

-- CreateEnum
CREATE TYPE "WalletRecvProtocol" AS ENUM ('NWC', 'LNBITS', 'PHOENIXD', 'BLINK', 'LN_ADDR', 'CLN_REST', 'LND_GRPC');

-- CreateTable
CREATE TABLE "WalletV2" (
    "id" SERIAL NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "name" TEXT NOT NULL,
    "image" TEXT,
    "description" TEXT,
    "sendProtocols" "WalletSendProtocol"[],
    "recvProtocols" "WalletRecvProtocol"[],

    CONSTRAINT "WalletV2_pkey" PRIMARY KEY ("id")
);

INSERT INTO "WalletV2" (name, "sendProtocols", "recvProtocols") VALUES
    ('ALBY',
        ARRAY['NWC', 'WEBLN']::"WalletSendProtocol"[],
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
    "walletId" INTEGER NOT NULL,
    "jsonSend" JSONB,
    "jsonRecv" JSONB,

    CONSTRAINT "UserWallet_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "WalletSendNWC" (
    "id" SERIAL NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "walletId" INTEGER NOT NULL,
    "type" "WalletSendProtocol" NOT NULL DEFAULT 'NWC',
    "urlId" INTEGER NOT NULL,

    CONSTRAINT "WalletSendNWC_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "WalletSendNWC_type_check" CHECK (type = 'NWC')
);

-- CreateTable
CREATE TABLE "WalletSendLNbits" (
    "id" SERIAL NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "walletId" INTEGER NOT NULL,
    "type" "WalletSendProtocol" NOT NULL DEFAULT 'LNBITS',
    "url" TEXT NOT NULL,
    "apiKeyId" INTEGER NOT NULL,

    CONSTRAINT "WalletSendLNbits_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "WalletSendLNbits_type_check" CHECK (type = 'LNBITS')
);

-- CreateTable
CREATE TABLE "WalletSendPhoenixd" (
    "id" SERIAL NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "walletId" INTEGER NOT NULL,
    "type" "WalletSendProtocol" NOT NULL DEFAULT 'PHOENIXD',
    "url" TEXT NOT NULL,
    "apiKeyId" INTEGER NOT NULL,

    CONSTRAINT "WalletSendPhoenixd_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "WalletSendPhoenixd_type_check" CHECK (type = 'PHOENIXD')
);

-- CreateTable
CREATE TABLE "WalletSendBlink" (
    "id" SERIAL NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "walletId" INTEGER NOT NULL,
    "type" "WalletSendProtocol" NOT NULL DEFAULT 'BLINK',
    "currencyId" INTEGER NOT NULL,
    "apiKeyId" INTEGER NOT NULL,

    CONSTRAINT "WalletSendBlink_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "WalletSendBlink_type_check" CHECK (type = 'BLINK')
);

-- CreateTable
CREATE TABLE "WalletSendWebLN" (
    "id" SERIAL NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "walletId" INTEGER NOT NULL,
    "type" "WalletSendProtocol" NOT NULL DEFAULT 'WEBLN',

    CONSTRAINT "WalletSendWebLN_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "WalletSendWebLN_type_check" CHECK (type = 'WEBLN')
);

-- CreateTable
CREATE TABLE "WalletSendLNC" (
    "id" SERIAL NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "walletId" INTEGER NOT NULL,
    "type" "WalletSendProtocol" NOT NULL DEFAULT 'LNC',
    "pairingPhraseId" INTEGER NOT NULL,
    "localKeyId" INTEGER NOT NULL,
    "remoteKeyId" INTEGER NOT NULL,
    "serverHostId" INTEGER NOT NULL,

    CONSTRAINT "WalletSendLNC_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "WalletSendLNC_type_check" CHECK (type = 'LNC')
);

-- CreateTable
CREATE TABLE "WalletRecvNWC" (
    "id" SERIAL NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "walletId" INTEGER NOT NULL,
    "type" "WalletRecvProtocol" NOT NULL DEFAULT 'NWC',
    "url" TEXT NOT NULL,

    CONSTRAINT "WalletRecvNWC_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "WalletRecvNWC_type_check" CHECK (type = 'NWC')
);

-- CreateTable
CREATE TABLE "WalletRecvLNbits" (
    "id" SERIAL NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "walletId" INTEGER NOT NULL,
    "type" "WalletRecvProtocol" NOT NULL DEFAULT 'LNBITS',
    "url" TEXT NOT NULL,
    "apiKey" TEXT NOT NULL,

    CONSTRAINT "WalletRecvLNbits_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "WalletRecvLNbits_type_check" CHECK (type = 'LNBITS')
);

-- CreateTable
CREATE TABLE "WalletRecvPhoenixd" (
    "id" SERIAL NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "walletId" INTEGER NOT NULL,
    "type" "WalletRecvProtocol" NOT NULL DEFAULT 'PHOENIXD',
    "url" TEXT NOT NULL,
    "apiKey" TEXT NOT NULL,

    CONSTRAINT "WalletRecvPhoenixd_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "WalletRecvPhoenixd_type_check" CHECK (type = 'PHOENIXD')
);

-- CreateTable
CREATE TABLE "WalletRecvBlink" (
    "id" SERIAL NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "walletId" INTEGER NOT NULL,
    "type" "WalletRecvProtocol" NOT NULL DEFAULT 'BLINK',
    "currency" TEXT NOT NULL,
    "apiKey" TEXT NOT NULL,

    CONSTRAINT "WalletRecvBlink_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "WalletRecvBlink_type_check" CHECK (type = 'BLINK')
);

-- CreateTable
CREATE TABLE "WalletRecvLightningAddress" (
    "id" SERIAL NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "walletId" INTEGER NOT NULL,
    "type" "WalletRecvProtocol" NOT NULL DEFAULT 'LN_ADDR',
    "address" TEXT NOT NULL,

    CONSTRAINT "WalletRecvLightningAddress_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "WalletRecvLightningAddress_type_check" CHECK (type = 'LN_ADDR')
);

-- CreateTable
CREATE TABLE "WalletRecvCLNRest" (
    "id" SERIAL NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "walletId" INTEGER NOT NULL,
    "type" "WalletRecvProtocol" NOT NULL DEFAULT 'CLN_REST',
    "socket" TEXT NOT NULL,
    "rune" TEXT NOT NULL,
    "cert" TEXT,

    CONSTRAINT "WalletRecvCLNRest_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "WalletRecvCLNRest_type_check" CHECK (type = 'CLN_REST')
);

-- CreateTable
CREATE TABLE "WalletRecvLNDGRPC" (
    "id" SERIAL NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "walletId" INTEGER NOT NULL,
    "type" "WalletRecvProtocol" NOT NULL DEFAULT 'LND_GRPC',
    "socket" TEXT NOT NULL,
    "macaroon" TEXT NOT NULL,
    "cert" TEXT,

    CONSTRAINT "WalletRecvLNDGRPC_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "WalletRecvLNDGRPC_type_check" CHECK (type = 'LND_GRPC')
);

-- CreateIndex
CREATE UNIQUE INDEX "WalletSendNWC_walletId_key" ON "WalletSendNWC"("walletId");

-- CreateIndex
CREATE UNIQUE INDEX "WalletSendNWC_urlId_key" ON "WalletSendNWC"("urlId");

-- CreateIndex
CREATE UNIQUE INDEX "WalletSendLNbits_walletId_key" ON "WalletSendLNbits"("walletId");

-- CreateIndex
CREATE UNIQUE INDEX "WalletSendLNbits_apiKeyId_key" ON "WalletSendLNbits"("apiKeyId");

-- CreateIndex
CREATE UNIQUE INDEX "WalletSendPhoenixd_walletId_key" ON "WalletSendPhoenixd"("walletId");

-- CreateIndex
CREATE UNIQUE INDEX "WalletSendPhoenixd_apiKeyId_key" ON "WalletSendPhoenixd"("apiKeyId");

-- CreateIndex
CREATE UNIQUE INDEX "WalletSendBlink_walletId_key" ON "WalletSendBlink"("walletId");

-- CreateIndex
CREATE UNIQUE INDEX "WalletSendBlink_apiKeyId_key" ON "WalletSendBlink"("apiKeyId");

-- CreateIndex
CREATE UNIQUE INDEX "WalletSendBlink_currencyId_key" ON "WalletSendBlink"("currencyId");

-- CreateIndex
CREATE UNIQUE INDEX "WalletSendWebLN_walletId_key" ON "WalletSendWebLN"("walletId");

-- CreateIndex
CREATE UNIQUE INDEX "WalletSendLNC_walletId_key" ON "WalletSendLNC"("walletId");

-- CreateIndex
CREATE UNIQUE INDEX "WalletSendLNC_pairingPhraseId_key" ON "WalletSendLNC"("pairingPhraseId");

-- CreateIndex
CREATE UNIQUE INDEX "WalletSendLNC_localKeyId_key" ON "WalletSendLNC"("localKeyId");

-- CreateIndex
CREATE UNIQUE INDEX "WalletSendLNC_remoteKeyId_key" ON "WalletSendLNC"("remoteKeyId");

-- CreateIndex
CREATE UNIQUE INDEX "WalletSendLNC_serverHostId_key" ON "WalletSendLNC"("serverHostId");

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
ALTER TABLE "WalletSendNWC" ADD CONSTRAINT "WalletSendNWC_walletId_fkey" FOREIGN KEY ("walletId") REFERENCES "UserWallet"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WalletSendNWC" ADD CONSTRAINT "WalletSendNWC_urlId_fkey" FOREIGN KEY ("urlId") REFERENCES "Vault"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WalletSendLNbits" ADD CONSTRAINT "WalletSendLNbits_walletId_fkey" FOREIGN KEY ("walletId") REFERENCES "UserWallet"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WalletSendLNbits" ADD CONSTRAINT "WalletSendLNbits_apiKeyId_fkey" FOREIGN KEY ("apiKeyId") REFERENCES "Vault"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WalletSendPhoenixd" ADD CONSTRAINT "WalletSendPhoenixd_walletId_fkey" FOREIGN KEY ("walletId") REFERENCES "UserWallet"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WalletSendPhoenixd" ADD CONSTRAINT "WalletSendPhoenixd_apiKeyId_fkey" FOREIGN KEY ("apiKeyId") REFERENCES "Vault"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WalletSendBlink" ADD CONSTRAINT "WalletSendBlink_walletId_fkey" FOREIGN KEY ("walletId") REFERENCES "UserWallet"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WalletSendBlink" ADD CONSTRAINT "WalletSendBlink_currencyId_fkey" FOREIGN KEY ("currencyId") REFERENCES "Vault"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WalletSendBlink" ADD CONSTRAINT "WalletSendBlink_apiKeyId_fkey" FOREIGN KEY ("apiKeyId") REFERENCES "Vault"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WalletSendWebLN" ADD CONSTRAINT "WalletSendWebLN_walletId_fkey" FOREIGN KEY ("walletId") REFERENCES "UserWallet"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WalletSendLNC" ADD CONSTRAINT "WalletSendLNC_walletId_fkey" FOREIGN KEY ("walletId") REFERENCES "UserWallet"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WalletSendLNC" ADD CONSTRAINT "WalletSendLNC_pairingPhraseId_fkey" FOREIGN KEY ("pairingPhraseId") REFERENCES "Vault"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WalletSendLNC" ADD CONSTRAINT "WalletSendLNC_localKeyId_fkey" FOREIGN KEY ("localKeyId") REFERENCES "Vault"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WalletSendLNC" ADD CONSTRAINT "WalletSendLNC_remoteKeyId_fkey" FOREIGN KEY ("remoteKeyId") REFERENCES "Vault"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WalletSendLNC" ADD CONSTRAINT "WalletSendLNC_serverHostId_fkey" FOREIGN KEY ("serverHostId") REFERENCES "Vault"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WalletRecvNWC" ADD CONSTRAINT "WalletRecvNWC_walletId_fkey" FOREIGN KEY ("walletId") REFERENCES "UserWallet"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WalletRecvLNbits" ADD CONSTRAINT "WalletRecvLNbits_walletId_fkey" FOREIGN KEY ("walletId") REFERENCES "UserWallet"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WalletRecvPhoenixd" ADD CONSTRAINT "WalletRecvPhoenixd_walletId_fkey" FOREIGN KEY ("walletId") REFERENCES "UserWallet"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WalletRecvBlink" ADD CONSTRAINT "WalletRecvBlink_walletId_fkey" FOREIGN KEY ("walletId") REFERENCES "UserWallet"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WalletRecvLightningAddress" ADD CONSTRAINT "WalletRecvLightningAddress_walletId_fkey" FOREIGN KEY ("walletId") REFERENCES "UserWallet"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WalletRecvCLNRest" ADD CONSTRAINT "WalletRecvCLNRest_walletId_fkey" FOREIGN KEY ("walletId") REFERENCES "UserWallet"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WalletRecvLNDGRPC" ADD CONSTRAINT "WalletRecvLNDGRPC_walletId_fkey" FOREIGN KEY ("walletId") REFERENCES "UserWallet"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UserWallet" ADD CONSTRAINT "UserWallet_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UserWallet" ADD CONSTRAINT "UserWallet_walletId_fkey" FOREIGN KEY ("walletId") REFERENCES "WalletV2"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE OR REPLACE FUNCTION wallet_check_support()
RETURNS TRIGGER AS $$
DECLARE
    wallet "WalletV2";
    direction TEXT;
BEGIN
    direction := TG_ARGV[0];

    SELECT w.* INTO wallet
    FROM "UserWallet" uw
    JOIN "WalletV2" w ON uw."walletId" = w.id
    WHERE uw.id = NEW."walletId";

    IF direction = 'SEND' THEN
        IF NOT NEW."type" = ANY(wallet."sendProtocols") THEN
            RAISE EXCEPTION 'Wallet % does not support send method %', wallet.name, NEW."type";
        END IF;
    ELSIF direction = 'RECEIVE' THEN
        IF NOT NEW."type" = ANY(wallet."recvProtocols") THEN
            RAISE EXCEPTION 'Wallet % does not support receive method %', wallet.name, NEW."type";
        END IF;
    END IF;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER wallet_check_support
    BEFORE INSERT OR UPDATE ON "WalletSendNWC"
    FOR EACH ROW
    EXECUTE FUNCTION wallet_check_support('SEND');

CREATE TRIGGER wallet_check_support
    BEFORE INSERT OR UPDATE ON "WalletSendLNbits"
    FOR EACH ROW
    EXECUTE FUNCTION wallet_check_support('SEND');

CREATE TRIGGER wallet_check_support
    BEFORE INSERT OR UPDATE ON "WalletSendPhoenixd"
    FOR EACH ROW
    EXECUTE FUNCTION wallet_check_support('SEND');

CREATE TRIGGER wallet_check_support
    BEFORE INSERT OR UPDATE ON "WalletSendBlink"
    FOR EACH ROW
    EXECUTE FUNCTION wallet_check_support('SEND');

CREATE TRIGGER wallet_check_support
    BEFORE INSERT OR UPDATE ON "WalletSendWebLN"
    FOR EACH ROW
    EXECUTE FUNCTION wallet_check_support('SEND');

CREATE TRIGGER wallet_check_support
    BEFORE INSERT OR UPDATE ON "WalletSendLNC"
    FOR EACH ROW
    EXECUTE FUNCTION wallet_check_support('SEND');

CREATE TRIGGER wallet_check_support
    BEFORE INSERT OR UPDATE ON "WalletRecvNWC"
    FOR EACH ROW
    EXECUTE FUNCTION wallet_check_support('RECEIVE');

CREATE TRIGGER wallet_check_support
    BEFORE INSERT OR UPDATE ON "WalletRecvLNbits"
    FOR EACH ROW
    EXECUTE FUNCTION wallet_check_support('RECEIVE');

CREATE TRIGGER wallet_check_support
    BEFORE INSERT OR UPDATE ON "WalletRecvPhoenixd"
    FOR EACH ROW
    EXECUTE FUNCTION wallet_check_support('RECEIVE');

CREATE TRIGGER wallet_check_support
    BEFORE INSERT OR UPDATE ON "WalletRecvBlink"
    FOR EACH ROW
    EXECUTE FUNCTION wallet_check_support('RECEIVE');

CREATE TRIGGER wallet_check_support
    BEFORE INSERT OR UPDATE ON "WalletRecvLightningAddress"
    FOR EACH ROW
    EXECUTE FUNCTION wallet_check_support('RECEIVE');

CREATE TRIGGER wallet_check_support
    BEFORE INSERT OR UPDATE ON "WalletRecvCLNRest"
    FOR EACH ROW
    EXECUTE FUNCTION wallet_check_support('RECEIVE');

CREATE TRIGGER wallet_check_support
    BEFORE INSERT OR UPDATE ON "WalletRecvLNDGRPC"
    FOR EACH ROW
    EXECUTE FUNCTION wallet_check_support('RECEIVE');
