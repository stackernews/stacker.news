-- CreateTable
CREATE UNLOGGED TABLE "AggRegistrations" (
    "id" SERIAL NOT NULL,
    "timeBucket" TIMESTAMPTZ(3) NOT NULL,
    "granularity" "AggGranularity" NOT NULL,
    "count" BIGINT NOT NULL,
    "invitedCount" BIGINT NOT NULL,
    "referredCount" BIGINT NOT NULL,

    CONSTRAINT "AggRegistrations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE UNLOGGED TABLE "AggRewards" (
    "id" SERIAL NOT NULL,
    "timeBucket" TIMESTAMPTZ(3) NOT NULL,
    "granularity" "AggGranularity" NOT NULL,
    "payInType" "PayInType",
    "msats" BIGINT NOT NULL,
    "countGroup" BIGINT NOT NULL,

    CONSTRAINT "AggRewards_pkey" PRIMARY KEY ("id")
);

CREATE OR REPLACE FUNCTION refresh_agg_registrations(
  bucket_part  text,        -- 'hour' | 'day' | 'month'
  p_from       timestamptz DEFAULT now() - interval '2 hours',
  p_to         timestamptz DEFAULT now()
) RETURNS void
LANGUAGE plpgsql
AS $$
DECLARE
  v_from  timestamptz;
  v_to    timestamptz;
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

  -- Align to clean bucket edges (naive timestamps here)
  v_from := date_trunc(bucket_part, p_from, 'America/Chicago');
  v_to   := date_trunc(bucket_part, p_to, 'America/Chicago') + v_step;

  -- Idempotent: clear the window for this granularity
  DELETE FROM "AggRegistrations"
  WHERE granularity = v_gran
    AND "timeBucket" >= v_from
    AND "timeBucket" <  v_to;

  -- Rebuild window
  INSERT INTO "AggRegistrations" ("timeBucket","granularity","count","invitedCount","referredCount")
  SELECT
    date_trunc(bucket_part, u."created_at" AT TIME ZONE 'UTC', 'America/Chicago')   AS "timeBucket",
    v_gran                                                                   AS granularity,
    COUNT(*)::bigint                                                         AS "count",
    COUNT(*) FILTER (WHERE u."inviteId"   IS NOT NULL)::bigint               AS "invitedCount",
    COUNT(*) FILTER (WHERE u."referrerId" IS NOT NULL)::bigint               AS "referredCount"
  FROM "users" u
  WHERE u."created_at" >= (v_from AT TIME ZONE 'UTC')
    AND u."created_at" < (v_to AT TIME ZONE 'UTC')
  GROUP BY "timeBucket";

END;
$$;

CREATE OR REPLACE FUNCTION refresh_agg_rewards(
  bucket_part  text,        -- 'hour' | 'day' | 'month'
  p_from       timestamptz DEFAULT now() - interval '2 hours',
  p_to         timestamptz DEFAULT now()
) RETURNS void
LANGUAGE plpgsql
AS $$
DECLARE
  v_from_local  timestamptz;          -- local wall-clock bucket start/end
  v_to_local    timestamptz;
  v_step        interval;
  v_gran        "AggGranularity";
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

  -- Align the window in *display* TZ (so buckets match your UI labels)
  v_from_local := date_trunc(bucket_part, p_from, 'America/Chicago');
  v_to_local   := date_trunc(bucket_part, p_to, 'America/Chicago') + v_step;

  -- Idempotent: clear this granularity’s window
  DELETE FROM "AggRewards"
  WHERE granularity = v_gran
    AND "timeBucket" >= v_from_local  -- convert local bucket start to timestamptz
    AND "timeBucket" <  v_to_local;

  -- Rebuild window: compute local bucket, then store its *instant* as timestamptz
  WITH facts AS (
    SELECT
      -- bucket in local time
      date_trunc(bucket_part, "PayIn"."payInStateChangedAt" AT TIME ZONE 'UTC', 'America/Chicago') AS bucket_local,
      "PayIn"."payInType" AS "payInType",
      "PayOutCustodialToken"."mtokens"::bigint AS msats
    FROM "PayIn"
    JOIN "PayOutCustodialToken"
      ON "PayOutCustodialToken"."payInId" = "PayIn"."id"
    WHERE "PayIn"."payInState" = 'PAID'
      AND "PayOutCustodialToken"."payOutType" = 'REWARDS_POOL'
      AND "PayIn"."payInStateChangedAt" >= (v_from_local AT TIME ZONE 'UTC')
      AND "PayIn"."payInStateChangedAt" < (v_to_local AT TIME ZONE 'UTC')
  ),
  by_type AS (
    SELECT
      bucket_local AS "timeBucket",
      v_gran AS granularity,
      "payInType",
      SUM(msats)::bigint AS msats,
      COUNT(*)::bigint AS "countGroup"
    FROM facts
    GROUP BY bucket_local,"payInType"
  ),
  totals AS (
    SELECT
      bucket_local AS "timeBucket",
      v_gran AS granularity,
      NULL::"PayInType" AS "payInType",
      SUM(msats)::bigint AS msats,
      COUNT(*)::bigint AS "countGroup"
    FROM facts
    GROUP BY bucket_local
  )
  INSERT INTO "AggRewards" ("timeBucket","granularity","payInType","msats","countGroup")
  SELECT * FROM totals
  UNION ALL
  SELECT * FROM by_type;

END;
$$;

-- Optional tiny wrappers (nice symmetry with the rest of your jobs)
CREATE OR REPLACE FUNCTION refresh_agg_registrations_hour(
  p_from timestamptz DEFAULT now() - interval '2 hours',
  p_to   timestamptz DEFAULT now()
) RETURNS void LANGUAGE sql AS $$
  SELECT refresh_agg_registrations('hour', p_from, p_to);
$$;

CREATE OR REPLACE FUNCTION refresh_agg_registrations_day(
  p_from timestamptz DEFAULT now() - interval '14 days',
  p_to   timestamptz DEFAULT now()
) RETURNS void LANGUAGE sql AS $$
  SELECT refresh_agg_registrations('day', p_from, p_to);
$$;

CREATE OR REPLACE FUNCTION refresh_agg_registrations_month(
  p_from timestamptz DEFAULT now() - interval '24 months',
  p_to   timestamptz DEFAULT now()
) RETURNS void LANGUAGE sql AS $$
  SELECT refresh_agg_registrations('month', p_from, p_to);
$$;

-- Optional wrappers
CREATE OR REPLACE FUNCTION refresh_agg_rewards_hour(
  p_from timestamptz DEFAULT now() - interval '2 hours',
  p_to   timestamptz DEFAULT now()
) RETURNS void LANGUAGE sql AS $$
  SELECT refresh_agg_rewards('hour', p_from, p_to);
$$;

CREATE OR REPLACE FUNCTION refresh_agg_rewards_day(
  p_from timestamptz DEFAULT now() - interval '14 days',
  p_to   timestamptz DEFAULT now()
) RETURNS void LANGUAGE sql AS $$
  SELECT refresh_agg_rewards('day', p_from, p_to);
$$;

CREATE OR REPLACE FUNCTION refresh_agg_rewards_month(
  p_from timestamptz DEFAULT now() - interval '24 months',
  p_to   timestamptz DEFAULT now()
) RETURNS void LANGUAGE sql AS $$
  SELECT refresh_agg_rewards('month', p_from, p_to);
$$;

-- hourly ranges in chunks
DO $$
DECLARE cur timestamptz := now() - interval '5 years';
BEGIN
  WHILE cur < now() LOOP
    PERFORM refresh_agg_rewards_hour(cur, cur + interval '30 days');
    PERFORM refresh_agg_registrations_hour(cur, cur + interval '30 days');
    cur := cur + interval '30 days';
  END LOOP;
END$$;

-- daily long range
SELECT refresh_agg_rewards_day(now() - interval '5 years', now());
SELECT refresh_agg_registrations_day(now() - interval '5 years', now());
-- monthly long range
SELECT refresh_agg_rewards_month(now() - interval '5 years', now());
SELECT refresh_agg_registrations_month(now() - interval '5 years', now());

ALTER TABLE "AggRegistrations" SET LOGGED;
ALTER TABLE "AggRewards" SET LOGGED;

-- CreateIndex
CREATE UNIQUE INDEX "AggRegistrations_unique_key" ON "AggRegistrations"("granularity", "timeBucket");

-- CreateIndex
CREATE UNIQUE INDEX "AggRewards_unique_key" ON "AggRewards"("granularity", "timeBucket", "payInType");

CREATE OR REPLACE FUNCTION new_views()
RETURNS INTEGER
LANGUAGE plpgsql
AS $$
DECLARE
BEGIN
    UPDATE pgboss.schedule SET cron = '* * * * *' WHERE name = 'views-hours';
    UPDATE pgboss.schedule SET cron = '*/5 * * * *' WHERE name = 'views-days';
    UPDATE pgboss.schedule SET cron = '0 * * * *' WHERE name = 'views-months';
    return 0;
EXCEPTION WHEN OTHERS THEN
    return 0;
END;
$$;

SELECT new_views();
DROP FUNCTION new_views();