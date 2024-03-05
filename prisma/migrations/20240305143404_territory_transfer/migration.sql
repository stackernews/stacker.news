-- CreateTable
CREATE TABLE "TerritoryTransfer" (
    "id" SERIAL NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "oldUserId" INTEGER NOT NULL,
    "newUserId" INTEGER NOT NULL,
    "subName" CITEXT NOT NULL,

    CONSTRAINT "TerritoryTransfer_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "TerritoryTransfer.newUserId_index" ON "TerritoryTransfer"("created_at", "newUserId");

-- CreateIndex
CREATE INDEX "TerritoryTransfer.oldUserId_index" ON "TerritoryTransfer"("created_at", "oldUserId");

-- AddForeignKey
ALTER TABLE "TerritoryTransfer" ADD CONSTRAINT "TerritoryTransfer_oldUserId_fkey" FOREIGN KEY ("oldUserId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TerritoryTransfer" ADD CONSTRAINT "TerritoryTransfer_newUserId_fkey" FOREIGN KEY ("newUserId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TerritoryTransfer" ADD CONSTRAINT "TerritoryTransfer_subName_fkey" FOREIGN KEY ("subName") REFERENCES "Sub"("name") ON DELETE CASCADE ON UPDATE CASCADE;
