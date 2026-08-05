/*
  Warnings:

  - You are about to drop the `MovimientoStock` table. If the table is not empty, all the data it contains will be lost.

*/
-- DropForeignKey
ALTER TABLE "MovimientoStock" DROP CONSTRAINT "MovimientoStock_depositoDestinoId_fkey";

-- DropForeignKey
ALTER TABLE "MovimientoStock" DROP CONSTRAINT "MovimientoStock_depositoOrigenId_fkey";

-- DropForeignKey
ALTER TABLE "MovimientoStock" DROP CONSTRAINT "MovimientoStock_productoId_fkey";

-- DropForeignKey
ALTER TABLE "MovimientoStock" DROP CONSTRAINT "MovimientoStock_usuarioId_fkey";

-- DropTable
DROP TABLE "MovimientoStock";

-- DropEnum
DROP TYPE "EstadoSync";

-- DropEnum
DROP TYPE "TipoMovimiento";

-- CreateTable
CREATE TABLE "SnapshotStock" (
    "id" TEXT NOT NULL,
    "syncRunId" TEXT NOT NULL,
    "fecha" TIMESTAMP(3) NOT NULL,
    "productoId" TEXT NOT NULL,
    "depositoId" TEXT NOT NULL,
    "cantidad" DECIMAL(18,4) NOT NULL,
    "puntoReposicion" DECIMAL(18,4),

    CONSTRAINT "SnapshotStock_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "SnapshotStock_fecha_idx" ON "SnapshotStock"("fecha");

-- CreateIndex
CREATE INDEX "SnapshotStock_productoId_fecha_idx" ON "SnapshotStock"("productoId", "fecha");

-- CreateIndex
CREATE INDEX "SnapshotStock_depositoId_fecha_idx" ON "SnapshotStock"("depositoId", "fecha");

-- AddForeignKey
ALTER TABLE "SnapshotStock" ADD CONSTRAINT "SnapshotStock_syncRunId_fkey" FOREIGN KEY ("syncRunId") REFERENCES "SyncRun"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SnapshotStock" ADD CONSTRAINT "SnapshotStock_productoId_fkey" FOREIGN KEY ("productoId") REFERENCES "Producto"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SnapshotStock" ADD CONSTRAINT "SnapshotStock_depositoId_fkey" FOREIGN KEY ("depositoId") REFERENCES "Deposito"("id") ON DELETE CASCADE ON UPDATE CASCADE;
