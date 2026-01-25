/*
  Warnings:

  - Added the required column `pathLocal` to the `Garment` table without a default value. This is not possible if the table is not empty.

*/
-- AlterTable
ALTER TABLE "Garment" ADD COLUMN     "pathLocal" TEXT NOT NULL;
