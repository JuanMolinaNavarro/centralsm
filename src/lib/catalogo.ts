import { prisma } from "@/lib/prisma";
import {
  SKU_PENDIENTES,
  type ArticuloClasificable,
  type CategoriaPlana,
} from "@/lib/catalogo-tipos";
import { derivarVerificacion, SIN_VERIFICAR, type Verificacion } from "@/lib/verificacion-tipos";

export { SKU_PENDIENTES, type ArticuloClasificable, type CategoriaPlana };

// ------------------------------------------------------------- Verificación

/**
 * Estado de verificación de TODAS las categorías en una sola consulta:
 * cuenta artículos asignados (clasificadoAt) y subcategorías creadas después
 * de `verificadaAt`. Son ~70 categorías: el mapa completo es barato.
 */
export async function getVerificacionPorCategoria(): Promise<Map<string, Verificacion>> {
  const rows = await prisma.$queryRaw<
    { id: string; verificadaAt: Date | null; verificadaPor: string | null; cambios: bigint | number }[]
  >`
    SELECT c.id, c."verificadaAt", c."verificadaPor",
      (SELECT count(*) FROM "Producto" p
        WHERE p."categoriaId" = c.id AND c."verificadaAt" IS NOT NULL AND p."clasificadoAt" > c."verificadaAt")
      + (SELECT count(*) FROM "Categoria" h
        WHERE h."parentId" = c.id AND c."verificadaAt" IS NOT NULL AND h."createdAt" > c."verificadaAt")
      AS cambios
    FROM "Categoria" c
  `;
  const out = new Map<string, Verificacion>();
  for (const r of rows) {
    out.set(r.id, derivarVerificacion(r.verificadaAt, r.verificadaPor, Number(r.cambios)));
  }
  return out;
}

/** Categorías raíz (Macro), con conteo de hijos y artículos y estado de verificación. */
export async function getMacroCategorias() {
  const [cats, verif] = await Promise.all([
    prisma.categoria.findMany({
      where: { parentId: null },
      orderBy: [{ orden: "asc" }, { createdAt: "asc" }],
      include: { _count: { select: { children: true, productos: true } } },
    }),
    getVerificacionPorCategoria(),
  ]);
  return {
    categorias: cats.map((c) => ({ ...c, verificacion: verif.get(c.id) ?? SIN_VERIFICAR })),
    /** Cuántas categorías (de todo el árbol) están verificadas y sin cambios. */
    verificadas: Array.from(verif.values()).filter((v) => v.estado === "verificada").length,
    totalCategorias: verif.size,
  };
}

/** Una categoría con su padre, subcategorías, artículos y estado de verificación. */
export async function getCategoria(id: string) {
  const [categoria, verif] = await Promise.all([
    prisma.categoria.findUnique({
      where: { id },
      include: {
        parent: true,
        children: {
          orderBy: [{ orden: "asc" }, { createdAt: "asc" }],
          include: { _count: { select: { children: true, productos: true } } },
        },
        productos: { orderBy: { secuencia: "asc" } },
      },
    }),
    getVerificacionPorCategoria(),
  ]);
  if (!categoria) return null;

  // Los artículos sin stock (≤ 0) van al final, manteniendo el orden por secuencia.
  categoria.productos.sort((a, b) => {
    const sinStockA = Number(a.cantidadStock) <= 0 ? 1 : 0;
    const sinStockB = Number(b.cantidadStock) <= 0 ? 1 : 0;
    return sinStockA - sinStockB || a.secuencia - b.secuencia;
  });

  return {
    ...categoria,
    verificacion: verif.get(categoria.id) ?? SIN_VERIFICAR,
    children: categoria.children.map((h) => ({ ...h, verificacion: verif.get(h.id) ?? SIN_VERIFICAR })),
  };
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

// ------------------------------------------------------------ Árbol aplanado

/**
 * Todas las categorías como lista plana con su ruta de ancestros resuelta,
 * ordenadas por SKU (que da un recorrido en profundidad del árbol).
 * Es lo que consume el selector de categoría del clasificador.
 */
export async function getCategoriasPlanas(): Promise<CategoriaPlana[]> {
  const [cats, verif] = await Promise.all([
    prisma.categoria.findMany({
      select: {
        id: true,
        parentId: true,
        nombre: true,
        segmento: true,
        codigoSku: true,
        _count: { select: { children: true, productos: true } },
      },
      orderBy: { codigoSku: "asc" },
    }),
    getVerificacionPorCategoria(),
  ]);
  const porId = new Map(cats.map((c) => [c.id, c]));
  const rutaCache = new Map<string, string[]>();
  const rutaDe = (id: string | null): string[] => {
    if (!id) return [];
    const hit = rutaCache.get(id);
    if (hit) return hit;
    const c = porId.get(id);
    const r = c ? [...rutaDe(c.parentId), c.nombre] : [];
    rutaCache.set(id, r);
    return r;
  };
  return cats.map((c) => {
    const ruta = rutaDe(c.parentId);
    return {
      id: c.id,
      parentId: c.parentId,
      nombre: c.nombre,
      segmento: c.segmento,
      codigoSku: c.codigoSku,
      ruta,
      nivel: ruta.length,
      tieneHijos: c._count.children > 0,
      productosCount: c._count.productos,
      verificacion: verif.get(c.id) ?? SIN_VERIFICAR,
    };
  });
}

/** Ids de una categoría y de todos sus descendientes (usa la lista plana). */
export function idsDelSubarbol(categorias: CategoriaPlana[], raizId: string): string[] {
  const hijos = new Map<string, string[]>();
  for (const c of categorias) {
    if (!c.parentId) continue;
    const arr = hijos.get(c.parentId) ?? [];
    arr.push(c.id);
    hijos.set(c.parentId, arr);
  }
  const out: string[] = [];
  const stack = [raizId];
  while (stack.length) {
    const id = stack.pop()!;
    out.push(id);
    stack.push(...(hijos.get(id) ?? []));
  }
  return out;
}

// ------------------------------------------------------- Clasificador manual

export type FiltroClasificador = {
  /** Texto libre: cada palabra debe aparecer en nombre, SKU o código Teamplace. */
  q?: string;
  /** "pendientes" (subárbol #REV), "todas" o el id de una categoría (incluye subárbol). */
  cat?: string;
  /** Solo artículos con stock > 0. */
  soloStock?: boolean;
  orden?: "nombre" | "stock" | "reciente";
  pagina?: number;
  tamano?: number;
};

export const TAMANO_PAGINA_CLASIFICADOR = 50;

/**
 * Búsqueda paginada de artículos para la mesa de clasificación.
 * Recibe la lista plana de categorías para resolver subárboles sin ir a la DB.
 */
export async function buscarArticulosParaClasificar(
  filtro: FiltroClasificador,
  categorias: CategoriaPlana[],
) {
  const tamano = Math.min(Math.max(filtro.tamano ?? TAMANO_PAGINA_CLASIFICADOR, 10), 200);
  const paginaPedida = Math.max(filtro.pagina ?? 1, 1);
  const cat = filtro.cat ?? "pendientes";

  const where: NonNullable<Parameters<typeof prisma.producto.findMany>[0]>["where"] = {};

  if (cat === "pendientes") {
    const rev = categorias.find((c) => c.codigoSku === SKU_PENDIENTES);
    where.categoriaId = rev ? { in: idsDelSubarbol(categorias, rev.id) } : { in: [] };
  } else if (cat !== "todas") {
    where.categoriaId = { in: idsDelSubarbol(categorias, cat) };
  }

  if (filtro.soloStock) where.cantidadStock = { gt: 0 };

  const tokens = (filtro.q ?? "").trim().split(/\s+/).filter(Boolean);
  if (tokens.length) {
    where.AND = tokens.map((t) => ({
      OR: [
        { nombre: { contains: t, mode: "insensitive" } },
        { codigoSku: { contains: t, mode: "insensitive" } },
        { teamplaceCodigo: { contains: t, mode: "insensitive" } },
      ],
    }));
  }

  const orderBy =
    filtro.orden === "stock"
      ? [{ cantidadStock: "desc" as const }, { nombre: "asc" as const }]
      : filtro.orden === "reciente"
        ? [{ clasificadoAt: "desc" as const }, { nombre: "asc" as const }]
        : [{ nombre: "asc" as const }, { codigoSku: "asc" as const }];

  const total = await prisma.producto.count({ where });
  const paginas = Math.max(1, Math.ceil(total / tamano));
  const pagina = Math.min(paginaPedida, paginas);

  const rows = await prisma.producto.findMany({
    where,
    orderBy,
    skip: (pagina - 1) * tamano,
    take: tamano,
    select: {
      id: true,
      nombre: true,
      descripcion: true,
      codigoSku: true,
      teamplaceCodigo: true,
      cantidadStock: true,
      unidadStock: true,
      estado: true,
      imagenUrl: true,
      categoriaId: true,
      categoria: { select: { nombre: true, codigoSku: true } },
    },
  });

  const items: ArticuloClasificable[] = rows.map((r) => ({
    id: r.id,
    nombre: r.nombre,
    descripcion: r.descripcion,
    codigoSku: r.codigoSku,
    teamplaceCodigo: r.teamplaceCodigo,
    cantidadStock: Number(r.cantidadStock.toString()),
    unidadStock: r.unidadStock,
    estado: r.estado,
    imagenUrl: r.imagenUrl,
    categoriaId: r.categoriaId,
    categoriaNombre: r.categoria.nombre,
    categoriaSku: r.categoria.codigoSku,
  }));

  return { items, total, pagina, paginas, tamano };
}

/** Cantidad de artículos pendientes de clasificar (subárbol #REV). */
export async function contarPendientes(categorias?: CategoriaPlana[]): Promise<number> {
  const cats = categorias ?? (await getCategoriasPlanas());
  const rev = cats.find((c) => c.codigoSku === SKU_PENDIENTES);
  if (!rev) return 0;
  return prisma.producto.count({ where: { categoriaId: { in: idsDelSubarbol(cats, rev.id) } } });
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
