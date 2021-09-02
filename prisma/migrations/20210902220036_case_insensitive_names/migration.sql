/*
  Warnings:

  - A unique constraint covering the columns `[name]` on the table `users` will be added. If there are existing duplicate values, this will fail.

*/
CREATE EXTENSION IF NOT EXISTS citext;

-- AlterTable
ALTER TABLE users ALTER COLUMN name TYPE citext;
