-- make sure we can still delete items within 10 minutes
ALTER TABLE "Item" DROP CONSTRAINT "Item_unique_time_constraint";
ALTER TABLE "Item" ADD CONSTRAINT "Item_unique_time_constraint"
  EXCLUDE USING gist (
    "userId" WITH =,
    COALESCE("parentId", -1) WITH =,
    md5(COALESCE("title", '')) WITH =,
    md5(COALESCE("subName", '')) WITH =,
    md5(COALESCE("text", '')) WITH =,
    tsrange(created_at, created_at + INTERVAL '10 minutes') WITH &&
  )
  WHERE (created_at > '2024-12-30' AND "deletedAt" IS NULL);
