-- CreateEnum
CREATE TYPE "LogLevel" AS ENUM ('DEBUG', 'INFO', 'WARN', 'ERROR');

-- AlterTable
ALTER TABLE "users" ADD COLUMN     "diagnostics" BOOLEAN NOT NULL DEFAULT false;

-- CreateTable
CREATE TABLE "Log" (
    "id" SERIAL NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "level" "LogLevel" NOT NULL,
    "name" TEXT NOT NULL,
    "message" TEXT NOT NULL,
    "env" JSONB,
    "context" JSONB,

    CONSTRAINT "Log_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Log.name_index" ON "Log"("created_at", "name");
