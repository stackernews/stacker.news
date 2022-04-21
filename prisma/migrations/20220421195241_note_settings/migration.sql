-- AlterTable
ALTER TABLE "users" ADD COLUMN     "noteAllDescendants" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN     "noteDeposits" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN     "noteEarning" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN     "noteInvites" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN     "noteItemSats" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN     "noteMentions" BOOLEAN NOT NULL DEFAULT true;
