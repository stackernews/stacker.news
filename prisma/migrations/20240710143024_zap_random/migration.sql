-- AlterTable
ALTER TABLE "users" ADD COLUMN     "tipRandom" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "tipRandomMax" INTEGER,
ADD COLUMN     "tipRandomMin" INTEGER;
