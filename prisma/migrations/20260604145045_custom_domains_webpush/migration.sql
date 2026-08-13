-- AlterTable
ALTER TABLE "PushSubscription" ADD COLUMN     "domainId" INTEGER;

-- CreateIndex
CREATE INDEX "PushSubscription_domainId_idx" ON "PushSubscription"("domainId");

-- AddForeignKey
ALTER TABLE "PushSubscription" ADD CONSTRAINT "PushSubscription_domainId_fkey" FOREIGN KEY ("domainId") REFERENCES "Domain"("id") ON DELETE SET NULL ON UPDATE CASCADE;
