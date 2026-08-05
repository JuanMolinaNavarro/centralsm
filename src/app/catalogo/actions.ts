"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { buildCategoriaSku, buildProductoSku, normalizarSegmento } from "@/lib/sku";
import { deleteImageByUrl } from "@/lib/uploads";
import { lanzarPushFinnegans } from "@/lib/finnegans-push";

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

    await prisma.categoria.delete({ where: { id } }); // cascada en DB

    for (const url of imagenes) await deleteImageByUrl(url);

    revalidatePath("/catalogo");
    if (cat.parentId) revalidatePath(`/catalogo/${cat.parentId}`);
    return { ok: true };
  } catch (error) {
    return { ok: false, error: mensajeError(error) };
  }
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
    if (jobId) revalidatePath("/productos");
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
