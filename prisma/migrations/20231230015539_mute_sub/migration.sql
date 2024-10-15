/*
  Warnings:

  - You are about to drop the `Subscription` table. If the table is not empty, all the data it contains will be lost.

*/
-- DropForeignKey
ALTER TABLE "Subscription" DROP CONSTRAINT "Subscription_subName_fkey";

-- DropForeignKey
ALTER TABLE "Subscription" DROP CONSTRAINT "Subscription_userId_fkey";

-- DropTable
DROP TABLE "Subscription";

-- CreateTable
CREATE TABLE "MuteSub" (
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "subName" CITEXT NOT NULL,
    "userId" INTEGER NOT NULL,

    CONSTRAINT "MuteSub_pkey" PRIMARY KEY ("userId","subName")
);

-- CreateIndex
CREATE INDEX "MuteSub_subName_idx" ON "MuteSub"("subName");

-- CreateIndex
CREATE INDEX "MuteSub_created_at_idx" ON "MuteSub"("created_at");

-- AddForeignKey
ALTER TABLE "MuteSub" ADD CONSTRAINT "MuteSub_subName_fkey" FOREIGN KEY ("subName") REFERENCES "Sub"("name") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MuteSub" ADD CONSTRAINT "MuteSub_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
