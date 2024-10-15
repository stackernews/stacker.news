-- AlterEnum
ALTER TYPE "LogLevel" ADD VALUE 'SUCCESS';

-- CreateTable
CREATE TABLE "WalletLog" (
    "id" SERIAL NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "userId" INTEGER NOT NULL,
    "wallet" TEXT NOT NULL,
    "level" "LogLevel" NOT NULL,
    "message" TEXT NOT NULL,

    CONSTRAINT "WalletLog_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "WalletLog_userId_created_at_idx" ON "WalletLog"("userId", "created_at");

-- AddForeignKey
ALTER TABLE "WalletLog" ADD CONSTRAINT "WalletLog_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
