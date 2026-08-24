-- CreateTable
CREATE TABLE "TipoCaracteristica" (
    "id" TEXT NOT NULL,
    "nombre" TEXT NOT NULL,
    "nombreClave" TEXT NOT NULL,
    "unidad" TEXT,
    "descripcion" TEXT,
    "orden" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "TipoCaracteristica_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CaracteristicaProducto" (
    "id" TEXT NOT NULL,
    "productoId" TEXT NOT NULL,
    "tipoId" TEXT NOT NULL,
    "valor" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CaracteristicaProducto_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "TipoCaracteristica_nombreClave_key" ON "TipoCaracteristica"("nombreClave");

-- CreateIndex
CREATE INDEX "TipoCaracteristica_orden_nombre_idx" ON "TipoCaracteristica"("orden", "nombre");

-- CreateIndex
CREATE INDEX "CaracteristicaProducto_productoId_idx" ON "CaracteristicaProducto"("productoId");

-- CreateIndex
CREATE INDEX "CaracteristicaProducto_tipoId_idx" ON "CaracteristicaProducto"("tipoId");

-- CreateIndex
CREATE UNIQUE INDEX "CaracteristicaProducto_productoId_tipoId_key" ON "CaracteristicaProducto"("productoId", "tipoId");

-- AddForeignKey
ALTER TABLE "CaracteristicaProducto" ADD CONSTRAINT "CaracteristicaProducto_productoId_fkey" FOREIGN KEY ("productoId") REFERENCES "Producto"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CaracteristicaProducto" ADD CONSTRAINT "CaracteristicaProducto_tipoId_fkey" FOREIGN KEY ("tipoId") REFERENCES "TipoCaracteristica"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Normalización de texto para el buscador del catálogo. Es el gemelo en SQL de
-- `normalizarBusqueda()` (src/lib/busqueda.ts): si cambia una, cambiar la otra.
-- "3 W" -> "3w" · "Ángulo-45°" -> "angulo45" · "N-hembra" -> "nhembra".
-- IMMUTABLE es obligatorio para poder indexarla. Se usa translate() en vez de la
-- extensión unaccent para no depender de extensiones al desplegar.
CREATE OR REPLACE FUNCTION centralsm_norm(txt text) RETURNS text
LANGUAGE sql IMMUTABLE PARALLEL SAFE STRICT AS $$
  SELECT regexp_replace(
    translate(
      lower(txt),
      'áàäâãåéèëêíìïîóòöôõúùüûñçÿ',
      'aaaaaaeeeeiiiiooooouuuuncy'
    ),
    '[^a-z0-9]+', '', 'g'
  );
$$;

-- Índices trigram para que el LIKE '%token%' del buscador no haga seq scan.
-- Si pg_trgm no está disponible en el servidor, la búsqueda sigue funcionando
-- (solo que sin índice), así que la migración no debe fallar por esto.
DO $$ BEGIN
  CREATE EXTENSION IF NOT EXISTS pg_trgm;
  CREATE INDEX IF NOT EXISTS "Producto_nombre_norm_trgm_idx"
    ON "Producto" USING gin (centralsm_norm("nombre") gin_trgm_ops);
  CREATE INDEX IF NOT EXISTS "Producto_codigoSku_norm_trgm_idx"
    ON "Producto" USING gin (centralsm_norm("codigoSku") gin_trgm_ops);
  CREATE INDEX IF NOT EXISTS "CaracteristicaProducto_valor_norm_trgm_idx"
    ON "CaracteristicaProducto" USING gin (centralsm_norm("valor") gin_trgm_ops);
EXCEPTION WHEN OTHERS THEN
  RAISE NOTICE 'pg_trgm no disponible: el buscador usa seq scan (aceptable al volumen actual).';
END $$;
