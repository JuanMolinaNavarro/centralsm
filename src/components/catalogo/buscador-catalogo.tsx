"use client";

import { ChevronLeft, ChevronRight, Loader2, Search, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useBusquedaUrl } from "@/components/catalogo/use-busqueda-url";

type Resultados = {
  total: number;
  pagina: number;
  paginas: number;
  tamano: number;
  /** Se alcanzó el tope de coincidencias: hay que afinar la búsqueda. */
  truncado: boolean;
};

type Props = {
  /** El `?q=` con el que se renderizó la página. */
  q: string;
  /** Null cuando no hay búsqueda activa (se muestra solo el buscador). */
  resultados: Resultados | null;
  /** Las cards de los artículos encontrados, ya renderizadas en el servidor. */
  children?: React.ReactNode;
};

/**
 * Buscador del catálogo: encuentra artículos por SKU, nombre, código Teamplace
 * o características. Mientras hay texto, los resultados reemplazan al árbol de
 * categorías; al vaciarlo vuelve la vista normal.
 */
export function BuscadorCatalogo({ q: qServidor, resultados, children }: Props) {
  const { q, setQ, navegar, navegando } = useBusquedaUrl(qServidor);

  const desde = resultados ? (resultados.pagina - 1) * resultados.tamano + 1 : 0;
  const hasta = resultados ? Math.min(resultados.pagina * resultados.tamano, resultados.total) : 0;

  return (
    <div className="mb-6 flex flex-col gap-4">
      <div className="flex items-center gap-3">
        <div className="relative flex-1">
          <Search className="pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Buscar artículos por SKU, nombre o características (ej: «3 W»)…"
            className="h-10 pr-8 pl-8"
            autoComplete="off"
            aria-label="Buscar artículos en el catálogo"
          />
          {q && (
            <button
              type="button"
              onClick={() => setQ("")}
              className="absolute top-1/2 right-2 -translate-y-1/2 rounded p-0.5 text-muted-foreground hover:text-foreground"
              aria-label="Limpiar búsqueda"
            >
              <X className="size-4" />
            </button>
          )}
        </div>
        {navegando && <Loader2 className="size-4 shrink-0 animate-spin text-muted-foreground" />}
      </div>

      {resultados && (
        <>
          <div className="flex flex-wrap items-center justify-between gap-2 text-sm text-muted-foreground">
            <span>
              {resultados.total === 0 ? (
                <>
                  Ningún artículo coincide con «{qServidor}». Cada palabra debe aparecer en el
                  nombre, el SKU o alguna característica.
                </>
              ) : (
                <>
                  {desde.toLocaleString("es-AR")}–{hasta.toLocaleString("es-AR")} de{" "}
                  <span className="font-semibold text-foreground">
                    {resultados.total.toLocaleString("es-AR")}
                  </span>{" "}
                  artículo{resultados.total === 1 ? "" : "s"}
                </>
              )}
            </span>
            {resultados.truncado && (
              <span className="text-amber-600 dark:text-amber-400">
                Demasiadas coincidencias: se muestran las primeras. Agregá otra palabra.
              </span>
            )}
          </div>

          <div className={cn(navegando && "opacity-70 transition-opacity")}>{children}</div>

          {resultados.paginas > 1 && (
            <div className="flex items-center justify-center gap-3">
              <Button
                size="sm"
                variant="outline"
                disabled={resultados.pagina <= 1 || navegando}
                onClick={() => navegar({ pagina: String(resultados.pagina - 1) })}
              >
                <ChevronLeft className="size-4" /> Anterior
              </Button>
              <span className="text-sm text-muted-foreground tabular-nums">
                Página {resultados.pagina} de {resultados.paginas}
              </span>
              <Button
                size="sm"
                variant="outline"
                disabled={resultados.pagina >= resultados.paginas || navegando}
                onClick={() => navegar({ pagina: String(resultados.pagina + 1) })}
              >
                Siguiente <ChevronRight className="size-4" />
              </Button>
            </div>
          )}
        </>
      )}
    </div>
  );
}
