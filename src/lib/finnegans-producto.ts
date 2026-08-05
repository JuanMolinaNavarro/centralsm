import { z } from "zod";

// Definición única de los campos del producto tal como los pide Finnegans Go.
// La usan: el formulario (UI), la server action (validación) y el runner de
// Playwright (mapeo a los inputs del form legacy).
//
// Referencia del form real: docs/carga-productos-playwright.md §5.2
// (campos sin id/name → se targetean por `tabindex` dentro de un iframe).

// (El mapeo de widgets `wdg_*` del form legacy vive únicamente en
// scripts/playwright/config.ts, que es quien lo usa. Acá había una copia
// desactualizable que nadie importaba; se eliminó.)

export const productoFinnegansSchema = z.object({
  // Identificación (obligatorios en Finnegans)
  codigo: z
    .string()
    .trim()
    .min(1, "El código es obligatorio.")
    .max(60, "El código es demasiado largo."),
  nombre: z.string().trim().min(1, "El nombre es obligatorio.").max(200),
  descripcion: z.string().trim().max(500).optional().or(z.literal("")),
  tipo: z.string().trim().min(1).default("Otros"),

  // Medidas
  peso: z.coerce.number().min(0).default(0),
  volumen: z.coerce.number().min(0).default(0),

  // Clasificación (campos F4 de Finnegans — opcionales)
  rubro: z.string().trim().max(100).optional().or(z.literal("")),
  marca: z.string().trim().max(100).optional().or(z.literal("")),
  familia: z.string().trim().max(100).optional().or(z.literal("")),
  subfamilia: z.string().trim().max(100).optional().or(z.literal("")),

  // Flags
  activo: z.boolean().default(true),
  esStockeable: z.boolean().default(false),
  seVende: z.boolean().default(false),
  seCompra: z.boolean().default(false),
  manejaRetenciones: z.boolean().default(false),

  // Enlace con el catálogo de CentralSM (requerido por nuestro modelo/SKU)
  categoriaId: z.string().min(1, "Elegí una categoría del catálogo."),
});

export type ProductoFinnegansInput = z.input<typeof productoFinnegansSchema>;
export type ProductoFinnegans = z.output<typeof productoFinnegansSchema>;

/** Valores del combo "Tipo" del maestro de Finnegans. */
export const TIPOS = ["Otros", "Producto", "Servicio", "Insumo"] as const;
