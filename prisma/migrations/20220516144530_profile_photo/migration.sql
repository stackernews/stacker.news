-- AlterTable
ALTER TABLE "users" ADD COLUMN     "photoId" INTEGER;

-- AddForeignKey
ALTER TABLE "users" ADD FOREIGN KEY ("photoId") REFERENCES "Upload"("id") ON DELETE SET NULL ON UPDATE CASCADE;
