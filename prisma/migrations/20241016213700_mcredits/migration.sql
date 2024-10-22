-- AlterTable
ALTER TABLE "users" ADD COLUMN     "mcredits" BIGINT NOT NULL DEFAULT 0;

ALTER TABLE users ADD CONSTRAINT "mcredits_positive" CHECK ("mcredits" >= 0) NOT VALID;
