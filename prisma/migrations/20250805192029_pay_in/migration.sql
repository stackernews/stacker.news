-- CreateEnum
CREATE TYPE "PayInType" AS ENUM ('BUY_CREDITS', 'ITEM_CREATE', 'ITEM_UPDATE', 'ZAP', 'DOWN_ZAP', 'BOOST', 'DONATE', 'POLL_VOTE', 'INVITE_GIFT', 'TERRITORY_CREATE', 'TERRITORY_UPDATE', 'TERRITORY_BILLING', 'TERRITORY_UNARCHIVE', 'PROXY_PAYMENT', 'REWARDS', 'WITHDRAWAL', 'AUTO_WITHDRAWAL');

-- CreateEnum
CREATE TYPE "PayInState" AS ENUM ('PENDING_INVOICE_CREATION', 'PENDING_INVOICE_WRAP', 'PENDING_WITHDRAWAL', 'WITHDRAWAL_PAID', 'WITHDRAWAL_FAILED', 'PENDING', 'PENDING_HELD', 'HELD', 'PAID', 'FAILED', 'FORWARDING', 'FORWARDED', 'FAILED_FORWARD', 'CANCELLED');

-- CreateEnum
CREATE TYPE "PayInFailureReason" AS ENUM ('INVOICE_CREATION_FAILED', 'INVOICE_WRAPPING_FAILED_HIGH_PREDICTED_FEE', 'INVOICE_WRAPPING_FAILED_HIGH_PREDICTED_EXPIRY', 'INVOICE_WRAPPING_FAILED_UNKNOWN', 'INVOICE_FORWARDING_CLTV_DELTA_TOO_LOW', 'INVOICE_FORWARDING_FAILED', 'HELD_INVOICE_UNEXPECTED_ERROR', 'HELD_INVOICE_SETTLED_TOO_SLOW', 'WITHDRAWAL_FAILED', 'USER_CANCELLED', 'SYSTEM_CANCELLED', 'INVOICE_EXPIRED', 'EXECUTION_FAILED', 'UNKNOWN_FAILURE');

-- CreateEnum
CREATE TYPE "CustodialTokenType" AS ENUM ('CREDITS', 'SATS');

-- CreateEnum
CREATE TYPE "PayOutType" AS ENUM ('TERRITORY_REVENUE', 'REWARDS_POOL', 'ROUTING_FEE', 'ROUTING_FEE_REFUND', 'PROXY_PAYMENT', 'ZAP', 'REWARD', 'INVITE_GIFT', 'WITHDRAWAL', 'SYSTEM_REVENUE', 'BUY_CREDITS');

-- AlterTable
ALTER TABLE "WalletLog" ADD COLUMN     "payOutBolt11Id" INTEGER;

-- CreateTable
CREATE TABLE "ItemPayIn" (
    "id" SERIAL NOT NULL,
    "itemId" INTEGER NOT NULL,
    "payInId" INTEGER NOT NULL,

    CONSTRAINT "ItemPayIn_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SubPayIn" (
    "id" SERIAL NOT NULL,
    "subName" CITEXT NOT NULL,
    "payInId" INTEGER NOT NULL,

    CONSTRAINT "SubPayIn_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PayIn" (
    "id" SERIAL NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "mcost" BIGINT NOT NULL,
    "payInType" "PayInType" NOT NULL,
    "payInState" "PayInState" NOT NULL,
    "payInFailureReason" "PayInFailureReason",
    "payInStateChangedAt" TIMESTAMP(3),
    "genesisId" INTEGER,
    "successorId" INTEGER,
    "benefactorId" INTEGER,
    "userId" INTEGER,
    "msatsBefore" BIGINT,
    "mcreditsBefore" BIGINT,

    CONSTRAINT "PayIn_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PayInCustodialToken" (
    "id" SERIAL NOT NULL,
    "payInId" INTEGER NOT NULL,
    "mtokens" BIGINT NOT NULL,
    "custodialTokenType" "CustodialTokenType" NOT NULL,

    CONSTRAINT "PayInCustodialToken_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PessimisticEnv" (
    "id" SERIAL NOT NULL,
    "payInId" INTEGER NOT NULL,
    "args" JSONB,
    "error" TEXT,

    CONSTRAINT "PessimisticEnv_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SubPayOutCustodialToken" (
    "id" SERIAL NOT NULL,
    "subName" CITEXT NOT NULL,
    "payOutCustodialTokenId" INTEGER NOT NULL,

    CONSTRAINT "SubPayOutCustodialToken_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PayOutCustodialToken" (
    "id" SERIAL NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "payOutType" "PayOutType" NOT NULL,
    "userId" INTEGER,
    "payInId" INTEGER NOT NULL,
    "mtokens" BIGINT NOT NULL,
    "custodialTokenType" "CustodialTokenType" NOT NULL,
    "msatsBefore" BIGINT,
    "mcreditsBefore" BIGINT,

    CONSTRAINT "PayOutCustodialToken_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PayInBolt11" (
    "id" SERIAL NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "payInId" INTEGER NOT NULL,
    "hash" TEXT NOT NULL,
    "preimage" TEXT,
    "bolt11" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "confirmedAt" TIMESTAMP(3),
    "confirmedIndex" BIGINT,
    "cancelledAt" TIMESTAMP(3),
    "msatsRequested" BIGINT NOT NULL,
    "msatsReceived" BIGINT,
    "expiryHeight" INTEGER,
    "acceptHeight" INTEGER,
    "userId" INTEGER,
    "protocolId" INTEGER,

    CONSTRAINT "PayInBolt11_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PayOutBolt11" (
    "id" SERIAL NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "payOutType" "PayOutType" NOT NULL,
    "userId" INTEGER NOT NULL,
    "hash" TEXT,
    "preimage" TEXT,
    "bolt11" TEXT,
    "msats" BIGINT NOT NULL,
    "status" "WithdrawlStatus",
    "protocolId" INTEGER,
    "payInId" INTEGER NOT NULL,

    CONSTRAINT "PayOutBolt11_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PayInBolt11Lud18" (
    "id" SERIAL NOT NULL,
    "payInBolt11Id" INTEGER NOT NULL,
    "name" TEXT,
    "identifier" TEXT,
    "email" TEXT,
    "pubkey" TEXT,

    CONSTRAINT "PayInBolt11Lud18_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PayInBolt11NostrNote" (
    "id" SERIAL NOT NULL,
    "payInBolt11Id" INTEGER NOT NULL,
    "note" JSONB NOT NULL,

    CONSTRAINT "PayInBolt11NostrNote_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PayInBolt11Comment" (
    "id" SERIAL NOT NULL,
    "payInBolt11Id" INTEGER NOT NULL,
    "comment" TEXT NOT NULL,

    CONSTRAINT "PayInBolt11Comment_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "ItemPayIn_payInId_key" ON "ItemPayIn"("payInId");

-- CreateIndex
CREATE INDEX "ItemPayIn_itemId_idx" ON "ItemPayIn"("itemId");

-- CreateIndex
CREATE INDEX "ItemPayIn_payInId_idx" ON "ItemPayIn"("payInId");

-- CreateIndex
CREATE UNIQUE INDEX "ItemPayIn_itemId_payInId_key" ON "ItemPayIn"("itemId", "payInId");

-- CreateIndex
CREATE UNIQUE INDEX "SubPayIn_payInId_key" ON "SubPayIn"("payInId");

-- CreateIndex
CREATE INDEX "SubPayIn_subName_idx" ON "SubPayIn"("subName");

-- CreateIndex
CREATE INDEX "SubPayIn_payInId_idx" ON "SubPayIn"("payInId");

-- CreateIndex
CREATE UNIQUE INDEX "SubPayIn_subName_payInId_key" ON "SubPayIn"("subName", "payInId");

-- CreateIndex
CREATE UNIQUE INDEX "PayIn_successorId_key" ON "PayIn"("successorId");

-- CreateIndex
CREATE INDEX "PayIn_userId_idx" ON "PayIn"("userId");

-- CreateIndex
CREATE INDEX "PayIn_payInType_idx" ON "PayIn"("payInType");

-- CreateIndex
CREATE INDEX "PayIn_successorId_idx" ON "PayIn"("successorId");

-- CreateIndex
CREATE INDEX "PayIn_payInStateChangedAt_idx" ON "PayIn"("payInStateChangedAt");

-- CreateIndex
CREATE UNIQUE INDEX "PessimisticEnv_payInId_key" ON "PessimisticEnv"("payInId");

-- CreateIndex
CREATE UNIQUE INDEX "SubPayOutCustodialToken_payOutCustodialTokenId_key" ON "SubPayOutCustodialToken"("payOutCustodialTokenId");

-- CreateIndex
CREATE INDEX "SubPayOutCustodialToken_subName_idx" ON "SubPayOutCustodialToken"("subName");

-- CreateIndex
CREATE UNIQUE INDEX "PayInBolt11_payInId_key" ON "PayInBolt11"("payInId");

-- CreateIndex
CREATE UNIQUE INDEX "PayInBolt11_hash_key" ON "PayInBolt11"("hash");

-- CreateIndex
CREATE UNIQUE INDEX "PayInBolt11_preimage_key" ON "PayInBolt11"("preimage");

-- CreateIndex
CREATE INDEX "PayInBolt11_created_at_idx" ON "PayInBolt11"("created_at");

-- CreateIndex
CREATE INDEX "PayInBolt11_confirmedIndex_idx" ON "PayInBolt11"("confirmedIndex");

-- CreateIndex
CREATE INDEX "PayInBolt11_confirmedAt_idx" ON "PayInBolt11"("confirmedAt");

-- CreateIndex
CREATE INDEX "PayInBolt11_cancelledAt_idx" ON "PayInBolt11"("cancelledAt");

-- CreateIndex
CREATE UNIQUE INDEX "PayOutBolt11_payInId_key" ON "PayOutBolt11"("payInId");

-- CreateIndex
CREATE INDEX "PayOutBolt11_created_at_idx" ON "PayOutBolt11"("created_at");

-- CreateIndex
CREATE INDEX "PayOutBolt11_userId_idx" ON "PayOutBolt11"("userId");

-- CreateIndex
CREATE INDEX "PayOutBolt11_hash_idx" ON "PayOutBolt11"("hash");

-- CreateIndex
CREATE INDEX "PayOutBolt11_protocolId_idx" ON "PayOutBolt11"("protocolId");

-- CreateIndex
CREATE INDEX "PayOutBolt11_status_idx" ON "PayOutBolt11"("status");

-- CreateIndex
CREATE UNIQUE INDEX "PayInBolt11Lud18_payInBolt11Id_key" ON "PayInBolt11Lud18"("payInBolt11Id");

-- CreateIndex
CREATE UNIQUE INDEX "PayInBolt11NostrNote_payInBolt11Id_key" ON "PayInBolt11NostrNote"("payInBolt11Id");

-- CreateIndex
CREATE UNIQUE INDEX "PayInBolt11Comment_payInBolt11Id_key" ON "PayInBolt11Comment"("payInBolt11Id");

-- AddForeignKey
ALTER TABLE "WalletLog" ADD CONSTRAINT "WalletLog_payOutBolt11Id_fkey" FOREIGN KEY ("payOutBolt11Id") REFERENCES "PayOutBolt11"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ItemPayIn" ADD CONSTRAINT "ItemPayIn_itemId_fkey" FOREIGN KEY ("itemId") REFERENCES "Item"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ItemPayIn" ADD CONSTRAINT "ItemPayIn_payInId_fkey" FOREIGN KEY ("payInId") REFERENCES "PayIn"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SubPayIn" ADD CONSTRAINT "SubPayIn_subName_fkey" FOREIGN KEY ("subName") REFERENCES "Sub"("name") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SubPayIn" ADD CONSTRAINT "SubPayIn_payInId_fkey" FOREIGN KEY ("payInId") REFERENCES "PayIn"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PayIn" ADD CONSTRAINT "PayIn_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PayIn" ADD CONSTRAINT "PayIn_genesisId_fkey" FOREIGN KEY ("genesisId") REFERENCES "PayIn"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PayIn" ADD CONSTRAINT "PayIn_successorId_fkey" FOREIGN KEY ("successorId") REFERENCES "PayIn"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PayIn" ADD CONSTRAINT "PayIn_benefactorId_fkey" FOREIGN KEY ("benefactorId") REFERENCES "PayIn"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PayInCustodialToken" ADD CONSTRAINT "PayInCustodialToken_payInId_fkey" FOREIGN KEY ("payInId") REFERENCES "PayIn"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PessimisticEnv" ADD CONSTRAINT "PessimisticEnv_payInId_fkey" FOREIGN KEY ("payInId") REFERENCES "PayIn"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SubPayOutCustodialToken" ADD CONSTRAINT "SubPayOutCustodialToken_subName_fkey" FOREIGN KEY ("subName") REFERENCES "Sub"("name") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SubPayOutCustodialToken" ADD CONSTRAINT "SubPayOutCustodialToken_payOutCustodialTokenId_fkey" FOREIGN KEY ("payOutCustodialTokenId") REFERENCES "PayOutCustodialToken"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PayOutCustodialToken" ADD CONSTRAINT "PayOutCustodialToken_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PayOutCustodialToken" ADD CONSTRAINT "PayOutCustodialToken_payInId_fkey" FOREIGN KEY ("payInId") REFERENCES "PayIn"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PayInBolt11" ADD CONSTRAINT "PayInBolt11_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PayInBolt11" ADD CONSTRAINT "PayInBolt11_protocolId_fkey" FOREIGN KEY ("protocolId") REFERENCES "WalletProtocol"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PayInBolt11" ADD CONSTRAINT "PayInBolt11_payInId_fkey" FOREIGN KEY ("payInId") REFERENCES "PayIn"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PayOutBolt11" ADD CONSTRAINT "PayOutBolt11_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PayOutBolt11" ADD CONSTRAINT "PayOutBolt11_protocolId_fkey" FOREIGN KEY ("protocolId") REFERENCES "WalletProtocol"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PayOutBolt11" ADD CONSTRAINT "PayOutBolt11_payInId_fkey" FOREIGN KEY ("payInId") REFERENCES "PayIn"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PayInBolt11Lud18" ADD CONSTRAINT "PayInBolt11Lud18_payInBolt11Id_fkey" FOREIGN KEY ("payInBolt11Id") REFERENCES "PayInBolt11"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PayInBolt11NostrNote" ADD CONSTRAINT "PayInBolt11NostrNote_payInBolt11Id_fkey" FOREIGN KEY ("payInBolt11Id") REFERENCES "PayInBolt11"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PayInBolt11Comment" ADD CONSTRAINT "PayInBolt11Comment_payInBolt11Id_fkey" FOREIGN KEY ("payInBolt11Id") REFERENCES "PayInBolt11"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
