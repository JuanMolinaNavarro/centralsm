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

/** Una característica cargada en un artículo ("Potencia" -> "3 W"). */
export type CaracteristicaProductoVista = {
  id: string;
  tipoId: string;
  tipoNombre: string;
  unidad: string | null;
  valor: string;
};
