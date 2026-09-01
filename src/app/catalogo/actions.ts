"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { buildCategoriaSku, buildProductoSku, normalizarSegmento } from "@/lib/sku";
import { deleteImageByUrl } from "@/lib/uploads";
import { lanzarPushFinnegans } from "@/lib/finnegans-push";
import { getCategoriasPlanas, getTiposCaracteristica, type CategoriaPlana } from "@/lib/catalogo";
import { normalizarBusqueda } from "@/lib/busqueda";
import type { TipoCaracteristicaPlano } from "@/lib/caracteristicas-tipos";

export type ActionResult =
  | { ok: true; id?: string; jobId?: string }
  | { ok: false; error: string };

function mensajeError(error: unknown): string {
  if (error && typeof error === "object" && "code" in error && error.code === "P2002") {
    return "Ya existe un elemento con ese código/segmento. Probá con otro.";
  }
  return error instanceof Error ? error.message : "Ocurrió un error inesperado.";
}

const categoriaSchema = z.object({
  parentId: z.string().nullish(),
  nombre: z.string().trim().min(1, "El nombre es obligatorio."),
  descripcion: z.string().trim().optional().nullable(),
  segmento: z.string().trim().min(1, "El segmento es obligatorio."),
  imagenUrl: z.string().trim().optional().nullable(),
});

const productoSchema = z.object({
  categoriaId: z.string().min(1),
  nombre: z.string().trim().min(1, "El nombre es obligatorio."),
  descripcion: z.string().trim().optional().nullable(),
  estado: z.enum(["ACTIVO", "INACTIVO"]).default("ACTIVO"),
  cantidadStock: z.coerce.number().min(0).default(0),
  unidadStock: z.string().trim().min(1).default("UNI"),
  lugar: z.string().trim().optional().nullable(),
  imagenUrl: z.string().trim().optional().nullable(),
  // Alta espejada en Finnegans Go (opcional). Si `pushFinnegans` está activo,
  // el artículo se crea también allá con un bot de Playwright.
  pushFinnegans: z.boolean().default(false),
  finnegansCodigo: z.string().trim().optional().nullable(),
});

// ----------------------------------------------------------------- Categorías

export async function crearCategoria(input: z.input<typeof categoriaSchema>): Promise<ActionResult> {
  try {
    const data = categoriaSchema.parse(input);
    const segmento = normalizarSegmento(data.segmento);

    const parent = data.parentId
      ? await prisma.categoria.findUnique({ where: { id: data.parentId } })
      : null;
    if (data.parentId && !parent) return { ok: false, error: "La categoría padre no existe." };

    const codigoSku = buildCategoriaSku(parent?.codigoSku ?? null, segmento);

    const ultimo = await prisma.categoria.findFirst({
      where: { parentId: data.parentId ?? null },
      orderBy: { orden: "desc" },
      select: { orden: true },
    });

    const creada = await prisma.categoria.create({
      data: {
        parentId: data.parentId ?? null,
        nombre: data.nombre,
        descripcion: data.descripcion || null,
        segmento,
        codigoSku,
        imagenUrl: data.imagenUrl || null,
        orden: (ultimo?.orden ?? -1) + 1,
      },
    });

    // Recrear a mano una categoría eliminada la revive: se levanta la lápida
    // para que el sync pueda volver a considerarla si algún día falta.
    await prisma.categoriaEliminada.deleteMany({ where: { codigoSku } });

    revalidatePath("/catalogo");
    if (data.parentId) revalidatePath(`/catalogo/${data.parentId}`);
    return { ok: true, id: creada.id };
  } catch (error) {
    return { ok: false, error: mensajeError(error) };
  }
}

export async function actualizarCategoria(
  id: string,
  input: z.input<typeof categoriaSchema>,
): Promise<ActionResult> {
  try {
    const data = categoriaSchema.parse(input);
    const segmento = normalizarSegmento(data.segmento);

    const actual = await prisma.categoria.findUnique({ where: { id }, include: { parent: true } });
    if (!actual) return { ok: false, error: "La categoría no existe." };

    const nuevoSku = buildCategoriaSku(actual.parent?.codigoSku ?? null, segmento);

    await prisma.$transaction(async (tx) => {
      await tx.categoria.update({
        where: { id },
        data: {
          nombre: data.nombre,
          descripcion: data.descripcion || null,
          segmento,
          codigoSku: nuevoSku,
          imagenUrl: data.imagenUrl ?? actual.imagenUrl,
        },
      });
      // Si cambió el segmento, recalcular el SKU de todo el subárbol.
      if (nuevoSku !== actual.codigoSku) {
        await recalcularSubarbol(tx, id, nuevoSku);
      }
    });

    revalidatePath("/catalogo");
    revalidatePath(`/catalogo/${id}`);
    if (actual.parentId) revalidatePath(`/catalogo/${actual.parentId}`);
    return { ok: true, id };
  } catch (error) {
    return { ok: false, error: mensajeError(error) };
  }
}

// Recalcula codigoSku de descendientes (subcategorías y artículos) tras un cambio.
type Tx = Parameters<Parameters<typeof prisma.$transaction>[0]>[0];
async function recalcularSubarbol(tx: Tx, categoriaId: string, categoriaSku: string) {
  const productos = await tx.producto.findMany({
    where: { categoriaId },
    select: { id: true, secuencia: true },
  });
  for (const p of productos) {
    await tx.producto.update({
      where: { id: p.id },
      data: { codigoSku: buildProductoSku(categoriaSku, p.secuencia) },
    });
  }
  const hijos = await tx.categoria.findMany({
    where: { parentId: categoriaId },
    select: { id: true, segmento: true },
  });
  for (const h of hijos) {
    const hijoSku = buildCategoriaSku(categoriaSku, h.segmento);
    await tx.categoria.update({ where: { id: h.id }, data: { codigoSku: hijoSku } });
    await recalcularSubarbol(tx, h.id, hijoSku);
  }
}

export async function eliminarCategoria(id: string): Promise<ActionResult> {
  try {
    const cat = await prisma.categoria.findUnique({ where: { id } });
    if (!cat) return { ok: false, error: "La categoría no existe." };

    // Juntar imágenes del subárbol para borrarlas del disco.
    const imagenes = await imagenesDelSubarbol(id);

    // Lápidas para el subárbol entero (la cascada también borra las hijas):
    // el sync diario no vuelve a sembrar las categorías de la taxonomía que
    // figuren acá. Crear a mano una con el mismo SKU la revive.
    const tumbas = await categoriasDelSubarbol(id);
    await prisma.categoriaEliminada.createMany({
      data: tumbas,
      skipDuplicates: true,
    });

    await prisma.categoria.delete({ where: { id } }); // cascada en DB

    for (const url of imagenes) await deleteImageByUrl(url);

    revalidatePath("/catalogo");
    if (cat.parentId) revalidatePath(`/catalogo/${cat.parentId}`);
    return { ok: true };
  } catch (error) {
    return { ok: false, error: mensajeError(error) };
  }
}

// codigoSku + nombre de una categoría y todas sus descendientes (para las lápidas).
async function categoriasDelSubarbol(
  categoriaId: string,
): Promise<{ codigoSku: string; nombre: string }[]> {
  const cat = await prisma.categoria.findUnique({
    where: { id: categoriaId },
    select: { codigoSku: true, nombre: true, children: { select: { id: true } } },
  });
  if (!cat) return [];
  const filas = [{ codigoSku: cat.codigoSku, nombre: cat.nombre }];
  for (const h of cat.children) filas.push(...(await categoriasDelSubarbol(h.id)));
  return filas;
}

async function imagenesDelSubarbol(categoriaId: string): Promise<string[]> {
  const urls: string[] = [];
  const cat = await prisma.categoria.findUnique({
    where: { id: categoriaId },
    select: {
      imagenUrl: true,
      productos: { select: { imagenUrl: true } },
      children: { select: { id: true } },
    },
  });
  if (!cat) return urls;
  if (cat.imagenUrl) urls.push(cat.imagenUrl);
  for (const p of cat.productos) if (p.imagenUrl) urls.push(p.imagenUrl);
  for (const h of cat.children) urls.push(...(await imagenesDelSubarbol(h.id)));
  return urls;
}

// ----------------------------------------------------------------- Artículos

export async function crearProducto(input: z.input<typeof productoSchema>): Promise<ActionResult> {
  try {
    const data = productoSchema.parse(input);
    const categoria = await prisma.categoria.findUnique({ where: { id: data.categoriaId } });
    if (!categoria) return { ok: false, error: "La categoría no existe." };

    const codigoFinnegans = data.finnegansCodigo?.trim() || null;
    if (data.pushFinnegans && !codigoFinnegans) {
      return { ok: false, error: "Para cargarlo en Finnegans Go necesitás indicar el Código." };
    }
    if (codigoFinnegans) {
      const dup = await prisma.producto.findUnique({
        where: { teamplaceCodigo: codigoFinnegans },
        select: { id: true },
      });
      if (dup) return { ok: false, error: `Ya existe un producto con el código "${codigoFinnegans}".` };
    }

    const ultimo = await prisma.producto.findFirst({
      where: { categoriaId: data.categoriaId },
      orderBy: { secuencia: "desc" },
      select: { secuencia: true },
    });
    const secuencia = (ultimo?.secuencia ?? 0) + 1;
    const codigoSku = buildProductoSku(categoria.codigoSku, secuencia);

    const creado = await prisma.producto.create({
      data: {
        categoriaId: data.categoriaId,
        secuencia,
        codigoSku,
        nombre: data.nombre,
        descripcion: data.descripcion || null,
        estado: data.estado,
        cantidadStock: data.cantidadStock,
        unidadStock: data.unidadStock,
        lugar: data.lugar || null,
        imagenUrl: data.imagenUrl || null,
        teamplaceCodigo: codigoFinnegans,
        finnegansActivo: data.estado === "ACTIVO",
        finnegansPushEstado: data.pushFinnegans ? "PENDIENTE" : "NO_APLICA",
      },
    });

    // Si se pidió, lanzamos el bot que lo da de alta en Finnegans Go.
    const jobId = data.pushFinnegans ? await lanzarPushFinnegans(creado.id) : undefined;

    revalidatePath(`/catalogo/${data.categoriaId}`);
    if (jobId) revalidatePath("/catalogo/altas");
    return { ok: true, id: creado.id, jobId };
  } catch (error) {
    return { ok: false, error: mensajeError(error) };
  }
}

export async function actualizarProducto(
  id: string,
  input: z.input<typeof productoSchema>,
): Promise<ActionResult> {
  try {
    const data = productoSchema.parse(input);
    const actual = await prisma.producto.findUnique({ where: { id } });
    if (!actual) return { ok: false, error: "El artículo no existe." };

    await prisma.producto.update({
      where: { id },
      data: {
        nombre: data.nombre,
        descripcion: data.descripcion || null,
        estado: data.estado,
        cantidadStock: data.cantidadStock,
        unidadStock: data.unidadStock,
        lugar: data.lugar || null,
        imagenUrl: data.imagenUrl ?? actual.imagenUrl,
      },
    });

    revalidatePath(`/catalogo/${actual.categoriaId}`);
    revalidatePath(`/catalogo/articulo/${id}`);
    return { ok: true, id };
  } catch (error) {
    return { ok: false, error: mensajeError(error) };
  }
}

// ------------------------------------------------- Clasificación manual

export type MoverResult =
  | {
      ok: true;
      movidos: number;
      destino: { id: string; nombre: string; codigoSku: string };
      /** Estado previo por artículo, para poder deshacer la movida. */
      anterior: { id: string; categoriaId: string }[];
    }
  | { ok: false; error: string };

/**
 * Mueve uno o varios artículos a otra categoría, regenerando `secuencia` y
 * `codigoSku` en el destino (correlativo max+1). Los que ya están en el
 * destino se ignoran. Es la única forma de recategorizar desde la UI.
 * Las características viajan con el artículo pero sus tipos NO se agregan a la
 * familia destino: en la ficha quedan como «fuera de familia».
 */
export async function moverProductos(ids: string[], categoriaId: string): Promise<MoverResult> {
  try {
    const unicos = Array.from(new Set(ids.filter(Boolean)));
    if (unicos.length === 0) return { ok: false, error: "No seleccionaste ningún artículo." };
    if (unicos.length > 500) return { ok: false, error: "Movés de a 500 artículos como máximo." };

    const destino = await prisma.categoria.findUnique({
      where: { id: categoriaId },
      select: { id: true, nombre: true, codigoSku: true },
    });
    if (!destino) return { ok: false, error: "La categoría destino no existe." };

    const productos = await prisma.producto.findMany({
      where: { id: { in: unicos } },
      select: { id: true, categoriaId: true, secuencia: true, codigoSku: true },
    });
    if (productos.length === 0) return { ok: false, error: "Los artículos ya no existen." };

    const aMover = productos.filter((p) => p.categoriaId !== destino.id);
    const anterior = aMover.map((p) => ({ id: p.id, categoriaId: p.categoriaId }));
    const origenes = Array.from(new Set(aMover.map((p) => p.categoriaId)));

    if (aMover.length > 0) {
      await prisma.$transaction(
        async (tx) => {
          const ultimo = await tx.producto.findFirst({
            where: { categoriaId: destino.id },
            orderBy: { secuencia: "desc" },
            select: { secuencia: true },
          });
          let secuencia = ultimo?.secuencia ?? 0;

          // Dos pasadas: primero un SKU temporal para no chocar con el índice
          // único de codigoSku si algún destino reutiliza un correlativo.
          for (const p of aMover) {
            await tx.producto.update({ where: { id: p.id }, data: { codigoSku: `TMP-${p.id}` } });
          }
          for (const p of aMover) {
            secuencia += 1;
            await tx.producto.update({
              where: { id: p.id },
              data: {
                categoriaId: destino.id,
                secuencia,
                codigoSku: buildProductoSku(destino.codigoSku, secuencia),
                clasificadoAt: new Date(),
              },
            });
          }
        },
        { timeout: 60_000, maxWait: 10_000 },
      );
    }

    revalidatePath("/catalogo");
    revalidatePath("/catalogo/clasificar");
    revalidatePath(`/catalogo/${destino.id}`);
    for (const o of origenes) revalidatePath(`/catalogo/${o}`);
    for (const p of aMover) revalidatePath(`/catalogo/articulo/${p.id}`);

    return { ok: true, movidos: aMover.length, destino, anterior };
  } catch (error) {
    return { ok: false, error: mensajeError(error) };
  }
}

/**
 * Deshace una movida: devuelve cada artículo a la categoría donde estaba.
 * (El correlativo se regenera; el SKU anterior no se recupera exactamente.)
 */
export async function deshacerMovida(
  anterior: { id: string; categoriaId: string }[],
): Promise<ActionResult> {
  const porCategoria = new Map<string, string[]>();
  for (const a of anterior) {
    const arr = porCategoria.get(a.categoriaId) ?? [];
    arr.push(a.id);
    porCategoria.set(a.categoriaId, arr);
  }
  for (const [categoriaId, ids] of porCategoria) {
    const res = await moverProductos(ids, categoriaId);
    if (!res.ok) return res;
  }
  return { ok: true };
}

// ------------------------------------------------- Verificación de categorías

/**
 * Marca (o re-marca) una categoría como verificada a mano. `verificadaPor` es
 * texto libre hasta que exista un sistema de usuarios.
 */
export async function verificarCategoria(id: string, verificadaPor: string): Promise<ActionResult> {
  try {
    const nombre = verificadaPor.trim();
    if (!nombre) return { ok: false, error: "Indicá quién verifica la categoría." };
    if (nombre.length > 80) return { ok: false, error: "El nombre es demasiado largo." };

    const cat = await prisma.categoria.findUnique({ where: { id }, select: { id: true, parentId: true } });
    if (!cat) return { ok: false, error: "La categoría no existe." };

    await prisma.categoria.update({
      where: { id },
      data: { verificadaAt: new Date(), verificadaPor: nombre },
    });

    revalidarCategoria(cat.id, cat.parentId);
    return { ok: true, id };
  } catch (error) {
    return { ok: false, error: mensajeError(error) };
  }
}

/** Quita la marca de verificación de una categoría. */
export async function quitarVerificacionCategoria(id: string): Promise<ActionResult> {
  try {
    const cat = await prisma.categoria.findUnique({ where: { id }, select: { id: true, parentId: true } });
    if (!cat) return { ok: false, error: "La categoría no existe." };

    await prisma.categoria.update({
      where: { id },
      data: { verificadaAt: null, verificadaPor: null },
    });

    revalidarCategoria(cat.id, cat.parentId);
    return { ok: true, id };
  } catch (error) {
    return { ok: false, error: mensajeError(error) };
  }
}

function revalidarCategoria(id: string, parentId: string | null) {
  revalidatePath("/catalogo");
  revalidatePath("/catalogo/clasificar");
  revalidatePath(`/catalogo/${id}`);
  if (parentId) revalidatePath(`/catalogo/${parentId}`);
}

/** Lista plana de categorías para el selector (carga bajo demanda desde el cliente). */
export async function listarCategoriasPlanas(): Promise<CategoriaPlana[]> {
  return getCategoriasPlanas();
}

export async function eliminarProducto(id: string): Promise<ActionResult> {
  try {
    const prod = await prisma.producto.findUnique({ where: { id } });
    if (!prod) return { ok: false, error: "El artículo no existe." };
    await prisma.producto.delete({ where: { id } });
    await deleteImageByUrl(prod.imagenUrl);
    revalidatePath(`/catalogo/${prod.categoriaId}`);
    return { ok: true };
  } catch (error) {
    return { ok: false, error: mensajeError(error) };
  }
}

// ------------------------------------------------------------ Características

const tipoCaracteristicaSchema = z.object({
  nombre: z.string().trim().min(1, "El nombre es obligatorio.").max(60),
  unidad: z.string().trim().max(20).optional().nullable(),
  descripcion: z.string().trim().max(200).optional().nullable(),
});

const caracteristicaSchema = z.object({
  productoId: z.string().min(1),
  tipoId: z.string().min(1),
  // "" permitido: borra el valor del artículo pero deja el tipo en la familia.
  valor: z.string().trim().max(200),
});

/**
 * Revalida todo lo que muestra características o las usa para buscar. Las
 * fichas de los hermanos de la familia no se revalidan una por una: todas las
 * páginas del catálogo son `force-dynamic`, así que se re-renderizan solas.
 */
async function revalidarCaracteristicas(productoId?: string) {
  revalidatePath("/catalogo");
  revalidatePath("/catalogo/clasificar");
  if (!productoId) return;
  const prod = await prisma.producto.findUnique({
    where: { id: productoId },
    select: { categoriaId: true },
  });
  revalidatePath(`/catalogo/articulo/${productoId}`);
  if (prod) revalidatePath(`/catalogo/${prod.categoriaId}`);
}

/** Crea un tipo de característica ("Potencia", con unidad "W"). */
export async function crearTipoCaracteristica(
  input: z.input<typeof tipoCaracteristicaSchema>,
): Promise<ActionResult> {
  try {
    const data = tipoCaracteristicaSchema.parse(input);
    const nombreClave = normalizarBusqueda(data.nombre);
    if (!nombreClave) return { ok: false, error: "El nombre necesita al menos una letra o número." };

    const ultimo = await prisma.tipoCaracteristica.findFirst({
      orderBy: { orden: "desc" },
      select: { orden: true },
    });

    const tipo = await prisma.tipoCaracteristica.create({
      data: {
        nombre: data.nombre,
        nombreClave,
        unidad: data.unidad || null,
        descripcion: data.descripcion || null,
        orden: (ultimo?.orden ?? 0) + 1,
      },
    });

    await revalidarCaracteristicas();
    return { ok: true, id: tipo.id };
  } catch (error) {
    return { ok: false, error: mensajeError(error) };
  }
}

/** Renombra un tipo de característica o cambia su unidad. */
export async function actualizarTipoCaracteristica(
  id: string,
  input: z.input<typeof tipoCaracteristicaSchema>,
): Promise<ActionResult> {
  try {
    const data = tipoCaracteristicaSchema.parse(input);
    const nombreClave = normalizarBusqueda(data.nombre);
    if (!nombreClave) return { ok: false, error: "El nombre necesita al menos una letra o número." };

    await prisma.tipoCaracteristica.update({
      where: { id },
      data: {
        nombre: data.nombre,
        nombreClave,
        unidad: data.unidad || null,
        descripcion: data.descripcion || null,
      },
    });

    await revalidarCaracteristicas();
    return { ok: true, id };
  } catch (error) {
    return { ok: false, error: mensajeError(error) };
  }
}

/** Elimina un tipo y, en cascada, los valores cargados en los artículos. */
export async function eliminarTipoCaracteristica(id: string): Promise<ActionResult> {
  try {
    await prisma.tipoCaracteristica.delete({ where: { id } });
    await revalidarCaracteristicas();
    return { ok: true };
  } catch (error) {
    return { ok: false, error: mensajeError(error) };
  }
}

/** Tipos de característica para el selector (carga bajo demanda desde el cliente). */
export async function listarTiposCaracteristica(): Promise<TipoCaracteristicaPlano[]> {
  return getTiposCaracteristica();
}

/**
 * Carga o pisa el valor de una característica en un artículo, y de paso asocia
 * el tipo a la familia (la categoría actual del producto): los hermanos pasan a
 * ver el tipo con valor opcional. Con valor vacío solo borra el valor del
 * artículo (la fila queda vacía en la familia). Editar una huérfana también la
 * incorpora a la familia actual.
 */
export async function guardarCaracteristica(
  input: z.input<typeof caracteristicaSchema>,
): Promise<ActionResult> {
  try {
    const data = caracteristicaSchema.parse(input);

    const producto = await prisma.producto.findUnique({
      where: { id: data.productoId },
      select: { categoriaId: true },
    });
    if (!producto) return { ok: false, error: "El artículo no existe." };

    const fila = await prisma.$transaction(async (tx) => {
      const yaEnFamilia = await tx.caracteristicaFamilia.findUnique({
        where: { categoriaId_tipoId: { categoriaId: producto.categoriaId, tipoId: data.tipoId } },
        select: { id: true },
      });
      if (!yaEnFamilia) {
        const ultimo = await tx.caracteristicaFamilia.findFirst({
          where: { categoriaId: producto.categoriaId },
          orderBy: { orden: "desc" },
          select: { orden: true },
        });
        await tx.caracteristicaFamilia.create({
          data: {
            categoriaId: producto.categoriaId,
            tipoId: data.tipoId,
            orden: (ultimo?.orden ?? 0) + 1,
          },
        });
      }

      if (!data.valor) {
        await tx.caracteristicaProducto.deleteMany({
          where: { productoId: data.productoId, tipoId: data.tipoId },
        });
        return null;
      }
      return tx.caracteristicaProducto.upsert({
        where: { productoId_tipoId: { productoId: data.productoId, tipoId: data.tipoId } },
        create: { productoId: data.productoId, tipoId: data.tipoId, valor: data.valor },
        update: { valor: data.valor },
      });
    });

    await revalidarCaracteristicas(data.productoId);
    return fila ? { ok: true, id: fila.id } : { ok: true };
  } catch (error) {
    return { ok: false, error: mensajeError(error) };
  }
}

/** Saca una característica de un artículo (no toca el tipo ni la familia). */
export async function eliminarCaracteristica(id: string): Promise<ActionResult> {
  try {
    const fila = await prisma.caracteristicaProducto.delete({
      where: { id },
      select: { productoId: true },
    });
    await revalidarCaracteristicas(fila.productoId);
    return { ok: true };
  } catch (error) {
    return { ok: false, error: mensajeError(error) };
  }
}

/**
 * Quita un tipo de la familia de una categoría y BORRA los valores cargados en
 * todos los artículos de esa categoría (destructivo: la UI pide confirmación
 * mostrando cuántos valores se pierden).
 */
export async function quitarTipoDeFamilia(
  categoriaId: string,
  tipoId: string,
): Promise<ActionResult> {
  try {
    await prisma.$transaction([
      prisma.caracteristicaProducto.deleteMany({
        where: { tipoId, producto: { categoriaId } },
      }),
      prisma.caracteristicaFamilia.deleteMany({ where: { categoriaId, tipoId } }),
    ]);

    revalidatePath("/catalogo");
    revalidatePath("/catalogo/clasificar");
    revalidatePath(`/catalogo/${categoriaId}`);
    return { ok: true };
  } catch (error) {
    return { ok: false, error: mensajeError(error) };
  }
}
