import { prisma } from "@/lib/prisma";

/** Movimientos desde una fecha (opcionalmente de un depósito), más recientes primero. */
export async function getMovimientos(desde: Date, limit = 500, depositoId?: string) {
  return prisma.historialStock.findMany({
    where: { fecha: { gte: desde }, ...(depositoId ? { depositoId } : {}) },
    orderBy: { fecha: "desc" },
    take: limit,
    include: {
      producto: {
        select: {
          id: true,
          codigoSku: true,
          nombre: true,
          unidadStock: true,
          categoria: { select: { nombre: true } },
        },
      },
      deposito: { select: { id: true, codigo: true, nombre: true } },
    },
  });
}

export type Agg = {
  id: string;
  etiqueta: string;
  detalle: string;
  entradas: number;
  salidas: number;
  neto: number;
  movimientos: number;
};

/** Entradas y salidas agregadas por tipo de producto (categoría/familia). */
export async function getEntradasSalidasPorTipo(desde: Date): Promise<Agg[]> {
  const rows = await prisma.$queryRaw<
    { id: string; etiqueta: string; detalle: string; entradas: string; salidas: string; neto: string; movimientos: bigint }[]
  >`
    SELECT c.id, c.nombre AS etiqueta, c."codigoSku" AS detalle,
      COALESCE(SUM(h.delta) FILTER (WHERE h.delta > 0), 0)::text AS entradas,
      COALESCE(SUM(-h.delta) FILTER (WHERE h.delta < 0), 0)::text AS salidas,
      COALESCE(SUM(h.delta), 0)::text AS neto,
      COUNT(*) AS movimientos
    FROM "HistorialStock" h
    JOIN "Producto" p ON p.id = h."productoId"
    JOIN "Categoria" c ON c.id = p."categoriaId"
    WHERE h.fecha >= ${desde}
    GROUP BY c.id
    ORDER BY (COALESCE(SUM(h.delta) FILTER (WHERE h.delta > 0), 0)
            + COALESCE(SUM(-h.delta) FILTER (WHERE h.delta < 0), 0)) DESC`;
  return mapAgg(rows);
}

/** Entradas y salidas agregadas por depósito. */
export async function getEntradasSalidasPorDeposito(desde: Date, limit = 40): Promise<Agg[]> {
  const rows = await prisma.$queryRaw<
    { id: string; etiqueta: string; detalle: string; entradas: string; salidas: string; neto: string; movimientos: bigint }[]
  >`
    SELECT d.id, d.nombre AS etiqueta, d.codigo AS detalle,
      COALESCE(SUM(h.delta) FILTER (WHERE h.delta > 0), 0)::text AS entradas,
      COALESCE(SUM(-h.delta) FILTER (WHERE h.delta < 0), 0)::text AS salidas,
      COALESCE(SUM(h.delta), 0)::text AS neto,
      COUNT(*) AS movimientos
    FROM "HistorialStock" h
    JOIN "Deposito" d ON d.id = h."depositoId"
    WHERE h.fecha >= ${desde}
    GROUP BY d.id
    ORDER BY (COALESCE(SUM(h.delta) FILTER (WHERE h.delta > 0), 0)
            + COALESCE(SUM(-h.delta) FILTER (WHERE h.delta < 0), 0)) DESC
    LIMIT ${limit}`;
  return mapAgg(rows);
}

function mapAgg(
  rows: { id: string; etiqueta: string; detalle: string; entradas: string; salidas: string; neto: string; movimientos: bigint }[],
): Agg[] {
  return rows.map((r) => ({
    id: r.id,
    etiqueta: r.etiqueta,
    detalle: r.detalle,
    entradas: Number(r.entradas),
    salidas: Number(r.salidas),
    neto: Number(r.neto),
    movimientos: Number(r.movimientos),
  }));
}

/** Totales de movimientos del período (opcionalmente de un depósito). */
export async function getResumenMovimientos(desde: Date, depositoId?: string) {
  const where = { fecha: { gte: desde }, ...(depositoId ? { depositoId } : {}) };
  const [total, entradas, salidas] = await Promise.all([
    prisma.historialStock.count({ where }),
    prisma.historialStock.aggregate({ where: { ...where, delta: { gt: 0 } }, _sum: { delta: true } }),
    prisma.historialStock.aggregate({ where: { ...where, delta: { lt: 0 } }, _sum: { delta: true } }),
  ]);
  return {
    total,
    entradas: Number(entradas._sum.delta?.toString() ?? 0),
    salidas: Math.abs(Number(salidas._sum.delta?.toString() ?? 0)),
  };
}
