
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
    (granularity,"timeBucket","payOutType","payInType","subName","userId",
     "sumMtokens","countUsers","countGroup","slice")
    WITH payouts_paid_facts AS (
        WITH paid AS (
            SELECT id,
                    "payInStateChangedAt" AS changed_at,
                    "payInType"           AS payin_type
            FROM "PayIn"
            WHERE "payInState" = 'PAID'
            AND "payInStateChangedAt" >= (v_from AT TIME ZONE 'UTC') AND "payInStateChangedAt" < (v_to AT TIME ZONE 'UTC')
        ),
        -- Aggregate territory mtokens per (payin, sub)
        territory_mtokens AS (
            SELECT
                pot."payInId"          AS payin_id,
                spc."subName"          AS sub_name,
                SUM(pot."mtokens")     AS mtokens_sub
            FROM "PayOutCustodialToken" pot
            JOIN "SubPayOutCustodialToken" spc
                ON spc."payOutCustodialTokenId" = pot."id"
            JOIN paid p
                ON p.id = pot."payInId"
            GROUP BY pot."payInId", spc."subName"
        ),
        -- Total mtokens per payin for proportion denominator
        territory_totals AS (
            SELECT payin_id, SUM(mtokens_sub) AS mtokens_total
            FROM territory_mtokens
            GROUP BY payin_id
        ),
        -- Proportion per (payin, sub): preserve your special-case (mtokens_sub=0 -> 1)
        territory_prop AS (
            SELECT
                tm.payin_id,
                tm.sub_name,
                CASE
                WHEN tm.mtokens_sub = 0 THEN 1.0
                ELSE tm.mtokens_sub::numeric / NULLIF(tt.mtokens_total, 0)
                END AS mtokens_proportion
            FROM territory_mtokens tm
            JOIN territory_totals tt USING (payin_id)
        ),
        -- Non-territory payouts (both sources), to be split across subs via the proportion
        non_territory AS (
            SELECT pot."payInId" AS payin_id,
                    pot."payOutType" AS payout_type,
                    pot."userId" AS user_id,
                    pot."mtokens"::numeric AS amount
            FROM "PayOutCustodialToken" pot
            JOIN paid p ON p.id = pot."payInId"
            WHERE pot."payOutType" <> 'TERRITORY_REVENUE'
            UNION ALL
            SELECT pob."payInId" AS payin_id,
                    pob."payOutType" AS payout_type,
                    pob."userId" AS user_id,
                    pob."msats"::numeric AS amount
            FROM "PayOutBolt11" pob
            JOIN paid p ON p.id = pob."payInId"
            WHERE pob."payOutType" <> 'TERRITORY_REVENUE'
        ),
        -- Apply proportions to non-territory payouts (one row per sub)
        split_non_territory AS (
            SELECT
                nt.payin_id,
                tp.sub_name,
                nt.payout_type,
                nt.user_id,
                (nt.amount * COALESCE(tp.mtokens_proportion, 1.0))::bigint AS mtokens
            FROM non_territory nt
            LEFT JOIN territory_prop tp
                ON tp.payin_id = nt.payin_id
        ),
        -- Territory revenue: attributed directly to the specific sub
        direct_territory AS (
            SELECT
                pot."payInId" AS payin_id,
                spc."subName" AS sub_name,
                pot."payOutType" AS payout_type,
                pot."userId" AS user_id,
                pot."mtokens"::bigint AS mtokens
            FROM "PayOutCustodialToken" pot
            JOIN "SubPayOutCustodialToken" spc
                ON spc."payOutCustodialTokenId" = pot."id"
            JOIN paid p ON p.id = pot."payInId"
            WHERE pot."payOutType" = 'TERRITORY_REVENUE'
        )
        SELECT
        p.id             AS payin_id,
        p.changed_at,
        x.payout_type,
        p.payin_type,
        x.sub_name,
        x.user_id,
        x.mtokens
        FROM paid p
        JOIN (
            SELECT * FROM split_non_territory
            UNION ALL
            SELECT * FROM direct_territory
        ) x ON x.payin_id = p.id
        WHERE x.payout_type IS NOT NULL
        AND p.payin_type IS NOT NULL
    ),
    facts AS (
        SELECT
        date_trunc(bucket_part, changed_at, 'America/Chicago') AS bucket,
        payout_type                  AS "payOutType",
        payin_type                    AS "payInType",
        sub_name                      AS "subName",  -- may be NULL; kept
        user_id                       AS "userId",   -- may be NULL; kept
        mtokens
        FROM payouts_paid_facts
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

  GET DIAGNOSTICS v_inserted_count = ROW_COUNT;
  RAISE NOTICE '    Inserted % aggregate rows', v_inserted_count;
END;
$$;

DROP VIEW IF EXISTS payouts_paid_fact;

-- bucket_part: 'hour' | 'day' | 'month'
CREATE OR REPLACE FUNCTION refresh_agg_payin(
    bucket_part  text,
    p_from       timestamptz DEFAULT now() - interval '2 hours',
    p_to         timestamptz DEFAULT now()
) RETURNS void
LANGUAGE plpgsql
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
        (granularity,"timeBucket","payInType","subName","userId",
        "sumMcost","countUsers","countGroup","slice")
    WITH payins_paid_facts AS (
        WITH paid AS (
            SELECT id, "payInStateChangedAt" AS changed_at,
                    "payInType" AS payin_type, "userId" AS user_id, "mcost"
            FROM "PayIn"
            WHERE "payInState" = 'PAID'
            AND "payInStateChangedAt" >= (v_from AT TIME ZONE 'UTC') AND "payInStateChangedAt" < (v_to AT TIME ZONE 'UTC')
        ),
        per_split AS (
            SELECT
                pot."payInId"        AS payin_id,
                spc."subName"        AS sub_name,
                pot."mtokens",
                SUM(pot."mtokens") OVER (PARTITION BY pot."payInId") AS mtokens_total
            FROM "PayOutCustodialToken" pot
            JOIN "SubPayOutCustodialToken" spc
                ON spc."payOutCustodialTokenId" = pot."id"
            -- only rows that can actually match PAID payins
            JOIN paid p ON p.id = pot."payInId"
        )
        SELECT
        p.id                          AS payin_id,
        p.changed_at,
        p.payin_type,
        ps.sub_name,
        p.user_id,
        /* use numeric division; avoid /0; keep your special-case when mtokens=0 */
        (p."mcost" * COALESCE(
            CASE
                WHEN ps."mtokens_total" = 0 OR ps."mtokens_total" IS NULL THEN 1.0
                ELSE ps."mtokens"::numeric / ps."mtokens_total"
            END
            ))::bigint AS mcost
        FROM paid p
        LEFT JOIN per_split ps ON ps.payin_id = p.id
    ),
    facts AS (
        SELECT
        date_trunc(bucket_part, changed_at, 'America/Chicago') AS "timeBucket",
        payin_type                  AS "payInType",
        sub_name                    AS "subName",   -- may be NULL; kept
        user_id                     AS "userId",
        mcost
        FROM payins_paid_facts
    ),
    rolled AS (
        SELECT
        "timeBucket", "payInType", "subName", "userId",
        SUM(mcost)                            AS "sumMcost",
        COUNT(DISTINCT "userId")              AS "countUsers",
        COUNT(*)                              AS "countGroup",
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

DROP VIEW IF EXISTS payins_paid_fact;