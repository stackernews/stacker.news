/*
  Warnings:

  - A unique constraint covering the columns `[slashtagId]` on the table `users` will be added. If there are existing duplicate values, this will fail.

*/
-- AlterTable
ALTER TABLE "users" ADD COLUMN     "slashtagId" TEXT;

-- CreateIndex
CREATE UNIQUE INDEX "users.slashtagId_unique" ON "users"("slashtagId");
