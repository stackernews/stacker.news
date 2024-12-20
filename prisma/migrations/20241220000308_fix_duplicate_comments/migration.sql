-- create a partial exclusion constraint that prevents insertion of duplicate items within 10 minutes
CREATE EXTENSION IF NOT EXISTS btree_gist;
ALTER TABLE "Item" ADD CONSTRAINT "Item_unique_time_constraint"
  EXCLUDE USING gist (
    "userId" WITH =,
    -- we use COALESCE so NULL is considered equal to itself. we also use md5 hashes because columns
    -- of type TEXT can make index row too large and columns of type CITEXT are not supported by GiST.
    COALESCE("parentId", -1) WITH =,
    md5(COALESCE("title", '')) WITH =,
    md5(COALESCE("subName", '')) WITH =,
    md5(COALESCE("text", '')) WITH =,
    tsrange(created_at, created_at + INTERVAL '10 minutes') WITH &&
  )
  -- enforce constraint after this date
  WHERE (created_at > '2024-12-20');
