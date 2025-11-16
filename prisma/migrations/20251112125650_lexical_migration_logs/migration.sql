-- CreateEnum
CREATE TYPE "MigrationType" AS ENUM ('LEXICAL_CONVERSION', 'HTML_GENERATION', 'UNEXPECTED');

-- CreateTable
CREATE TABLE "LexicalMigrationLog" (
    "id" SERIAL NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "itemId" INTEGER NOT NULL,
    "type" "MigrationType" NOT NULL,
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
