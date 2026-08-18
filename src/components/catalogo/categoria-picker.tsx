"use client";

import { useEffect, useMemo, useRef, useState, useTransition } from "react";
import { Check, Clock, Folder, FolderTree, Loader2, Plus, Search } from "lucide-react";
import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { CategoriaFormDialog } from "@/components/catalogo/categoria-form-dialog";
import { VerificacionBadge } from "@/components/catalogo/verificacion-badge";
import { listarCategoriasPlanas } from "@/app/catalogo/actions";
import type { CategoriaPlana } from "@/lib/catalogo-tipos";

const RECIENTES_KEY = "centralsm.categorias-recientes";
const MAX_RECIENTES = 6;
const MAX_RESULTADOS = 120;

// Caché de la lista plana para no volver a pedirla en cada apertura.
let cacheCategorias: CategoriaPlana[] | null = null;

function normalizar(s: string) {
  return s
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase();
}

function leerRecientes(): string[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(RECIENTES_KEY);
    const arr = raw ? (JSON.parse(raw) as unknown) : [];
    return Array.isArray(arr) ? arr.filter((x): x is string => typeof x === "string") : [];
  } catch {
    return [];
  }
}

function guardarReciente(id: string) {
  const prev = leerRecientes().filter((x) => x !== id);
  window.localStorage.setItem(RECIENTES_KEY, JSON.stringify([id, ...prev].slice(0, MAX_RECIENTES)));
}

type Fila = { cat: CategoriaPlana; seccion: "recientes" | "todas" | "resultados" };

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  titulo?: string;
  descripcion?: React.ReactNode;
  /** Lista plana ya cargada (opcional; si falta se carga bajo demanda). */
  categorias?: CategoriaPlana[];
  /** Categoría actual del/los artículos: se marca y no se puede elegir. */
  actualId?: string | null;
  /** Ids que se marcan como "actual" (cuando la selección viene de varias categorías). */
  actualesIds?: string[];
  onSelect: (categoria: CategoriaPlana) => void | Promise<void>;
  /** Deshabilita la selección mientras se ejecuta la acción. */
  pending?: boolean;
  /** Permite crear subcategorías desde el selector (por defecto sí). */
  permitirCrear?: boolean;
  /** Texto del placeholder del buscador. */
  placeholder?: string;
};

/**
 * Selector de categoría con búsqueda por texto sobre la ruta completa
 * (padres + nombre + SKU), sección de recientes, navegación por teclado
 * (↑ ↓ Enter) y creación inline de subcategorías.
 */
export function CategoriaPicker({
  open,
  onOpenChange,
  titulo = "Elegir categoría",
  descripcion,
  categorias: categoriasProp,
  actualId = null,
  actualesIds,
  onSelect,
  pending = false,
  permitirCrear = true,
  placeholder = "Buscar por nombre, ruta o SKU…",
}: Props) {
  // Lista cargada/recargada localmente (bajo demanda o tras crear una subcategoría).
  // Tiene prioridad sobre la prop hasta que el selector se vuelve a abrir.
  const [listaLocal, setListaLocal] = useState<CategoriaPlana[] | null>(null);
  const [cargando, startCarga] = useTransition();
  const [q, setQ] = useState("");
  const [activo, setActivo] = useState(0);
  const [recientes, setRecientes] = useState<string[]>([]);
  const [crearEn, setCrearEn] = useState<CategoriaPlana | null>(null);
  const [prevOpen, setPrevOpen] = useState(open);
  const inputRef = useRef<HTMLInputElement>(null);
  const listaRef = useRef<HTMLDivElement>(null);

  // Reiniciar el estado al abrir (ajuste de estado durante el render, sin efecto).
  if (open !== prevOpen) {
    setPrevOpen(open);
    if (open) {
      setQ("");
      setActivo(0);
      setListaLocal(null);
      setRecientes(leerRecientes());
    }
  }

  const lista: CategoriaPlana[] | null = listaLocal ?? categoriasProp ?? cacheCategorias;

  const actuales = useMemo(() => {
    const s = new Set(actualesIds ?? []);
    if (actualId) s.add(actualId);
    return s;
  }, [actualId, actualesIds]);

  function recargar(): Promise<CategoriaPlana[]> {
    return new Promise((resolve) => {
      startCarga(async () => {
        const data = await listarCategoriasPlanas();
        cacheCategorias = data;
        setListaLocal(data);
        resolve(data);
      });
    });
  }

  // Al abrir: enfocar el buscador. Si la lista no viene por prop, se (re)carga
  // en segundo plano — la caché sirve para mostrar algo al instante, pero los
  // conteos y el estado de verificación pueden haber cambiado.
  useEffect(() => {
    if (!open) return;
    if (categoriasProp) cacheCategorias = categoriasProp;
    else void recargar();
    const t = window.setTimeout(() => inputRef.current?.focus(), 30);
    return () => window.clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  const filas: Fila[] = useMemo(() => {
    if (!lista) return [];
    const tokens = normalizar(q).split(/\s+/).filter(Boolean);
    if (tokens.length === 0) {
      const porId = new Map(lista.map((c) => [c.id, c]));
      const rec = recientes
        .map((id) => porId.get(id))
        .filter((c): c is CategoriaPlana => !!c)
        .map((cat) => ({ cat, seccion: "recientes" as const }));
      return [...rec, ...lista.map((cat) => ({ cat, seccion: "todas" as const }))];
    }
    const puntuadas: { cat: CategoriaPlana; score: number }[] = [];
    for (const cat of lista) {
      const nombre = normalizar(cat.nombre);
      const ruta = normalizar(cat.ruta.join(" "));
      const sku = normalizar(cat.codigoSku);
      let score = 0;
      let ok = true;
      for (const t of tokens) {
        if (nombre.startsWith(t)) score += 0;
        else if (nombre.includes(t)) score += 1;
        else if (sku.includes(t)) score += 2;
        else if (ruta.includes(t)) score += 3;
        else {
          ok = false;
          break;
        }
      }
      // En empate, las hojas (donde van los artículos) antes que los padres.
      if (ok) puntuadas.push({ cat, score: score + (cat.tieneHijos ? 0.5 : 0) });
    }
    puntuadas.sort((a, b) => a.score - b.score || a.cat.codigoSku.localeCompare(b.cat.codigoSku));
    return puntuadas.slice(0, MAX_RESULTADOS).map(({ cat }) => ({ cat, seccion: "resultados" as const }));
  }, [lista, q, recientes]);

  // Mantener visible la fila activa al navegar con teclado.
  useEffect(() => {
    const el = listaRef.current?.querySelector<HTMLElement>(`[data-index="${activo}"]`);
    el?.scrollIntoView({ block: "nearest" });
  }, [activo]);

  async function elegir(cat: CategoriaPlana) {
    if (pending || actuales.has(cat.id)) return;
    guardarReciente(cat.id);
    await onSelect(cat);
  }

  function onKeyDown(e: React.KeyboardEvent) {
    if (filas.length === 0) return;
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setActivo((i) => Math.min(i + 1, filas.length - 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setActivo((i) => Math.max(i - 1, 0));
    } else if (e.key === "Home") {
      e.preventDefault();
      setActivo(0);
    } else if (e.key === "End") {
      e.preventDefault();
      setActivo(filas.length - 1);
    } else if (e.key === "Enter") {
      e.preventDefault();
      const f = filas[activo];
      if (f) void elegir(f.cat);
    }
  }

  let seccionAnterior: Fila["seccion"] | null = null;

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="gap-3 p-0 sm:max-w-xl" showCloseButton={false}>
          <DialogHeader className="px-4 pt-4">
            <DialogTitle>{titulo}</DialogTitle>
            {descripcion && <DialogDescription>{descripcion}</DialogDescription>}
          </DialogHeader>

          <div className="relative px-4">
            <Search className="pointer-events-none absolute top-1/2 left-6.5 size-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              ref={inputRef}
              value={q}
              onChange={(e) => {
                setQ(e.target.value);
                setActivo(0);
              }}
              onKeyDown={onKeyDown}
              placeholder={placeholder}
              className="h-9 pl-8"
              autoComplete="off"
              spellCheck={false}
              aria-label="Buscar categoría"
              disabled={pending}
            />
            {(pending || cargando) && (
              <Loader2 className="absolute top-1/2 right-6.5 size-4 -translate-y-1/2 animate-spin text-muted-foreground" />
            )}
          </div>

          <div
            ref={listaRef}
            role="listbox"
            aria-label="Categorías"
            className="max-h-[min(60vh,28rem)] overflow-y-auto border-t"
          >
            {!lista && (
              <p className="px-4 py-8 text-center text-sm text-muted-foreground">Cargando categorías…</p>
            )}
            {lista && filas.length === 0 && (
              <p className="px-4 py-8 text-center text-sm text-muted-foreground">
                Ninguna categoría coincide con «{q}».
              </p>
            )}
            {filas.map((f, i) => {
              const encabezado = f.seccion !== seccionAnterior;
              seccionAnterior = f.seccion;
              const esActual = actuales.has(f.cat.id);
              const esActivo = i === activo;
              const indent = f.seccion === "todas" ? f.cat.nivel : 0;
              return (
                <div key={`${f.seccion}-${f.cat.id}`}>
                  {encabezado && f.seccion !== "resultados" && (
                    <div className="sticky top-0 z-10 flex items-center gap-1.5 bg-popover px-4 pt-3 pb-1 text-[11px] font-medium tracking-wide text-muted-foreground uppercase">
                      {f.seccion === "recientes" ? <Clock className="size-3" /> : <FolderTree className="size-3" />}
                      {f.seccion === "recientes" ? "Recientes" : "Todas las categorías"}
                    </div>
                  )}
                  <div
                    role="option"
                    aria-selected={esActivo}
                    aria-disabled={esActual || pending}
                    data-index={i}
                    onMouseEnter={() => setActivo(i)}
                    onClick={() => void elegir(f.cat)}
                    className={cn(
                      "group/fila flex cursor-pointer items-center gap-2 px-4 py-1.5 text-sm",
                      esActivo && "bg-muted",
                      (esActual || pending) && "cursor-default opacity-60",
                    )}
                    style={{ paddingLeft: `${1 + indent * 0.9}rem` }}
                  >
                    {f.cat.tieneHijos ? (
                      <FolderTree className="size-4 shrink-0 text-muted-foreground" />
                    ) : (
                      <Folder className="size-4 shrink-0 text-muted-foreground" />
                    )}
                    <div className="flex min-w-0 flex-1 flex-col">
                      <span className="truncate font-medium">{f.cat.nombre}</span>
                      {f.cat.ruta.length > 0 && f.seccion !== "todas" && (
                        <span className="truncate text-xs text-muted-foreground">
                          {f.cat.ruta.join(" › ")}
                        </span>
                      )}
                    </div>
                    <span className="hidden text-xs text-muted-foreground tabular-nums sm:inline">
                      {f.cat.productosCount} art.
                    </span>
                    <VerificacionBadge verificacion={f.cat.verificacion} compact />
                    <Badge variant="secondary" className="shrink-0 font-mono text-[11px]">
                      {f.cat.codigoSku}
                    </Badge>
                    {esActual ? (
                      <span className="flex w-7 items-center justify-center" title="Categoría actual">
                        <Check className="size-4 text-muted-foreground" />
                      </span>
                    ) : permitirCrear ? (
                      <Button
                        size="icon-xs"
                        variant="ghost"
                        className="opacity-0 group-hover/fila:opacity-100 focus-visible:opacity-100"
                        title={`Crear subcategoría en «${f.cat.nombre}»`}
                        aria-label={`Crear subcategoría en ${f.cat.nombre}`}
                        onClick={(e) => {
                          e.stopPropagation();
                          setCrearEn(f.cat);
                        }}
                        disabled={pending}
                      >
                        <Plus />
                      </Button>
                    ) : (
                      <span className="w-7" />
                    )}
                  </div>
                </div>
              );
            })}
          </div>

          <div className="flex items-center justify-between gap-2 border-t bg-muted/50 px-4 py-2 text-xs text-muted-foreground">
            <span className="whitespace-nowrap">
              <kbd className="rounded border bg-background px-1 font-mono">↑↓</kbd> navegar ·{" "}
              <kbd className="rounded border bg-background px-1 font-mono">Enter</kbd> elegir ·{" "}
              <kbd className="rounded border bg-background px-1 font-mono">Esc</kbd> cerrar
            </span>
            {permitirCrear && (
              <span className="hidden text-right sm:inline">
                <Plus className="inline size-3" /> en una fila crea una subcategoría ahí.
              </span>
            )}
          </div>
        </DialogContent>
      </Dialog>

      {permitirCrear && (
        <CategoriaFormDialog
          open={!!crearEn}
          onOpenChange={(o) => {
            if (!o) setCrearEn(null);
          }}
          mode="create"
          parentId={crearEn?.id ?? null}
          parentSku={crearEn?.codigoSku ?? null}
          onCreated={async (id) => {
            // Recargar la lista y elegir la recién creada.
            const data = await recargar();
            const nueva = data.find((c) => c.id === id);
            if (nueva) await elegir(nueva);
          }}
        />
      )}
    </>
  );
}
