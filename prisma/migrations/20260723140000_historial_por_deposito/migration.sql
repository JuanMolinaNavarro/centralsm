-- Histórico de stock ahora es por (producto, depósito). Se limpian las filas
-- previas (nivel producto) porque no tienen depósito y quedan superadas.
DELETE FROM "HistorialStock";

ALTER TABLE "HistorialStock" ADD COLUMN "depositoId" TEXT NOT NULL;

CREATE INDEX "HistorialStock_depositoId_idx" ON "HistorialStock"("depositoId");

ALTER TABLE "HistorialStock" ADD CONSTRAINT "HistorialStock_depositoId_fkey"
  FOREIGN KEY ("depositoId") REFERENCES "Deposito"("id") ON DELETE CASCADE ON UPDATE CASCADE;
