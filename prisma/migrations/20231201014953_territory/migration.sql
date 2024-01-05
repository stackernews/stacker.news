/*
  Warnings:

  - Added the required column `billingCost` to the `Sub` table without a default value. This is not possible if the table is not empty.
  - Added the required column `billingType` to the `Sub` table without a default value. This is not possible if the table is not empty.
  - Added the required column `userId` to the `Sub` table without a default value. This is not possible if the table is not empty.

*/
-- CreateEnum
CREATE TYPE "BillingType" AS ENUM ('MONTHLY', 'YEARLY', 'ONCE');

-- CreateEnum
CREATE TYPE "SubActType" AS ENUM ('BILLING', 'REVENUE');

-- AlterEnum
ALTER TYPE "Status" ADD VALUE 'GRACE';

-- add new columns giving old columns default special default values
ALTER TABLE "Sub"
ADD COLUMN     "billedLastAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
ADD COLUMN     "billingCost" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "billingType" "BillingType" NOT NULL DEFAULT 'ONCE',
ADD COLUMN     "parentName" CITEXT,
ADD COLUMN     "path" ltree,
ADD COLUMN     "status" "Status" NOT NULL DEFAULT 'ACTIVE',
ADD COLUMN     "userId" INTEGER NOT NULL DEFAULT 616,
ADD COLUMN     "rewardsPct" INTEGER NOT NULL DEFAULT 100;

-- set the default values for the new columns from this point forward
ALTER TABLE "Sub"
ALTER COLUMN     "billingCost" DROP DEFAULT,
ALTER COLUMN     "billingType" DROP DEFAULT,
ALTER COLUMN     "userId" DROP DEFAULT,
ALTER COLUMN     "rewardsPct" SET DEFAULT 50;

-- constrain percent to be between 0 and 100
ALTER TABLE "Sub" ADD CONSTRAINT "rewardsPct" CHECK ("rewardsPct" >= 0 AND "rewardsPct" <= 100) NOT VALID;

-- we plan to structure subs as a tree
UPDATE "Sub" SET "path" = LOWER(name)::ltree;

-- assign subs to appropriate people
-- UPDATE "Sub" SET "userId" = 6030 WHERE name = 'tech';
-- UPDATE "Sub" SET "userId" = 4502 WHERE name = 'meta';

-- CreateTable
CREATE TABLE "SubAct" (
    "id" SERIAL NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "userId" INTEGER NOT NULL,
    "subName" CITEXT NOT NULL,
    "msats" BIGINT NOT NULL,
    "type" "SubActType" NOT NULL,

    CONSTRAINT "SubAct_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "SubAct_userId_idx" ON "SubAct"("userId");

-- CreateIndex
CREATE INDEX "SubAct_userId_type_idx" ON "SubAct"("userId", "type");

-- CreateIndex
CREATE INDEX "SubAct_type_idx" ON "SubAct"("type");

-- CreateIndex
CREATE INDEX "SubAct_created_at_idx" ON "SubAct"("created_at");

-- CreateIndex
CREATE INDEX "SubAct_created_at_type_idx" ON "SubAct"("created_at", "type");

-- CreateIndex
CREATE INDEX "SubAct_userId_created_at_type_idx" ON "SubAct"("userId", "created_at", "type");

-- CreateIndex
CREATE INDEX "Sub_parentName_idx" ON "Sub"("parentName");

-- CreateIndex
CREATE INDEX "Sub_created_at_idx" ON "Sub"("created_at");

-- CreateIndex
CREATE INDEX "Sub_userId_idx" ON "Sub"("userId");

-- CreateIndex
CREATE INDEX "Sub_path_idx" ON "Sub" USING GIST ("path" gist_ltree_ops(siglen=2024));

-- AddForeignKey
ALTER TABLE "Sub" ADD CONSTRAINT "Sub_parentName_fkey" FOREIGN KEY ("parentName") REFERENCES "Sub"("name") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Sub" ADD CONSTRAINT "Sub_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SubAct" ADD CONSTRAINT "SubAct_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SubAct" ADD CONSTRAINT "SubAct_subName_fkey" FOREIGN KEY ("subName") REFERENCES "Sub"("name") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE OR REPLACE FUNCTION update_sub_path() RETURNS TRIGGER AS $$
    DECLARE
        npath ltree;
    BEGIN
        IF NEW."parentName" IS NULL THEN
            SELECT LOWER(NEW.name)::ltree INTO npath;
            NEW."path" = npath;
        ELSEIF TG_OP = 'INSERT' OR OLD."parentName" IS NULL OR OLD."parentName" != NEW."parentName" THEN
            SELECT "path" || LOWER(NEW.name)::text
            FROM "Sub"
            WHERE name = NEW."parentName"
            INTO npath;

            IF npath IS NULL THEN
                RAISE EXCEPTION 'Invalid parent name %', NEW."parentName";
            END IF;
            NEW."path" = npath;
        END IF;
        RETURN NEW;
    END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER sub_path_tgr
    BEFORE INSERT OR UPDATE ON "Sub"
    FOR EACH ROW EXECUTE PROCEDURE update_sub_path();

-- fix balance limit check
CREATE OR REPLACE FUNCTION create_invoice(hash TEXT, bolt11 TEXT, expires_at timestamp(3) without time zone,
    msats_req BIGINT, user_id INTEGER, idesc TEXT, comment TEXT, lud18_data JSONB, inv_limit INTEGER, balance_limit_msats BIGINT)
RETURNS "Invoice"
LANGUAGE plpgsql
AS $$
DECLARE
    invoice "Invoice";
    inv_limit_reached BOOLEAN;
    balance_limit_reached BOOLEAN;
    inv_pending_msats BIGINT;
BEGIN
    PERFORM ASSERT_SERIALIZED();

    -- prevent too many pending invoices
    SELECT inv_limit > 0 AND count(*) >= inv_limit, COALESCE(sum("msatsRequested"), 0) INTO inv_limit_reached, inv_pending_msats
    FROM "Invoice"
    WHERE "userId" = user_id AND "expiresAt" > now_utc() AND "confirmedAt" IS NULL AND cancelled = false;

    IF inv_limit_reached THEN
        RAISE EXCEPTION 'SN_INV_PENDING_LIMIT';
    END IF;

    -- prevent pending invoices + msats from exceeding the limit
    SELECT balance_limit_msats > 0 AND inv_pending_msats+msats_req+msats > balance_limit_msats INTO balance_limit_reached
    FROM users
    WHERE id = user_id;

    IF balance_limit_reached THEN
        RAISE EXCEPTION 'SN_INV_EXCEED_BALANCE';
    END IF;

    -- we good, proceed frens
    INSERT INTO "Invoice" (hash, bolt11, "expiresAt", "msatsRequested", "userId", created_at, updated_at, "desc", comment, "lud18Data")
    VALUES (hash, bolt11, expires_at, msats_req, user_id, now_utc(), now_utc(), idesc, comment, lud18_data) RETURNING * INTO invoice;

    INSERT INTO pgboss.job (name, data, retrylimit, retrybackoff, startafter)
    VALUES ('checkInvoice', jsonb_build_object('hash', hash), 21, true, now() + interval '10 seconds');

    RETURN invoice;
END;
$$;


-- get spenders
DROP MATERIALIZED VIEW IF EXISTS spender_growth_days;
CREATE MATERIALIZED VIEW IF NOT EXISTS spender_growth_days AS
SELECT day, count(DISTINCT "userId") as any,
            count(DISTINCT "userId") FILTER (WHERE act = 'STREAM') as jobs,
            count(DISTINCT "userId") FILTER (WHERE act = 'BOOST') as boost,
            count(DISTINCT "userId") FILTER (WHERE act = 'FEE') as fees,
            count(DISTINCT "userId") FILTER (WHERE act = 'TIP') as tips,
            count(DISTINCT "userId") FILTER (WHERE act = 'DONATION') as donations,
            count(DISTINCT "userId") FILTER (WHERE act = 'TERRITORY') as territories
FROM days
LEFT JOIN
((SELECT "ItemAct".created_at, "userId", act::text as act
    FROM "ItemAct")
UNION ALL
(SELECT created_at, "userId", 'DONATION' as act
    FROM "Donation")
UNION ALL
(SELECT created_at, "userId", 'TERRITORY' as act
          FROM "SubAct"
          WHERE type = 'BILLING')
) u ON day = date_trunc('day', timezone('America/Chicago', u.created_at at time zone 'UTC'))
GROUP BY day
ORDER BY day ASC;

-- get spending
DROP MATERIALIZED VIEW IF EXISTS spending_growth_days;
CREATE MATERIALIZED VIEW IF NOT EXISTS spending_growth_days AS
SELECT day, coalesce(floor(sum(msats) FILTER (WHERE act = 'STREAM')/1000), 0) as jobs,
            coalesce(floor(sum(msats) FILTER (WHERE act = 'BOOST')/1000), 0) as boost,
            coalesce(floor(sum(msats) FILTER (WHERE act NOT IN ('BOOST', 'TIP', 'STREAM', 'DONATION', 'TERRITORY'))/1000), 0) as fees,
            coalesce(floor(sum(msats) FILTER (WHERE act = 'TIP')/1000), 0) as tips,
            coalesce(floor(sum(msats) FILTER (WHERE act = 'DONATION')/1000), 0) as donations,
            coalesce(floor(sum(msats) FILTER (WHERE act = 'TERRITORY')/1000), 0) as territories
FROM days
LEFT JOIN
((SELECT "ItemAct".created_at, msats, act::text as act
    FROM "ItemAct")
UNION ALL
(SELECT created_at, sats * 1000 as msats, 'DONATION' as act
    FROM "Donation")
UNION ALL
(SELECT created_at, msats, 'TERRITORY' as act
          FROM "SubAct"
          WHERE type = 'BILLING')
) u ON day = date_trunc('day', timezone('America/Chicago', u.created_at at time zone 'UTC'))
GROUP BY day
ORDER BY day ASC;

-- get stackers
DROP MATERIALIZED VIEW IF EXISTS stackers_growth_days;
CREATE MATERIALIZED VIEW IF NOT EXISTS stackers_growth_days AS
SELECT day, count(distinct user_id) as any,
            count(distinct user_id) FILTER (WHERE type = 'POST') as posts,
            count(distinct user_id) FILTER (WHERE type = 'COMMENT') as comments,
            count(distinct user_id) FILTER (WHERE type = 'EARN') as rewards,
            count(distinct user_id) FILTER (WHERE type = 'REFERRAL') as referrals,
            count(distinct user_id) FILTER (WHERE type = 'REVENUE') as territories
FROM days
LEFT JOIN
((SELECT "ItemAct".created_at, "Item"."userId" as user_id, CASE WHEN "Item"."parentId" IS NULL THEN 'POST' ELSE 'COMMENT' END as type
    FROM "ItemAct"
    JOIN "Item" on "ItemAct"."itemId" = "Item".id
    WHERE "ItemAct".act = 'TIP')
UNION ALL
    (SELECT created_at, "userId" as user_id, 'EARN' as type
        FROM "Earn")
UNION ALL
    (SELECT created_at, "referrerId" as user_id, 'REFERRAL' as type
        FROM "ReferralAct")
UNION ALL
    (SELECT created_at, "userId" as user_id, 'REVENUE' as type
        FROM "SubAct"
        WHERE type = 'REVENUE')
) u ON day = date_trunc('day', timezone('America/Chicago', u.created_at at time zone 'UTC'))
GROUP BY day
ORDER BY day ASC;

-- get stacking
DROP MATERIALIZED VIEW IF EXISTS stacking_growth_days;
CREATE MATERIALIZED VIEW IF NOT EXISTS stacking_growth_days AS
SELECT day, coalesce(floor(sum(airdrop)/1000),0) as rewards,
            coalesce(floor(sum(post)/1000),0) as posts,
            coalesce(floor(sum(comment)/1000),0) as comments,
            coalesce(floor(sum(referral)/1000),0) as referrals,
            coalesce(floor(sum(revenue)/1000),0) as territories
FROM days
LEFT JOIN
((SELECT "ItemAct".created_at, 0 as airdrop,
    CASE WHEN "Item"."parentId" IS NULL THEN 0 ELSE "ItemAct".msats END as comment,
    CASE WHEN "Item"."parentId" IS NULL THEN "ItemAct".msats ELSE 0 END as post,
    0 as referral, 0 as revenue
        FROM "ItemAct"
        JOIN "Item" on "ItemAct"."itemId" = "Item".id
        WHERE "ItemAct".act = 'TIP')
UNION ALL
    (SELECT created_at, 0 as airdrop, 0 as post, 0 as comment, msats as referral, 0 as revenue
        FROM "ReferralAct")
UNION ALL
(SELECT created_at, msats as airdrop, 0 as post, 0 as comment, 0 as referral, 0 as revenue
        FROM "Earn")
UNION ALL
    (SELECT created_at, 0 as airdrop, 0 as post, 0 as comment, 0 as referral, msats as revenue
        FROM "SubAct"
        WHERE type = 'REVENUE')
) u ON day = date_trunc('day', timezone('America/Chicago', u.created_at at time zone 'UTC'))
GROUP BY day
ORDER BY day ASC;

-- indices for the other materialized view so we can refresh concurrently
CREATE UNIQUE INDEX IF NOT EXISTS spender_growth_days_idx ON spender_growth_days(day);
CREATE UNIQUE INDEX IF NOT EXISTS spending_growth_days_idx ON spending_growth_days(day);
CREATE UNIQUE INDEX IF NOT EXISTS stackers_growth_days_idx ON stackers_growth_days(day);
CREATE UNIQUE INDEX IF NOT EXISTS stacking_growth_days_idx ON stacking_growth_days(day);

