-- AlterTable
ALTER TABLE "ProyectoVenta" ADD COLUMN     "videos" TEXT[] DEFAULT ARRAY[]::TEXT[];

-- AlterTable
ALTER TABLE "PiezaPlan" ADD COLUMN     "videoUrl" TEXT;
