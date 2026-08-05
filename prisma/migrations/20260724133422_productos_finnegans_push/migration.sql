-- CreateEnum
CREATE TYPE "EstadoPushFinnegans" AS ENUM ('NO_APLICA', 'PENDIENTE', 'EN_PROCESO', 'SINCRONIZADO', 'ERROR');

-- AlterTable
ALTER TABLE "Producto" ADD COLUMN     "esStockeable" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "finnegansActivo" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN     "finnegansFamilia" TEXT,
ADD COLUMN     "finnegansMarca" TEXT,
ADD COLUMN     "finnegansPeso" DECIMAL(18,4) NOT NULL DEFAULT 0,
ADD COLUMN     "finnegansPushAt" TIMESTAMP(3),
ADD COLUMN     "finnegansPushError" TEXT,
ADD COLUMN     "finnegansPushEstado" "EstadoPushFinnegans" NOT NULL DEFAULT 'NO_APLICA',
ADD COLUMN     "finnegansRubro" TEXT,
ADD COLUMN     "finnegansSubFamilia" TEXT,
ADD COLUMN     "finnegansTipo" TEXT NOT NULL DEFAULT 'Otros',
ADD COLUMN     "finnegansVolumen" DECIMAL(18,4) NOT NULL DEFAULT 0,
ADD COLUMN     "manejaRetenciones" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "seCompra" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "seVende" BOOLEAN NOT NULL DEFAULT false;

-- CreateTable
CREATE TABLE "FinnegansPushJob" (
    "id" TEXT NOT NULL,
    "productoId" TEXT NOT NULL,
    "estado" "EstadoPushFinnegans" NOT NULL DEFAULT 'PENDIENTE',
    "intento" INTEGER NOT NULL DEFAULT 1,
    "error" TEXT,
    "log" TEXT,
    "startedAt" TIMESTAMP(3),
    "finishedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "FinnegansPushJob_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "FinnegansPushJob_productoId_idx" ON "FinnegansPushJob"("productoId");

-- CreateIndex
CREATE INDEX "FinnegansPushJob_estado_idx" ON "FinnegansPushJob"("estado");

-- CreateIndex
CREATE INDEX "FinnegansPushJob_createdAt_idx" ON "FinnegansPushJob"("createdAt");

-- CreateIndex
CREATE INDEX "Producto_finnegansPushEstado_idx" ON "Producto"("finnegansPushEstado");

-- AddForeignKey
ALTER TABLE "FinnegansPushJob" ADD CONSTRAINT "FinnegansPushJob_productoId_fkey" FOREIGN KEY ("productoId") REFERENCES "Producto"("id") ON DELETE CASCADE ON UPDATE CASCADE;
