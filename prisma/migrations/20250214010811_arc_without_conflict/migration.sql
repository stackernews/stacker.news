/*
  Warnings:

  - The primary key for the `Arc` table will be changed. If it partially fails, the table could be left without primary key constraint.
  - A unique constraint covering the columns `[fromId,toId,withoutConflict]` on the table `Arc` will be added. If there are existing duplicate values, this will fail.
  - A unique constraint covering the columns `[toId,fromId,withoutConflict]` on the table `Arc` will be added. If there are existing duplicate values, this will fail.

*/
-- DropIndex
DROP INDEX "Arc_toId_fromId_idx";

-- AlterTable
ALTER TABLE "Arc" DROP CONSTRAINT "Arc_pkey",
ADD COLUMN     "id" SERIAL NOT NULL,
ADD COLUMN     "withoutConflict" BOOLEAN NOT NULL DEFAULT false,
ADD CONSTRAINT "Arc_pkey" PRIMARY KEY ("id");

-- AlterTable
ALTER TABLE "users" ADD COLUMN  "trustWithoutConflict" DOUBLE PRECISION NOT NULL DEFAULT 0;

-- CreateIndex
CREATE UNIQUE INDEX "Arc_fromId_toId_withoutConflict_key" ON "Arc"("fromId", "toId", "withoutConflict");

-- CreateIndex
CREATE UNIQUE INDEX "Arc_toId_fromId_withoutConflict_key" ON "Arc"("toId", "fromId", "withoutConflict");
