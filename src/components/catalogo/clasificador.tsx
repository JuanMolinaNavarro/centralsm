"use client";

import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useEffect, useMemo, useRef, useState, useTransition } from "react";
import {
  ArrowRightLeft,
  ChevronLeft,
  ChevronRight,
  Filter,
  Loader2,
  Package,
  Search,
  X,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { CategoriaPicker } from "@/components/catalogo/categoria-picker";
import { MoverArticulosDialog } from "@/components/catalogo/mover-articulos-dialog";
import { esSkuPendiente, type ArticuloClasificable, type CategoriaPlana } from "@/lib/catalogo-tipos";

export type FiltroUI = {
  q: string;
  cat: string;
  soloStock: boolean;
  orden: "nombre" | "stock" | "reciente";
};

type Props = {
  items: ArticuloClasificable[];
  total: number;
  pagina: number;
  paginas: number;
  tamano: number;
  filtro: FiltroUI;
  categorias: CategoriaPlana[];
  pendientes: number;
};

const ORDENES: { value: FiltroUI["orden"]; label: string }[] = [
  { value: "nombre", label: "Nombre (A→Z)" },
  { value: "stock", label: "Más stock primero" },
  { value: "reciente", label: "Clasificados recientemente" },
];

export function Clasificador({ items, total, pagina, paginas, tamano, filtro, categorias, pendientes }: Props) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [navegando, startTransition] = useTransition();

  const [q, setQ] = useState(filtro.q);
  const [prevFiltroQ, setPrevFiltroQ] = useState(filtro.q);
  const [seleccion, setSeleccion] = useState<Map<string, { categoriaId: string }>>(new Map());
  const [moverIds, setMoverIds] = useState<string[] | null>(null);
  const [filtroCatOpen, setFiltroCatOpen] = useState(false);
  const ultimoClick = useRef<number | null>(null);
  const [ultimoQEnviado, setUltimoQEnviado] = useState(filtro.q);

  // Sincronizar el input solo si el filtro cambia desde afuera (back/forward),
  // no cuando es el eco de lo que acabamos de escribir (evita pisar el tipeo).
  if (filtro.q !== prevFiltroQ) {
    setPrevFiltroQ(filtro.q);
    if (filtro.q !== ultimoQEnviado) setQ(filtro.q);
  }

  function navegar(cambios: Partial<Record<"q" | "cat" | "stock" | "orden" | "pagina", string | null>>) {
    const params = new URLSearchParams(searchParams.toString());
    for (const [k, v] of Object.entries(cambios)) {
      if (v === null || v === "" || v === undefined) params.delete(k);
      else params.set(k, v);
    }
    // Cualquier cambio de filtro vuelve a la primera página.
    if (!("pagina" in cambios)) params.delete("pagina");
    const qs = params.toString();
    startTransition(() => {
      router.replace(qs ? `${pathname}?${qs}` : pathname, { scroll: false });
    });
  }

  // Búsqueda con debounce.
  useEffect(() => {
    if (q === filtro.q) return;
    const t = window.setTimeout(() => {
      setUltimoQEnviado(q.trim());
      navegar({ q: q.trim() || null });
    }, 300);
    return () => window.clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [q]);

  const idsPagina = useMemo(() => items.map((i) => i.id), [items]);
  const seleccionadosEnPagina = idsPagina.filter((id) => seleccion.has(id)).length;
  const todosPagina = items.length > 0 && seleccionadosEnPagina === items.length;
  const algunosPagina = seleccionadosEnPagina > 0 && !todosPagina;

  function toggle(item: ArticuloClasificable, index: number, shift: boolean) {
    setSeleccion((prev) => {
      const next = new Map(prev);
      const marcar = !prev.has(item.id);
      if (shift && ultimoClick.current !== null) {
        const [a, b] = [ultimoClick.current, index].sort((x, y) => x - y);
        for (let i = a; i <= b; i++) {
          const it = items[i];
          if (marcar) next.set(it.id, { categoriaId: it.categoriaId });
          else next.delete(it.id);
        }
      } else if (marcar) {
        next.set(item.id, { categoriaId: item.categoriaId });
      } else {
        next.delete(item.id);
      }
      return next;
    });
    ultimoClick.current = index;
  }

  function togglePagina() {
    setSeleccion((prev) => {
      const next = new Map(prev);
      if (todosPagina) for (const id of idsPagina) next.delete(id);
      else for (const it of items) next.set(it.id, { categoriaId: it.categoriaId });
      return next;
    });
  }

  const categoriaFiltro =
    filtro.cat === "pendientes" || filtro.cat === "todas"
      ? null
      : (categorias.find((c) => c.id === filtro.cat) ?? null);

  const actualesSeleccion = useMemo(
    () => Array.from(new Set(Array.from(seleccion.values()).map((v) => v.categoriaId))),
    [seleccion],
  );

  const desde = total === 0 ? 0 : (pagina - 1) * tamano + 1;
  const hasta = Math.min(pagina * tamano, total);

  return (
    <div className="flex flex-col gap-4">
      {/* Filtros */}
      <div className="flex flex-col gap-3">
        <div className="flex flex-wrap items-center gap-2">
          <div className="relative min-w-64 flex-1">
            <Search className="pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Buscar por nombre, SKU o código Teamplace… (varias palabras = todas deben aparecer)"
              className="h-9 pl-8 pr-8"
              autoComplete="off"
              aria-label="Buscar artículos"
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

          <select
            value={filtro.orden}
            onChange={(e) => navegar({ orden: e.target.value === "nombre" ? null : e.target.value })}
            className="h-9 rounded-lg border border-input bg-transparent px-2.5 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 dark:bg-input/30"
            aria-label="Orden"
          >
            {ORDENES.map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
          </select>

          <label className="flex h-9 cursor-pointer items-center gap-2 rounded-lg border border-input px-3 text-sm select-none">
            <input
              type="checkbox"
              checked={filtro.soloStock}
              onChange={(e) => navegar({ stock: e.target.checked ? "1" : null })}
              className="size-4 rounded border-input accent-primary"
            />
            Solo con stock
          </label>
        </div>

        <div className="flex flex-wrap items-center gap-2 text-sm">
          <span className="flex items-center gap-1 text-muted-foreground">
            <Filter className="size-3.5" /> Mostrar:
          </span>
          <Chip activo={filtro.cat === "pendientes"} onClick={() => navegar({ cat: null })}>
            Pendientes de clasificar
            <Badge variant={filtro.cat === "pendientes" ? "default" : "secondary"} className="ml-1 tabular-nums">
              {pendientes.toLocaleString("es-AR")}
            </Badge>
          </Chip>
          <Chip activo={filtro.cat === "todas"} onClick={() => navegar({ cat: "todas" })}>
            Todo el catálogo
          </Chip>
          <Chip activo={!!categoriaFiltro} onClick={() => setFiltroCatOpen(true)}>
            {categoriaFiltro ? (
              <>
                <span className="font-mono text-xs">{categoriaFiltro.codigoSku}</span>
                <span className="max-w-48 truncate">{categoriaFiltro.nombre}</span>
                <span
                  role="button"
                  aria-label="Quitar filtro de categoría"
                  className="ml-0.5 rounded hover:bg-foreground/10"
                  onClick={(e) => {
                    e.stopPropagation();
                    navegar({ cat: null });
                  }}
                >
                  <X className="size-3.5" />
                </span>
              </>
            ) : (
              "Una categoría…"
            )}
          </Chip>
          <span className="ml-auto flex items-center gap-2 text-muted-foreground tabular-nums">
            {navegando && <Loader2 className="size-3.5 animate-spin" />}
            {total === 0
              ? "Sin resultados"
              : `${desde.toLocaleString("es-AR")}–${hasta.toLocaleString("es-AR")} de ${total.toLocaleString("es-AR")}`}
          </span>
        </div>
      </div>

      {/* Tabla */}
      <div className={cn("overflow-hidden rounded-lg border", navegando && "opacity-70 transition-opacity")}>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-10">
                <input
                  type="checkbox"
                  checked={todosPagina}
                  ref={(el) => {
                    if (el) el.indeterminate = algunosPagina;
                  }}
                  onChange={togglePagina}
                  disabled={items.length === 0}
                  aria-label="Seleccionar todos los de esta página"
                  className="size-4 rounded border-input accent-primary"
                />
              </TableHead>
              <TableHead>Artículo</TableHead>
              <TableHead className="hidden md:table-cell">Código Teamplace</TableHead>
              <TableHead>Categoría actual</TableHead>
              <TableHead className="text-right">Stock</TableHead>
              <TableHead className="w-24" />
            </TableRow>
          </TableHeader>
          <TableBody>
            {items.length === 0 && (
              <TableRow>
                <TableCell colSpan={6} className="py-12 text-center text-sm text-muted-foreground">
                  {filtro.cat === "pendientes" && !filtro.q && !filtro.soloStock
                    ? "🎉 No quedan artículos pendientes de clasificar."
                    : "Ningún artículo coincide con el filtro."}
                </TableCell>
              </TableRow>
            )}
            {items.map((it, index) => {
              const marcado = seleccion.has(it.id);
              const pendiente = esSkuPendiente(it.categoriaSku);
              const sinStock = it.cantidadStock <= 0;
              return (
                <TableRow
                  key={it.id}
                  data-state={marcado ? "selected" : undefined}
                  className={cn("cursor-default", marcado && "bg-muted/60")}
                  onClick={(e) => {
                    // Clic en la fila (fuera de links/botones) alterna la selección.
                    const target = e.target as HTMLElement;
                    if (target.closest("a,button,input")) return;
                    toggle(it, index, e.shiftKey);
                  }}
                >
                  <TableCell>
                    <input
                      type="checkbox"
                      checked={marcado}
                      onChange={() => {}}
                      onClick={(e) => toggle(it, index, (e as React.MouseEvent).shiftKey)}
                      aria-label={`Seleccionar ${it.nombre}`}
                      className="size-4 rounded border-input accent-primary"
                    />
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center gap-3">
                      <div className="flex size-9 shrink-0 items-center justify-center overflow-hidden rounded-md border bg-muted">
                        {it.imagenUrl ? (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img src={it.imagenUrl} alt="" className="size-full object-cover" />
                        ) : (
                          <Package className="size-4 text-muted-foreground/50" />
                        )}
                      </div>
                      <div className="flex min-w-0 flex-col">
                        <Link
                          href={`/catalogo/articulo/${it.id}`}
                          className="truncate font-medium hover:underline"
                          title={it.nombre}
                        >
                          {it.nombre}
                        </Link>
                        <span className="truncate font-mono text-xs text-muted-foreground">
                          {it.codigoSku}
                          {it.estado === "INACTIVO" && " · inactivo"}
                        </span>
                      </div>
                    </div>
                  </TableCell>
                  <TableCell className="hidden font-mono text-xs text-muted-foreground md:table-cell">
                    {it.teamplaceCodigo ?? "—"}
                  </TableCell>
                  <TableCell>
                    <Link
                      href={`/catalogo/${it.categoriaId}`}
                      className="flex w-fit items-center gap-1.5 hover:underline"
                      title={it.categoriaNombre}
                    >
                      <Badge
                        variant={pendiente ? "outline" : "secondary"}
                        className={cn("font-mono text-[11px]", pendiente && "border-amber-500/50 text-amber-700 dark:text-amber-400")}
                      >
                        {it.categoriaSku}
                      </Badge>
                      <span className="max-w-40 truncate text-xs text-muted-foreground">{it.categoriaNombre}</span>
                    </Link>
                  </TableCell>
                  <TableCell className={cn("text-right text-sm tabular-nums", sinStock && "text-muted-foreground")}>
                    {it.cantidadStock.toLocaleString("es-AR")}{" "}
                    <span className="text-xs text-muted-foreground">{it.unidadStock}</span>
                  </TableCell>
                  <TableCell className="text-right">
                    <Button size="sm" variant="outline" onClick={() => setMoverIds([it.id])}>
                      <ArrowRightLeft /> Mover
                    </Button>
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </div>

      {/* Paginación */}
      {paginas > 1 && (
        <div className="flex items-center justify-between gap-2 text-sm">
          <span className="text-muted-foreground">
            Página {pagina} de {paginas}
            {seleccion.size > 0 && " · la selección se mantiene al cambiar de página"}
          </span>
          <div className="flex gap-1">
            <Button
              size="sm"
              variant="outline"
              disabled={pagina <= 1 || navegando}
              onClick={() => navegar({ pagina: String(pagina - 1) })}
            >
              <ChevronLeft /> Anterior
            </Button>
            <Button
              size="sm"
              variant="outline"
              disabled={pagina >= paginas || navegando}
              onClick={() => navegar({ pagina: String(pagina + 1) })}
            >
              Siguiente <ChevronRight />
            </Button>
          </div>
        </div>
      )}

      {/* Barra de acción flotante */}
      {seleccion.size > 0 && (
        <div className="pointer-events-none fixed inset-x-0 bottom-6 z-40 flex justify-center px-4">
          <div className="pointer-events-auto flex items-center gap-3 rounded-full border bg-popover px-4 py-2 text-sm shadow-lg ring-1 ring-foreground/10">
            <span className="font-medium tabular-nums">
              {seleccion.size === 1 ? "1 artículo seleccionado" : `${seleccion.size} artículos seleccionados`}
            </span>
            <Button size="sm" variant="ghost" onClick={() => setSeleccion(new Map())}>
              Limpiar
            </Button>
            <Button size="sm" onClick={() => setMoverIds(Array.from(seleccion.keys()))}>
              <ArrowRightLeft /> Mover a…
            </Button>
          </div>
        </div>
      )}

      <MoverArticulosDialog
        open={moverIds !== null}
        onOpenChange={(o) => {
          if (!o) setMoverIds(null);
        }}
        ids={moverIds ?? []}
        actualesIds={
          moverIds && moverIds.length === 1
            ? [items.find((i) => i.id === moverIds[0])?.categoriaId ?? ""]
            : actualesSeleccion
        }
        etiqueta={
          moverIds && moverIds.length === 1
            ? `«${items.find((i) => i.id === moverIds[0])?.nombre ?? "artículo"}»`
            : undefined
        }
        categorias={categorias}
        onMoved={(res) => {
          // Sacar de la selección los que se movieron.
          setSeleccion((prev) => {
            const next = new Map(prev);
            for (const a of res.anterior) next.delete(a.id);
            for (const id of moverIds ?? []) next.delete(id);
            return next;
          });
        }}
      />

      <CategoriaPicker
        open={filtroCatOpen}
        onOpenChange={setFiltroCatOpen}
        titulo="Filtrar por categoría"
        descripcion="Se muestran los artículos de la categoría elegida y de todas sus subcategorías."
        categorias={categorias}
        permitirCrear={false}
        onSelect={(cat) => {
          setFiltroCatOpen(false);
          navegar({ cat: cat.id });
        }}
      />
    </div>
  );
}

function Chip({
  activo,
  onClick,
  children,
}: {
  activo: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={activo}
      className={cn(
        "flex h-8 items-center gap-1.5 rounded-full border px-3 text-sm transition-colors",
        activo
          ? "border-foreground/30 bg-foreground/5 font-medium"
          : "text-muted-foreground hover:border-foreground/20 hover:text-foreground",
      )}
    >
      {children}
    </button>
  );
}
