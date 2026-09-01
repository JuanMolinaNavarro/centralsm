"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Loader2, Plus, Tags, Trash2 } from "lucide-react";
import { toast } from "sonner";
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
import { TipoCaracteristicaPicker } from "@/components/catalogo/tipo-caracteristica-picker";
import {
  eliminarCaracteristica,
  guardarCaracteristica,
  quitarTipoDeFamilia,
} from "@/app/catalogo/actions";
import type {
  CaracteristicaFichaVista,
  TipoCaracteristicaPlano,
} from "@/lib/caracteristicas-tipos";

type Props = {
  productoId: string;
  categoriaId: string;
  caracteristicas: CaracteristicaFichaVista[];
};

/**
 * Características del artículo: los tipos de la familia (la categoría del
 * artículo, compartidos con los hermanos, con valor opcional) más las
 * huérfanas (valores propios cuyo tipo quedó fuera de la familia). Agregar un
 * tipo acá lo asocia a la familia entera.
 */
export function CaracteristicasArticulo({ productoId, categoriaId, caracteristicas }: Props) {
  const router = useRouter();
  const [pickerOpen, setPickerOpen] = useState(false);
  const [nuevoTipo, setNuevoTipo] = useState<TipoCaracteristicaPlano | null>(null);

  return (
    <section>
      <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
        <h2 className="text-lg font-medium">Características</h2>
        <Button size="sm" variant="outline" onClick={() => setPickerOpen(true)}>
          <Plus className="size-4" /> Agregar característica
        </Button>
      </div>

      {caracteristicas.length === 0 ? (
        <p className="rounded-lg border border-dashed p-6 text-center text-sm text-muted-foreground">
          Sin características cargadas. Son los datos técnicos del artículo (potencia, frecuencia,
          conector…): el buscador del catálogo los usa para encontrarlo, y cada tipo que agregues
          queda asociado a esta categoría y aparece también en los artículos hermanos.
        </p>
      ) : (
        <div className="flex flex-col divide-y rounded-lg border">
          {caracteristicas.map((c) => (
            <FilaCaracteristica
              key={c.tipoId}
              productoId={productoId}
              categoriaId={categoriaId}
              caracteristica={c}
            />
          ))}
        </div>
      )}

      <TipoCaracteristicaPicker
        open={pickerOpen}
        onOpenChange={setPickerOpen}
        usadosIds={caracteristicas.map((c) => c.tipoId)}
        familiaIds={caracteristicas.filter((c) => c.enFamilia).map((c) => c.tipoId)}
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

/**
 * Una fila tipo → valor, con el valor editable en el lugar. Cada fila es dueña
 * de todas sus acciones (guardar / borrar valor / quitar de la familia) con un
 * único `useTransition`: guardar y borrar de la misma fila nunca corren en
 * paralelo, y una acción ajena no deshabilita este input (deshabilitar un
 * input con foco dispara `blur` → guardado espurio, que era el bug que
 * "resucitaba" características borradas).
 */
function FilaCaracteristica({
  productoId,
  categoriaId,
  caracteristica,
}: {
  productoId: string;
  categoriaId: string;
  caracteristica: CaracteristicaFichaVista;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [confirmOpen, setConfirmOpen] = useState(false);

  // El input se resincroniza cuando el server component refresca el prop
  // (patrón render-time; sin esto el guard de guardar() compara contra un
  // valor rancio y un blur inocente dispara un upsert).
  const [prevValor, setPrevValor] = useState(caracteristica.valor);
  const [valor, setValor] = useState(caracteristica.valor);
  if (caracteristica.valor !== prevValor) {
    setPrevValor(caracteristica.valor);
    setValor(caracteristica.valor);
  }

  function guardar() {
    if (pending) return;
    const limpio = valor.trim();
    if (limpio === caracteristica.valor) return;
    startTransition(async () => {
      const res = await guardarCaracteristica({
        productoId,
        tipoId: caracteristica.tipoId,
        valor: limpio,
      });
      if (res.ok) {
        toast.success(
          limpio
            ? `«${caracteristica.tipoNombre}» actualizada`
            : `Valor de «${caracteristica.tipoNombre}» borrado`,
        );
        router.refresh();
      } else {
        toast.error(res.error);
        setValor(caracteristica.valor);
      }
    });
  }

  const familiaVacia = caracteristica.enFamilia && caracteristica.id === null;

  function onTacho() {
    if (pending) return;
    if (familiaVacia) {
      // Fila de familia sin valor: el tacho quita el tipo de toda la familia.
      setConfirmOpen(true);
      return;
    }
    startTransition(async () => {
      const res = caracteristica.enFamilia
        ? // Borra solo el valor del artículo; el tipo sigue en la familia.
          await guardarCaracteristica({ productoId, tipoId: caracteristica.tipoId, valor: "" })
        : await eliminarCaracteristica(caracteristica.id!);
      if (res.ok) {
        toast.success(
          caracteristica.enFamilia
            ? `Valor de «${caracteristica.tipoNombre}» borrado`
            : `«${caracteristica.tipoNombre}» eliminada`,
        );
        router.refresh();
      } else {
        toast.error(res.error);
      }
    });
  }

  const tituloTacho = familiaVacia
    ? `Quitar «${caracteristica.tipoNombre}» de toda la familia`
    : caracteristica.enFamilia
      ? "Borrar el valor de este artículo (el tipo sigue en la familia)"
      : "Quitar esta característica del artículo";

  return (
    <div className="flex items-center gap-3 px-3 py-2">
      <Tags className="size-4 shrink-0 text-muted-foreground" />
      <span
        className="w-44 shrink-0 truncate text-sm text-muted-foreground"
        title={caracteristica.tipoNombre}
      >
        {caracteristica.tipoNombre}
        {caracteristica.unidad && (
          <span className="ml-1 font-mono text-xs">({caracteristica.unidad})</span>
        )}
      </span>
      {!caracteristica.enFamilia && (
        <Badge
          variant="outline"
          className="shrink-0 font-normal text-muted-foreground"
          title="Cargada cuando el artículo estaba en otra categoría; guardar un valor la incorpora a esta familia."
        >
          Fuera de familia
        </Badge>
      )}
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
        placeholder={caracteristica.unidad ? `p. ej. 3 ${caracteristica.unidad}` : "Sin valor"}
        className="h-8 flex-1"
        autoComplete="off"
        aria-label={`Valor de ${caracteristica.tipoNombre}`}
        disabled={pending}
      />
      {pending && <Loader2 className="size-4 shrink-0 animate-spin text-muted-foreground" />}
      <Button
        size="icon-sm"
        variant="ghost"
        onClick={onTacho}
        // Sin preventDefault, el clic robaría el foco del input y el blur
        // dispararía un guardado en paralelo con el borrado (carrera que
        // recreaba la fila recién eliminada).
        onPointerDown={(e) => e.preventDefault()}
        disabled={pending}
        aria-label={tituloTacho}
        title={tituloTacho}
      >
        <Trash2 className="size-3.5" />
      </Button>

      <ConfirmDialog
        open={confirmOpen}
        onOpenChange={setConfirmOpen}
        title={`Quitar «${caracteristica.tipoNombre}» de la familia`}
        description={
          caracteristica.valoresEnFamilia > 0
            ? `Se va a borrar el valor cargado en ${caracteristica.valoresEnFamilia} ${
                caracteristica.valoresEnFamilia === 1 ? "artículo" : "artículos"
              } de esta categoría. No se puede deshacer.`
            : "Ningún artículo de la categoría tiene valor cargado; el tipo simplemente deja de ofrecerse en esta familia."
        }
        confirmLabel="Quitar de la familia"
        action={() => quitarTipoDeFamilia(categoriaId, caracteristica.tipoId)}
        onDone={() => router.refresh()}
      />
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
    if (!tipo || pending) return;
    startTransition(async () => {
      const res = await guardarCaracteristica({ productoId, tipoId: tipo.id, valor });
      if (!res.ok) {
        toast.error(res.error);
        return;
      }
      toast.success(
        valor.trim()
          ? `«${tipo.nombre}» cargada`
          : `«${tipo.nombre}» asociada a la familia (sin valor)`,
      );
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
            />
            <p className="text-xs leading-snug text-muted-foreground">
              Texto libre; si el artículo tiene más de un valor, separalos con comas. Opcional:
              dejalo vacío para asociar el tipo a la familia (todos los hermanos lo ven) sin cargar
              valor todavía.
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
