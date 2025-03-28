-- AlterTable
ALTER TABLE "users"
    ADD COLUMN     "hasRecvWallet" BOOLEAN NOT NULL DEFAULT false,
    ADD COLUMN     "hasSendWallet" BOOLEAN NOT NULL DEFAULT false;
