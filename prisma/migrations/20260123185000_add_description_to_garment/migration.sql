-- CreateEnum (si no existe)
DO $$ BEGIN
    CREATE TYPE "Category" AS ENUM ('TOP', 'BOTTOM', 'DRESS', 'OUTERWEAR', 'FOOTWEAR', 'ACCESSORY');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

-- AlterTable Garment
ALTER TABLE "Garment" ADD COLUMN IF NOT EXISTS "description" TEXT;
ALTER TABLE "Garment" ADD COLUMN IF NOT EXISTS "category" "Category";

-- AlterTable GarmentOutfit
ALTER TABLE "GarmentOutfit" ADD COLUMN IF NOT EXISTS "order" INTEGER NOT NULL DEFAULT 0;
