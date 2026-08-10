"use client";

import Link from "next/link";
import { useEffect, useState, useTransition } from "react";
import { Loader2 } from "lucide-react";
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
import { Textarea } from "@/components/ui/textarea";
import { ImageUpload } from "@/components/catalogo/image-upload";
import { PushStatus, usePushStatus } from "@/components/productos/push-status";
import { crearProducto, actualizarProducto } from "@/app/catalogo/actions";

type ProductoData = {
  id: string;
  nombre: string;
  descripcion: string | null;
  estado: "ACTIVO" | "INACTIVO";
  cantidadStock: number;
  unidadStock: string;
  lugar: string | null;
  imagenUrl: string | null;
};

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  mode: "create" | "edit";
  categoriaId: string;
  categoriaSku: string;
  producto?: ProductoData;
};

export function ArticuloFormDialog({
  open,
  onOpenChange,
  mode,
  categoriaId,
  categoriaSku,
  producto,
}: Props) {
  const [nombre, setNombre] = useState("");
  const [descripcion, setDescripcion] = useState("");
  const [estado, setEstado] = useState<"ACTIVO" | "INACTIVO">("ACTIVO");
  const [cantidadStock, setCantidadStock] = useState("0");
  const [unidadStock, setUnidadStock] = useState("UNI");
  const [lugar, setLugar] = useState("");
  const [imagenUrl, setImagenUrl] = useState<string | null>(null);
  const [pushFinnegans, setPushFinnegans] = useState(false);
  const [finnegansCodigo, setFinnegansCodigo] = useState("");
  const [jobId, setJobId] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const { estado: estadoPush, error: errorPush, enCurso } = usePushStatus(jobId, (final) => {
    if (final === "SINCRONIZADO") toast.success("Producto creado en Finnegans Go");
    else toast.error("El alta en Finnegans Go falló");
  });

  useEffect(() => {
    if (open) {
      setNombre(producto?.nombre ?? "");
      setDescripcion(producto?.descripcion ?? "");
      setEstado(producto?.estado ?? "ACTIVO");
      setCantidadStock(String(producto?.cantidadStock ?? 0));
      setUnidadStock(producto?.unidadStock ?? "UNI");
      setLugar(producto?.lugar ?? "");
      setImagenUrl(producto?.imagenUrl ?? null);
      setPushFinnegans(false);
      setFinnegansCodigo("");
      setJobId(null);
    }
  }, [open, producto]);

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    startTransition(async () => {
      const payload = {
        nombre,
        descripcion,
        estado,
        cantidadStock: Number(cantidadStock) || 0,
        unidadStock,
        lugar,
        imagenUrl,
      };
      const res =
        mode === "create"
          ? await crearProducto({
              ...payload,
              categoriaId,
              pushFinnegans,
              finnegansCodigo: pushFinnegans ? finnegansCodigo : null,
            })
          : await actualizarProducto(producto!.id, { ...payload, categoriaId });
      if (res.ok) {
        toast.success(mode === "create" ? "Artículo creado" : "Artículo actualizado");
        // Si se pidió el alta en Finnegans, dejamos el diálogo abierto para
        // mostrar el progreso del bot; si no, lo cerramos como siempre.
        if (res.jobId) setJobId(res.jobId);
        else onOpenChange(false);
      } else {
        toast.error(res.error);
      }
    });
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{mode === "create" ? "Nuevo artículo" : "Editar artículo"}</DialogTitle>
          <DialogDescription>
            {mode === "create" ? (
              <>
                Código base: <span className="font-mono">{categoriaSku}-XXXX</span> (correlativo
                automático).
              </>
            ) : (
              "Modificá los datos del artículo."
            )}
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          <div className="flex flex-col gap-2">
            <Label htmlFor="art-nombre">Nombre</Label>
            <Input
              id="art-nombre"
              value={nombre}
              onChange={(e) => setNombre(e.target.value)}
              placeholder="Ej: Fibra ADSS 12 Pelos"
              required
            />
          </div>

          <div className="flex flex-col gap-2">
            <Label htmlFor="art-desc">Breve descripción</Label>
            <Textarea
              id="art-desc"
              value={descripcion}
              onChange={(e) => setDescripcion(e.target.value)}
              rows={2}
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="flex flex-col gap-2">
              <Label htmlFor="art-estado">Estado</Label>
              <select
                id="art-estado"
                value={estado}
                onChange={(e) => setEstado(e.target.value as "ACTIVO" | "INACTIVO")}
                className="h-8 rounded-lg border border-input bg-transparent px-2.5 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 dark:bg-input/30"
              >
                <option value="ACTIVO">Activo</option>
                <option value="INACTIVO">Inactivo</option>
              </select>
            </div>
            <div className="flex flex-col gap-2">
              <Label htmlFor="art-lugar">Lugar</Label>
              <Input
                id="art-lugar"
                value={lugar}
                onChange={(e) => setLugar(e.target.value)}
                placeholder="Ubicación / depósito"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="flex flex-col gap-2">
              <Label htmlFor="art-cant">Cantidad en stock</Label>
              <Input
                id="art-cant"
                type="number"
                min="0"
                step="any"
                value={cantidadStock}
                onChange={(e) => setCantidadStock(e.target.value)}
              />
            </div>
            <div className="flex flex-col gap-2">
              <Label htmlFor="art-unidad">Unidad</Label>
              <Input
                id="art-unidad"
                value={unidadStock}
                onChange={(e) => setUnidadStock(e.target.value)}
                placeholder="UNI, M, KG..."
              />
            </div>
          </div>

          <div className="flex flex-col gap-2">
            <Label>Imagen</Label>
            <ImageUpload value={imagenUrl} onChange={setImagenUrl} />
          </div>

          {/* Alta espejada en Finnegans Go (solo al crear) */}
          {mode === "create" && (
            <div className="flex flex-col gap-3 rounded-lg border border-dashed p-3">
              <label htmlFor="art-push" className="flex items-center gap-2 text-sm font-medium">
                <input
                  id="art-push"
                  type="checkbox"
                  checked={pushFinnegans}
                  onChange={(e) => setPushFinnegans(e.target.checked)}
                  disabled={pending || enCurso}
                  className="size-4 rounded border-input accent-primary"
                />
                Cargar también en Finnegans Go
              </label>

              {pushFinnegans && (
                <div className="flex flex-col gap-2">
                  <Label htmlFor="art-fin-codigo">
                    Código de Finnegans <span className="text-destructive">*</span>
                  </Label>
                  <Input
                    id="art-fin-codigo"
                    value={finnegansCodigo}
                    onChange={(e) => setFinnegansCodigo(e.target.value)}
                    placeholder="Ej: N081032"
                    required
                    disabled={pending || enCurso}
                  />
                  <p className="text-xs text-muted-foreground">
                    Un bot de Playwright lo dará de alta en Finnegans Go al guardar. ¿Necesitás
                    rubro, marca o familia?{" "}
                    <Link href="/catalogo/altas/nuevo" className="underline underline-offset-2">
                      Usá el formulario completo
                    </Link>
                    .
                  </p>
                </div>
              )}

              <PushStatus estado={estadoPush} error={errorPush} compact />
            </div>
          )}

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              disabled={pending || enCurso}
            >
              {estadoPush === "SINCRONIZADO" || estadoPush === "ERROR" ? "Cerrar" : "Cancelar"}
            </Button>
            <Button type="submit" disabled={pending || enCurso || !!estadoPush}>
              {(pending || enCurso) && <Loader2 className="size-4 animate-spin" />}
              {mode === "create" ? "Crear" : "Guardar"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
