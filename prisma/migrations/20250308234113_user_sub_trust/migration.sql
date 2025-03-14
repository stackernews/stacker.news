-- AlterTable
ALTER TABLE "Item" ADD COLUMN     "subWeightedDownVotes" FLOAT NOT NULL DEFAULT 0,
ADD COLUMN     "subWeightedVotes" FLOAT NOT NULL DEFAULT 0;

CREATE INDEX "Item.sumSubVotes_index" ON "Item"(("subWeightedVotes" - "subWeightedDownVotes"));

-- CreateTable
CREATE TABLE "UserSubTrust" (
    "subName" CITEXT NOT NULL,
    "userId" INTEGER NOT NULL,
    "zapPostTrust" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "subZapPostTrust" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "zapCommentTrust" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "subZapCommentTrust" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "UserSubTrust_pkey" PRIMARY KEY ("userId","subName")
);

-- AddForeignKey
ALTER TABLE "UserSubTrust" ADD CONSTRAINT "UserSubTrust_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UserSubTrust" ADD CONSTRAINT "UserSubTrust_subName_fkey" FOREIGN KEY ("subName") REFERENCES "Sub"("name") ON DELETE CASCADE ON UPDATE CASCADE;

-- UserSubTrust is NOT populated, so this is a no-op ... but useful having it written out for migrating manually on deployment
UPDATE "Item"
SET "subWeightedVotes" = subquery."subWeightedVotes",
    "subWeightedDownVotes" = subquery."subWeightedDownVotes"
FROM (
    WITH sub_votes AS (
        SELECT "ItemAct"."itemId",
            CASE WHEN (SUM("ItemAct"."msats") FILTER (WHERE "ItemAct"."act" IN ('TIP', 'FEE')))::FLOAT > 0
            THEN COALESCE(
                LOG(
                    (SUM("ItemAct"."msats") FILTER (WHERE "ItemAct"."act" IN ('TIP', 'FEE')))::FLOAT / 1000
                ) * CASE
                        WHEN "Item"."parentId" IS NULL
                        THEN "UserSubTrust"."subZapPostTrust"
                        ELSE "UserSubTrust"."subZapCommentTrust"
                    END, 0)
            ELSE 0
            END AS "subWeightedVotes",
            CASE WHEN (SUM("ItemAct"."msats") FILTER (WHERE "ItemAct"."act" IN ('DONT_LIKE_THIS')))::FLOAT > 0
            THEN COALESCE(
                LOG(
                    (SUM("ItemAct"."msats") FILTER (WHERE "ItemAct"."act" IN ('DONT_LIKE_THIS')))::FLOAT / 1000
                ) * CASE
                        WHEN "Item"."parentId" IS NULL
                        THEN "UserSubTrust"."subZapPostTrust"
                        ELSE "UserSubTrust"."subZapCommentTrust"
                    END, 0)
            ELSE 0
            END AS "subWeightedDownVotes"
            FROM "ItemAct"
            JOIN "UserSubTrust" ON "ItemAct"."userId" = "UserSubTrust"."userId"
            JOIN "Item" ON "Item".id = "ItemAct"."itemId"
                AND "UserSubTrust"."subName" = "Item"."subName"
                AND "Item"."userId" <> "ItemAct"."userId"
            WHERE "ItemAct".act IN ('TIP', 'FEE', 'DONT_LIKE_THIS')
            GROUP BY "ItemAct"."itemId", "ItemAct"."userId", "UserSubTrust"."subZapPostTrust", "UserSubTrust"."subZapCommentTrust", "Item"."parentId"
    )
    SELECT "itemId", SUM("subWeightedVotes") AS "subWeightedVotes", SUM("subWeightedDownVotes") AS "subWeightedDownVotes"
    FROM sub_votes
    GROUP BY "itemId"
) AS subquery
WHERE "Item".id = subquery."itemId";

CREATE MATERIALIZED VIEW IF NOT EXISTS hot_score_view AS
  SELECT id,
         ("Item"."weightedVotes" - "Item"."weightedDownVotes" + ("Item"."weightedComments"*0.5) + ("Item".boost / 5000))
            / POWER(GREATEST(3, EXTRACT(EPOCH FROM (now() - "Item".created_at))/3600), 1.1) AS hot_score,
         ("Item"."subWeightedVotes" - "Item"."subWeightedDownVotes" + ("Item"."weightedComments"*0.5) + ("Item".boost / 5000))
            / POWER(GREATEST(3, EXTRACT(EPOCH FROM (now() - "Item".created_at))/3600), 1.1) AS sub_hot_score
  FROM "Item"
  WHERE "Item"."weightedVotes" > 0 OR "Item"."weightedDownVotes" > 0 OR "Item"."subWeightedVotes" > 0
    OR "Item"."subWeightedDownVotes" > 0 OR "Item"."weightedComments" > 0 OR "Item".boost > 0;

CREATE UNIQUE INDEX IF NOT EXISTS hot_score_view_id_idx ON hot_score_view(id);
CREATE INDEX IF NOT EXISTS hot_score_view_hot_score_idx ON hot_score_view(hot_score DESC NULLS LAST);
CREATE INDEX IF NOT EXISTS hot_score_view_sub_hot_score_idx ON hot_score_view(sub_hot_score DESC NULLS LAST);
