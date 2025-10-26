-- AlterTable - Lexical Editor support
-- lexicalState is the raw JSON state of the editor
-- html is the sanitized HTML result of the editor
ALTER TABLE "Item" ADD COLUMN "lexicalState" JSONB, ADD COLUMN "html" TEXT;

-- ensure we can't submit duplicate lexical states within 10 minutes
ALTER TABLE "Item" DROP CONSTRAINT "Item_unique_time_constraint";
ALTER TABLE "Item" ADD CONSTRAINT "Item_unique_time_constraint"
  EXCLUDE USING gist (
    "userId" WITH =,
    COALESCE("parentId", -1) WITH =,
    md5(COALESCE("title", '')) WITH =,
    md5(COALESCE("subName", '')) WITH =,
    md5(COALESCE("text", '')) WITH =,
    -- well okay, what if lexicalState is so slightly different?
    -- we should do more checks
    md5(COALESCE("lexicalState"::text, '')) WITH =,
    tsrange(created_at, created_at + INTERVAL '10 minutes') WITH &&
  )
  -- update constraint date
  WHERE (created_at > '2025-10-24' AND "deletedAt" IS NULL);
