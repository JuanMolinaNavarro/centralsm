-- CreateEnum
CREATE TYPE "Rol" AS ENUM ('ADMIN', 'OPERADOR', 'LECTOR');

-- CreateEnum
CREATE TYPE "EstadoProducto" AS ENUM ('ACTIVO', 'INACTIVO');

-- CreateEnum
CREATE TYPE "TipoMovimiento" AS ENUM ('INGRESO', 'EGRESO', 'AJUSTE', 'TRANSFERENCIA');

-- CreateEnum
CREATE TYPE "EstadoSync" AS ENUM ('PENDIENTE', 'SINCRONIZADO', 'ERROR');

-- CreateTable
CREATE TABLE "User" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "nombre" TEXT NOT NULL,
    "rol" "Rol" NOT NULL DEFAULT 'OPERADOR',
    "activo" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Categoria" (
    "id" TEXT NOT NULL,
    "nombre" TEXT NOT NULL,
    "descripcion" TEXT,
    "segmento" TEXT NOT NULL,
    "codigoSku" TEXT NOT NULL,
    "parentId" TEXT,
    "imagenUrl" TEXT,
    "orden" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Categoria_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Producto" (
    "id" TEXT NOT NULL,
    "categoriaId" TEXT NOT NULL,
    "secuencia" INTEGER NOT NULL,
    "codigoSku" TEXT NOT NULL,
    "nombre" TEXT NOT NULL,
    "descripcion" TEXT,
    "imagenUrl" TEXT,
    "estado" "EstadoProducto" NOT NULL DEFAULT 'ACTIVO',
    "cantidadStock" DECIMAL(18,4) NOT NULL DEFAULT 0,
    "unidadStock" TEXT NOT NULL DEFAULT 'UNI',
    "lugar" TEXT,
    "fechaUltimoIngreso" TIMESTAMP(3),
    "teamplaceSyncAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Producto_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Deposito" (
    "id" TEXT NOT NULL,
    "codigo" TEXT NOT NULL,
    "nombre" TEXT NOT NULL,
    "activo" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Deposito_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "StockDeposito" (
    "id" TEXT NOT NULL,
    "productoId" TEXT NOT NULL,
    "depositoId" TEXT NOT NULL,
    "cantidad" DECIMAL(18,4) NOT NULL DEFAULT 0,
    "stockMinimo" DECIMAL(18,4),
    "stockMaximo" DECIMAL(18,4),
    "puntoReposicion" DECIMAL(18,4),
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "StockDeposito_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MovimientoStock" (
    "id" TEXT NOT NULL,
    "tipo" "TipoMovimiento" NOT NULL,
    "productoId" TEXT NOT NULL,
    "cantidad" DECIMAL(18,4) NOT NULL,
    "depositoOrigenId" TEXT,
    "depositoDestinoId" TEXT,
    "descripcion" TEXT,
    "fecha" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "usuarioId" TEXT,
    "estadoSync" "EstadoSync" NOT NULL DEFAULT 'PENDIENTE',
    "teamplaceRef" TEXT,
    "teamplaceSyncAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "MovimientoStock_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");

-- CreateIndex
CREATE UNIQUE INDEX "Categoria_codigoSku_key" ON "Categoria"("codigoSku");

-- CreateIndex
CREATE INDEX "Categoria_parentId_idx" ON "Categoria"("parentId");

-- CreateIndex
CREATE UNIQUE INDEX "Categoria_parentId_segmento_key" ON "Categoria"("parentId", "segmento");

-- CreateIndex
CREATE UNIQUE INDEX "Producto_codigoSku_key" ON "Producto"("codigoSku");

-- CreateIndex
CREATE INDEX "Producto_categoriaId_idx" ON "Producto"("categoriaId");

-- CreateIndex
CREATE INDEX "Producto_nombre_idx" ON "Producto"("nombre");

-- CreateIndex
CREATE UNIQUE INDEX "Producto_categoriaId_secuencia_key" ON "Producto"("categoriaId", "secuencia");

-- CreateIndex
CREATE UNIQUE INDEX "Deposito_codigo_key" ON "Deposito"("codigo");

-- CreateIndex
CREATE INDEX "StockDeposito_depositoId_idx" ON "StockDeposito"("depositoId");

-- CreateIndex
CREATE UNIQUE INDEX "StockDeposito_productoId_depositoId_key" ON "StockDeposito"("productoId", "depositoId");

-- CreateIndex
CREATE INDEX "MovimientoStock_productoId_idx" ON "MovimientoStock"("productoId");

-- CreateIndex
CREATE INDEX "MovimientoStock_fecha_idx" ON "MovimientoStock"("fecha");

-- CreateIndex
CREATE INDEX "MovimientoStock_estadoSync_idx" ON "MovimientoStock"("estadoSync");

-- AddForeignKey
ALTER TABLE "Categoria" ADD CONSTRAINT "Categoria_parentId_fkey" FOREIGN KEY ("parentId") REFERENCES "Categoria"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Producto" ADD CONSTRAINT "Producto_categoriaId_fkey" FOREIGN KEY ("categoriaId") REFERENCES "Categoria"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StockDeposito" ADD CONSTRAINT "StockDeposito_productoId_fkey" FOREIGN KEY ("productoId") REFERENCES "Producto"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StockDeposito" ADD CONSTRAINT "StockDeposito_depositoId_fkey" FOREIGN KEY ("depositoId") REFERENCES "Deposito"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MovimientoStock" ADD CONSTRAINT "MovimientoStock_productoId_fkey" FOREIGN KEY ("productoId") REFERENCES "Producto"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MovimientoStock" ADD CONSTRAINT "MovimientoStock_depositoOrigenId_fkey" FOREIGN KEY ("depositoOrigenId") REFERENCES "Deposito"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MovimientoStock" ADD CONSTRAINT "MovimientoStock_depositoDestinoId_fkey" FOREIGN KEY ("depositoDestinoId") REFERENCES "Deposito"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MovimientoStock" ADD CONSTRAINT "MovimientoStock_usuarioId_fkey" FOREIGN KEY ("usuarioId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
