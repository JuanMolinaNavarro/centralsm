import { prisma } from "@/lib/prisma";

// Consultas para el alta de productos con push a Finnegans Go.

/** Categorías del catálogo, ordenadas por SKU (para el selector del formulario). */
export async function getCategoriasParaSelect() {
  return prisma.categoria.findMany({
    select: { id: true, nombre: true, codigoSku: true },
    orderBy: { codigoSku: "asc" },
  });
}

/**
 * Productos dados de alta desde CentralSM (los que tienen push a Finnegans).
 * Excluye los ~3200 que vinieron del pull (quedan en NO_APLICA).
 */
export async function getProductosConPush(limit = 100) {
  return prisma.producto.findMany({
    where: { finnegansPushEstado: { not: "NO_APLICA" } },
    select: {
      id: true,
      nombre: true,
      codigoSku: true,
      teamplaceCodigo: true,
      finnegansPushEstado: true,
      finnegansPushAt: true,
      finnegansPushError: true,
      createdAt: true,
      categoria: { select: { nombre: true, codigoSku: true } },
    },
    orderBy: { createdAt: "desc" },
    take: limit,
  });
}
