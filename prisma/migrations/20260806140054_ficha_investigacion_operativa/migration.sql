-- CreateEnum
CREATE TYPE "OrigenArticulo" AS ENUM ('NACIONAL', 'IMPORTADO');

-- CreateEnum
CREATE TYPE "EstadoItem" AS ENUM ('NUEVO', 'RECORTE', 'RECUPERADO');

-- CreateEnum
CREATE TYPE "TipoCosto" AS ENUM ('REPOSICION', 'ULTIMA_COMPRA', 'PROMEDIO_PONDERADO', 'ESTANDAR');

-- CreateEnum
CREATE TYPE "TipoMovimiento" AS ENUM ('CONSUMO', 'TRANSFERENCIA', 'DEVOLUCION', 'AJUSTE', 'SALIDA_PROYECTO', 'REINGRESO_PROYECTO');

-- CreateEnum
CREATE TYPE "TipoDemanda" AS ENUM ('RECURRENTE', 'OBRA', 'URGENTE', 'NA');

-- AlterTable
ALTER TABLE "Producto" ADD COLUMN     "criticidad" INTEGER,
ADD COLUMN     "enTransito" DECIMAL(18,4) NOT NULL DEFAULT 0,
ADD COLUMN     "entidades" TEXT,
ADD COLUMN     "estadoItem" "EstadoItem" NOT NULL DEFAULT 'NUEVO',
ADD COLUMN     "instalacionesMes" INTEGER,
ADD COLUMN     "kitCantidad" DECIMAL(18,4),
ADD COLUMN     "kitNombre" TEXT,
ADD COLUMN     "origen" "OrigenArticulo",
ADD COLUMN     "predecesorId" TEXT,
ADD COLUMN     "proveedorSeleccionadoId" TEXT,
ADD COLUMN     "requiereAutoelevador" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "sustitutos" TEXT,
ADD COLUMN     "tipoCosto" "TipoCosto" NOT NULL DEFAULT 'REPOSICION',
ADD COLUMN     "vidaUtilMeses" INTEGER;

-- CreateTable
CREATE TABLE "ProveedorArticulo" (
    "id" TEXT NOT NULL,
    "productoId" TEXT NOT NULL,
    "nombre" TEXT NOT NULL,
    "unidadCompra" TEXT NOT NULL DEFAULT 'unidad',
    "factorCompra" DECIMAL(18,4) NOT NULL DEFAULT 1,
    "unidadConsumo" TEXT NOT NULL DEFAULT 'unidad',
    "factorConsumo" DECIMAL(18,4) NOT NULL DEFAULT 1,
    "loteMinimo" DECIMAL(18,4) NOT NULL DEFAULT 0,
    "multiplo" DECIMAL(18,4) NOT NULL DEFAULT 1,
    "orden" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ProveedorArticulo_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PrecioProveedor" (
    "id" TEXT NOT NULL,
    "proveedorId" TEXT NOT NULL,
    "fecha" TIMESTAMP(3) NOT NULL,
    "precioUsd" DECIMAL(18,4) NOT NULL,

    CONSTRAINT "PrecioProveedor_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MovimientoArticulo" (
    "id" TEXT NOT NULL,
    "productoId" TEXT NOT NULL,
    "fecha" TIMESTAMP(3) NOT NULL,
    "tipo" "TipoMovimiento" NOT NULL,
    "demanda" "TipoDemanda" NOT NULL DEFAULT 'NA',
    "solicitado" DECIMAL(18,4) NOT NULL DEFAULT 0,
    "entregado" DECIMAL(18,4) NOT NULL DEFAULT 0,
    "destino" TEXT,
    "pedido" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "MovimientoArticulo_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "LeadTimeRegistro" (
    "id" TEXT NOT NULL,
    "productoId" TEXT NOT NULL,
    "dias" INTEGER NOT NULL,
    "fecha" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "LeadTimeRegistro_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ProveedorArticulo_productoId_idx" ON "ProveedorArticulo"("productoId");

-- CreateIndex
CREATE INDEX "PrecioProveedor_proveedorId_fecha_idx" ON "PrecioProveedor"("proveedorId", "fecha");

-- CreateIndex
CREATE INDEX "MovimientoArticulo_productoId_fecha_idx" ON "MovimientoArticulo"("productoId", "fecha");

-- CreateIndex
CREATE INDEX "MovimientoArticulo_tipo_idx" ON "MovimientoArticulo"("tipo");

-- CreateIndex
CREATE INDEX "LeadTimeRegistro_productoId_idx" ON "LeadTimeRegistro"("productoId");

-- AddForeignKey
ALTER TABLE "Producto" ADD CONSTRAINT "Producto_predecesorId_fkey" FOREIGN KEY ("predecesorId") REFERENCES "Producto"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Producto" ADD CONSTRAINT "Producto_proveedorSeleccionadoId_fkey" FOREIGN KEY ("proveedorSeleccionadoId") REFERENCES "ProveedorArticulo"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProveedorArticulo" ADD CONSTRAINT "ProveedorArticulo_productoId_fkey" FOREIGN KEY ("productoId") REFERENCES "Producto"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PrecioProveedor" ADD CONSTRAINT "PrecioProveedor_proveedorId_fkey" FOREIGN KEY ("proveedorId") REFERENCES "ProveedorArticulo"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MovimientoArticulo" ADD CONSTRAINT "MovimientoArticulo_productoId_fkey" FOREIGN KEY ("productoId") REFERENCES "Producto"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LeadTimeRegistro" ADD CONSTRAINT "LeadTimeRegistro_productoId_fkey" FOREIGN KEY ("productoId") REFERENCES "Producto"("id") ON DELETE CASCADE ON UPDATE CASCADE;
