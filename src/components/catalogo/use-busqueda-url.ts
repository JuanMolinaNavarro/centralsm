"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useEffect, useState, useTransition } from "react";

const DEBOUNCE_MS = 300;

/**
 * Búsqueda de catálogo sincronizada con la URL: mantiene el texto tipeado,
 * lo empuja al query string con debounce y expone `navegar()` para el resto de
 * los filtros. La lista siempre la resuelve el servidor a partir de la URL.
 *
 * `qServidor` es el `?q=` con el que se renderizó la página.
 */
export function useBusquedaUrl(qServidor: string) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [navegando, startTransition] = useTransition();

  const [q, setQ] = useState(qServidor);
  const [prevQServidor, setPrevQServidor] = useState(qServidor);
  const [ultimoEnviado, setUltimoEnviado] = useState(qServidor);

  // Sincronizar el input solo si el filtro cambia desde afuera (back/forward),
  // no cuando es el eco de lo que acabamos de escribir (evita pisar el tipeo).
  if (qServidor !== prevQServidor) {
    setPrevQServidor(qServidor);
    if (qServidor !== ultimoEnviado) setQ(qServidor);
  }

  /** Aplica cambios al query string. Cualquier filtro vuelve a la primera página. */
  function navegar(cambios: Record<string, string | null | undefined>) {
    const params = new URLSearchParams(searchParams.toString());
    for (const [k, v] of Object.entries(cambios)) {
      if (v === null || v === "" || v === undefined) params.delete(k);
      else params.set(k, v);
    }
    if (!("pagina" in cambios)) params.delete("pagina");
    const qs = params.toString();
    startTransition(() => {
      router.replace(qs ? `${pathname}?${qs}` : pathname, { scroll: false });
    });
  }

  // Búsqueda con debounce.
  useEffect(() => {
    if (q === qServidor) return;
    const t = window.setTimeout(() => {
      setUltimoEnviado(q.trim());
      navegar({ q: q.trim() || null });
    }, DEBOUNCE_MS);
    return () => window.clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [q]);

  return { q, setQ, navegar, navegando };
}
