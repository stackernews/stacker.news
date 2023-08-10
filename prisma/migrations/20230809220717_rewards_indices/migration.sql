-- CreateIndex
CREATE INDEX "ReferralAct_referrerId_idx" ON "ReferralAct"("referrerId");

-- CreateIndex
CREATE INDEX "ReferralAct_itemActId_idx" ON "ReferralAct"("itemActId");

-- This is an empty migration.

CREATE INDEX IF NOT EXISTS "ItemAct.created_at_day_index"
    ON "ItemAct"(date_trunc('day', created_at AT TIME ZONE 'UTC' AT TIME ZONE 'America/Chicago'));

CREATE INDEX IF NOT EXISTS "Donation.created_at_day_index"
    ON "Donation"(date_trunc('day', created_at AT TIME ZONE 'UTC' AT TIME ZONE 'America/Chicago'));