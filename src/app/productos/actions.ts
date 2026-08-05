"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { buildProductoSku } from "@/lib/sku";
import { productoFinnegansSchema, type ProductoFinnegansInput } from "@/lib/finnegans-producto";
import { lanzarPushFinnegans } from "@/lib/finnegans-push";

export type CrearResult =
  | { ok: true; productoId: string; jobId: string }
  | { ok: false; error: string };

function mensajeError(error: unknown): string {
  if (error && typeof error === "object" && "code" in error && error.code === "P2002") {
    return "Ya existe un producto con ese código. Probá con otro.";
  }
  if (error && typeof error === "object" && "issues" in error) {
    const issues = (error as { issues: Array<{ message: string }> }).issues;
    return issues.map((i) => i.message).join(" ");
  }
  return error instanceof Error ? error.message : "Ocurrió un error inesperado.";
}

/**
 * Da de alta un producto en CentralSM con los campos de Finnegans y dispara el
 * bot de Playwright que lo crea en Finnegans Go.
 *
 * El alta local es síncrona (queda en la base al instante); el push a Finnegans
 * corre en background y se sigue por polling con el `jobId` devuelto.
 */
export async function crearProductoYEmpujar(
  input: ProductoFinnegansInput,
): Promise<CrearResult> {
  try {
    const data = productoFinnegansSchema.parse(input);

    const categoria = await prisma.categoria.findUnique({ where: { id: data.categoriaId } });
    if (!categoria) return { ok: false, error: "La categoría no existe." };

    const duplicado = await prisma.producto.findUnique({
      where: { teamplaceCodigo: data.codigo },
      select: { id: true },
    });
    if (duplicado) {
      return { ok: false, error: `Ya existe un producto con el código "${data.codigo}".` };
    }

    const ultimo = await prisma.producto.findFirst({
      where: { categoriaId: data.categoriaId },
      orderBy: { secuencia: "desc" },
      select: { secuencia: true },
    });
    const secuencia = (ultimo?.secuencia ?? 0) + 1;

    const creado = await prisma.producto.create({
      data: {
        categoriaId: data.categoriaId,
        secuencia,
        codigoSku: buildProductoSku(categoria.codigoSku, secuencia),
        nombre: data.nombre,
        descripcion: data.descripcion || null,
        estado: data.activo ? "ACTIVO" : "INACTIVO",
        // El "Código" de Finnegans es la llave del vínculo con su maestro.
        teamplaceCodigo: data.codigo,

        finnegansTipo: data.tipo,
        finnegansPeso: data.peso,
        finnegansVolumen: data.volumen,
        finnegansRubro: data.rubro || null,
        finnegansMarca: data.marca || null,
        finnegansFamilia: data.familia || null,
        finnegansSubFamilia: data.subfamilia || null,
        finnegansActivo: data.activo,
        esStockeable: data.esStockeable,
        seVende: data.seVende,
        seCompra: data.seCompra,
        manejaRetenciones: data.manejaRetenciones,

        finnegansPushEstado: "PENDIENTE",
      },
    });

    const jobId = await lanzarPushFinnegans(creado.id);

    revalidatePath("/productos");
    revalidatePath(`/catalogo/${data.categoriaId}`);
    return { ok: true, productoId: creado.id, jobId };
  } catch (error) {
    return { ok: false, error: mensajeError(error) };
  }
}

/** Reintenta el push de un producto que quedó en ERROR. */
export async function reintentarPush(
  productoId: string,
): Promise<{ ok: true; jobId: string } | { ok: false; error: string }> {
  try {
    const producto = await prisma.producto.findUnique({
      where: { id: productoId },
      select: { id: true, teamplaceCodigo: true },
    });
    if (!producto) return { ok: false, error: "El producto no existe." };
    if (!producto.teamplaceCodigo) {
      return { ok: false, error: "El producto no tiene código de Finnegans." };
    }
    const jobId = await lanzarPushFinnegans(producto.id);
    revalidatePath("/productos");
    return { ok: true, jobId };
  } catch (error) {
    return { ok: false, error: mensajeError(error) };
  }
}
