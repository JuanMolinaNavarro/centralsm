// Helpers para construir y validar los códigos SKU del catálogo.
//
// El SKU se arma por capas (la "cebolla"): cada categoría aporta un `segmento`.
//   Macro "IR"  ->  "#IR"
//   sub   "1"   ->  "#IR-1"
//   sub   "ADS" ->  "#IR-1-ADS"
//   artículo correlativo 1 -> "#IR-1-ADS-0001"

export const SKU_PREFIX = "#";
export const SKU_SEP = "-";
export const PRODUCTO_SEQ_PAD = 4;

/** Normaliza un fragmento: sin "#", mayúsculas, sin espacios, solo [A-Z0-9]. */
export function normalizarSegmento(segmento: string): string {
  return segmento
    .trim()
    .replace(/^#/, "")
    .toUpperCase()
    .replace(/\s+/g, "")
    .replace(/[^A-Z0-9]/g, "");
}

/** Valida un fragmento ya normalizado. Lanza Error con mensaje legible. */
export function validarSegmento(segmento: string): string {
  const seg = normalizarSegmento(segmento);
  if (seg.length === 0) {
    throw new Error("El segmento no puede estar vacío.");
  }
  if (seg.length > 8) {
    throw new Error("El segmento puede tener hasta 8 caracteres.");
  }
  return seg;
}

/** Construye el SKU de una categoría a partir del SKU del padre. */
export function buildCategoriaSku(
  parentSku: string | null,
  segmento: string,
): string {
  const seg = validarSegmento(segmento);
  if (!parentSku) return `${SKU_PREFIX}${seg}`;
  return `${parentSku}${SKU_SEP}${seg}`;
}

/** Construye el SKU de un artículo (categoría hoja + correlativo). */
export function buildProductoSku(categoriaSku: string, secuencia: number): string {
  const seq = String(secuencia).padStart(PRODUCTO_SEQ_PAD, "0");
  return `${categoriaSku}${SKU_SEP}${seq}`;
}
