-- DropForeignKey
ALTER TABLE "Garment" DROP CONSTRAINT "Garment_closetId_fkey";

-- AddForeignKey
ALTER TABLE "Garment" ADD CONSTRAINT "Garment_closetId_fkey" FOREIGN KEY ("closetId") REFERENCES "Closet"("id") ON DELETE CASCADE ON UPDATE CASCADE;
