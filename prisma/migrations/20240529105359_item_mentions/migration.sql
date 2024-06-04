-- CreateTable
CREATE TABLE "ItemMention" (
    "id" SERIAL NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "referrerId" INTEGER NOT NULL,
    "refereeId" INTEGER NOT NULL,

    CONSTRAINT "ItemMention_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ItemMention.created_at_index" ON "ItemMention"("created_at");

-- CreateIndex
CREATE INDEX "ItemMention.referrerId_index" ON "ItemMention"("referrerId");

-- CreateIndex
CREATE INDEX "ItemMention.refereeId_index" ON "ItemMention"("refereeId");

-- CreateIndex
CREATE UNIQUE INDEX "ItemMention.referrerId_refereeId_unique" ON "ItemMention"("referrerId", "refereeId");

-- AddForeignKey
ALTER TABLE "ItemMention" ADD CONSTRAINT "ItemMention_referrerId_fkey" FOREIGN KEY ("referrerId") REFERENCES "Item"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ItemMention" ADD CONSTRAINT "ItemMention_refereeId_fkey" FOREIGN KEY ("refereeId") REFERENCES "Item"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AlterTable
ALTER TABLE "users" ADD COLUMN     "noteItemMentions" BOOLEAN NOT NULL DEFAULT true;
