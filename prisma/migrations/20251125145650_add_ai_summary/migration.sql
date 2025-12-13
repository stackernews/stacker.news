-- CreateTable
CREATE TABLE "ItemSummary" (
    "id" SERIAL NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "itemId" INTEGER NOT NULL,
    "text" TEXT NOT NULL,
    "sources" JSONB,

    CONSTRAINT "ItemSummary_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ItemClarification" (
    "id" SERIAL NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "itemId" INTEGER NOT NULL,
    "term" TEXT NOT NULL,
    "text" TEXT NOT NULL,

    CONSTRAINT "ItemClarification_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "ItemSummary_itemId_key" ON "ItemSummary"("itemId");

-- CreateIndex
CREATE INDEX "ItemClarification_itemId_idx" ON "ItemClarification"("itemId");

-- CreateIndex
CREATE UNIQUE INDEX "ItemClarification_itemId_term_key" ON "ItemClarification"("itemId", "term");

-- AddForeignKey
ALTER TABLE "ItemSummary" ADD CONSTRAINT "ItemSummary_itemId_fkey" FOREIGN KEY ("itemId") REFERENCES "Item"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ItemClarification" ADD CONSTRAINT "ItemClarification_itemId_fkey" FOREIGN KEY ("itemId") REFERENCES "Item"("id") ON DELETE CASCADE ON UPDATE CASCADE;
