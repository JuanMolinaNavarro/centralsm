-- Producto: campos para el delta diario y el flag "Nuevo"
ALTER TABLE "Producto" ADD COLUMN "cantidadStockAnterior" DECIMAL(18,4) NOT NULL DEFAULT 0;
ALTER TABLE "Producto" ADD COLUMN "esNuevo" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "Producto" ADD COLUMN "primeraVezAt" TIMESTAMP(3);

-- Enum de tipo de corrida
CREATE TYPE "TipoSync" AS ENUM ('CRON', 'MANUAL');

-- Bitácora de corridas de sincronización
CREATE TABLE "SyncRun" (
  "id" TEXT NOT NULL,
  "ejecutadoAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "tipo" "TipoSync" NOT NULL DEFAULT 'CRON',
  "ok" BOOLEAN NOT NULL DEFAULT true,
  "error" TEXT,
  "duracionMs" INTEGER,
  "productosNuevos" INTEGER NOT NULL DEFAULT 0,
  "productosConCambio" INTEGER NOT NULL DEFAULT 0,
  "unidadesAlta" DECIMAL(18,4) NOT NULL DEFAULT 0,
  "unidadesBaja" DECIMAL(18,4) NOT NULL DEFAULT 0,
  "stockRegistros" INTEGER NOT NULL DEFAULT 0,
  "depositos" INTEGER NOT NULL DEFAULT 0,
  CONSTRAINT "SyncRun_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "SyncRun_ejecutadoAt_idx" ON "SyncRun"("ejecutadoAt");
