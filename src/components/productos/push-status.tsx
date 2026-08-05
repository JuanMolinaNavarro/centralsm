"use client";

import { useEffect, useRef, useState } from "react";
import { CheckCircle2, Loader2, XCircle } from "lucide-react";

export type EstadoPush = "PENDIENTE" | "EN_PROCESO" | "SINCRONIZADO" | "ERROR" | "NO_APLICA";

/**
 * Sigue por polling el estado del bot de Playwright que carga un producto en
 * Finnegans Go. Devuelve el estado y corta el polling al terminar.
 */
export function usePushStatus(
  jobId: string | null,
  onFinal?: (estado: EstadoPush, error: string | null) => void,
) {
  const [estado, setEstado] = useState<EstadoPush | null>(null);
  const [error, setError] = useState<string | null>(null);
  const timer = useRef<ReturnType<typeof setInterval> | null>(null);
  const cb = useRef(onFinal);
  useEffect(() => {
    cb.current = onFinal;
  });

  // Reset sincrónico al cambiar de job (patrón "adjust state during render").
  const [lastJobId, setLastJobId] = useState(jobId);
  if (jobId !== lastJobId) {
    setLastJobId(jobId);
    setEstado(jobId ? "PENDIENTE" : null);
    setError(null);
  }

  useEffect(() => {
    if (!jobId) return;

    const detener = () => {
      if (timer.current) clearInterval(timer.current);
      timer.current = null;
    };

    const tick = async () => {
      try {
        const res = await fetch(`/api/finnegans-push/${jobId}`, { cache: "no-store" });
        if (!res.ok) return;
        const job = (await res.json()) as { estado: EstadoPush; error: string | null };
        setEstado(job.estado);
        if (job.estado === "SINCRONIZADO" || job.estado === "ERROR") {
          detener();
          setError(job.error);
          cb.current?.(job.estado, job.error);
        }
      } catch {
        // reintentamos en el próximo tick
      }
    };

    void tick();
    timer.current = setInterval(tick, 2500);
    return detener;
  }, [jobId]);

  const enCurso = estado === "PENDIENTE" || estado === "EN_PROCESO";
  return { estado, error, enCurso };
}

/** Cartel de progreso del alta en Finnegans Go. `children` se renderiza al pie
 * (p. ej. un botón "Cargar otro producto" cuando terminó). */
export function PushStatus({
  estado,
  error,
  compact,
  children,
}: {
  estado: EstadoPush | null;
  error: string | null;
  compact?: boolean;
  children?: React.ReactNode;
}) {
  if (!estado) return null;
  const enCurso = estado === "PENDIENTE" || estado === "EN_PROCESO";

  return (
    <div
      className={`flex items-start gap-3 rounded-lg border ${compact ? "p-3" : "p-4"} text-sm ${
        estado === "ERROR"
          ? "border-destructive/40 bg-destructive/5"
          : estado === "SINCRONIZADO"
            ? "border-emerald-500/40 bg-emerald-500/5"
            : "border-border bg-muted/40"
      }`}
    >
      {enCurso && <Loader2 className="mt-0.5 size-4 shrink-0 animate-spin" />}
      {estado === "SINCRONIZADO" && (
        <CheckCircle2 className="mt-0.5 size-4 shrink-0 text-emerald-600" />
      )}
      {estado === "ERROR" && <XCircle className="mt-0.5 size-4 shrink-0 text-destructive" />}
      <div className="flex flex-col gap-1">
        <span className="font-medium">
          {estado === "PENDIENTE" && "Guardado en CentralSM. Iniciando el navegador…"}
          {estado === "EN_PROCESO" && "Playwright está cargando el producto en Finnegans Go…"}
          {estado === "SINCRONIZADO" && "¡Listo! El producto ya existe en Finnegans Go."}
          {estado === "ERROR" && "No se pudo crear en Finnegans Go."}
        </span>
        {error && <span className="text-xs break-words text-muted-foreground">{error}</span>}
        {children}
      </div>
    </div>
  );
}
