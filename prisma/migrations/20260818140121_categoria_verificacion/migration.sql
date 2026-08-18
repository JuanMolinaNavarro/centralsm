-- AlterTable
ALTER TABLE "Categoria" ADD COLUMN     "verificadaAt" TIMESTAMP(3),
ADD COLUMN     "verificadaPor" TEXT;

-- AlterTable
ALTER TABLE "Producto" ADD COLUMN     "clasificadoAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;

-- Backfill: los artículos existentes se consideran clasificados cuando se crearon
-- (así ninguna categoría aparece "con cambios" por la propia migración).
UPDATE "Producto" SET "clasificadoAt" = "createdAt";

-- CreateIndex
CREATE INDEX "Producto_categoriaId_clasificadoAt_idx" ON "Producto"("categoriaId", "clasificadoAt");
