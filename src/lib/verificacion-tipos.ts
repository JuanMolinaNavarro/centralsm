// Estado de verificación manual de una categoría (cliente-safe, sin Prisma).

export type EstadoVerificacion = "sin_verificar" | "verificada" | "con_cambios";

export type Verificacion = {
  estado: EstadoVerificacion;
  verificadaAt: Date | null;
  verificadaPor: string | null;
  /** Artículos asignados o subcategorías creadas después de la última verificación. */
  cambios: number;
};

export const SIN_VERIFICAR: Verificacion = {
  estado: "sin_verificar",
  verificadaAt: null,
  verificadaPor: null,
  cambios: 0,
};

/** Deriva el estado a partir de la fecha de verificación y la cantidad de cambios posteriores. */
export function derivarVerificacion(
  verificadaAt: Date | null,
  verificadaPor: string | null,
  cambios: number,
): Verificacion {
  if (!verificadaAt) return SIN_VERIFICAR;
  return {
    estado: cambios > 0 ? "con_cambios" : "verificada",
    verificadaAt,
    verificadaPor,
    cambios,
  };
}
