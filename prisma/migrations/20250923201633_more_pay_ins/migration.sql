-- CreateTable
CREATE TABLE "RefundCustodialToken" (
    "id" SERIAL NOT NULL,
    "payInId" INTEGER NOT NULL,
    "mtokens" BIGINT NOT NULL,
    "mtokensAfter" BIGINT,
    "custodialTokenType" "CustodialTokenType" NOT NULL,

    CONSTRAINT "RefundCustodialToken_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "RefundCustodialToken_payInId_idx" ON "RefundCustodialToken"("payInId");

-- CreateIndex
CREATE INDEX "PayIn_created_at_idx" ON "PayIn"("created_at");

-- CreateIndex
CREATE INDEX "PayIn_genesisId_idx" ON "PayIn"("genesisId");

-- CreateIndex
CREATE INDEX "PayIn_payInState_idx" ON "PayIn"("payInState");

-- CreateIndex
CREATE INDEX "PayIn_benefactorId_idx" ON "PayIn"("benefactorId");

-- CreateIndex
CREATE INDEX "PayInBolt11_payInId_idx" ON "PayInBolt11"("payInId");

-- CreateIndex
CREATE INDEX "PayInBolt11_hash_idx" ON "PayInBolt11"("hash");

-- CreateIndex
CREATE INDEX "PayInBolt11_userId_idx" ON "PayInBolt11"("userId");

-- CreateIndex
CREATE INDEX "PayInBolt11_protocolId_idx" ON "PayInBolt11"("protocolId");

-- CreateIndex
CREATE INDEX "PayInBolt11Comment_payInBolt11Id_idx" ON "PayInBolt11Comment"("payInBolt11Id");

-- CreateIndex
CREATE INDEX "PayInBolt11Lud18_payInBolt11Id_idx" ON "PayInBolt11Lud18"("payInBolt11Id");

-- CreateIndex
CREATE INDEX "PayInBolt11NostrNote_payInBolt11Id_idx" ON "PayInBolt11NostrNote"("payInBolt11Id");

-- CreateIndex
CREATE INDEX "PayInCustodialToken_payInId_idx" ON "PayInCustodialToken"("payInId");

-- CreateIndex
CREATE INDEX "PayOutBolt11_payInId_idx" ON "PayOutBolt11"("payInId");

-- CreateIndex
CREATE INDEX "PayOutBolt11_payOutType_idx" ON "PayOutBolt11"("payOutType");

-- CreateIndex
CREATE INDEX "PayOutCustodialToken_created_at_idx" ON "PayOutCustodialToken"("created_at");

-- CreateIndex
CREATE INDEX "PayOutCustodialToken_payInId_idx" ON "PayOutCustodialToken"("payInId");

-- CreateIndex
CREATE INDEX "PayOutCustodialToken_userId_idx" ON "PayOutCustodialToken"("userId");

-- CreateIndex
CREATE INDEX "PayOutCustodialToken_payOutType_idx" ON "PayOutCustodialToken"("payOutType");

-- CreateIndex
CREATE INDEX "PessimisticEnv_payInId_idx" ON "PessimisticEnv"("payInId");

-- CreateIndex
CREATE INDEX "SubPayOutCustodialToken_payOutCustodialTokenId_idx" ON "SubPayOutCustodialToken"("payOutCustodialTokenId");

-- AddForeignKey
ALTER TABLE "RefundCustodialToken" ADD CONSTRAINT "RefundCustodialToken_payInId_fkey" FOREIGN KEY ("payInId") REFERENCES "PayIn"("id") ON DELETE CASCADE ON UPDATE CASCADE;
