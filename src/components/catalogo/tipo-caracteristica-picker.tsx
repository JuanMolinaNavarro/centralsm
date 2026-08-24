"use client";

import { useEffect, useMemo, useRef, useState, useTransition } from "react";
import { Check, Loader2, Pencil, Plus, Search, Tags, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ConfirmDialog } from "@/components/catalogo/confirm-dialog";
import {
  actualizarTipoCaracteristica,
  crearTipoCaracteristica,
  eliminarTipoCaracteristica,
  listarTiposCaracteristica,
} from "@/app/catalogo/actions";
import { normalizarBusqueda } from "@/lib/busqueda";
import type { TipoCaracteristicaPlano } from "@/lib/caracteristicas-tipos";

// Caché de la lista para no volver a pedirla en cada apertura.
let cacheTipos: TipoCaracteristicaPlano[] | null = null;

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Tipos ya cargados en el artículo: se marcan y no se pueden elegir. */
  usadosIds?: string[];
  onSelect: (tipo: TipoCaracteristicaPlano) => void | Promise<void>;
  pending?: boolean;
};

/**
 * Selector de tipo de característica ("Potencia", "Conector"…) con búsqueda
 * normalizada, navegación por teclado (↑ ↓ Enter) y administración inline:
 * desde acá se crean, se renombran y se eliminan los tipos, así que no hace
 * falta una pantalla aparte.
 */
export function TipoCaracteristicaPicker({
  open,
  onOpenChange,
  usadosIds,
  onSelect,
  pending = false,
}: Props) {
  const [listaLocal, setListaLocal] = useState<TipoCaracteristicaPlano[] | null>(null);
  const [cargando, startCarga] = useTransition();
  const [q, setQ] = useState("");
  const [activo, setActivo] = useState(0);
  const [editando, setEditando] = useState<TipoCaracteristicaPlano | null>(null);
  const [creando, setCreando] = useState(false);
  const [borrando, setBorrando] = useState<TipoCaracteristicaPlano | null>(null);
  const [prevOpen, setPrevOpen] = useState(open);
  const inputRef = useRef<HTMLInputElement>(null);
  const listaRef = useRef<HTMLDivElement>(null);

  // Reiniciar el estado al abrir (ajuste durante el render, sin efecto).
  if (open !== prevOpen) {
    setPrevOpen(open);
    if (open) {
      setQ("");
      setActivo(0);
      setListaLocal(null);
    }
  }

  const lista = listaLocal ?? cacheTipos;
  const usados = useMemo(() => new Set(usadosIds ?? []), [usadosIds]);

  function recargar(): Promise<TipoCaracteristicaPlano[]> {
    return new Promise((resolve) => {
      startCarga(async () => {
        const data = await listarTiposCaracteristica();
        cacheTipos = data;
        setListaLocal(data);
        resolve(data);
      });
    });
  }

  useEffect(() => {
    if (!open) return;
    void recargar();
    const t = window.setTimeout(() => inputRef.current?.focus(), 30);
    return () => window.clearTimeout(t);
  }, [open]);

  const filas = useMemo(() => {
    if (!lista) return [];
    const tokens = q.trim().split(/\s+/).map(normalizarBusqueda).filter(Boolean);
    if (!tokens.length) return lista;
    return lista.filter((t) => {
      const nombre = normalizarBusqueda(t.nombre);
      const unidad = normalizarBusqueda(t.unidad ?? "");
      return tokens.every((tok) => nombre.includes(tok) || unidad.includes(tok));
    });
  }, [lista, q]);

  /** ¿El texto tipeado ya existe como tipo? Si no, se ofrece crearlo. */
  const clave = normalizarBusqueda(q);
  const hayExacto = !!lista?.some((t) => normalizarBusqueda(t.nombre) === clave);
  const puedeCrear = clave.length > 0 && !hayExacto;

  useEffect(() => {
    listaRef.current?.querySelector<HTMLElement>(`[data-index="${activo}"]`)?.scrollIntoView({
      block: "nearest",
    });
  }, [activo]);

  async function elegir(tipo: TipoCaracteristicaPlano) {
    if (pending || usados.has(tipo.id)) return;
    await onSelect(tipo);
  }

  function onKeyDown(e: React.KeyboardEvent) {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setActivo((i) => Math.min(i + 1, Math.max(filas.length - 1, 0)));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setActivo((i) => Math.max(i - 1, 0));
    } else if (e.key === "Home") {
      e.preventDefault();
      setActivo(0);
    } else if (e.key === "End") {
      e.preventDefault();
      setActivo(Math.max(filas.length - 1, 0));
    } else if (e.key === "Enter") {
      e.preventDefault();
      const f = filas[activo];
      if (f) void elegir(f);
      else if (puedeCrear) setCreando(true);
    }
  }

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="gap-3 p-0 sm:max-w-lg" showCloseButton={false}>
          <DialogHeader className="px-4 pt-4">
            <DialogTitle>Elegir característica</DialogTitle>
            <DialogDescription>
              Buscá un tipo ya existente o creá uno nuevo. Los tipos se comparten entre todos los
              artículos del catálogo.
            </DialogDescription>
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
              placeholder="Buscar por nombre o unidad…"
              className="h-9 pl-8"
              autoComplete="off"
              spellCheck={false}
              aria-label="Buscar tipo de característica"
              disabled={pending}
            />
            {(pending || cargando) && (
              <Loader2 className="absolute top-1/2 right-6.5 size-4 -translate-y-1/2 animate-spin text-muted-foreground" />
            )}
          </div>

          <div
            ref={listaRef}
            role="listbox"
            aria-label="Tipos de característica"
            className="max-h-[min(60vh,26rem)] overflow-y-auto border-t"
          >
            {!lista && (
              <p className="px-4 py-8 text-center text-sm text-muted-foreground">Cargando tipos…</p>
            )}
            {lista && filas.length === 0 && !puedeCrear && (
              <p className="px-4 py-8 text-center text-sm text-muted-foreground">
                Todavía no hay tipos de característica. Escribí un nombre para crear el primero.
              </p>
            )}
            {filas.map((t, i) => {
              const esUsado = usados.has(t.id);
              const esActivo = i === activo;
              return (
                <div
                  key={t.id}
                  role="option"
                  aria-selected={esActivo}
                  aria-disabled={esUsado || pending}
                  data-index={i}
                  onMouseEnter={() => setActivo(i)}
                  onClick={() => void elegir(t)}
                  className={cn(
                    "group/fila flex cursor-pointer items-center gap-2 px-4 py-1.5 text-sm",
                    esActivo && "bg-muted",
                    (esUsado || pending) && "cursor-default opacity-60",
                  )}
                >
                  <Tags className="size-4 shrink-0 text-muted-foreground" />
                  <div className="flex min-w-0 flex-1 flex-col">
                    <span className="truncate font-medium">{t.nombre}</span>
                    {t.descripcion && (
                      <span className="truncate text-xs text-muted-foreground">{t.descripcion}</span>
                    )}
                  </div>
                  {t.unidad && (
                    <Badge variant="secondary" className="shrink-0 font-mono text-[11px]">
                      {t.unidad}
                    </Badge>
                  )}
                  <span className="hidden text-xs text-muted-foreground tabular-nums sm:inline">
                    {t.usos} art.
                  </span>
                  {esUsado ? (
                    <span className="flex w-14 items-center justify-center" title="Ya cargada en este artículo">
                      <Check className="size-4 text-muted-foreground" />
                    </span>
                  ) : (
                    <span className="flex w-14 gap-1 opacity-0 group-hover/fila:opacity-100 focus-within:opacity-100">
                      <Button
                        size="icon-xs"
                        variant="ghost"
                        title={`Editar «${t.nombre}»`}
                        aria-label={`Editar ${t.nombre}`}
                        onClick={(e) => {
                          e.stopPropagation();
                          setEditando(t);
                        }}
                        disabled={pending}
                      >
                        <Pencil />
                      </Button>
                      <Button
                        size="icon-xs"
                        variant="ghost"
                        title={`Eliminar «${t.nombre}»`}
                        aria-label={`Eliminar ${t.nombre}`}
                        onClick={(e) => {
                          e.stopPropagation();
                          setBorrando(t);
                        }}
                        disabled={pending}
                      >
                        <Trash2 />
                      </Button>
                    </span>
                  )}
                </div>
              );
            })}

            {puedeCrear && (
              <div
                onClick={() => setCreando(true)}
                className="flex cursor-pointer items-center gap-2 border-t px-4 py-2 text-sm text-primary"
              >
                <Plus className="size-4 shrink-0" />
                Crear «{q.trim()}» como tipo de característica
              </div>
            )}
          </div>

          <div className="border-t bg-muted/50 px-4 py-2 text-xs text-muted-foreground">
            <kbd className="rounded border bg-background px-1 font-mono">↑↓</kbd> navegar ·{" "}
            <kbd className="rounded border bg-background px-1 font-mono">Enter</kbd> elegir ·{" "}
            <kbd className="rounded border bg-background px-1 font-mono">Esc</kbd> cerrar
          </div>
        </DialogContent>
      </Dialog>

      <TipoFormDialog
        open={creando}
        onOpenChange={setCreando}
        nombreInicial={q.trim()}
        onDone={async (id) => {
          const data = await recargar();
          const nuevo = data.find((t) => t.id === id);
          if (nuevo) await elegir(nuevo);
        }}
      />

      <TipoFormDialog
        open={!!editando}
        onOpenChange={(o) => {
          if (!o) setEditando(null);
        }}
        tipo={editando}
        onDone={async () => {
          setEditando(null);
          await recargar();
        }}
      />

      <ConfirmDialog
        open={!!borrando}
        onOpenChange={(o) => {
          if (!o) setBorrando(null);
        }}
        title={`Eliminar «${borrando?.nombre}»`}
        description={
          borrando && borrando.usos > 0
            ? `Se va a borrar también el valor cargado en ${borrando.usos} artículo${borrando.usos === 1 ? "" : "s"}. No se puede deshacer.`
            : "Este tipo no lo usa ningún artículo. No se puede deshacer."
        }
        action={() => eliminarTipoCaracteristica(borrando!.id)}
        onDone={() => {
          setBorrando(null);
          void recargar();
        }}
      />
    </>
  );
}

/** Alta/edición de un tipo de característica. */
function TipoFormDialog({
  open,
  onOpenChange,
  tipo,
  nombreInicial = "",
  onDone,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  tipo?: TipoCaracteristicaPlano | null;
  nombreInicial?: string;
  onDone: (id?: string) => void | Promise<void>;
}) {
  const [nombre, setNombre] = useState("");
  const [unidad, setUnidad] = useState("");
  const [descripcion, setDescripcion] = useState("");
  const [pending, startTransition] = useTransition();
  const [prevOpen, setPrevOpen] = useState(open);

  if (open !== prevOpen) {
    setPrevOpen(open);
    if (open) {
      setNombre(tipo?.nombre ?? nombreInicial);
      setUnidad(tipo?.unidad ?? "");
      setDescripcion(tipo?.descripcion ?? "");
    }
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    startTransition(async () => {
      const input = { nombre, unidad, descripcion };
      const res = tipo
        ? await actualizarTipoCaracteristica(tipo.id, input)
        : await crearTipoCaracteristica(input);
      if (!res.ok) {
        toast.error(res.error);
        return;
      }
      toast.success(tipo ? "Tipo actualizado" : `Tipo «${nombre}» creado`);
      onOpenChange(false);
      await onDone(res.id);
    });
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <form onSubmit={handleSubmit}>
          <DialogHeader>
            <DialogTitle>{tipo ? "Editar característica" : "Nueva característica"}</DialogTitle>
            <DialogDescription>
              El nombre es el atributo («Potencia»), no el valor. La unidad es opcional y se sugiere
              al cargar el valor.
            </DialogDescription>
          </DialogHeader>

          <div className="my-4 flex flex-col gap-4">
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="tipo-nombre">Nombre</Label>
              <Input
                id="tipo-nombre"
                value={nombre}
                onChange={(e) => setNombre(e.target.value)}
                placeholder="Potencia"
                autoComplete="off"
                required
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="tipo-unidad">Unidad (opcional)</Label>
              <Input
                id="tipo-unidad"
                value={unidad}
                onChange={(e) => setUnidad(e.target.value)}
                placeholder="W"
                autoComplete="off"
              />
              <p className="text-xs leading-snug text-muted-foreground">
                Buscar «3 W» también encuentra artículos cargados con el valor «3» y unidad «W».
              </p>
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="tipo-descripcion">Descripción (opcional)</Label>
              <Input
                id="tipo-descripcion"
                value={descripcion}
                onChange={(e) => setDescripcion(e.target.value)}
                placeholder="Potencia de transmisión declarada por el fabricante"
                autoComplete="off"
              />
            </div>
          </div>

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              disabled={pending}
            >
              Cancelar
            </Button>
            <Button type="submit" disabled={pending}>
              {pending && <Loader2 className="size-4 animate-spin" />}
              {tipo ? "Guardar" : "Crear"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
