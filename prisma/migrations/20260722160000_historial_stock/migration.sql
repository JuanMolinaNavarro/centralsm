-- Histórico de cambios de stock (movimientos detectados por el cron)
CREATE TABLE "HistorialStock" (
  "id" TEXT NOT NULL,
  "syncRunId" TEXT NOT NULL,
  "fecha" TIMESTAMP(3) NOT NULL,
  "productoId" TEXT NOT NULL,
  "antes" DECIMAL(18,4) NOT NULL,
  "ahora" DECIMAL(18,4) NOT NULL,
  "delta" DECIMAL(18,4) NOT NULL,
  CONSTRAINT "HistorialStock_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "HistorialStock_fecha_idx" ON "HistorialStock"("fecha");
CREATE INDEX "HistorialStock_productoId_idx" ON "HistorialStock"("productoId");

ALTER TABLE "HistorialStock" ADD CONSTRAINT "HistorialStock_syncRunId_fkey"
  FOREIGN KEY ("syncRunId") REFERENCES "SyncRun"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "HistorialStock" ADD CONSTRAINT "HistorialStock_productoId_fkey"
  FOREIGN KEY ("productoId") REFERENCES "Producto"("id") ON DELETE CASCADE ON UPDATE CASCADE;
