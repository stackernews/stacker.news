-- AlterTable
ALTER TABLE "users" ADD COLUMN "referrerId" INTEGER;

-- AddForeignKey
ALTER TABLE "users" ADD FOREIGN KEY ("referrerId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
