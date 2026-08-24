/**
 * Normalización de texto para las búsquedas del catálogo.
 *
 * Sin imports de Prisma: este módulo se puede usar desde componentes `use client`.
 *
 * IMPORTANTE: tiene un gemelo en SQL — la función `centralsm_norm(text)` creada en
 * la migración `..._caracteristicas_producto`. Si cambiás una, cambiá la otra: la
 * búsqueda compara tokens normalizados acá contra columnas normalizadas allá.
 */

/** "3 W" -> "3w" · "Ángulo-45°" -> "angulo45" · "N-hembra" -> "nhembra". */
export function normalizarBusqueda(s: string): string {
  return s
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "");
}

/** Palabras de la consulta, ya normalizadas y sin vacíos. Cada una debe aparecer. */
export function tokensBusqueda(q: string): string[] {
  return q.trim().split(/\s+/).map(normalizarBusqueda).filter(Boolean);
}
