-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "TipoMovimiento" ADD VALUE 'RECEPCION_COMPRA';
ALTER TYPE "TipoMovimiento" ADD VALUE 'DEVOLUCION_COMPRA';

-- AlterTable
ALTER TABLE "MovimientoArticulo" ADD COLUMN     "deposito" TEXT,
ADD COLUMN     "documento" TEXT,
ADD COLUMN     "empresa" TEXT,
ADD COLUMN     "fuente" TEXT;

-- CreateIndex
CREATE INDEX "MovimientoArticulo_fuente_idx" ON "MovimientoArticulo"("fuente");
