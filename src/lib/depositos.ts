import { prisma } from "@/lib/prisma";

/** Todos los depósitos con conteo de productos y total de unidades (desde cache). */
export async function getDepositos() {
  const depositos = await prisma.deposito.findMany({
    orderBy: { nombre: "asc" },
    include: { _count: { select: { stock: true } } },
  });
  const sums = await prisma.stockDeposito.groupBy({
    by: ["depositoId"],
    _sum: { cantidad: true },
  });
  const sumMap = new Map(
    sums.map((s) => [s.depositoId, Number(s._sum.cantidad?.toString() ?? 0)]),
  );
  return depositos.map((d) => ({
    id: d.id,
    codigo: d.codigo,
    nombre: d.nombre,
    productos: d._count.stock,
    totalUnidades: sumMap.get(d.id) ?? 0,
  }));
}

/** Un depósito con su inventario cacheado (productos + cantidades). */
export async function getDeposito(id: string) {
  const deposito = await prisma.deposito.findUnique({
    where: { id },
    include: {
      stock: {
        where: { cantidad: { not: 0 } },
        orderBy: { cantidad: "desc" },
        include: {
          producto: {
            select: { id: true, codigoSku: true, nombre: true, unidadStock: true },
          },
        },
      },
    },
  });
  if (!deposito) return null;
  const items = deposito.stock.map((s) => ({
    productoId: s.producto.id,
    codigoSku: s.producto.codigoSku,
    nombre: s.producto.nombre,
    unidadStock: s.producto.unidadStock,
    cantidad: Number(s.cantidad.toString()),
  }));
  return {
    id: deposito.id,
    codigo: deposito.codigo,
    nombre: deposito.nombre,
    snapshotAt: deposito.stock[0]?.snapshotAt ?? null,
    totalUnidades: items.reduce((a, i) => a + i.cantidad, 0),
    items,
  };
}
