-- AlterTable
ALTER TABLE "Item" DROP COLUMN "weightedDownVotesLocal",
DROP COLUMN "weightedVotesLocal",
ADD COLUMN     "hotScore" DOUBLE PRECISION NOT NULL DEFAULT 0,
ADD COLUMN     "subHotScore" DOUBLE PRECISION NOT NULL DEFAULT 0,
ADD COLUMN     "subWeightedDownVotes" DOUBLE PRECISION NOT NULL DEFAULT 0,
ADD COLUMN     "subWeightedVotes" DOUBLE PRECISION NOT NULL DEFAULT 0;

-- CreateIndex
CREATE INDEX "Item_hotScore_idx" ON "Item"("hotScore");

-- CreateIndex
CREATE INDEX "Item_subHotScore_idx" ON "Item"("subHotScore");

WITH changed_rows AS (
  SELECT id,
         (CASE WHEN "Item"."weightedVotes" - "Item"."weightedDownVotes" > 0 THEN
              GREATEST("Item"."weightedVotes" - "Item"."weightedDownVotes", POWER("Item"."weightedVotes" - "Item"."weightedDownVotes", 1.2))
            ELSE
              "Item"."weightedVotes" - "Item"."weightedDownVotes"
            END + "Item"."weightedComments"*0.5) + ("Item".boost / 5000)
            / POWER(GREATEST(3, EXTRACT(EPOCH FROM (now() - "Item".created_at))/3600), 1.3) AS new_hot_rank,
         (CASE WHEN "Item"."subWeightedVotes" - "Item"."subWeightedDownVotes" > 0 THEN
              GREATEST("Item"."subWeightedVotes" - "Item"."subWeightedDownVotes", POWER("Item"."subWeightedVotes" - "Item"."subWeightedDownVotes", 1.2))
            ELSE
              "Item"."subWeightedVotes" - "Item"."subWeightedDownVotes"
            END + "Item"."weightedComments"*0.5) + ("Item".boost / 5000)
            / POWER(GREATEST(3, EXTRACT(EPOCH FROM (now() - "Item".created_at))/3600), 1.3) AS new_sub_hot_rank
  FROM "Item"
  WHERE "Item"."weightedVotes" > 0 OR "Item"."weightedDownVotes" > 0 OR "Item"."subWeightedVotes" > 0 OR "Item"."subWeightedDownVotes" > 0 OR "Item"."weightedComments" > 0
  OR "Item".boost > 0
)
UPDATE "Item"
SET "hotScore" = changed_rows."new_hot_rank",
    "subHotScore" = changed_rows."new_sub_hot_rank"
FROM changed_rows
WHERE "Item".id = changed_rows.id
  AND ("Item"."hotScore" IS DISTINCT FROM changed_rows."new_hot_rank"
    OR "Item"."subHotScore" IS DISTINCT FROM changed_rows."new_sub_hot_rank");