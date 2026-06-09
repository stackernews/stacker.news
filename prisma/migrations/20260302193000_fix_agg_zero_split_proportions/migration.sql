ALTER TABLE "PayOutCustodialToken" ADD COLUMN "subId" INTEGER;

UPDATE "PayOutCustodialToken" pot
SET "subId" = spc."subId"
FROM "SubPayOutCustodialToken" spc
WHERE spc."payOutCustodialTokenId" = pot."id";

CREATE INDEX "PayOutCustodialToken_subId_idx" ON "PayOutCustodialToken"("subId");

CREATE UNIQUE INDEX "PayOutCustodialToken_payInId_subId_key"
ON "PayOutCustodialToken"("payInId", "subId");

ALTER TABLE "PayOutCustodialToken" ADD CONSTRAINT "PayOutCustodialToken_subId_fkey"
FOREIGN KEY ("subId") REFERENCES "Sub"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Match the mine/sub growth resolver filters so those reads do not have to
-- scan broad AggPayIn user/sub buckets and then discard most rows.
CREATE INDEX "AggPayIn_growth_user_idx"
ON "AggPayIn"("granularity", "slice", "userId", "timeBucket", "payInType");

CREATE INDEX "AggPayIn_growth_sub_idx"
ON "AggPayIn"("granularity", "slice", "subId", "timeBucket", "payInType");

CREATE OR REPLACE FUNCTION refresh_agg_payout(
    bucket_part  text,        -- 'hour' | 'day' | 'month'
    p_from       timestamptz DEFAULT now() - interval '2 hours',
    p_to         timestamptz DEFAULT now()
) RETURNS void
LANGUAGE plpgsql
SET TimeZone TO 'UTC'
AS $$
DECLARE
    v_from  timestamptz;
    v_to    timestamptz;
    v_step  interval;
    v_gran  "AggGranularity";
    v_deleted_count int;
    v_inserted_count int;
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

  RAISE NOTICE '  refresh_agg_payout(%): Processing % to %', bucket_part, v_from, v_to;

  -- Idempotent: clear the window for this granularity
  DELETE FROM "AggPayOut"
  WHERE granularity = v_gran
    AND "timeBucket" >= v_from
    AND "timeBucket" <  v_to;

  GET DIAGNOSTICS v_deleted_count = ROW_COUNT;
  RAISE NOTICE '    Deleted % existing rows', v_deleted_count;

  -- One pass: all 8 slices
    INSERT INTO "AggPayOut"
    (granularity,"timeBucket","payOutType","payInType","subId","userId",
     "sumMtokens","countUsers","countGroup","slice")
    WITH paid AS (
        SELECT id,
                "payInStateChangedAt" AS changed_at,
                "payInType"           AS payin_type
        FROM "PayIn"
        WHERE "payInState" = 'PAID'
        AND "payInStateChangedAt" >= (v_from AT TIME ZONE 'UTC') AND "payInStateChangedAt" < (v_to AT TIME ZONE 'UTC')
    ),
    -- Territory rows are enforced one per (payin, sub). During rollout,
    -- fall back to the child table only when legacy writes have not yet
    -- populated PayOutCustodialToken.subId.
    territory_mtokens AS (
        SELECT
            pot."payInId"          AS payin_id,
            COALESCE(pot."subId", spc."subId") AS sub_id,
            pot."mtokens"          AS mtokens_sub
        FROM "PayOutCustodialToken" pot
        LEFT JOIN "SubPayOutCustodialToken" spc
            ON pot."subId" IS NULL
           AND spc."payOutCustodialTokenId" = pot."id"
        JOIN paid p
            ON p.id = pot."payInId"
        WHERE COALESCE(pot."subId", spc."subId") IS NOT NULL
    ),
    -- Total mtokens and territory splits per payin for proportion denominator
    territory_totals AS (
        SELECT payin_id, SUM(mtokens_sub) AS mtokens_total, COUNT(*) AS sub_count
        FROM territory_mtokens
        GROUP BY payin_id
    ),
    -- Precompute exact split boundaries once per payin instead of windowing
    -- over every exploded non-territory payout row.
    territory_split_bounds AS (
        SELECT
            tm.payin_id,
            tm.sub_id,
            tm.mtokens_sub,
            tt.mtokens_total,
            tt.sub_count,
            ROW_NUMBER() OVER (
                PARTITION BY tm.payin_id
                ORDER BY tm.sub_id
            ) AS split_index,
            SUM(tm.mtokens_sub) OVER (
                PARTITION BY tm.payin_id
                ORDER BY tm.sub_id
                ROWS BETWEEN UNBOUNDED PRECEDING AND CURRENT ROW
            ) AS cumulative_mtokens_sub
        FROM territory_mtokens tm
        JOIN territory_totals tt USING (payin_id)
    ),
    -- Keep one unsplit row per payout so non-sub slices can count base payout
    -- rows directly instead of deduplicating exploded split facts later.
    non_territory AS (
        SELECT
            pot."payInId" AS payin_id,
            p.changed_at,
            p.payin_type,
            pot."payOutType" AS payout_type,
            pot."userId" AS user_id,
            pot."mtokens"::bigint AS mtokens
        FROM "PayOutCustodialToken" pot
        JOIN paid p ON p.id = pot."payInId"
        WHERE pot."payOutType" <> 'TERRITORY_REVENUE'
        UNION ALL
        SELECT
            pob."payInId" AS payin_id,
            p.changed_at,
            p.payin_type,
            pob."payOutType" AS payout_type,
            pob."userId" AS user_id,
            pob."msats"::bigint AS mtokens
        FROM "PayOutBolt11" pob
        JOIN paid p ON p.id = pob."payInId"
        WHERE pob."payOutType" <> 'TERRITORY_REVENUE'
    ),
    split_non_territory AS (
        SELECT
            nt.changed_at,
            nt.payin_type,
            nt.payin_id,
            tsb.sub_id,
            nt.payout_type,
            nt.user_id,
            CASE
            WHEN tsb.sub_count IS NULL THEN nt.mtokens
            WHEN tsb.mtokens_total = 0 OR tsb.mtokens_total IS NULL THEN (
                floor(nt.mtokens::numeric * tsb.split_index::numeric / tsb.sub_count::numeric)
                - floor(nt.mtokens::numeric * (tsb.split_index - 1)::numeric / tsb.sub_count::numeric)
            )::bigint
            ELSE (
                floor(nt.mtokens::numeric * tsb.cumulative_mtokens_sub / tsb.mtokens_total::numeric)
                - floor(nt.mtokens::numeric * (tsb.cumulative_mtokens_sub - tsb.mtokens_sub) / tsb.mtokens_total::numeric)
            )::bigint
            END AS mtokens
        FROM non_territory nt
        LEFT JOIN territory_split_bounds tsb
            ON tsb.payin_id = nt.payin_id
    ),
    -- Territory revenue: attributed directly to the specific sub
    direct_territory AS (
        SELECT
            pot."payInId" AS payin_id,
            p.changed_at,
            p.payin_type,
            COALESCE(pot."subId", spc."subId") AS sub_id,
            pot."payOutType" AS payout_type,
            pot."userId" AS user_id,
            pot."mtokens"::bigint AS mtokens
        FROM "PayOutCustodialToken" pot
        LEFT JOIN "SubPayOutCustodialToken" spc
            ON pot."subId" IS NULL
           AND spc."payOutCustodialTokenId" = pot."id"
        JOIN paid p ON p.id = pot."payInId"
        WHERE pot."payOutType" = 'TERRITORY_REVENUE'
          AND COALESCE(pot."subId", spc."subId") IS NOT NULL
    ),
    base_payouts_paid AS (
        SELECT
        changed_at,
        payout_type,
        payin_type,
        user_id,
        mtokens
        FROM non_territory
        WHERE payout_type IS NOT NULL
        AND payin_type IS NOT NULL
        UNION ALL
        SELECT
        changed_at,
        payout_type,
        payin_type,
        user_id,
        mtokens
        FROM direct_territory
        WHERE payout_type IS NOT NULL
        AND payin_type IS NOT NULL
    ),
    split_payouts_paid AS (
        SELECT
        changed_at,
        payout_type,
        payin_type,
        sub_id,
        user_id,
        mtokens
        FROM split_non_territory
        WHERE payout_type IS NOT NULL
        AND payin_type IS NOT NULL
        UNION ALL
        SELECT
        changed_at,
        payout_type,
        payin_type,
        sub_id,
        user_id,
        mtokens
        FROM direct_territory
        WHERE payout_type IS NOT NULL
        AND payin_type IS NOT NULL
    ),
    global_user_facts AS (
        SELECT
        date_trunc(bucket_part, changed_at, 'America/Chicago') AS bucket,
        payout_type                  AS "payOutType",
        payin_type                   AS "payInType",
        user_id                      AS "userId",
        mtokens
        FROM base_payouts_paid
    ),
    sub_facts AS (
        SELECT
        date_trunc(bucket_part, changed_at, 'America/Chicago') AS bucket,
        payout_type                  AS "payOutType",
        payin_type                   AS "payInType",
        sub_id                       AS "subId",
        user_id                      AS "userId",
        mtokens
        FROM split_payouts_paid
    ),
    rolled_global_user AS (
        SELECT
        bucket, "payOutType", "payInType",
        NULL::integer                           AS "subId",
        "userId",
        SUM(mtokens)                            AS "sumMtokens",
        COUNT(DISTINCT "userId")                AS "countUsers",
        COUNT(*)                                AS "countGroup",
        /* bit mask: payOutType=4, payInType=2, userId=1 (1 = grand-totalled) */
        GROUPING("payOutType","payInType","userId") AS gmask
        FROM global_user_facts
        GROUP BY GROUPING SETS (
            -- GLOBAL family
            (bucket),                                  -- gmask = 7 (111)
            (bucket, "payOutType"),                    -- gmask = 3 (011)
            (bucket, "payOutType","payInType"),        -- gmask = 1 (001)

            -- USER family
            (bucket, "userId"),                        -- gmask = 6 (110)
            (bucket, "userId","payOutType"),           -- gmask = 2 (010)
            (bucket, "userId","payOutType","payInType") -- gmask = 0 (000)
        )
    ),
    rolled_sub AS (
        SELECT
        bucket, "payOutType", "payInType", "subId", "userId",
        SUM(mtokens)                              AS "sumMtokens",
        COUNT(DISTINCT "userId")                  AS "countUsers",
        COUNT(*)                                  AS "countGroup",
        /* bit mask: payOutType=4, payInType=2, userId=1 (1 = grand-totalled) */
        GROUPING("payOutType","payInType","userId") AS gmask
        FROM sub_facts
        GROUP BY GROUPING SETS (
            -- SUB family
            (bucket, "subId"),                            -- gmask = 7 (111)
            (bucket, "subId","payOutType"),              -- gmask = 3 (011)
            (bucket, "subId","payOutType","payInType"),  -- gmask = 1 (001)

            -- SUB x USER family
            (bucket, "subId","userId"),                  -- gmask = 6 (110)
            (bucket, "subId","userId","payOutType"),     -- gmask = 2 (010)
            (bucket, "subId","userId","payOutType","payInType") -- gmask = 0 (000)
        )
    )
    SELECT
    v_gran                                   AS granularity,
    bucket                                   AS "timeBucket",
    "payOutType","payInType","subId","userId",
    "sumMtokens","countUsers","countGroup",
    CASE gmask
        WHEN 7 THEN 'GLOBAL'::"AggSlice"
        WHEN 3 THEN 'GLOBAL_BY_TYPE'::"AggSlice"
        WHEN 1 THEN 'GLOBAL_BY_TYPE'::"AggSlice"
        WHEN 6 THEN 'USER_TOTAL'::"AggSlice"
        WHEN 2 THEN 'USER_BY_TYPE'::"AggSlice"
        WHEN 0 THEN 'USER_BY_TYPE'::"AggSlice"
    END AS slice
    FROM rolled_global_user
    UNION ALL
    SELECT
    v_gran                                   AS granularity,
    bucket                                   AS "timeBucket",
    "payOutType","payInType","subId","userId",
    "sumMtokens","countUsers","countGroup",
    CASE gmask
        WHEN 7 THEN 'SUB_TOTAL'::"AggSlice"
        WHEN 3 THEN 'SUB_BY_TYPE'::"AggSlice"
        WHEN 1 THEN 'SUB_BY_TYPE'::"AggSlice"
        WHEN 6 THEN 'SUB_BY_USER'::"AggSlice"
        WHEN 2 THEN 'USER_SUB_BY_TYPE'::"AggSlice"
        WHEN 0 THEN 'USER_SUB_BY_TYPE'::"AggSlice"
    END AS slice
    FROM rolled_sub;

  GET DIAGNOSTICS v_inserted_count = ROW_COUNT;
  RAISE NOTICE '    Inserted % aggregate rows', v_inserted_count;
END;
$$;

-- bucket_part: 'hour' | 'day' | 'month'
CREATE OR REPLACE FUNCTION refresh_agg_payin(
    bucket_part  text,
    p_from       timestamptz DEFAULT now() - interval '2 hours',
    p_to         timestamptz DEFAULT now()
) RETURNS void
LANGUAGE plpgsql
SET TimeZone TO 'UTC'
AS $$
DECLARE
    v_from timestamptz;
    v_to   timestamptz;
    v_step interval;
    v_gran "AggGranularity";
    v_deleted_count int;
    v_inserted_count int;
BEGIN
    IF bucket_part NOT IN ('hour','day','month') THEN
        RAISE EXCEPTION 'bucket_part must be "hour" or "day" or "month"';
    END IF;

    v_step := CASE bucket_part WHEN 'hour' THEN interval '1 hour' WHEN 'day' THEN interval '1 day' WHEN 'month' THEN interval '1 month' END;
    v_gran := CASE bucket_part WHEN 'hour' THEN 'HOUR' WHEN 'day' THEN 'DAY' WHEN 'month' THEN 'MONTH' END;
    v_from := date_trunc(bucket_part, p_from, 'America/Chicago');
    v_to   := date_trunc(bucket_part, p_to, 'America/Chicago') + v_step;

    RAISE NOTICE '  refresh_agg_payin(%): Processing % to %', bucket_part, v_from, v_to;

    -- idempotent: clear current window for this granularity
    DELETE FROM "AggPayIn"
    WHERE granularity = v_gran
        AND "timeBucket" >= v_from
        AND "timeBucket" <  v_to;

    GET DIAGNOSTICS v_deleted_count = ROW_COUNT;
    RAISE NOTICE '    Deleted % existing rows', v_deleted_count;

    INSERT INTO "AggPayIn"
        (granularity,"timeBucket","payInType","subId","userId",
        "sumMcost","countUsers","countGroup","slice")
    WITH payins_paid_facts AS (
        WITH paid AS (
            SELECT id, "payInStateChangedAt" AS changed_at,
                    "payInType" AS payin_type, "userId" AS user_id, "mcost"
            FROM "PayIn"
            WHERE "payInState" = 'PAID'
            AND "payInStateChangedAt" >= (v_from AT TIME ZONE 'UTC') AND "payInStateChangedAt" < (v_to AT TIME ZONE 'UTC')
        ),
        per_split_ranked AS (
            SELECT
                pot."payInId"        AS payin_id,
                COALESCE(pot."subId", spc."subId") AS sub_id,
                pot."mtokens"        AS mtokens,
                SUM(pot."mtokens") OVER (PARTITION BY pot."payInId") AS mtokens_total,
                COUNT(*) OVER (PARTITION BY pot."payInId") AS sub_count,
                ROW_NUMBER() OVER (
                    PARTITION BY pot."payInId"
                    ORDER BY COALESCE(pot."subId", spc."subId")
                ) AS split_index,
                SUM(pot."mtokens") OVER (
                    PARTITION BY pot."payInId"
                    ORDER BY COALESCE(pot."subId", spc."subId")
                    ROWS BETWEEN UNBOUNDED PRECEDING AND CURRENT ROW
                ) AS cumulative_mtokens
            FROM "PayOutCustodialToken" pot
            LEFT JOIN "SubPayOutCustodialToken" spc
                ON pot."subId" IS NULL
               AND spc."payOutCustodialTokenId" = pot."id"
            -- only rows that can actually match PAID payins
            JOIN paid p ON p.id = pot."payInId"
            WHERE COALESCE(pot."subId", spc."subId") IS NOT NULL
        )
        SELECT
        p.id                          AS payin_id,
        p.changed_at,
        p.payin_type,
        ps.sub_id,
        p.user_id,
        /* preserve total mcost exactly while still allowing equal splits for zero-weight territories */
        CASE
            WHEN ps.sub_count IS NULL THEN p."mcost"
            WHEN ps."mtokens_total" = 0 OR ps."mtokens_total" IS NULL THEN (
                floor(p."mcost"::numeric * ps.split_index::numeric / ps.sub_count::numeric)
                - floor(p."mcost"::numeric * (ps.split_index - 1)::numeric / ps.sub_count::numeric)
            )::bigint
            ELSE (
                floor(p."mcost"::numeric * ps.cumulative_mtokens / ps."mtokens_total"::numeric)
                - floor(p."mcost"::numeric * (ps.cumulative_mtokens - ps.mtokens) / ps."mtokens_total"::numeric)
            )::bigint
        END AS mcost
        FROM paid p
        LEFT JOIN per_split_ranked ps ON ps.payin_id = p.id
    ),
    facts AS (
        SELECT
        payin_id,
        date_trunc(bucket_part, changed_at, 'America/Chicago') AS "timeBucket",
        payin_type                  AS "payInType",
        sub_id                      AS "subId",   -- may be NULL; kept
        user_id                     AS "userId",
        mcost
        FROM payins_paid_facts
    ),
    rolled AS (
        SELECT
        "timeBucket", "payInType", "subId", "userId",
        SUM(mcost)                            AS "sumMcost",
        COUNT(DISTINCT "userId")              AS "countUsers",
        COUNT(DISTINCT payin_id)              AS "countGroup",
        /* bit mask: payInType=4, subId=2, userId=1 (1 = grand-totalled) */
        GROUPING("payInType","subId","userId") AS "groupingId"
        FROM facts
        GROUP BY GROUPING SETS (
            ("timeBucket"),                                -- 7  GLOBAL
            ("timeBucket", "payInType"),                   -- 3  GLOBAL_BY_TYPE
            ("timeBucket", "subId"),                       -- 5  SUB_TOTAL
            ("timeBucket", "subId","payInType"),           -- 1  SUB_BY_TYPE
            ("timeBucket", "userId"),                      -- 6  USER_TOTAL
            ("timeBucket", "userId","payInType"),          -- 2  USER_BY_TYPE
            ("timeBucket", "subId","userId"),              -- 4  SUB_BY_USER
            ("timeBucket", "userId","subId","payInType")   -- 0  USER_SUB_BY_TYPE
        )
    )
    SELECT
        v_gran AS granularity,
        "timeBucket",
        "payInType","subId","userId",
        "sumMcost","countUsers","countGroup",
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

    GET DIAGNOSTICS v_inserted_count = ROW_COUNT;
    RAISE NOTICE '    Inserted % aggregate rows', v_inserted_count;
END;
$$;
