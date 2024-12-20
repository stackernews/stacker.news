-- create a partial exclusion constraint that prevents insertion of duplicate items within 10 minutes
CREATE EXTENSION IF NOT EXISTS btree_gist;
ALTER TABLE "Item" ADD CONSTRAINT "Item_unique_time_constraint"
  EXCLUDE USING gist (
    "userId" WITH =,
    -- we use COALESCE so NULL is considered equal to itself
    COALESCE("parentId", -1) WITH =,
    COALESCE("title", '') WITH =,
    -- GiST does not support citext so we use md5 hash
    md5(COALESCE("subName", '')) WITH =,
    -- including text column directly can make index row too large so we use md5 hash
    md5("text") WITH =,
    tsrange(created_at, created_at + INTERVAL '10 minutes') WITH &&
  )
  -- enforce constraint after this date
  WHERE (created_at > '2024-12-20');
