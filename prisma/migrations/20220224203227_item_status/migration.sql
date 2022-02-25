-- CreateEnum
CREATE TYPE "Status" AS ENUM ('ACTIVE', 'STOPPED', 'NOSATS');

-- AlterTable
ALTER TABLE "Item" ADD COLUMN     "noSatsAt" TIMESTAMP(3),
ADD COLUMN     "status" "Status" NOT NULL DEFAULT E'ACTIVE';
