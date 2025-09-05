-- AlterTable
ALTER TABLE "Earn" ADD COLUMN     "payOutCustodialTokenId" INTEGER,
ADD COLUMN     "typeProportion" FLOAT;

-- AddForeignKey
ALTER TABLE "Earn" ADD CONSTRAINT "Earn_payOutCustodialTokenId_fkey" FOREIGN KEY ("payOutCustodialTokenId") REFERENCES "PayOutCustodialToken"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- add user for rewards if they don't exist (for dev)
INSERT INTO users (id, name) VALUES (9513, 'rewards') ON CONFLICT DO NOTHING;

CREATE OR REPLACE FUNCTION reward_prospects(
    min TIMESTAMP(3), max TIMESTAMP(3), ival INTERVAL, date_part TEXT,
    percentile_cutoff INTEGER DEFAULT 50,
    zap_threshold INTEGER DEFAULT 20,
    each_zap_portion FLOAT DEFAULT 4.0,
    each_item_portion FLOAT DEFAULT 4.0,
    handicap_ids INTEGER[] DEFAULT '{616, 6030, 4502, 27}',
    handicap_zap_mult FLOAT DEFAULT 0.5)
RETURNS TABLE (
    "userId" INTEGER,
    rank INTEGER,
    "typeProportion" FLOAT,
    "type" TEXT,
    "typeId" INTEGER
)
LANGUAGE plpgsql
AS $$
DECLARE
    min_utc TIMESTAMP(3) := timezone('utc', min AT TIME ZONE 'America/Chicago');
BEGIN
    RETURN QUERY
    SELECT "userId", rank, "typeProportion", "type", "typeId"
    FROM generate_series(min, max, ival) period(t),
    LATERAL
        (WITH item_proportions AS (
            SELECT *,
                CASE WHEN "parentId" IS NULL THEN 'POST' ELSE 'COMMENT' END as type,
                CASE WHEN "weightedVotes" > 0 THEN "weightedVotes"/(sum("weightedVotes") OVER (PARTITION BY "parentId" IS NULL)) ELSE 0 END AS proportion
            FROM (
                    SELECT *,
                        NTILE(100)  OVER (PARTITION BY "parentId" IS NULL ORDER BY ("weightedVotes"-"weightedDownVotes") desc) AS percentile,
                        ROW_NUMBER()  OVER (PARTITION BY "parentId" IS NULL ORDER BY ("weightedVotes"-"weightedDownVotes") desc) AS rank
                    FROM "Item"
                    JOIN LATERAL (
                        SELECT "PayIn".*
                        FROM "ItemPayIn"
                        JOIN "PayIn" ON "PayIn".id = "ItemPayIn"."payInId" AND "PayIn"."payInType" = 'ITEM_CREATE'
                        WHERE "ItemPayIn"."itemId" = "Item".id AND ("PayIn"."userId" = "Item"."userId" OR "PayIn"."payInState" = 'PAID')
                        ORDER BY "PayIn"."created_at" DESC
                        LIMIT 1
                    ) "PayIn" ON "PayIn".id IS NOT NULL
                    WHERE date_trunc(date_part, "PayIn"."payInStateChangedAt" AT TIME ZONE 'UTC' AT TIME ZONE 'America/Chicago') = period.t
                    AND "weightedVotes" > 0
                    AND "deletedAt" IS NULL
                    AND NOT bio
                )
            ) x
            WHERE x.percentile <= percentile_cutoff
        ),
        -- get top item zappers of top posts and comments
        item_zapper_islands AS (
            SELECT "PayIn"."userId", item_proportions.id, item_proportions.proportion, item_proportions."parentId",
                "PayIn".mcost as zapped_msats, "PayIn"."payInStateChangedAt" as acted_at,
                ROW_NUMBER() OVER (partition by item_proportions.id order by "PayIn"."payInStateChangedAt" asc)
                - ROW_NUMBER() OVER (partition by item_proportions.id, "PayIn"."userId" order by "PayIn"."payInStateChangedAt" asc) AS island
            FROM item_proportions
            JOIN "ItemPayIn" ON "ItemPayIn"."itemId" = item_proportions.id
            JOIN "PayIn" ON "PayIn".id = "ItemPayIn"."payInId" AND "PayIn"."payInType" = 'ZAP' AND "PayIn"."payInState" = 'PAID'
            WHERE date_trunc(date_part, "PayIn"."payInStateChangedAt" AT TIME ZONE 'UTC' AT TIME ZONE 'America/Chicago') = period.t
        ),
        -- isolate contiguous upzaps from the same user on the same item so that when we take the log
        -- of the upzaps it accounts for successive zaps and does not disproportionately reward them
        -- quad root of the total tipped
        item_zappers AS (
            SELECT "userId", item_zapper_islands.id, item_zapper_islands.proportion,
                item_zapper_islands."parentId", GREATEST(power(sum(zapped_msats) / 1000, 0.25), 0) as zapped_msats, min(acted_at) as acted_at
            FROM item_zapper_islands
            GROUP BY "userId", item_zapper_islands.id, item_zapper_islands.proportion, item_zapper_islands."parentId", island
            HAVING sum(zapped_msats) / 1000 > zap_threshold
        ),
        -- the relative contribution of each zapper to the post/comment
        -- early component: 1/ln(early_rank + e - 1)
        -- tipped component: how much they tipped relative to the total tipped for the item
        -- multiplied by the relative rank of the item to the total items
        -- multiplied by the trust of the user
        item_zapper_ratios AS (
            SELECT "userId", sum((2*early_multiplier+1)*tipped_ratio*ratio*handicap_mult) as item_zapper_proportion,
                "parentId" IS NULL as "isPost", CASE WHEN "parentId" IS NULL THEN 'TIP_POST' ELSE 'TIP_COMMENT' END as type
            FROM (
                SELECT *,
                    1.0/LN(ROW_NUMBER() OVER (partition by item_zappers.id order by acted_at asc) + EXP(1.0) - 1) AS early_multiplier,
                    zapped_msats::float/(sum(zapped_msats) OVER (partition by item_zappers.id)) zapped_msats_proportion,
                    CASE WHEN item_zappers."userId" = ANY(handicap_ids) THEN handicap_zap_mult ELSE 1 END as handicap_mult
                FROM item_zappers
                WHERE zapped_msats > 0
            ) u
            JOIN users on "userId" = users.id
            GROUP BY "userId", "parentId" IS NULL
        ),
        SELECT "userId", ROW_NUMBER() OVER (PARTITION BY "isPost" ORDER BY item_zapper_proportion DESC) as rank,
            item_zapper_proportion/(sum(item_zapper_proportion) OVER (PARTITION BY "isPost"))/each_zap_portion as "typeProportion",
            "type", NULL as "typeId"
        FROM item_zapper_ratios
        WHERE item_zapper_proportion > 0
        UNION ALL
        SELECT "userId", rank, item_proportions.proportion/each_item_portion as "typeProportion",
            "type", item_proportions.id as "typeId"
        FROM item_proportions;
END;
$$;

CREATE TYPE "PayInTypeTotalMsats" AS (
    "PayInType" "PayInType",
    "totalMsats" BIGINT
);

CREATE OR REPLACE FUNCTION rewards(min TIMESTAMP(3), max TIMESTAMP(3), ival INTERVAL, date_part TEXT)
RETURNS TABLE (
    t TIMESTAMP(3), "totalMsats" BIGINT, "payInTypes" "PayInTypeTotalMsats"[]
)
LANGUAGE plpgsql
AS $$
DECLARE
BEGIN
    RETURN QUERY
    SELECT period.t,
        coalesce(sum(x."totalMsats"), 0)::BIGINT as "totalMsats",
        array_agg(row(x."PayInType", x."totalMsats")::"PayInTypeTotalMsats") as "payInTypes"
    FROM generate_series(min, max, ival) period(t),
    LATERAL
    (
        SELECT "PayInType", coalesce(sum("mtokens"), 0)::BIGINT as "totalMsats"
        FROM "PayIn"
        JOIN "PayOutCustodialToken" ON "PayOutCustodialToken"."payInId" = "PayIn"."id" AND "PayOutCustodialToken"."payOutType" = 'REWARDS_POOL'
        WHERE date_trunc(date_part, "PayIn"."payInStateChangedAt" AT TIME ZONE 'UTC' AT TIME ZONE 'America/Chicago') = period.t
        AND "PayIn"."payInState" = 'PAID'
        GROUP BY "PayInType"
    ) x
    GROUP BY period.t;
END;
$$;