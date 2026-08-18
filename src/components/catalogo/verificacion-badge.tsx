import { BadgeAlert, BadgeCheck, CircleDashed } from "lucide-react";
import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import { fechaHoraAR } from "@/lib/fecha";
import type { Verificacion } from "@/lib/verificacion-tipos";

type Props = {
  verificacion: Verificacion;
  /** Solo icono (para cards y filas del selector). */
  compact?: boolean;
  /** Mostrar también el estado "Sin verificar" (por defecto no se renderiza nada). */
  mostrarVacio?: boolean;
  className?: string;
};

/** Texto largo para tooltip/title. */
export function describirVerificacion(v: Verificacion): string {
  if (v.estado === "sin_verificar") return "Categoría sin verificar";
  const quien = v.verificadaPor ? ` por ${v.verificadaPor}` : "";
  const cuando = v.verificadaAt ? ` el ${fechaHoraAR(v.verificadaAt)}` : "";
  if (v.estado === "verificada") return `Verificada${quien}${cuando}`;
  return `${v.cambios === 1 ? "1 cambio" : `${v.cambios} cambios`} desde la verificación${quien}${cuando}`;
}

/**
 * Badge de verificación manual de una categoría: verde si está verificada,
 * ámbar si entraron artículos/subcategorías después de verificarla.
 * Sin dependencias de servidor: se puede usar en Server y Client Components.
 */
export function VerificacionBadge({ verificacion: v, compact = false, mostrarVacio = false, className }: Props) {
  const title = describirVerificacion(v);

  if (v.estado === "sin_verificar") {
    if (!mostrarVacio) return null;
    return (
      <Badge variant="outline" className={cn("gap-1 text-muted-foreground", className)} title={title}>
        <CircleDashed className="size-3" />
        {!compact && "Sin verificar"}
      </Badge>
    );
  }

  if (v.estado === "verificada") {
    return (
      <Badge
        variant="outline"
        className={cn(
          "gap-1 border-emerald-500/50 bg-emerald-500/10 text-emerald-700 dark:text-emerald-400",
          compact && "px-1",
          className,
        )}
        title={title}
        aria-label={title}
      >
        <BadgeCheck className="size-3.5" />
        {!compact && "Verificada"}
      </Badge>
    );
  }

  return (
    <Badge
      variant="outline"
      className={cn(
        "gap-1 border-amber-500/50 bg-amber-500/10 text-amber-700 dark:text-amber-400",
        compact && "px-1",
        className,
      )}
      title={title}
      aria-label={title}
    >
      <BadgeAlert className="size-3.5" />
      {compact
        ? v.cambios
        : `${v.cambios === 1 ? "1 cambio" : `${v.cambios} cambios`} desde la verificación`}
    </Badge>
  );
}
