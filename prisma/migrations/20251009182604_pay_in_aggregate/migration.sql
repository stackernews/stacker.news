-- CreateEnum
DO $$ BEGIN RAISE NOTICE 'Creating AggSlice enum...'; END $$;
CREATE TYPE "AggSlice" AS ENUM ('GLOBAL', 'GLOBAL_BY_TYPE', 'SUB_TOTAL', 'SUB_BY_TYPE', 'USER_TOTAL', 'USER_BY_TYPE', 'SUB_BY_USER', 'USER_SUB_BY_TYPE');

-- CreateEnum
DO $$ BEGIN RAISE NOTICE 'Creating AggGranularity enum...'; END $$;
CREATE TYPE "AggGranularity" AS ENUM ('HOUR', 'DAY', 'MONTH');

-- CreateTable
DO $$ BEGIN RAISE NOTICE 'Creating AggPayIn table...'; END $$;
CREATE UNLOGGED TABLE "AggPayIn" (
    "id" SERIAL NOT NULL,
    "timeBucket" TIMESTAMPTZ(3) NOT NULL,
    "granularity" "AggGranularity" NOT NULL,
    "payInType" "PayInType",
    "subName" CITEXT,
    "userId" INTEGER,
    "sumMcost" BIGINT NOT NULL,
    "countUsers" BIGINT NOT NULL,
    "countGroup" BIGINT NOT NULL,
    "slice" "AggSlice" NOT NULL,

    CONSTRAINT "AggPayIn_pkey" PRIMARY KEY ("id")
);
DO $$ BEGIN RAISE NOTICE 'AggPayIn table created'; END $$;

DO $$ BEGIN RAISE NOTICE 'Creating payins_paid_fact view...'; END $$;
CREATE OR REPLACE VIEW payins_paid_fact AS
WITH paid AS (
  SELECT id, "payInStateChangedAt" AS changed_at,
         "payInType" AS payin_type, "userId" AS user_id, "mcost"
  FROM "PayIn"
  WHERE "payInState" = 'PAID'
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
LEFT JOIN per_split ps ON ps.payin_id = p.id;
DO $$ BEGIN RAISE NOTICE 'payins_paid_fact view created'; END $$;

-- bucket_part: 'hour' | 'day' | 'month'
DO $$ BEGIN RAISE NOTICE 'Creating refresh_agg_payin function...'; END $$;
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
    WITH facts AS (
        SELECT
        date_trunc(bucket_part, changed_at, 'America/Chicago') AS "timeBucket",
        payin_type                  AS "payInType",
        sub_name                    AS "subName",   -- may be NULL; kept
        user_id                     AS "userId",
        mcost
        FROM payins_paid_fact
        WHERE changed_at >= (v_from AT TIME ZONE 'UTC') AND changed_at < (v_to AT TIME ZONE 'UTC')
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
    p_from timestamptz DEFAULT now() - interval '24 months',
    p_to   timestamptz DEFAULT now()
) RETURNS void LANGUAGE sql AS $$
    SELECT refresh_agg_payin('month', p_from, p_to);
$$;
DO $$ BEGIN RAISE NOTICE 'All refresh functions created'; END $$;

-- hourly ranges in chunks
DO $$
DECLARE
    cur timestamptz := now() - interval '5 years';
    chunk_count int := 0;
    total_chunks int;
BEGIN
  RAISE NOTICE 'Starting hourly aggregation (this may take several minutes)...';

  -- Calculate total chunks for progress tracking
  total_chunks := CEIL(EXTRACT(epoch FROM (now() - (now() - interval '5 years'))) / EXTRACT(epoch FROM interval '30 days'));
  RAISE NOTICE 'Processing % chunks of 30 days each for hourly aggregation', total_chunks;

  WHILE cur < now() LOOP
    chunk_count := chunk_count + 1;
    RAISE NOTICE 'Processing hourly chunk %/% (from % to %)',
      chunk_count, total_chunks, cur, cur + interval '30 days';
    PERFORM refresh_agg_payin_hour(cur, cur + interval '30 days');
    cur := cur + interval '30 days';
  END LOOP;

  RAISE NOTICE 'Hourly aggregation complete: % chunks processed', chunk_count;
END$$;

-- daily long range
DO $$
BEGIN
  RAISE NOTICE 'Starting daily aggregation (5 years)...';
  PERFORM refresh_agg_payin_day(now() - interval '5 years', now());
  RAISE NOTICE 'Daily aggregation complete';
END$$;

-- monthly long range
DO $$
BEGIN
  RAISE NOTICE 'Starting monthly aggregation (5 years)...';
  PERFORM refresh_agg_payin_month(now() - interval '5 years', now());
  RAISE NOTICE 'Monthly aggregation complete';
END$$;

DO $$ BEGIN RAISE NOTICE 'Converting AggPayIn table to LOGGED...'; END $$;
ALTER TABLE "AggPayIn" SET LOGGED;
DO $$ BEGIN RAISE NOTICE 'AggPayIn table converted to LOGGED'; END $$;

DO $$ BEGIN RAISE NOTICE 'Creating unique index on AggPayIn...'; END $$;
CREATE UNIQUE INDEX IF NOT EXISTS "AggPayIn_unique_key"
ON "AggPayIn" (
    "granularity",
    "timeBucket",
    "payInType",
    "subName",
    "userId",
    "slice"
) NULLS NOT DISTINCT;
DO $$ BEGIN RAISE NOTICE 'Unique index created'; END $$;

-- CreateIndex
DO $$ BEGIN RAISE NOTICE 'Creating AggPayIn indexes...'; END $$;
CREATE INDEX "AggPayIn_granularity_slice_timeBucket_idx" ON "AggPayIn"("granularity", "slice", "timeBucket");

-- CreateIndex
CREATE INDEX "AggPayIn_granularity_timeBucket_idx" ON "AggPayIn"("granularity", "timeBucket");

-- CreateIndex
CREATE INDEX "AggPayIn_granularity_payInType_idx" ON "AggPayIn"("granularity", "payInType");

-- CreateIndex
CREATE INDEX "AggPayIn_granularity_subName_idx" ON "AggPayIn"("granularity", "subName");

-- CreateIndex
CREATE INDEX "AggPayIn_granularity_userId_idx" ON "AggPayIn"("granularity", "userId");
DO $$ BEGIN RAISE NOTICE 'All indexes created'; END $$;

-- AddForeignKey
DO $$ BEGIN RAISE NOTICE 'Adding foreign key constraint...'; END $$;
ALTER TABLE "AggPayIn" ADD CONSTRAINT "AggPayIn_subName_fkey" FOREIGN KEY ("subName") REFERENCES "Sub"("name") ON DELETE CASCADE ON UPDATE CASCADE;
DO $$ BEGIN RAISE NOTICE 'Foreign key constraint added'; END $$;

DO $$ BEGIN RAISE NOTICE 'Migration complete!'; END $$;