-- DropForeignKey
ALTER TABLE "Item" DROP CONSTRAINT "Item_subName_fkey";

-- AddForeignKey
ALTER TABLE "Item" ADD CONSTRAINT "Item_subName_fkey" FOREIGN KEY ("subName") REFERENCES "Sub"("name") ON DELETE CASCADE ON UPDATE CASCADE;
