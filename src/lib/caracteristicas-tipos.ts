/**
 * Tipos de las características de artículo compartidos entre servidor y cliente.
 * Sin imports de Prisma: se puede usar desde componentes `use client`.
 */

/** Un tipo de característica ("Potencia") con cuántos artículos lo usan. */
export type TipoCaracteristicaPlano = {
  id: string;
  nombre: string;
  unidad: string | null;
  descripcion: string | null;
  orden: number;
  usos: number;
};

/**
 * Fila de la sección Características de la ficha: los tipos de la familia
 * (la categoría del artículo, con o sin valor cargado) más las características
 * propias cuyo tipo quedó fuera de la familia (huérfanas, p. ej. tras mover el
 * artículo de categoría).
 */
export type CaracteristicaFichaVista = {
  /** id de CaracteristicaProducto; null = tipo de la familia sin valor acá. */
  id: string | null;
  tipoId: string;
  tipoNombre: string;
  unidad: string | null;
  /** "" cuando el artículo no tiene valor cargado. */
  valor: string;
  /** El tipo está asociado a la categoría (familia) del artículo. */
  enFamilia: boolean;
  /** Artículos de la familia con valor cargado para este tipo (para el confirm
   *  destructivo de «quitar de la familia»). */
  valoresEnFamilia: number;
};

/** Característica compacta para las cards del catálogo ("Potencia: 3 W"). */
export type CaracteristicaCardVista = {
  nombre: string;
  valor: string;
  unidad: string | null;
};
