-- CreateEnum
CREATE TYPE "AggSlice" AS ENUM ('GLOBAL', 'GLOBAL_BY_TYPE', 'SUB_TOTAL', 'SUB_BY_TYPE', 'USER_TOTAL', 'USER_BY_TYPE', 'SUB_BY_USER', 'USER_SUB_BY_TYPE');

-- CreateEnum
CREATE TYPE "AggGranularity" AS ENUM ('HOUR', 'DAY', 'MONTH');

-- CreateTable
CREATE UNLOGGED TABLE "AggPayIn" (
    "id" SERIAL NOT NULL,
    "timeBucket" TIMESTAMP(3) NOT NULL,
    "granularity" "AggGranularity" NOT NULL,
    "payInType" "PayInType",
    "subName" CITEXT,
    "userId" INTEGER,
    "sumMcost" BIGINT NOT NULL,
    "countUsers" BIGINT NOT NULL,
    "slice" "AggSlice" NOT NULL,

    CONSTRAINT "AggPayIn_pkey" PRIMARY KEY ("id")
);

CREATE OR REPLACE VIEW payins_paid_fact AS
SELECT
    p.id                                      AS payin_id,
    p."payInStateChangedAt"                   AS changed_at,
    p."payInType"                             AS payin_type,
    pc."subName"                              AS sub_name,
    p."userId"                                AS user_id,
    -- this is to make sure that the mcost is split proportionally to the territory mtokens
    -- for when we have multiple territories for the same payin
    (p."mcost" * COALESCE(pc."mtokens_proportion", 1))::bigint AS mcost
FROM "PayIn" p
LEFT JOIN LATERAL (
    SELECT spc."subName", "PayOutCustodialToken"."mtokens" / sum("PayOutCustodialToken"."mtokens") OVER () AS mtokens_proportion
    FROM "PayOutCustodialToken"
    JOIN "SubPayOutCustodialToken" spc ON spc."payOutCustodialTokenId" = "PayOutCustodialToken"."id"
    WHERE "PayOutCustodialToken"."payInId" = p.id
    GROUP BY spc."subName", "PayOutCustodialToken"."mtokens"
) pc ON true
WHERE p."payInState" = 'PAID';

-- bucket_part: 'hour' | 'day' | 'month'
CREATE OR REPLACE FUNCTION refresh_agg_payin(
    bucket_part  text,
    p_from       timestamptz DEFAULT now() - interval '2 hours',
    p_to         timestamptz DEFAULT now()
) RETURNS void
LANGUAGE plpgsql
AS $$
DECLARE
    v_from timestamp;
    v_to   timestamp;
    v_step interval;
    v_gran "AggGranularity";
BEGIN
    IF bucket_part NOT IN ('hour','day','month') THEN
        RAISE EXCEPTION 'bucket_part must be "hour" or "day" or "month"';
    END IF;

    v_step := CASE bucket_part WHEN 'hour' THEN interval '1 hour' WHEN 'day' THEN interval '1 day' WHEN 'month' THEN interval '1 month' END;
    v_gran := CASE bucket_part WHEN 'hour' THEN 'HOUR' WHEN 'day' THEN 'DAY' WHEN 'month' THEN 'MONTH' END;
    v_from := date_trunc(bucket_part, p_from);
    v_to   := date_trunc(bucket_part, p_to) + v_step;

    -- idempotent: clear current window for this granularity
    DELETE FROM "AggPayIn"
    WHERE granularity = v_gran
        AND "timeBucket" >= v_from
        AND "timeBucket" <  v_to;

    INSERT INTO "AggPayIn"
        (granularity,"timeBucket","payInType","subName","userId",
        "sumMcost","countUsers","slice")
    WITH facts AS (
        SELECT
        date_trunc(bucket_part, changed_at) AS "timeBucket",
        payin_type                  AS "payInType",
        sub_name                    AS "subName",   -- may be NULL; kept
        user_id                     AS "userId",
        mcost
        FROM payins_paid_fact
        WHERE changed_at >= v_from AND changed_at < v_to
    ),
    rolled AS (
        SELECT
        "timeBucket", "payInType", "subName", "userId",
        SUM(mcost)                            AS "sumMcost",
        COUNT(DISTINCT "userId")              AS "countUsers",
        /* bit mask: payInType=4, subName=2, userId=1 (1 = grand-totalled) */
        GROUPING("payInType","subName","userId") AS "groupingId"
        FROM facts
        GROUP BY GROUPING SETS (
            ("timeBucket"),                                -- 7  GLOBAL
            ("timeBucket", "payInType"),                   -- 3  GLOBAL_BY_TYPE
            ("timeBucket", "subName"),                     -- 5  SUB_TOTAL
            ("timeBucket", "subName","payInType"),         -- 1  SUB_BY_TYPE
            ("timeBucket", "userId"),                      -- 6  USER_TOTAL
            ("timeBucket", "userId","payInType"),          -- 2  USER_BY_TYPE
            ("timeBucket", "subName","userId"),            -- 4  SUB_BY_USER
            ("timeBucket", "userId","subName","payInType") -- 0  USER_SUB_BY_TYPE
        )
    )
    SELECT
        v_gran AS granularity,
        "timeBucket",
        "payInType","subName","userId",
        "sumMcost","countUsers",
        CASE "groupingId"
            WHEN 7 THEN 'GLOBAL'::"AggSlice"
            WHEN 3 THEN 'GLOBAL_BY_TYPE'::"AggSlice"
            WHEN 5 THEN 'SUB_TOTAL'::"AggSlice"
            WHEN 1 THEN 'SUB_BY_TYPE'::"AggSlice"
            WHEN 6 THEN 'USER_TOTAL'::"AggSlice"
            WHEN 2 THEN 'USER_BY_TYPE'::"AggSlice"
            WHEN 4 THEN 'SUB_BY_USER'::"AggSlice"
            WHEN 0 THEN 'USER_SUB_BY_TYPE'::"AggSlice"
        END AS slice
    FROM rolled;
END;
$$;

-- Thin wrappers you’ll actually call:
CREATE OR REPLACE FUNCTION refresh_agg_payin_hour(
    p_from timestamptz DEFAULT now() - interval '2 hours',
    p_to   timestamptz DEFAULT now()
) RETURNS void LANGUAGE sql AS $$
    SELECT refresh_agg_payin('hour', p_from, p_to);
$$;

CREATE OR REPLACE FUNCTION refresh_agg_payin_day(
    p_from timestamptz DEFAULT now() - interval '14 days',
    p_to   timestamptz DEFAULT now()
) RETURNS void LANGUAGE sql AS $$
    SELECT refresh_agg_payin('day', p_from, p_to);
$$;

CREATE OR REPLACE FUNCTION refresh_agg_payin_month(
    p_from timestamptz DEFAULT date_trunc('month', now()) - interval '24 months',
    p_to   timestamptz DEFAULT now()
) RETURNS void LANGUAGE sql AS $$
    SELECT refresh_agg_payin('month', p_from, p_to);
$$;

-- hourly ranges in chunks
DO $$
DECLARE cur timestamptz := now() - interval '5 years';
BEGIN
  WHILE cur < now() LOOP
    PERFORM refresh_agg_payin_hour(cur, cur + interval '1 day');
    cur := cur + interval '1 day';
  END LOOP;
END$$;

-- daily long range
SELECT refresh_agg_payin_day(now() - interval '5 years', now());

-- monthly long range
SELECT refresh_agg_payin_month(now() - interval '5 years', now());

ALTER TABLE "AggPayIn" SET LOGGED;

CREATE UNIQUE INDEX IF NOT EXISTS "AggPayIn_unique_key"
ON "AggPayIn" (
    "granularity",
    "timeBucket",
    "payInType",
    "subName",
    "userId",
    "slice"
) NULLS NOT DISTINCT;

-- CreateIndex
CREATE INDEX "AggPayIn_granularity_slice_timeBucket_idx" ON "AggPayIn"("granularity", "slice", "timeBucket");

-- CreateIndex
CREATE INDEX "AggPayIn_granularity_timeBucket_idx" ON "AggPayIn"("granularity", "timeBucket");

-- CreateIndex
CREATE INDEX "AggPayIn_granularity_payInType_idx" ON "AggPayIn"("granularity", "payInType");

-- CreateIndex
CREATE INDEX "AggPayIn_granularity_subName_idx" ON "AggPayIn"("granularity", "subName");

-- CreateIndex
CREATE INDEX "AggPayIn_granularity_userId_idx" ON "AggPayIn"("granularity", "userId");

-- AddForeignKey
ALTER TABLE "AggPayIn" ADD CONSTRAINT "AggPayIn_subName_fkey" FOREIGN KEY ("subName") REFERENCES "Sub"("name") ON DELETE CASCADE ON UPDATE CASCADE;