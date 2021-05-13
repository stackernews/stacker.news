-- CreateEnum
CREATE TYPE "WithdrawlStatus" AS ENUM ('INSUFFICIENT_BALANCE', 'INVALID_PAYMENT', 'PATHFINDING_TIMEOUT', 'ROUTE_NOT_FOUND');

-- CreateTable
CREATE TABLE "Withdrawl" (
    "id" SERIAL NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "userId" INTEGER NOT NULL,
    "hash" TEXT NOT NULL,
    "bolt11" TEXT NOT NULL,
    "msatsPaying" INTEGER NOT NULL,
    "msatsPaid" INTEGER,
    "msatsFeePaying" INTEGER NOT NULL,
    "msatsFeePaid" INTEGER,
    "status" "WithdrawlStatus",

    PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Withdrawl.hash_unique" ON "Withdrawl"("hash");

-- CreateIndex
CREATE INDEX "Withdrawl.userId_index" ON "Withdrawl"("userId");

-- AddForeignKey
ALTER TABLE "Withdrawl" ADD FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
