-- CreateTable
CREATE UNLOGGED TABLE "AggPayOut" (
    "id" SERIAL NOT NULL,
    "timeBucket" TIMESTAMPTZ(3) NOT NULL,
    "granularity" "AggGranularity" NOT NULL,
    "payOutType" "PayOutType",
    "payInType" "PayInType",
    "subName" CITEXT,
    "userId" INTEGER,
    "sumMtokens" BIGINT NOT NULL,
    "countUsers" BIGINT NOT NULL,
    "countGroup" BIGINT NOT NULL,
    "slice" "AggSlice" NOT NULL,

    CONSTRAINT "AggPayOut_pkey" PRIMARY KEY ("id")
);

CREATE OR REPLACE VIEW payouts_paid_fact AS
SELECT
    p.id                                       AS payin_id,
    p."payInStateChangedAt"                    AS changed_at,
    pt."payOutType"                            AS payout_type,
    p."payInType"                              AS payin_type,
    pc."subName"                               AS sub_name,
    pt."userId"                                AS user_id,
    COALESCE(pt."mtokens", 0)                  AS mtokens
FROM "PayIn" p
LEFT JOIN LATERAL (
    SELECT spc."subName", "PayOutCustodialToken"."mtokens" AS mtokens, "PayOutCustodialToken"."mtokens" / sum("PayOutCustodialToken"."mtokens") OVER () AS mtokens_proportion
    FROM "PayOutCustodialToken"
    JOIN "SubPayOutCustodialToken" spc ON spc."payOutCustodialTokenId" = "PayOutCustodialToken"."id"
    WHERE "PayOutCustodialToken"."payInId" = p.id
    GROUP BY spc."subName", "PayOutCustodialToken"."mtokens"
) pc ON true
LEFT JOIN LATERAL (
    -- each non-territory revenue is fractionally attributed to the territory
    (SELECT "PayOutCustodialToken"."payOutType", "PayOutCustodialToken"."userId", "PayOutCustodialToken"."mtokens" * COALESCE(pc."mtokens_proportion", 1) AS mtokens
    FROM "PayOutCustodialToken"
    WHERE "PayOutCustodialToken"."payInId" = p.id AND "PayOutCustodialToken"."payOutType" <> 'TERRITORY_REVENUE')
    UNION ALL
    (SELECT "PayOutBolt11"."payOutType", "PayOutBolt11"."userId", "PayOutBolt11"."msats" * COALESCE(pc."mtokens_proportion", 1) AS mtokens
    FROM "PayOutBolt11"
    WHERE "PayOutBolt11"."payInId" = p.id AND "PayOutBolt11"."payOutType" <> 'TERRITORY_REVENUE')
    UNION ALL
    (SELECT "PayOutCustodialToken"."payOutType", "PayOutCustodialToken"."userId", "PayOutCustodialToken"."mtokens" AS mtokens
    FROM "PayOutCustodialToken"
    JOIN "SubPayOutCustodialToken" spc ON spc."payOutCustodialTokenId" = "PayOutCustodialToken"."id"
    WHERE "PayOutCustodialToken"."payInId" = p.id AND "PayOutCustodialToken"."payOutType" = 'TERRITORY_REVENUE' AND spc."subName" = pc."subName")
) pt ON true
WHERE p."payInState" = 'PAID' AND pt."payOutType" IS NOT NULL AND p."payInType" IS NOT NULL;


CREATE OR REPLACE FUNCTION refresh_agg_payout(
    bucket_part  text,        -- 'hour' | 'day' | 'month'
    p_from       timestamptz DEFAULT now() - interval '2 hours',
    p_to         timestamptz DEFAULT now()
) RETURNS void
LANGUAGE plpgsql
AS $$
DECLARE
    v_from  timestamp;
    v_to    timestamp;
    v_step  interval;
    v_gran  "AggGranularity";
BEGIN
  IF bucket_part NOT IN ('hour','day','month') THEN
    RAISE EXCEPTION 'bucket_part must be hour|day|month';
  END IF;

  v_step := CASE bucket_part
              WHEN 'hour'  THEN interval '1 hour'
              WHEN 'day'   THEN interval '1 day'
              WHEN 'month' THEN interval '1 month'
            END;

  v_gran := CASE bucket_part
              WHEN 'hour'  THEN 'HOUR'::"AggGranularity"
              WHEN 'day'   THEN 'DAY'::"AggGranularity"
              ELSE              'MONTH'::"AggGranularity"
            END;

  v_from := date_trunc(bucket_part, p_from, 'America/Chicago');
  v_to   := date_trunc(bucket_part, p_to, 'America/Chicago') + v_step;

  -- Idempotent: clear the window for this granularity
  DELETE FROM "AggPayOut"
  WHERE granularity = v_gran
    AND "timeBucket" >= v_from
    AND "timeBucket" <  v_to;

  -- One pass: all 8 slices
    INSERT INTO "AggPayOut"
    (granularity,"timeBucket","payOutType","payInType","subName","userId",
     "sumMtokens","countUsers","countGroup","slice")
    WITH facts AS (
        SELECT
        date_trunc(bucket_part, changed_at, 'America/Chicago') AS bucket,
        payout_type                  AS "payOutType",
        payin_type                    AS "payInType",
        sub_name                      AS "subName",  -- may be NULL; kept
        user_id                       AS "userId",   -- may be NULL; kept
        mtokens
        FROM payouts_paid_fact
        WHERE changed_at >= (v_from AT TIME ZONE 'UTC') AND changed_at < (v_to AT TIME ZONE 'UTC')
    ),
    rolled AS (
        SELECT
        bucket, "payOutType", "payInType", "subName", "userId",
        SUM(mtokens)                              AS "sumMtokens",
        COUNT(DISTINCT "userId")                  AS "countUsers",
        COUNT(*)                                  AS "countGroup",
        /* bit mask: payOutType=8, payInType=4, subName=2, userId=1 (1 = grand-totalled) */
        GROUPING("payOutType","payInType","subName","userId") AS gmask
        FROM facts
        GROUP BY GROUPING SETS (
            -- GLOBAL family
            (bucket),                                  -- gmask = 15 (1111)
            (bucket, "payOutType"),                    -- gmask = 7 (0111)
            (bucket, "payOutType","payInType"),        -- gmask = 3 (0011)

            -- SUB family
            (bucket, "subName"),                       -- gmask = 13 (1101)
            (bucket, "subName","payOutType"),          -- gmask = 5 (0101)
            (bucket, "subName","payOutType","payInType"), -- gmask = 1 (0001)

            -- USER family
            (bucket, "userId"),                        -- gmask = 14  (1110)
            (bucket, "userId","payOutType"),           -- gmask = 6  (0110)
            (bucket, "userId","payOutType","payInType"), -- gmask = 2  (0010)

            -- SUB × USER family
            (bucket, "subName","userId"),              -- gmask = 12  (1100)
            (bucket, "userId","subName","payOutType"), -- gmask = 4  (0100)
            (bucket, "userId","subName","payOutType","payInType") -- gmask = 0 (0000)
        )
    )
    SELECT
    v_gran                                   AS granularity,
    bucket                                   AS "timeBucket",
    "payOutType","payInType","subName","userId",
    "sumMtokens","countUsers","countGroup",
    CASE gmask
        WHEN 15 THEN 'GLOBAL'::"AggSlice"
        WHEN  7 THEN 'GLOBAL_BY_TYPE'::"AggSlice"      -- (bucket, payOutType)
        WHEN  3 THEN 'GLOBAL_BY_TYPE'::"AggSlice"      -- (bucket, payOutType, payInType)
        WHEN 13 THEN 'SUB_TOTAL'::"AggSlice"
        WHEN  5 THEN 'SUB_BY_TYPE'::"AggSlice"         -- (bucket, subName, payOutType)
        WHEN  1 THEN 'SUB_BY_TYPE'::"AggSlice"         -- (bucket, subName, payOutType, payInType)
        WHEN 14 THEN 'USER_TOTAL'::"AggSlice"
        WHEN  6 THEN 'USER_BY_TYPE'::"AggSlice"        -- (bucket, userId, payOutType)
        WHEN  2 THEN 'USER_BY_TYPE'::"AggSlice"        -- (bucket, userId, payOutType, payInType)
        WHEN 12 THEN 'SUB_BY_USER'::"AggSlice"
        WHEN  4 THEN 'USER_SUB_BY_TYPE'::"AggSlice"    -- (bucket, userId, subName, payOutType)
        WHEN  0 THEN 'USER_SUB_BY_TYPE'::"AggSlice"    -- (bucket, userId, subName, payOutType, payInType)
    END AS slice
    FROM rolled;
END;
$$;

-- Convenience wrappers (same shape as pay-ins)
CREATE OR REPLACE FUNCTION refresh_agg_payout_hour(
  p_from timestamptz DEFAULT now() - interval '2 hours',
  p_to   timestamptz DEFAULT now()
) RETURNS void LANGUAGE sql AS $$
  SELECT refresh_agg_payout('hour', p_from, p_to);
$$;

CREATE OR REPLACE FUNCTION refresh_agg_payout_day(
  p_from timestamptz DEFAULT now() - interval '14 days',
  p_to   timestamptz DEFAULT now()
) RETURNS void LANGUAGE sql AS $$
  SELECT refresh_agg_payout('day', p_from, p_to);
$$;

CREATE OR REPLACE FUNCTION refresh_agg_payout_month(
  p_from timestamptz DEFAULT now() - interval '24 months',
  p_to   timestamptz DEFAULT now()
) RETURNS void LANGUAGE sql AS $$
  SELECT refresh_agg_payout('month', p_from, p_to);
$$;

-- hourly ranges in chunks
DO $$
DECLARE cur timestamptz := now() - interval '5 years';
BEGIN
  WHILE cur < now() LOOP
    PERFORM refresh_agg_payout_hour(cur, cur + interval '30 days');
    cur := cur + interval '30 days';
  END LOOP;
END$$;

-- daily long range
SELECT refresh_agg_payout_day(now() - interval '5 years', now());

-- monthly long range
SELECT refresh_agg_payout_month(now() - interval '5 years', now());


ALTER TABLE "AggPayOut" SET LOGGED;

-- CreateIndex
CREATE INDEX "AggPayOut_granularity_slice_timeBucket_idx" ON "AggPayOut"("granularity", "slice", "timeBucket");

-- CreateIndex
CREATE INDEX "AggPayOut_granularity_timeBucket_idx" ON "AggPayOut"("granularity", "timeBucket");

-- CreateIndex
CREATE INDEX "AggPayOut_granularity_payInType_idx" ON "AggPayOut"("granularity", "payInType");

-- CreateIndex
CREATE INDEX "AggPayOut_granularity_payOutType_idx" ON "AggPayOut"("granularity", "payOutType");

-- CreateIndex
CREATE INDEX "AggPayOut_granularity_subName_idx" ON "AggPayOut"("granularity", "subName");

-- CreateIndex
CREATE INDEX "AggPayOut_granularity_userId_idx" ON "AggPayOut"("granularity", "userId");

-- CreateIndex
CREATE UNIQUE INDEX "AggPayOut_unique_key" ON "AggPayOut"("granularity", "timeBucket", "payOutType", "payInType", "subName", "userId", "slice") NULLS NOT DISTINCT;

-- AddForeignKey
ALTER TABLE "AggPayOut" ADD CONSTRAINT "AggPayOut_subName_fkey" FOREIGN KEY ("subName") REFERENCES "Sub"("name") ON DELETE CASCADE ON UPDATE CASCADE;
