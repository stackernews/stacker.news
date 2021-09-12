-- AlterTable
ALTER TABLE "ItemAct" ALTER COLUMN "sats" DROP DEFAULT;

-- AlterTable
ALTER TABLE "users" ADD COLUMN     "tipDefault" INTEGER NOT NULL DEFAULT 0;
