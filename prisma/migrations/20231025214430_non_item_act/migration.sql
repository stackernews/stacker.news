-- CreateEnum
CREATE TYPE "NonItemActType" AS ENUM ('NYM_CHANGE');

-- CreateTable
CREATE TABLE "NonItemAct" (
    "id" SERIAL NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "userId" INTEGER NOT NULL,
    "msats" BIGINT NOT NULL,
    "type" "NonItemActType" NOT NULL,

    CONSTRAINT "NonItemAct_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "NonItemAct.userId_index" ON "NonItemAct"("userId");

-- CreateIndex
CREATE INDEX "NonItemAct.userId_type_index" ON "NonItemAct"("userId", "type");

-- CreateIndex
CREATE INDEX "NonItemAct.type_index" ON "NonItemAct"("type");

-- CreateIndex
CREATE INDEX "NonItemAct.created_at_index" ON "NonItemAct"("created_at");

-- CreateIndex
CREATE INDEX "NonItemAct.created_at_type_index" ON "NonItemAct"("created_at", "type");

-- CreateIndex
CREATE INDEX "NonItemAct.userId_created_at_type_index" ON "NonItemAct"("userId", "created_at", "type");

-- AddForeignKey
ALTER TABLE "NonItemAct" ADD CONSTRAINT "NonItemAct_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
