/*
  Warnings:

  - Added the required column `cname` to the `CustomDomain` table without a default value. This is not possible if the table is not empty.
  - Added the required column `verificationTxt` to the `CustomDomain` table without a default value. This is not possible if the table is not empty.

*/
-- AlterTable
ALTER TABLE "CustomDomain" ADD COLUMN     "cname" TEXT NOT NULL,
ADD COLUMN     "verificationTxt" TEXT NOT NULL;
