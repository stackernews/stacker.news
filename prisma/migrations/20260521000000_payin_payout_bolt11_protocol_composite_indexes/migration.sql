-- Composite indexes supporting wallet activity filters in api/resolvers/payIn.js
-- that lookup `protocolId IN (...) AND payInId = X` instead of joining through
-- WalletProtocol/Wallet for each candidate row.

-- CreateIndex
CREATE INDEX IF NOT EXISTS "PayInBolt11_protocolId_payInId_idx" ON "PayInBolt11"("protocolId", "payInId");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "PayOutBolt11_protocolId_payInId_idx" ON "PayOutBolt11"("protocolId", "payInId");
