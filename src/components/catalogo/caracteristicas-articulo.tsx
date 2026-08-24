"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Loader2, Plus, Tags, Trash2 } from "lucide-react";
import { toast } from "sonner";
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
import { TipoCaracteristicaPicker } from "@/components/catalogo/tipo-caracteristica-picker";
import { eliminarCaracteristica, guardarCaracteristica } from "@/app/catalogo/actions";
import type {
  CaracteristicaProductoVista,
  TipoCaracteristicaPlano,
} from "@/lib/caracteristicas-tipos";

type Props = {
  productoId: string;
  caracteristicas: CaracteristicaProductoVista[];
};

/**
 * Características del artículo: pares tipo → valor. Los tipos los crea el
 * usuario desde el selector y se comparten entre todos los artículos; el valor
 * es texto libre y se edita en la misma fila.
 */
export function CaracteristicasArticulo({ productoId, caracteristicas }: Props) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [pickerOpen, setPickerOpen] = useState(false);
  const [nuevoTipo, setNuevoTipo] = useState<TipoCaracteristicaPlano | null>(null);

  const accion = (fn: () => Promise<{ ok: boolean; error?: string }>, okMsg: string) =>
    startTransition(async () => {
      const res = await fn();
      if (res.ok) {
        toast.success(okMsg);
        router.refresh();
      } else {
        toast.error(res.error ?? "Error");
      }
    });

  return (
    <section>
      <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
        <h2 className="text-lg font-medium">Características</h2>
        <Button size="sm" variant="outline" onClick={() => setPickerOpen(true)} disabled={pending}>
          <Plus className="size-4" /> Agregar característica
        </Button>
      </div>

      {caracteristicas.length === 0 ? (
        <p className="rounded-lg border border-dashed p-6 text-center text-sm text-muted-foreground">
          Sin características cargadas. Son los datos técnicos del artículo (potencia, frecuencia,
          conector…) y el buscador del catálogo los usa para encontrarlo.
        </p>
      ) : (
        <div className="flex flex-col divide-y rounded-lg border">
          {caracteristicas.map((c) => (
            <FilaCaracteristica
              key={c.id}
              productoId={productoId}
              caracteristica={c}
              disabled={pending}
              onEliminar={() =>
                accion(() => eliminarCaracteristica(c.id), `«${c.tipoNombre}» eliminada`)
              }
            />
          ))}
        </div>
      )}

      <TipoCaracteristicaPicker
        open={pickerOpen}
        onOpenChange={setPickerOpen}
        usadosIds={caracteristicas.map((c) => c.tipoId)}
        onSelect={(tipo) => {
          setPickerOpen(false);
          setNuevoTipo(tipo);
        }}
      />

      <ValorDialog
        open={!!nuevoTipo}
        onOpenChange={(o) => {
          if (!o) setNuevoTipo(null);
        }}
        tipo={nuevoTipo}
        productoId={productoId}
        onDone={() => {
          setNuevoTipo(null);
          router.refresh();
        }}
      />
    </section>
  );
}

/** Una fila tipo → valor, con el valor editable en el lugar. */
function FilaCaracteristica({
  productoId,
  caracteristica,
  disabled,
  onEliminar,
}: {
  productoId: string;
  caracteristica: CaracteristicaProductoVista;
  disabled: boolean;
  onEliminar: () => void;
}) {
  const router = useRouter();
  const [valor, setValor] = useState(caracteristica.valor);
  const [pending, startTransition] = useTransition();

  function guardar() {
    const limpio = valor.trim();
    if (limpio === caracteristica.valor) return;
    if (!limpio) {
      // Vaciar el campo no borra la característica: para eso está la papelera.
      setValor(caracteristica.valor);
      return;
    }
    startTransition(async () => {
      const res = await guardarCaracteristica({
        productoId,
        tipoId: caracteristica.tipoId,
        valor: limpio,
      });
      if (res.ok) {
        toast.success(`«${caracteristica.tipoNombre}» actualizada`);
        router.refresh();
      } else {
        toast.error(res.error);
        setValor(caracteristica.valor);
      }
    });
  }

  return (
    <div className="flex items-center gap-3 px-3 py-2">
      <Tags className="size-4 shrink-0 text-muted-foreground" />
      <span className="w-44 shrink-0 truncate text-sm text-muted-foreground" title={caracteristica.tipoNombre}>
        {caracteristica.tipoNombre}
        {caracteristica.unidad && (
          <span className="ml-1 font-mono text-xs">({caracteristica.unidad})</span>
        )}
      </span>
      <Input
        value={valor}
        onChange={(e) => setValor(e.target.value)}
        onBlur={guardar}
        onKeyDown={(e) => {
          if (e.key === "Enter") {
            e.preventDefault();
            e.currentTarget.blur();
          } else if (e.key === "Escape") {
            setValor(caracteristica.valor);
          }
        }}
        className="h-8 flex-1"
        autoComplete="off"
        aria-label={`Valor de ${caracteristica.tipoNombre}`}
        disabled={disabled || pending}
      />
      {pending && <Loader2 className="size-4 shrink-0 animate-spin text-muted-foreground" />}
      <Button
        size="icon-sm"
        variant="ghost"
        onClick={onEliminar}
        disabled={disabled || pending}
        aria-label={`Eliminar ${caracteristica.tipoNombre}`}
        title="Quitar esta característica del artículo"
      >
        <Trash2 className="size-3.5" />
      </Button>
    </div>
  );
}

/** Pide el valor después de elegir el tipo en el selector. */
function ValorDialog({
  open,
  onOpenChange,
  tipo,
  productoId,
  onDone,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  tipo: TipoCaracteristicaPlano | null;
  productoId: string;
  onDone: () => void;
}) {
  const [valor, setValor] = useState("");
  const [pending, startTransition] = useTransition();
  const [prevOpen, setPrevOpen] = useState(open);

  if (open !== prevOpen) {
    setPrevOpen(open);
    if (open) setValor("");
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!tipo) return;
    startTransition(async () => {
      const res = await guardarCaracteristica({ productoId, tipoId: tipo.id, valor });
      if (!res.ok) {
        toast.error(res.error);
        return;
      }
      toast.success(`«${tipo.nombre}» cargada`);
      onOpenChange(false);
      onDone();
    });
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <form onSubmit={handleSubmit}>
          <DialogHeader>
            <DialogTitle>{tipo?.nombre}</DialogTitle>
            <DialogDescription>
              {tipo?.descripcion ?? "Valor de esta característica para el artículo."}
            </DialogDescription>
          </DialogHeader>

          <div className="my-4 flex flex-col gap-1.5">
            <Label htmlFor="caracteristica-valor">Valor</Label>
            <Input
              id="caracteristica-valor"
              value={valor}
              onChange={(e) => setValor(e.target.value)}
              placeholder={tipo?.unidad ? `3 ${tipo.unidad}` : "3 W"}
              autoComplete="off"
              autoFocus
              required
            />
            <p className="text-xs leading-snug text-muted-foreground">
              Texto libre. Si el artículo tiene más de un valor, separalos con comas.
            </p>
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)} disabled={pending}>
              Cancelar
            </Button>
            <Button type="submit" disabled={pending}>
              {pending && <Loader2 className="size-4 animate-spin" />}
              Guardar
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
