-- DropForeignKey
ALTER TABLE "GarmentOutfit" DROP CONSTRAINT "GarmentOutfit_garmentId_fkey";

-- DropForeignKey
ALTER TABLE "GarmentOutfit" DROP CONSTRAINT "GarmentOutfit_outfitId_fkey";

-- AddForeignKey
ALTER TABLE "GarmentOutfit" ADD CONSTRAINT "GarmentOutfit_garmentId_fkey" FOREIGN KEY ("garmentId") REFERENCES "Garment"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GarmentOutfit" ADD CONSTRAINT "GarmentOutfit_outfitId_fkey" FOREIGN KEY ("outfitId") REFERENCES "Outfit"("id") ON DELETE CASCADE ON UPDATE CASCADE;
