import { Prisma } from "@/generated/prisma/client";
import { prisma } from "@/lib/prisma";
import {
  SKU_PENDIENTES,
  type ArticuloClasificable,
  type ArticuloResultado,
  type CategoriaPlana,
} from "@/lib/catalogo-tipos";
import { tokensBusqueda } from "@/lib/busqueda";
import type {
  CaracteristicaCardVista,
  CaracteristicaFichaVista,
  TipoCaracteristicaPlano,
} from "@/lib/caracteristicas-tipos";
import { derivarVerificacion, SIN_VERIFICAR, type Verificacion } from "@/lib/verificacion-tipos";

export { SKU_PENDIENTES, type ArticuloClasificable, type ArticuloResultado, type CategoriaPlana };

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
        productos: {
          orderBy: { secuencia: "asc" },
          include: {
            caracteristicas: {
              orderBy: [{ tipo: { orden: "asc" } }, { tipo: { nombre: "asc" } }],
              select: { valor: true, tipo: { select: { nombre: true, unidad: true } } },
            },
          },
        },
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

// -------------------------------------------------------------- Búsqueda

/**
 * Columnas que necesitan tanto la mesa de clasificación como el buscador.
 * `lugar` y `esNuevo` solo los usa el buscador (los pide la card del catálogo).
 */
const SELECT_ARTICULO = {
  id: true,
  nombre: true,
  descripcion: true,
  codigoSku: true,
  teamplaceCodigo: true,
  cantidadStock: true,
  unidadStock: true,
  estado: true,
  imagenUrl: true,
  lugar: true,
  esNuevo: true,
  categoriaId: true,
  categoria: { select: { nombre: true, codigoSku: true } },
} as const;

type FilaArticulo = {
  id: string;
  nombre: string;
  descripcion: string | null;
  codigoSku: string;
  teamplaceCodigo: string | null;
  cantidadStock: { toString(): string };
  unidadStock: string;
  estado: "ACTIVO" | "INACTIVO";
  imagenUrl: string | null;
  lugar: string | null;
  esNuevo: boolean;
  categoriaId: string;
  categoria: { nombre: string; codigoSku: string };
};

function aArticuloResultado(r: FilaArticulo): ArticuloResultado {
  return {
    id: r.id,
    nombre: r.nombre,
    descripcion: r.descripcion,
    codigoSku: r.codigoSku,
    teamplaceCodigo: r.teamplaceCodigo,
    cantidadStock: Number(r.cantidadStock.toString()),
    unidadStock: r.unidadStock,
    estado: r.estado,
    imagenUrl: r.imagenUrl,
    lugar: r.lugar,
    esNuevo: r.esNuevo,
    categoriaId: r.categoriaId,
    categoriaNombre: r.categoria.nombre,
    categoriaSku: r.categoria.codigoSku,
  };
}

/** Tope de ids que devuelve la búsqueda por texto (evita un IN gigante). */
export const LIMITE_BUSQUEDA = 2000;

/** Artículos donde TODOS los tokens aparecen en algún campo buscable. */
async function idsQueContienen(tokens: string[], limite: number): Promise<string[]> {
  const condiciones = tokens.map((t) => {
    const patron = `%${t}%`;
    return Prisma.sql`(
      centralsm_norm(p."nombre") LIKE ${patron}
      OR centralsm_norm(p."codigoSku") LIKE ${patron}
      OR centralsm_norm(coalesce(p."teamplaceCodigo", '')) LIKE ${patron}
      OR EXISTS (
        SELECT 1 FROM "CaracteristicaProducto" cp
        JOIN "TipoCaracteristica" tc ON tc.id = cp."tipoId"
        WHERE cp."productoId" = p.id
          AND (
            centralsm_norm(cp."valor") LIKE ${patron}
            OR centralsm_norm(cp."valor" || coalesce(tc."unidad", '')) LIKE ${patron}
            OR centralsm_norm(tc."nombre") LIKE ${patron}
          )
      )
    )`;
  });

  const filas = await prisma.$queryRaw<{ id: string }[]>`
    SELECT p.id FROM "Producto" p
    WHERE ${Prisma.join(condiciones, " AND ")}
    ORDER BY p."nombre" ASC
    LIMIT ${limite}
  `;
  return filas.map((f) => f.id);
}

/**
 * Ids de los artículos que matchean el texto libre, buscando en el nombre, el
 * SKU, el código Teamplace y las características (valor, valor+unidad y nombre
 * del tipo).
 *
 * Compara todo normalizado (`centralsm_norm` en SQL, `normalizarBusqueda` en TS),
 * así "3 W" encuentra "3W", "3 w" y "3-W", y también el caso de un valor "3" con
 * unidad "W".
 *
 * Dos pasadas: primero la consulta entera pegada como una sola frase ("3 W" ->
 * "3w"), que es lo que la gente quiere decir al escribir una medida; si eso no
 * da nada, se cae al AND palabra por palabra ("antena 3w"). La frase siempre es
 * un subconjunto del AND, así que la primera pasada solo afina, nunca pierde
 * resultados relevantes.
 *
 * Devuelve `null` cuando no hay nada que buscar (no confundir con `[]`, que es
 * "se buscó y no hubo resultados").
 */
export async function buscarIdsPorTexto(
  q: string | undefined,
  limite = LIMITE_BUSQUEDA,
): Promise<string[] | null> {
  const tokens = tokensBusqueda(q ?? "");
  if (!tokens.length) return null;

  if (tokens.length > 1) {
    const comoFrase = await idsQueContienen([tokens.join("")], limite);
    if (comoFrase.length) return comoFrase;
  }

  return idsQueContienen(tokens, limite);
}

export const TAMANO_PAGINA_BUSQUEDA = 24;

/**
 * Búsqueda paginada de artículos por texto libre, para el buscador del catálogo.
 * `truncado` avisa que se alcanzó el tope de `LIMITE_BUSQUEDA` coincidencias.
 */
export async function buscarArticulosPorTexto(
  q: string,
  opciones: { pagina?: number; tamano?: number } = {},
) {
  const tamano = Math.min(Math.max(opciones.tamano ?? TAMANO_PAGINA_BUSQUEDA, 6), 120);
  const paginaPedida = Math.max(opciones.pagina ?? 1, 1);

  const ids = await buscarIdsPorTexto(q);
  if (!ids || ids.length === 0) {
    return {
      items: [] as ArticuloResultado[],
      total: 0,
      pagina: 1,
      paginas: 1,
      tamano,
      truncado: false,
    };
  }

  const total = ids.length;
  const paginas = Math.max(1, Math.ceil(total / tamano));
  const pagina = Math.min(paginaPedida, paginas);

  const rows = await prisma.producto.findMany({
    where: { id: { in: ids } },
    orderBy: [{ nombre: "asc" }, { codigoSku: "asc" }],
    skip: (pagina - 1) * tamano,
    take: tamano,
    select: SELECT_ARTICULO,
  });

  // Solo para la página de resultados (≤ tamano filas): las cards muestran
  // las características, que además son parte de lo que matchea la búsqueda.
  const caracts = await getCaracteristicasCardPorProducto(rows.map((r) => r.id));

  return {
    items: rows.map((r) => ({
      ...aArticuloResultado(r),
      caracteristicas: caracts.get(r.id) ?? [],
    })),
    total,
    pagina,
    paginas,
    tamano,
    truncado: total >= LIMITE_BUSQUEDA,
  };
}

// ------------------------------------------------------- Clasificador manual

export type FiltroClasificador = {
  /** Texto libre: cada palabra debe aparecer en nombre, SKU, código Teamplace o características. */
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

  // La búsqueda por texto (normalizada, incluye características) se resuelve
  // aparte y entra acá como un filtro por id, sin tocar el resto de los filtros.
  const idsPorTexto = await buscarIdsPorTexto(filtro.q);
  if (idsPorTexto) where.id = { in: idsPorTexto };

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
    select: SELECT_ARTICULO,
  });

  const items: ArticuloClasificable[] = rows.map(aArticuloResultado);

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

// ----------------------------------------------------------- Características

/**
 * Filas de la sección Características de la ficha: el set de tipos de la
 * familia (la categoría del artículo) con el valor propio si lo hay (LEFT
 * JOIN), más las características huérfanas (valores del artículo cuyo tipo no
 * está en la familia, p. ej. porque se lo movió de categoría) al final.
 */
export async function getCaracteristicasFicha(
  productoId: string,
): Promise<CaracteristicaFichaVista[]> {
  const producto = await prisma.producto.findUnique({
    where: { id: productoId },
    select: { categoriaId: true },
  });
  if (!producto) return [];

  const [familia, valores, conteos] = await Promise.all([
    prisma.caracteristicaFamilia.findMany({
      where: { categoriaId: producto.categoriaId },
      orderBy: [{ orden: "asc" }, { createdAt: "asc" }],
      select: { tipoId: true, tipo: { select: { nombre: true, unidad: true } } },
    }),
    prisma.caracteristicaProducto.findMany({
      where: { productoId },
      orderBy: [{ tipo: { orden: "asc" } }, { tipo: { nombre: "asc" } }],
      select: {
        id: true,
        tipoId: true,
        valor: true,
        tipo: { select: { nombre: true, unidad: true } },
      },
    }),
    // Cuántos artículos de la familia tienen valor por tipo (para el confirm
    // destructivo de «quitar de la familia»).
    prisma.caracteristicaProducto.groupBy({
      by: ["tipoId"],
      where: { producto: { categoriaId: producto.categoriaId } },
      _count: { _all: true },
    }),
  ]);

  const valorPorTipo = new Map(valores.map((v) => [v.tipoId, v]));
  const conteoPorTipo = new Map(conteos.map((c) => [c.tipoId, c._count._all]));

  const filas: CaracteristicaFichaVista[] = familia.map((f) => {
    const v = valorPorTipo.get(f.tipoId);
    return {
      id: v?.id ?? null,
      tipoId: f.tipoId,
      tipoNombre: f.tipo.nombre,
      unidad: f.tipo.unidad,
      valor: v?.valor ?? "",
      enFamilia: true,
      valoresEnFamilia: conteoPorTipo.get(f.tipoId) ?? 0,
    };
  });

  const tiposDeFamilia = new Set(familia.map((f) => f.tipoId));
  for (const v of valores) {
    if (tiposDeFamilia.has(v.tipoId)) continue;
    filas.push({
      id: v.id,
      tipoId: v.tipoId,
      tipoNombre: v.tipo.nombre,
      unidad: v.tipo.unidad,
      valor: v.valor,
      enFamilia: false,
      valoresEnFamilia: 0,
    });
  }
  return filas;
}

/**
 * Características con valor real de un lote de artículos, para las cards del
 * catálogo (las filas vacías de familia no aparecen: no existen como valor).
 */
export async function getCaracteristicasCardPorProducto(
  productoIds: string[],
): Promise<Map<string, CaracteristicaCardVista[]>> {
  const out = new Map<string, CaracteristicaCardVista[]>();
  if (!productoIds.length) return out;
  const filas = await prisma.caracteristicaProducto.findMany({
    where: { productoId: { in: productoIds } },
    orderBy: [{ tipo: { orden: "asc" } }, { tipo: { nombre: "asc" } }],
    select: { productoId: true, valor: true, tipo: { select: { nombre: true, unidad: true } } },
  });
  for (const f of filas) {
    const arr = out.get(f.productoId) ?? [];
    arr.push({ nombre: f.tipo.nombre, valor: f.valor, unidad: f.tipo.unidad });
    out.set(f.productoId, arr);
  }
  return out;
}

/** Todos los tipos de característica, con cuántos artículos usan cada uno. */
export async function getTiposCaracteristica(): Promise<TipoCaracteristicaPlano[]> {
  const filas = await prisma.tipoCaracteristica.findMany({
    orderBy: [{ orden: "asc" }, { nombre: "asc" }],
    select: {
      id: true,
      nombre: true,
      unidad: true,
      descripcion: true,
      orden: true,
      _count: { select: { valores: true } },
    },
  });
  return filas.map((f) => ({
    id: f.id,
    nombre: f.nombre,
    unidad: f.unidad,
    descripcion: f.descripcion,
    orden: f.orden,
    usos: f._count.valores,
  }));
}
