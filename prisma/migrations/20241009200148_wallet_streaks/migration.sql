-- CreateEnum
CREATE TYPE "StreakType" AS ENUM ('COWBOY_HAT', 'GUN', 'HORSE');

-- AlterTable
ALTER TABLE "Streak" ADD COLUMN     "type" "StreakType" NOT NULL DEFAULT 'COWBOY_HAT';

-- AlterTable
ALTER TABLE "users" ADD COLUMN     "gunStreak" INTEGER,
ADD COLUMN     "horseStreak" INTEGER;

-- CreateIndex
CREATE INDEX "Streak_type_idx" ON "Streak"("type");

-- CreateIndex
CREATE INDEX "users_streak_idx" ON "users"("streak");

-- CreateIndex
CREATE INDEX "users_gunStreak_idx" ON "users"("gunStreak");

-- CreateIndex
CREATE INDEX "users_horseStreak_idx" ON "users"("horseStreak");
