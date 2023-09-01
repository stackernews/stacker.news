-- CreateEnum
CREATE TYPE "CsvRequest" AS ENUM ('NO_REQUEST', 'FULL_REPORT');

-- CreateEnum
CREATE TYPE "CsvRequestStatus" AS ENUM ('NO_REQUEST', 'FULL_REPORT', 'GENERATING_REPORT');

-- AlterTable
ALTER TABLE "users" ADD COLUMN     "csvRequest" "CsvRequest" NOT NULL DEFAULT 'NO_REQUEST',
ADD COLUMN     "csvRequestProgress" INTEGER,
ADD COLUMN     "csvRequestStatus" "CsvRequestStatus" NOT NULL DEFAULT 'NO_REQUEST';
