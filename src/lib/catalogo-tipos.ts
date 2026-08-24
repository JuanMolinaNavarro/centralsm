// Tipos y constantes del catálogo compartidos entre servidor y cliente.
// (Sin imports de Prisma: este módulo se puede usar desde componentes "use client".)

import type { Verificacion } from "@/lib/verificacion-tipos";

/** SKU de la categoría raíz donde caen los artículos que el sync no pudo clasificar. */
export const SKU_PENDIENTES = "#REV";

export type CategoriaPlana = {
  id: string;
  parentId: string | null;
  nombre: string;
  segmento: string;
  codigoSku: string;
  /** Nombres de los ancestros, de la raíz hacia abajo (sin incluir la propia). */
  ruta: string[];
  nivel: number;
  tieneHijos: boolean;
  productosCount: number;
  verificacion: Verificacion;
};

export type ArticuloClasificable = {
  id: string;
  nombre: string;
  descripcion: string | null;
  codigoSku: string;
  teamplaceCodigo: string | null;
  cantidadStock: number;
  unidadStock: string;
  estado: "ACTIVO" | "INACTIVO";
  imagenUrl: string | null;
  categoriaId: string;
  categoriaNombre: string;
  categoriaSku: string;
};

/** ¿La categoría (por SKU) está dentro del subárbol de pendientes? */
export function esSkuPendiente(categoriaSku: string): boolean {
  return categoriaSku === SKU_PENDIENTES || categoriaSku.startsWith(`${SKU_PENDIENTES}-`);
}

/** Un artículo tal como lo muestra el buscador del catálogo (card completa). */
export type ArticuloResultado = ArticuloClasificable & {
  lugar: string | null;
  esNuevo: boolean;
};
