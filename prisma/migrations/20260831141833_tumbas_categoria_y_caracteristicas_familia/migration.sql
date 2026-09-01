-- CreateTable
CREATE TABLE "CategoriaEliminada" (
    "id" TEXT NOT NULL,
    "codigoSku" TEXT NOT NULL,
    "nombre" TEXT NOT NULL,
    "eliminadaAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CategoriaEliminada_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CaracteristicaFamilia" (
    "id" TEXT NOT NULL,
    "categoriaId" TEXT NOT NULL,
    "tipoId" TEXT NOT NULL,
    "orden" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CaracteristicaFamilia_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "CategoriaEliminada_codigoSku_key" ON "CategoriaEliminada"("codigoSku");

-- CreateIndex
CREATE INDEX "CaracteristicaFamilia_tipoId_idx" ON "CaracteristicaFamilia"("tipoId");

-- CreateIndex
CREATE UNIQUE INDEX "CaracteristicaFamilia_categoriaId_tipoId_key" ON "CaracteristicaFamilia"("categoriaId", "tipoId");

-- AddForeignKey
ALTER TABLE "CaracteristicaFamilia" ADD CONSTRAINT "CaracteristicaFamilia_categoriaId_fkey" FOREIGN KEY ("categoriaId") REFERENCES "Categoria"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CaracteristicaFamilia" ADD CONSTRAINT "CaracteristicaFamilia_tipoId_fkey" FOREIGN KEY ("tipoId") REFERENCES "TipoCaracteristica"("id") ON DELETE CASCADE ON UPDATE CASCADE;
