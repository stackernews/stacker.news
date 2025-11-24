-- AlterTable - Lexical Editor support
-- lexicalState is the raw JSON state of the editor
-- html is the sanitized HTML result of the editor
ALTER TABLE "Item" ADD COLUMN "lexicalState" JSONB, ADD COLUMN "html" TEXT;

-- CreateEnum
CREATE TYPE "LexicalMigrationType" AS ENUM ('LEXICAL_CONVERSION', 'HTML_GENERATION', 'UNEXPECTED');

-- CreateTable
CREATE TABLE "LexicalMigrationLog" (
    "id" SERIAL NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "itemId" INTEGER NOT NULL,
    "type" "LexicalMigrationType" NOT NULL,
    "retryCount" INTEGER NOT NULL DEFAULT 0,
    "message" TEXT NOT NULL,

    CONSTRAINT "LexicalMigrationLog_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "LexicalBatchMigrationLog" (
    "id" SERIAL NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "durationMs" INTEGER NOT NULL,
    "successCount" INTEGER NOT NULL,
    "failureCount" INTEGER NOT NULL,
    "summary" JSONB,

    CONSTRAINT "LexicalBatchMigrationLog_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "LexicalMigrationLog_type_idx" ON "LexicalMigrationLog"("type");

-- CreateIndex
CREATE INDEX "LexicalMigrationLog_retryCount_idx" ON "LexicalMigrationLog"("retryCount");

-- CreateIndex
CREATE INDEX "LexicalMigrationLog_itemId_idx" ON "LexicalMigrationLog"("itemId");

-- CreateIndex
CREATE INDEX "LexicalBatchMigrationLog_created_at_idx" ON "LexicalBatchMigrationLog"("created_at");

-- AddForeignKey
ALTER TABLE "LexicalMigrationLog" ADD CONSTRAINT "LexicalMigrationLog_itemId_fkey" FOREIGN KEY ("itemId") REFERENCES "Item"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- CreateIndex
CREATE UNIQUE INDEX "LexicalMigrationLog_itemId_key" ON "LexicalMigrationLog"("itemId");

-- ensure we can't submit duplicate lexical states within 10 minutes
-- ALTER TABLE "Item" DROP CONSTRAINT "Item_unique_time_constraint";
-- ALTER TABLE "Item" ADD CONSTRAINT "Item_unique_time_constraint"
--   EXCLUDE USING gist (
--     "userId" WITH =,
--     COALESCE("parentId", -1) WITH =,
--     md5(COALESCE("title", '')) WITH =,
--     md5(COALESCE("subName", '')) WITH =,
--     md5(COALESCE("text", '')) WITH =,
--     tsrange(created_at, created_at + INTERVAL '10 minutes') WITH &&
--   )
--   -- update constraint date
--   WHERE (created_at > '2025-10-24' AND "deletedAt" IS NULL);
