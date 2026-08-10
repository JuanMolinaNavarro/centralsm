import { prisma } from "@/lib/prisma";

/** Última corrida de sincronización. */
export async function getUltimaSync() {
  return prisma.syncRun.findFirst({ orderBy: { ejecutadoAt: "desc" } });
}

/** Historial de corridas. */
export async function getSyncRuns(limit = 10) {
  return prisma.syncRun.findMany({ orderBy: { ejecutadoAt: "desc" }, take: limit });
}

/** Productos marcados como nuevos por la última corrida. */
export async function getProductosNuevos(limit = 50) {
  return prisma.producto.findMany({
    where: { esNuevo: true },
    orderBy: { primeraVezAt: "desc" },
    take: limit,
    select: {
      id: true,
      codigoSku: true,
      nombre: true,
      cantidadStock: true,
      unidadStock: true,
      primeraVezAt: true,
      categoria: { select: { nombre: true } },
    },
  });
}

export type CambioStock = {
  id: string;
  codigoSku: string;
  nombre: string;
  unidadStock: string;
  antes: number;
  ahora: number;
  delta: number;
};

/** Productos cuyo stock cambió respecto del snapshot anterior. */
export async function getCambiosStock(limit = 50): Promise<CambioStock[]> {
  const rows = await prisma.$queryRaw<
    { id: string; codigoSku: string; nombre: string; unidadStock: string; antes: string; ahora: string }[]
  >`
    SELECT id, "codigoSku", nombre, "unidadStock",
           "cantidadStockAnterior"::text AS antes, "cantidadStock"::text AS ahora
    FROM "Producto"
    WHERE "cantidadStock" <> "cantidadStockAnterior"
      -- Solo productos sincronizados: los manuales nunca actualizan
      -- cantidadStockAnterior y quedarían acá con delta fantasma eterno.
      AND "teamplaceCodigo" IS NOT NULL
    ORDER BY abs("cantidadStock" - "cantidadStockAnterior") DESC
    LIMIT ${limit}`;
  return rows.map((r) => {
    const antes = Number(r.antes);
    const ahora = Number(r.ahora);
    return { id: r.id, codigoSku: r.codigoSku, nombre: r.nombre, unidadStock: r.unidadStock, antes, ahora, delta: ahora - antes };
  });
}

/** Una corrida puntual, para la vista histórica del dashboard. */
export async function getSyncRunById(id: string) {
  return prisma.syncRun.findUnique({ where: { id } });
}

/**
 * Cambios de stock de una corrida específica, agregados por producto (los
 * deltas de HistorialStock se suman entre depósitos).
 */
export async function getCambiosDeRun(syncRunId: string, limit = 50): Promise<CambioStock[]> {
  const rows = await prisma.$queryRaw<
    { id: string; codigoSku: string; nombre: string; unidadStock: string; antes: string; ahora: string }[]
  >`
    SELECT p.id, p."codigoSku", p.nombre, p."unidadStock",
           SUM(h.antes)::text AS antes, SUM(h.ahora)::text AS ahora
    FROM "HistorialStock" h
    JOIN "Producto" p ON p.id = h."productoId"
    WHERE h."syncRunId" = ${syncRunId}
    GROUP BY p.id, p."codigoSku", p.nombre, p."unidadStock"
    ORDER BY abs(SUM(h.ahora) - SUM(h.antes)) DESC
    LIMIT ${limit}`;
  return rows.map((r) => {
    const antes = Number(r.antes);
    const ahora = Number(r.ahora);
    return { id: r.id, codigoSku: r.codigoSku, nombre: r.nombre, unidadStock: r.unidadStock, antes, ahora, delta: ahora - antes };
  });
}

/**
 * Productos que aparecieron por primera vez durante una corrida. El sync setea
 * primeraVezAt justo antes de crear el SyncRun (ejecutadoAt marca el FINAL de
 * la corrida), así que se busca dentro de la ventana de la corrida con margen.
 */
export async function getNuevosDeRun(
  run: { ejecutadoAt: Date; duracionMs: number | null },
  limit = 50,
) {
  const margenMs = 10 * 60_000;
  const desde = new Date(run.ejecutadoAt.getTime() - (run.duracionMs ?? 0) - margenMs);
  const hasta = new Date(run.ejecutadoAt.getTime() + margenMs);
  return prisma.producto.findMany({
    where: { primeraVezAt: { gte: desde, lte: hasta } },
    orderBy: { primeraVezAt: "desc" },
    take: limit,
    select: {
      id: true,
      codigoSku: true,
      nombre: true,
      cantidadStock: true,
      unidadStock: true,
      primeraVezAt: true,
      categoria: { select: { nombre: true } },
    },
  });
}

/** Niveles totales del snapshot de una corrida (tarjetas de la vista histórica). */
export async function getTotalesDeRun(syncRunId: string) {
  const rows = await prisma.$queryRaw<{ productos: bigint; constock: bigint; unidades: string }[]>`
    SELECT COUNT(DISTINCT "productoId") AS productos,
           COUNT(DISTINCT "productoId") FILTER (WHERE cantidad > 0) AS constock,
           COALESCE(SUM(cantidad), 0)::text AS unidades
    FROM "SnapshotStock"
    WHERE "syncRunId" = ${syncRunId}`;
  const r = rows[0];
  return {
    productos: Number(r?.productos ?? 0),
    conStock: Number(r?.constock ?? 0),
    unidades: Number(r?.unidades ?? 0),
  };
}

/** Totales para las tarjetas. */
export async function getResumen() {
  const [totalProductos, conStock, nuevos] = await Promise.all([
    prisma.producto.count(),
    prisma.producto.count({ where: { cantidadStock: { gt: 0 } } }),
    prisma.producto.count({ where: { esNuevo: true } }),
  ]);
  return { totalProductos, conStock, nuevos };
}
