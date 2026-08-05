-- AlterTable
ALTER TABLE "Producto" ADD COLUMN "teamplaceCodigo" TEXT;

-- CreateIndex
CREATE UNIQUE INDEX "Producto_teamplaceCodigo_key" ON "Producto"("teamplaceCodigo");
