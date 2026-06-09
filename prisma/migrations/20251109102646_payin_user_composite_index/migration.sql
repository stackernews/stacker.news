-- CreateIndex
CREATE INDEX "PayIn_userId_payInState_payInStateChangedAt_payInType_idx" ON "PayIn"("userId", "payInState", "payInStateChangedAt", "payInType");
