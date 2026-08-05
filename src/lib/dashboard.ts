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

/** Totales para las tarjetas. */
export async function getResumen() {
  const [totalProductos, conStock, nuevos] = await Promise.all([
    prisma.producto.count(),
    prisma.producto.count({ where: { cantidadStock: { gt: 0 } } }),
    prisma.producto.count({ where: { esNuevo: true } }),
  ]);
  return { totalProductos, conStock, nuevos };
}
