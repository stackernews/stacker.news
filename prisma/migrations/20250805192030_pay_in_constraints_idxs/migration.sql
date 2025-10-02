-- CreateIndex
CREATE UNIQUE INDEX "PollVote_payInId_key" ON "PollVote"("payInId");

-- CreateIndex
CREATE UNIQUE INDEX "ItemPayIn_payInId_key" ON "ItemPayIn"("payInId");

-- CreateIndex
CREATE INDEX "ItemPayIn_itemId_idx" ON "ItemPayIn"("itemId");

-- CreateIndex
CREATE UNIQUE INDEX "SubPayIn_payInId_key" ON "SubPayIn"("payInId");

-- CreateIndex
CREATE INDEX "SubPayIn_subName_idx" ON "SubPayIn"("subName");

-- CreateIndex
CREATE UNIQUE INDEX "PayIn_successorId_key" ON "PayIn"("successorId");

-- CreateIndex
CREATE INDEX "PayIn_userId_idx" ON "PayIn"("userId");

-- CreateIndex
CREATE INDEX "PayIn_payInType_idx" ON "PayIn"("payInType");

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

-- CreateIndex
CREATE INDEX "WalletLog_payInId_idx" ON "WalletLog"("payInId");

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
CREATE INDEX "PayInBolt11_userId_idx" ON "PayInBolt11"("userId");

-- CreateIndex
CREATE INDEX "PayInBolt11_protocolId_idx" ON "PayInBolt11"("protocolId");

-- CreateIndex
CREATE INDEX "PayInCustodialToken_payInId_idx" ON "PayInCustodialToken"("payInId");

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
CREATE INDEX "UploadPayIn_uploadId_idx" ON "UploadPayIn"("uploadId");

-- CreateIndex
CREATE INDEX "UploadPayIn_payInId_idx" ON "UploadPayIn"("payInId");

-- CreateIndex
CREATE UNIQUE INDEX "UploadPayIn_uploadId_payInId_key" ON "UploadPayIn"("uploadId", "payInId");

-- CreateIndex
CREATE INDEX "Earn_payOutCustodialTokenId_idx" ON "Earn"("payOutCustodialTokenId");

-- CreateIndex
CREATE UNIQUE INDEX "LnWith_payInId_key" ON "LnWith"("payInId");

-- AddForeignKey
ALTER TABLE "WalletLog" ADD CONSTRAINT "WalletLog_payInId_fkey" FOREIGN KEY ("payInId") REFERENCES "PayIn"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LnWith" ADD CONSTRAINT "LnWith_payInId_fkey" FOREIGN KEY ("payInId") REFERENCES "PayIn"("id") ON DELETE CASCADE ON UPDATE CASCADE;

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
ALTER TABLE "PayInBolt11" ADD CONSTRAINT "PayInBolt11_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

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

-- AddForeignKey
ALTER TABLE "RefundCustodialToken" ADD CONSTRAINT "RefundCustodialToken_payInId_fkey" FOREIGN KEY ("payInId") REFERENCES "PayIn"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PollVote" ADD CONSTRAINT "PollVote_payInId_fkey" FOREIGN KEY ("payInId") REFERENCES "PayIn"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UploadPayIn" ADD CONSTRAINT "UploadPayIn_uploadId_fkey" FOREIGN KEY ("uploadId") REFERENCES "Upload"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UploadPayIn" ADD CONSTRAINT "UploadPayIn_payInId_fkey" FOREIGN KEY ("payInId") REFERENCES "PayIn"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Earn" ADD CONSTRAINT "Earn_payOutCustodialTokenId_fkey" FOREIGN KEY ("payOutCustodialTokenId") REFERENCES "PayOutCustodialToken"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- add indices associated with creating daily and hourly views
CREATE INDEX IF NOT EXISTS "PayIn.created_at_hour_index"
    ON "ItemAct"(date_trunc('hour', created_at AT TIME ZONE 'UTC' AT TIME ZONE 'America/Chicago'));
CREATE INDEX IF NOT EXISTS "PayIn.created_at_day_index"
    ON "PayIn"(date_trunc('day', created_at AT TIME ZONE 'UTC' AT TIME ZONE 'America/Chicago'));
CREATE INDEX IF NOT EXISTS "PayIn.payInStateChangedAt_hour_index"
    ON "PayIn"(date_trunc('hour', "payInStateChangedAt" AT TIME ZONE 'UTC' AT TIME ZONE 'America/Chicago'));
CREATE INDEX IF NOT EXISTS "PayIn.payInStateChangedAt_day_index"
    ON "PayIn"(date_trunc('day', "payInStateChangedAt" AT TIME ZONE 'UTC' AT TIME ZONE 'America/Chicago'));

CREATE OR REPLACE FUNCTION "PayIn_payInStateChangedAt"()
RETURNS TRIGGER AS $$
BEGIN
    NEW."payInStateChangedAt" = now();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE TRIGGER "PayIn_payInStateChangedAt"
BEFORE UPDATE ON "PayIn"
FOR EACH ROW
WHEN (OLD."payInState" <> NEW."payInState")
EXECUTE FUNCTION "PayIn_payInStateChangedAt"();

CREATE OR REPLACE FUNCTION "PayIn_payInFailureReason"()
RETURNS TRIGGER AS $$
BEGIN
    NEW."payInFailureReason" = CASE
        WHEN NEW."payInFailureReason" IS NULL THEN 'UNKNOWN_FAILURE'
        ELSE NEW."payInFailureReason"
    END;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE TRIGGER "PayIn_payInFailureReason"
AFTER UPDATE ON "PayIn"
FOR EACH ROW
WHEN (NEW."payInState" = 'FAILED')
EXECUTE FUNCTION "PayIn_payInFailureReason"();

ALTER TABLE "PayIn" ADD CONSTRAINT "mcost_positive" CHECK ("mcost" >= 0) NOT VALID;

ALTER TABLE "PayInCustodialToken" ADD CONSTRAINT "mtokens_positive" CHECK ("mtokens" >= 0) NOT VALID;
ALTER TABLE "PayInCustodialToken" ADD CONSTRAINT "mtokensAfter_positive" CHECK ("mtokensAfter" IS NULL OR "mtokensAfter" >= 0) NOT VALID;

ALTER TABLE "PayOutCustodialToken" ADD CONSTRAINT "mtokens_positive" CHECK ("mtokens" >= 0) NOT VALID;
ALTER TABLE "PayOutCustodialToken" ADD CONSTRAINT "mtokensAfter_positive" CHECK ("mtokensAfter" IS NULL OR "mtokensAfter" >= 0) NOT VALID;

ALTER TABLE "PayInBolt11" ADD CONSTRAINT "msatsRequested_positive" CHECK ("msatsRequested" >= 0) NOT VALID;
ALTER TABLE "PayInBolt11" ADD CONSTRAINT "msatsReceived_positive" CHECK ("msatsReceived" IS NULL OR "msatsReceived" >= 0) NOT VALID;

ALTER TABLE "PayOutBolt11" ADD CONSTRAINT "msats_positive" CHECK ("msats" >= 0) NOT VALID;