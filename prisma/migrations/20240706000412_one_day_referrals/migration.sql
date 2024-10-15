-- CreateEnum
CREATE TYPE "OneDayReferralType" AS ENUM ('REFERRAL', 'POST', 'COMMENT', 'PROFILE', 'TERRITORY');

-- CreateTable
CREATE TABLE "OneDayReferral" (
    "id" SERIAL NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "referrerId" INTEGER NOT NULL,
    "refereeId" INTEGER NOT NULL,
    "type" "OneDayReferralType" NOT NULL,
    "typeId" TEXT NOT NULL,

    CONSTRAINT "OneDayReferral_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "OneDayReferral_created_at_idx" ON "OneDayReferral"("created_at");

-- CreateIndex
CREATE INDEX "OneDayReferral_referrerId_idx" ON "OneDayReferral"("referrerId");

-- CreateIndex
CREATE INDEX "OneDayReferral_refereeId_idx" ON "OneDayReferral"("refereeId");

-- CreateIndex
CREATE INDEX "OneDayReferral_type_typeId_idx" ON "OneDayReferral"("type", "typeId");

-- AddForeignKey
ALTER TABLE "OneDayReferral" ADD CONSTRAINT "OneDayReferral_referrerId_fkey" FOREIGN KEY ("referrerId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OneDayReferral" ADD CONSTRAINT "OneDayReferral_refereeId_fkey" FOREIGN KEY ("refereeId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
