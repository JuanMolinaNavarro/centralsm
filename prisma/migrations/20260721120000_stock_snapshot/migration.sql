-- AlterTable: snapshot de stock para reconciliación diaria
ALTER TABLE "StockDeposito" ADD COLUMN "cantidadTeamplace" DECIMAL(18,4) NOT NULL DEFAULT 0;
ALTER TABLE "StockDeposito" ADD COLUMN "snapshotAt" TIMESTAMP(3);
