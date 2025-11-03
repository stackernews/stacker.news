-- AlterTable
ALTER TABLE "users" ADD COLUMN     "cured" BOOLEAN NOT NULL DEFAULT false;

-- CreateTable
CREATE TABLE "Cure" (
    "id" SERIAL NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "itemActId" INTEGER,
    "cureeId" INTEGER NOT NULL,
    "curerId" INTEGER,

    CONSTRAINT "Cure_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Cure_cureeId_unique" ON "Cure"("cureeId");

-- CreateIndex
CREATE UNIQUE INDEX "Cure_itemActId_unique" ON "Cure"("itemActId");

-- CreateIndex
CREATE INDEX "Cure_curerId_idx" ON "Cure"("curerId");

-- AddForeignKey
ALTER TABLE "Cure" ADD CONSTRAINT "Cure_cureeId_fkey" FOREIGN KEY ("cureeId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Cure" ADD CONSTRAINT "Cure_curerId_fkey" FOREIGN KEY ("curerId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Cure" ADD CONSTRAINT "Cure_itemActId_fkey" FOREIGN KEY ("itemActId") REFERENCES "ItemAct"("id") ON DELETE CASCADE ON UPDATE CASCADE;
