/*
  Warnings:

  - A unique constraint covering the columns `[itemId]` on the table `LexicalMigrationLog` will be added. If there are existing duplicate values, this will fail.

*/
-- CreateIndex
CREATE UNIQUE INDEX "LexicalMigrationLog_itemId_key" ON "LexicalMigrationLog"("itemId");
