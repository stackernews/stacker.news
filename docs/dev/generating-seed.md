# install postgresql anonymizer extension
```bash
git clone https://gitlab.com/dalibo/postgresql_anonymizer.git
make extension
make install
```

# take a 45 day sample from prod database
```bash
pg_sample --limit=""Item"=created_at >= now() - interval '45 days',"Donation"=created_at >= now() - interval '45 days',"Earn"=created_at >= now() - interval '45 days',"ItemAct"=created_at >= now() - interval '45 days',"Sub"=*,"SubAct"=*,_prisma_migrations=*" stackernews > sample.sql
```

# load the sample and take 5% of it
```bash
createdb sample
psql sample < sample.sql
pg_sample --limit=""Item"=5%,"Donation"=5%,"Earn"=5%,"ItemAct"=5%,"Sub"=*,"SubAct"=*,_prisma_migrations=*" sample > sample.sql
```

# create a new database from data
```bash
dropdb sample
createdb sample
psql sample < sample.sql
```

# initialize the extension
we turn on the privacy by default just to make sure default values are set if we forget to mask a column

```sql
ALTER DATABASE sample SET session_preload_libraries = 'anon';
ALTER DATABASE sample SET anon.privacy_by_default = true;
```

restart session

# begin statically masking the data

We want to keep the variety of data for development purposes, but the exactness is irrelevant. We lose quite a bit of data consistency but that shouldn't matter. We turn off triggers to make this faster.

In some future version it might be worth keeping data consistency and masking other tables.

### initialize the extension
```sql
-- turn off triggers to make this faster
SET session_replication_role = replica;
CREATE EXTENSION IF NOT EXISTS anon CASCADE;
SELECT anon.init();
```

### drop all sensitive tables we won't need
```sql
DELETE FROM pgboss.job;
DELETE FROM pgboss.archive;
DELETE FROM "Snl";
DELETE FROM "Wallet";
DELETE FROM "WalletLightningAddress";
DELETE FROM "WalletLND";
DELETE FROM "Mute";
DELETE FROM "Arc";
DELETE FROM "Streak";
DELETE FROM "NostrRelay";
DELETE FROM "UserNostrRelay";
DELETE FROM "ItemUpload";
DELETE FROM "Upload";
DELETE FROM "LnAuth";
DELETE FROM "LnWith";
DELETE FROM "Invite";
DELETE FROM "Message";
DELETE FROM "ItemForward";
DELETE FROM "PollOption";
DELETE FROM "PollVote";
DELETE FROM "MuteSub";
DELETE FROM "Pin";
DELETE FROM "ReferralAct";
DELETE FROM "Mention";
DELETE FROM "Invoice";
DELETE FROM "Withdrawl";
DELETE FROM "accounts";
DELETE FROM "OFAC";
DELETE FROM "sessions";
DELETE FROM "verification_requests";
DELETE FROM "Bookmark";
DELETE FROM "ThreadSubscription";
DELETE FROM "UserSubscription";
DELETE FROM "PushSubscription";
DELETE FROM "Log";
DELETE FROM "TerritoryTransfer";
```

### mask and shuffle the users table

```sql
-- users
SECURITY LABEL FOR anon ON COLUMN users.created_at
IS 'MASKED WITH FUNCTION anon.random_in_tsrange(''[2021-10-01,2024-2-20]'')';
SECURITY LABEL FOR anon ON COLUMN users.updated_at
IS 'MASKED WITH FUNCTION anon.random_in_tsrange(''[2021-10-01,2024-2-20]'')';
SECURITY LABEL FOR anon ON COLUMN users.msats
IS 'MASKED WITH FUNCTION anon.random_in_int8range(''[0,250000000]'')';
SECURITY LABEL FOR anon ON COLUMN users."stackedMsats"
IS 'MASKED WITH FUNCTION anon.random_in_int8range(''[0,2500000000]'')';
-- set masking for columns we want to mask
SECURITY LABEL FOR anon ON COLUMN users.name
IS 'MASKED WITH VALUE anon.fake_first_name() || anon.fake_last_name() || anon.random_string(3)';
-- set not to mask for columns we don't want to mask
SECURITY LABEL FOR anon ON COLUMN users.id
IS 'NOT MASKED';
SELECT anon.anonymize_table('users');
```

### mask other tables mostly by randomizing the userId column

#### donation

```sql
-- donation
-- set masking for columns we want to mask
SECURITY LABEL FOR anon ON COLUMN "Donation"."userId"
IS 'MASKED WITH FUNCTION anon.random_in(ARRAY(SELECT id FROM public.users))';
-- set not to mask for columns we don't want to mask
SECURITY LABEL FOR anon ON COLUMN "Donation".id
IS 'NOT MASKED';
SECURITY LABEL FOR anon ON COLUMN "Donation".sats
IS 'NOT MASKED';
SECURITY LABEL FOR anon ON COLUMN "Donation".created_at
IS 'NOT MASKED';
SECURITY LABEL FOR anon ON COLUMN "Donation".updated_at
IS 'NOT MASKED';
SELECT anon.anonymize_table('"Donation"');
```

#### earn
```sql
-- set masking for columns we want to mask
SECURITY LABEL FOR anon ON COLUMN "Earn"."userId"
IS 'MASKED WITH FUNCTION anon.random_in(ARRAY(SELECT id FROM public.users))';
-- set not to mask for columns we don't want to mask
SECURITY LABEL FOR anon ON COLUMN "Earn".id
IS 'NOT MASKED';
SECURITY LABEL FOR anon ON COLUMN "Earn".created_at
IS 'NOT MASKED';
SECURITY LABEL FOR anon ON COLUMN "Earn".updated_at
IS 'NOT MASKED';
SECURITY LABEL FOR anon ON COLUMN "Earn".msats
IS 'NOT MASKED';
SELECT anon.anonymize_table('"Earn"');
```

#### item
```sql
SECURITY LABEL FOR anon ON COLUMN "Item"."userId"
IS 'MASKED WITH FUNCTION anon.random_in(ARRAY(SELECT id FROM public.users))';
-- set not to mask for columns we don't want to mask
SECURITY LABEL FOR anon ON COLUMN "Item".id
IS 'NOT MASKED';
SECURITY LABEL FOR anon ON COLUMN "Item".created_at
IS 'NOT MASKED';
SECURITY LABEL FOR anon ON COLUMN "Item".msats
IS 'MASKED WITH FUNCTION anon.random_in_int8range(''[0,250000000]'')';
SECURITY LABEL FOR anon ON COLUMN "Item"."weightedVotes"
IS 'MASKED WITH FUNCTION anon.random_in_numrange(''[0,30]'')';
SECURITY LABEL FOR anon ON COLUMN "Item".text
IS 'MASKED WITH VALUE CASE WHEN "Item".text IS NULL
        THEN "Item".text
        ELSE anon.lorem_ipsum(characters := LENGTH("Item".text))
        END';
SECURITY LABEL FOR anon ON COLUMN "Item".title
IS 'MASKED WITH VALUE CASE WHEN "Item".title IS NULL
        THEN "Item".title
        ELSE anon.lorem_ipsum(characters := LENGTH("Item".title))
        END';
SECURITY LABEL FOR anon ON COLUMN "Item".url
IS 'MASKED WITH VALUE ''https://example.com/''';
SECURITY LABEL FOR anon ON COLUMN "Item".updated_at
IS 'NOT MASKED';
SECURITY LABEL FOR anon ON COLUMN "Item".path
IS 'NOT MASKED';
SECURITY LABEL FOR anon ON COLUMN "Item"."parentId"
IS 'NOT MASKED';
SECURITY LABEL FOR anon ON COLUMN "Item"."subName"
IS 'NOT MASKED';
SECURITY LABEL FOR anon ON COLUMN "Item"."ncomments"
IS 'NOT MASKED';
SECURITY LABEL FOR anon ON COLUMN "Item"."rootId"
IS 'NOT MASKED';
SELECT anon.anonymize_table('"Item"');
```

#### itemAct
```sql
SECURITY LABEL FOR anon ON COLUMN "ItemAct"."userId"
IS 'MASKED WITH FUNCTION anon.random_in(ARRAY(SELECT id FROM public.users))';
-- set not to mask for columns we don't want to mask
SECURITY LABEL FOR anon ON COLUMN "ItemAct"."id"
IS 'NOT MASKED';
SECURITY LABEL FOR anon ON COLUMN "ItemAct"."itemId"
IS 'NOT MASKED';
SECURITY LABEL FOR anon ON COLUMN "ItemAct".created_at
IS 'NOT MASKED';
SECURITY LABEL FOR anon ON COLUMN "ItemAct".updated_at
IS 'NOT MASKED';
SECURITY LABEL FOR anon ON COLUMN "ItemAct".act
IS 'NOT MASKED';
SECURITY LABEL FOR anon ON COLUMN "ItemAct".msats
IS 'NOT MASKED';
SELECT anon.anonymize_table('"ItemAct"');
```

#### sub
```sql
SECURITY LABEL FOR anon ON COLUMN "Sub"."userId"
IS 'MASKED WITH FUNCTION anon.random_in(ARRAY(SELECT id FROM public.users))';
-- set not to mask for columns we don't want to mask
SECURITY LABEL FOR anon ON COLUMN "Sub"."name"
IS 'NOT MASKED';
SECURITY LABEL FOR anon ON COLUMN "Sub"."path"
IS 'NOT MASKED';
SECURITY LABEL FOR anon ON COLUMN "Sub".created_at
IS 'NOT MASKED';
SECURITY LABEL FOR anon ON COLUMN "Sub".updated_at
IS 'NOT MASKED';
SECURITY LABEL FOR anon ON COLUMN "Sub"."billingType"
IS 'MASKED WITH VALUE ''ONCE''';
SECURITY LABEL FOR anon ON COLUMN "Sub"."billingCost"
IS 'MASKED WITH VALUE 0';
SECURITY LABEL FOR anon ON COLUMN "Sub"."rankingType"
IS 'NOT MASKED';
SECURITY LABEL FOR anon ON COLUMN "Sub"."postTypes"
IS 'NOT MASKED';
SELECT anon.anonymize_table('"Sub"');
```

#### subAct
```sql
SECURITY LABEL FOR anon ON COLUMN "SubAct"."userId"
IS 'MASKED WITH FUNCTION anon.random_in(ARRAY(SELECT id FROM public.users))';
-- shuffle the subName column
SELECT anon.shuffle_column('"SubAct"', 'subName', 'id');
SELECT anon.shuffle_column('"SubAct"', 'msats', 'id');
-- set not to mask for columns we don't want to mask
SECURITY LABEL FOR anon ON COLUMN "SubAct".id
IS 'NOT MASKED';
SECURITY LABEL FOR anon ON COLUMN "SubAct"."subName"
IS 'NOT MASKED';
SECURITY LABEL FOR anon ON COLUMN "SubAct".type
IS 'NOT MASKED';
SECURITY LABEL FOR anon ON COLUMN "SubAct".msats
IS 'NOT MASKED';
SECURITY LABEL FOR anon ON COLUMN "SubAct".created_at
IS 'NOT MASKED';
SECURITY LABEL FOR anon ON COLUMN "SubAct".updated_at
IS 'NOT MASKED';
SELECT anon.anonymize_table('"SubAct"');
```

#### _prisma_migrations

don't mask this table

```sql
SECURITY LABEL FOR anon ON COLUMN _prisma_migrations.id
IS 'NOT MASKED';
SECURITY LABEL FOR anon ON COLUMN _prisma_migrations.checksum
IS 'NOT MASKED';
SECURITY LABEL FOR anon ON COLUMN _prisma_migrations.finished_at
IS 'NOT MASKED';
SECURITY LABEL FOR anon ON COLUMN _prisma_migrations.migration_name
IS 'NOT MASKED';
SECURITY LABEL FOR anon ON COLUMN _prisma_migrations.started_at
IS 'NOT MASKED';
SECURITY LABEL FOR anon ON COLUMN _prisma_migrations.applied_steps_count
IS 'NOT MASKED';
SECURITY LABEL FOR anon ON COLUMN _prisma_migrations.rolled_back_at
IS 'NOT MASKED';
SELECT anon.anonymize_table('_prisma_migrations');
```

#### pgboss.schedule

don't mask this table

```sql
SECURITY LABEL FOR anon ON COLUMN pgboss.schedule.name
IS 'NOT MASKED';
SECURITY LABEL FOR anon ON COLUMN pgboss.schedule.cron
IS 'NOT MASKED';
SECURITY LABEL FOR anon ON COLUMN pgboss.schedule.timezone
IS 'NOT MASKED';
SECURITY LABEL FOR anon ON COLUMN pgboss.schedule.data
IS 'NOT MASKED';
SECURITY LABEL FOR anon ON COLUMN pgboss.schedule.options
IS 'NOT MASKED';
SECURITY LABEL FOR anon ON COLUMN pgboss.schedule.created_on
IS 'NOT MASKED';
SECURITY LABEL FOR anon ON COLUMN pgboss.schedule.updated_on
IS 'NOT MASKED';
SELECT anon.anonymize_table('pgboss.schedule');
```

#### pgboss.version

don't mask this table

```sql
SECURITY LABEL FOR anon ON COLUMN pgboss.version.version
IS 'NOT MASKED';
SECURITY LABEL FOR anon ON COLUMN pgboss.version.maintained_on
IS 'NOT MASKED';
SECURITY LABEL FOR anon ON COLUMN pgboss.version.cron_on
IS 'NOT MASKED';
SELECT anon.anonymize_table('pgboss.version');
```

# turn triggers back on
```sql
SET session_replication_role = DEFAULT;
DROP EXTENSION IF EXISTS anon CASCADE;
```

# refresh all materialized views
```sql
SET search_path TO public;

CREATE OR REPLACE FUNCTION public.RefreshAllMaterializedViews(schema_arg TEXT DEFAULT 'public')
RETURNS INT AS $$
DECLARE
    r RECORD;
BEGIN
    RAISE NOTICE 'Refreshing materialized view in schema %', schema_arg;
    FOR r IN SELECT matviewname FROM pg_matviews WHERE schemaname = schema_arg
    LOOP
        RAISE NOTICE 'Refreshing %.%', schema_arg, r.matviewname;
        EXECUTE 'REFRESH MATERIALIZED VIEW ' || schema_arg || '.' || r.matviewname;
    END LOOP;

    RETURN 1;
END
$$ LANGUAGE plpgsql;

-- make sure materialized views are refreshed
SELECT public.RefreshAllMaterializedViews();
```

# dump it
```bash
pg_dump sample --no-owner --no-security-labels > anon.sql
```

# modify search_path
```sql
SELECT pg_catalog.set_config('search_path', 'public', false);
```

# set the time zone to UTC
```sql
ALTER DATABASE stackernews SET timezone TO 'UTC';
```

# modify the dump to timewarp the data at the end
```sql
CREATE OR REPLACE FUNCTION timewarp()
RETURNS VOID LANGUAGE plpgsql AS $$
DECLARE
  r RECORD;
  max_timestamp TIMESTAMP;
  interval_to_add INTERVAL;
BEGIN
  FOR r IN SELECT c.table_schema, c.table_name, c.column_name
           FROM information_schema.columns c
           JOIN information_schema.tables t ON c.table_schema = t.table_schema AND c.table_name = t.table_name
           WHERE c.data_type IN ('timestamp without time zone', 'timestamp with time zone')
           AND c.table_schema NOT IN ('pg_catalog', 'information_schema') -- Exclude system schemas
           AND t.table_type = 'BASE TABLE' -- Ensure targeting only user-defined tables (excluding views)
           AND t.table_schema NOT LIKE 'pg_%' -- Exclude other potential PostgreSQL system schemas
  LOOP
    -- Calculate the maximum value in the column
    EXECUTE format('SELECT max(%I) FROM %I.%I', r.column_name, r.table_schema, r.table_name) INTO max_timestamp;

    -- If there's a maximum value, calculate the interval and update the column
    IF max_timestamp IS NOT NULL THEN
      interval_to_add := now() - max_timestamp;
      EXECUTE format('UPDATE %I.%I SET %I = %I + %L', r.table_schema, r.table_name, r.column_name, r.column_name, interval_to_add);
    END IF;
  END LOOP;
END;
$$;

SELECT timewarp();
```

# fix denormalized comment stuff
```sql
UPDATE "Item" p SET (ncomments, "commentMsats") =
(SELECT COALESCE(count(*), 0), COALESCE(sum(msats), 0)
FROM "Item" c
WHERE c.path <@ p.path AND p.id <> c.id);
```

# index all the tables
```sql
INSERT INTO pgboss.job (name) VALUES ('indexAllItems');
```