"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { prisma } from "@/lib/prisma";

// Server actions de la ficha de investigación operativa. Todas devuelven
// { ok } | { ok: false, error } y revalidan la ficha del artículo.

export type ActionResult = { ok: true } | { ok: false; error: string };

function mensajeError(error: unknown): string {
  if (error && typeof error === "object" && "issues" in error) {
    const issues = (error as { issues: Array<{ message: string }> }).issues;
    return issues.map((i) => i.message).join(" ");
  }
  return error instanceof Error ? error.message : "Ocurrió un error inesperado.";
}

function revalidar(productoId: string) {
  revalidatePath(`/catalogo/articulo/${productoId}/ficha`);
  revalidatePath(`/catalogo/articulo/${productoId}`);
}

// ─── Maestro (pestaña Artículo) ───────────────────────────────────────────────

const maestroSchema = z.object({
  unidadBase: z.string().trim().min(1, "La unidad base es obligatoria."),
  entidades: z.string().trim().nullable(),
  criticidad: z.number().int().min(1).max(3).nullable(),
  kitNombre: z.string().trim().nullable(),
  kitCantidad: z.number().min(0).nullable(),
  predecesorId: z.string().trim().nullable(),
  sustitutos: z.string().trim().nullable(),
  origen: z.enum(["NACIONAL", "IMPORTADO"]).nullable(),
  estadoItem: z.enum(["NUEVO", "RECORTE", "RECUPERADO"]),
  tipoCosto: z.enum(["REPOSICION", "ULTIMA_COMPRA", "PROMEDIO_PONDERADO", "ESTANDAR"]),
  volumen: z.number().min(0),
  peso: z.number().min(0),
  requiereAutoelevador: z.boolean(),
  vidaUtilMeses: z.number().int().min(0).nullable(),
  enTransito: z.number().min(0),
  instalacionesMes: z.number().int().min(0).nullable(),
});

export type MaestroInput = z.input<typeof maestroSchema>;

export async function guardarMaestro(productoId: string, input: MaestroInput): Promise<ActionResult> {
  try {
    const d = maestroSchema.parse(input);
    if (d.predecesorId) {
      const pred = await prisma.producto.findUnique({
        where: { id: d.predecesorId },
        select: { id: true },
      });
      if (!pred) return { ok: false, error: "El artículo predecesor no existe." };
      if (pred.id === productoId)
        return { ok: false, error: "Un artículo no puede ser su propio predecesor." };
    }
    await prisma.producto.update({
      where: { id: productoId },
      data: {
        unidadStock: d.unidadBase,
        entidades: d.entidades || null,
        criticidad: d.criticidad,
        kitNombre: d.kitNombre || null,
        kitCantidad: d.kitCantidad,
        predecesorId: d.predecesorId || null,
        sustitutos: d.sustitutos || null,
        origen: d.origen,
        estadoItem: d.estadoItem,
        tipoCosto: d.tipoCosto,
        finnegansVolumen: d.volumen,
        finnegansPeso: d.peso,
        requiereAutoelevador: d.requiereAutoelevador,
        vidaUtilMeses: d.vidaUtilMeses,
        enTransito: d.enTransito,
        instalacionesMes: d.instalacionesMes,
      },
    });
    revalidar(productoId);
    return { ok: true };
  } catch (error) {
    return { ok: false, error: mensajeError(error) };
  }
}

// ─── Proveedores y precios ────────────────────────────────────────────────────

const proveedorSchema = z.object({
  nombre: z.string().trim().min(1, "El nombre del proveedor es obligatorio."),
  unidadCompra: z.string().trim().min(1, "La unidad de compra es obligatoria."),
  factorCompra: z.number().positive("El factor de compra debe ser mayor a 0."),
  unidadConsumo: z.string().trim().min(1, "La unidad de consumo es obligatoria."),
  factorConsumo: z.number().positive("El factor de consumo debe ser mayor a 0."),
  loteMinimo: z.number().min(0),
  multiplo: z.number().positive("El múltiplo debe ser mayor a 0."),
});

export type ProveedorInput = z.input<typeof proveedorSchema>;

export async function guardarProveedor(
  productoId: string,
  input: ProveedorInput,
  proveedorId?: string,
): Promise<ActionResult> {
  try {
    const d = proveedorSchema.parse(input);
    if (proveedorId) {
      await prisma.proveedorArticulo.update({ where: { id: proveedorId }, data: d });
    } else {
      const creado = await prisma.proveedorArticulo.create({
        data: { ...d, productoId },
      });
      // El primer proveedor queda seleccionado automáticamente.
      await prisma.producto.updateMany({
        where: { id: productoId, proveedorSeleccionadoId: null },
        data: { proveedorSeleccionadoId: creado.id },
      });
    }
    revalidar(productoId);
    return { ok: true };
  } catch (error) {
    return { ok: false, error: mensajeError(error) };
  }
}

export async function eliminarProveedor(productoId: string, proveedorId: string): Promise<ActionResult> {
  try {
    await prisma.proveedorArticulo.delete({ where: { id: proveedorId } });
    revalidar(productoId);
    return { ok: true };
  } catch (error) {
    return { ok: false, error: mensajeError(error) };
  }
}

export async function seleccionarProveedor(productoId: string, proveedorId: string): Promise<ActionResult> {
  try {
    await prisma.producto.update({
      where: { id: productoId },
      data: { proveedorSeleccionadoId: proveedorId },
    });
    revalidar(productoId);
    return { ok: true };
  } catch (error) {
    return { ok: false, error: mensajeError(error) };
  }
}

const precioSchema = z.object({
  fecha: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Fecha inválida."),
  precioUsd: z.number().positive("El precio debe ser mayor a 0."),
});

export async function agregarPrecio(
  productoId: string,
  proveedorId: string,
  input: z.input<typeof precioSchema>,
): Promise<ActionResult> {
  try {
    const d = precioSchema.parse(input);
    await prisma.precioProveedor.create({
      data: { proveedorId, fecha: new Date(d.fecha + "T00:00:00Z"), precioUsd: d.precioUsd },
    });
    revalidar(productoId);
    return { ok: true };
  } catch (error) {
    return { ok: false, error: mensajeError(error) };
  }
}

export async function eliminarPrecio(productoId: string, precioId: string): Promise<ActionResult> {
  try {
    await prisma.precioProveedor.delete({ where: { id: precioId } });
    revalidar(productoId);
    return { ok: true };
  } catch (error) {
    return { ok: false, error: mensajeError(error) };
  }
}

// ─── Movimientos (pestaña 2) ─────────────────────────────────────────────────

const movimientoSchema = z.object({
  fecha: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Fecha inválida."),
  tipo: z.enum([
    "CONSUMO",
    "TRANSFERENCIA",
    "DEVOLUCION",
    "AJUSTE",
    "RECEPCION_COMPRA",
    "DEVOLUCION_COMPRA",
    "SALIDA_PROYECTO",
    "REINGRESO_PROYECTO",
  ]),
  demanda: z.enum(["RECURRENTE", "OBRA", "URGENTE", "NA"]),
  solicitado: z.number().min(0),
  entregado: z.number().min(0),
  destino: z.string().trim().nullable(),
  pedido: z.string().trim().nullable(),
});

export type MovimientoInput = z.input<typeof movimientoSchema>;

export async function guardarMovimiento(
  productoId: string,
  input: MovimientoInput,
  movimientoId?: string,
): Promise<ActionResult> {
  try {
    const d = movimientoSchema.parse(input);
    const data = {
      fecha: new Date(d.fecha + "T00:00:00Z"),
      tipo: d.tipo,
      // La demanda solo aplica al consumo; el resto queda en NA.
      demanda: d.tipo === "CONSUMO" ? (d.demanda === "NA" ? "RECURRENTE" : d.demanda) : "NA",
      solicitado: d.solicitado,
      entregado: d.entregado,
      destino: d.destino || null,
      pedido: d.pedido || null,
    } as const;
    if (movimientoId) {
      await prisma.movimientoArticulo.update({ where: { id: movimientoId }, data });
    } else {
      await prisma.movimientoArticulo.create({ data: { ...data, productoId } });
    }
    revalidar(productoId);
    return { ok: true };
  } catch (error) {
    return { ok: false, error: mensajeError(error) };
  }
}

export async function eliminarMovimiento(productoId: string, movimientoId: string): Promise<ActionResult> {
  try {
    await prisma.movimientoArticulo.delete({ where: { id: movimientoId } });
    revalidar(productoId);
    return { ok: true };
  } catch (error) {
    return { ok: false, error: mensajeError(error) };
  }
}

// ─── Lead times ──────────────────────────────────────────────────────────────

export async function agregarLeadTime(
  productoId: string,
  dias: number,
  fecha?: string,
): Promise<ActionResult> {
  try {
    const d = z.number().int().positive("Los días deben ser mayores a 0.").parse(dias);
    await prisma.leadTimeRegistro.create({
      data: {
        productoId,
        dias: d,
        ...(fecha ? { fecha: new Date(fecha + "T00:00:00Z") } : {}),
      },
    });
    revalidar(productoId);
    return { ok: true };
  } catch (error) {
    return { ok: false, error: mensajeError(error) };
  }
}

export async function eliminarLeadTime(productoId: string, leadTimeId: string): Promise<ActionResult> {
  try {
    await prisma.leadTimeRegistro.delete({ where: { id: leadTimeId } });
    revalidar(productoId);
    return { ok: true };
  } catch (error) {
    return { ok: false, error: mensajeError(error) };
  }
}
