import { prisma } from "@/lib/prisma";

/** Categorías raíz (Macro), con conteo de hijos y artículos. */
export async function getMacroCategorias() {
  return prisma.categoria.findMany({
    where: { parentId: null },
    orderBy: [{ orden: "asc" }, { createdAt: "asc" }],
    include: { _count: { select: { children: true, productos: true } } },
  });
}

/** Una categoría con su padre, subcategorías y artículos. */
export async function getCategoria(id: string) {
  const categoria = await prisma.categoria.findUnique({
    where: { id },
    include: {
      parent: true,
      children: {
        orderBy: [{ orden: "asc" }, { createdAt: "asc" }],
        include: { _count: { select: { children: true, productos: true } } },
      },
      productos: { orderBy: { secuencia: "asc" } },
    },
  });
  if (!categoria) return null;

  // Los artículos sin stock (≤ 0) van al final, manteniendo el orden por secuencia.
  categoria.productos.sort((a, b) => {
    const sinStockA = Number(a.cantidadStock) <= 0 ? 1 : 0;
    const sinStockB = Number(b.cantidadStock) <= 0 ? 1 : 0;
    return sinStockA - sinStockB || a.secuencia - b.secuencia;
  });

  return categoria;
}

/** Un artículo con su categoría. */
export async function getProducto(id: string) {
  return prisma.producto.findUnique({
    where: { id },
    include: { categoria: true },
  });
}

/** Stock cacheado de un producto por depósito (sale de la DB local, gratis). */
export async function getStockProducto(productoId: string) {
  return prisma.stockDeposito.findMany({
    where: { productoId, cantidad: { not: 0 } },
    orderBy: { cantidad: "desc" },
    include: { deposito: { select: { codigo: true, nombre: true } } },
  });
}

export type Crumb = { id: string; nombre: string; codigoSku: string };

/** Cadena de ancestros (de la raíz hasta la categoría dada, incluida). */
export async function getBreadcrumbs(categoriaId: string): Promise<Crumb[]> {
  const crumbs: Crumb[] = [];
  let actual: string | null = categoriaId;
  // El árbol es poco profundo; recorremos la cadena de padres.
  while (actual) {
    const cat: { id: string; nombre: string; codigoSku: string; parentId: string | null } | null =
      await prisma.categoria.findUnique({
        where: { id: actual },
        select: { id: true, nombre: true, codigoSku: true, parentId: true },
      });
    if (!cat) break;
    crumbs.unshift({ id: cat.id, nombre: cat.nombre, codigoSku: cat.codigoSku });
    actual = cat.parentId;
  }
  return crumbs;
}
