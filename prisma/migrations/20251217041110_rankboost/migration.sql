-- AlterTable
ALTER TABLE "Item" ADD COLUMN "rankboost" DOUBLE PRECISION GENERATED ALWAYS AS (
    (COALESCE("boost",0)::double precision)
        * 1000.0
        * 0.3
    - COALESCE("downMsats",0)::double precision
) STORED NOT NULL;

-- CreateIndex
CREATE INDEX "Item_subName_rankboost_idx" ON "Item"("subName", "rankboost");
CREATE INDEX "Item_rankboost_idx" ON "Item"("rankboost");
CREATE INDEX "Item_total_boost_idx" ON "Item"(("boost" + "oldBoost"));
