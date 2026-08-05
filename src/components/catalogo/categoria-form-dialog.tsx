"use client";

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
import { buildCategoriaSku, normalizarSegmento } from "@/lib/sku";
import { crearCategoria, actualizarCategoria } from "@/app/catalogo/actions";

type CategoriaData = {
  id: string;
  nombre: string;
  descripcion: string | null;
  segmento: string;
  imagenUrl: string | null;
};

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  mode: "create" | "edit";
  /** Para crear: padre (null = categoría macro). */
  parentId?: string | null;
  /** SKU del padre, para la vista previa del código. */
  parentSku?: string | null;
  categoria?: CategoriaData;
  esMacro?: boolean;
};

export function CategoriaFormDialog({
  open,
  onOpenChange,
  mode,
  parentId = null,
  parentSku = null,
  categoria,
  esMacro = false,
}: Props) {
  const [nombre, setNombre] = useState("");
  const [segmento, setSegmento] = useState("");
  const [descripcion, setDescripcion] = useState("");
  const [imagenUrl, setImagenUrl] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  useEffect(() => {
    if (open) {
      setNombre(categoria?.nombre ?? "");
      setSegmento(categoria?.segmento ?? "");
      setDescripcion(categoria?.descripcion ?? "");
      setImagenUrl(categoria?.imagenUrl ?? null);
    }
  }, [open, categoria]);

  let preview = "—";
  try {
    if (normalizarSegmento(segmento)) {
      preview = buildCategoriaSku(parentSku, segmento);
    }
  } catch {
    preview = "—";
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    startTransition(async () => {
      const payload = { nombre, segmento, descripcion, imagenUrl };
      const res =
        mode === "create"
          ? await crearCategoria({ ...payload, parentId })
          : await actualizarCategoria(categoria!.id, payload);
      if (res.ok) {
        toast.success(mode === "create" ? "Categoría creada" : "Categoría actualizada");
        onOpenChange(false);
      } else {
        toast.error(res.error);
      }
    });
  }

  const titulo =
    mode === "create"
      ? esMacro
        ? "Nueva categoría macro"
        : "Nueva subcategoría"
      : "Editar categoría";

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{titulo}</DialogTitle>
          <DialogDescription>
            El segmento se suma al SKU del padre para formar el código.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          <div className="flex flex-col gap-2">
            <Label htmlFor="cat-nombre">Nombre</Label>
            <Input
              id="cat-nombre"
              value={nombre}
              onChange={(e) => setNombre(e.target.value)}
              placeholder="Ej: Cables y Fibra"
              required
            />
          </div>

          <div className="flex flex-col gap-2">
            <Label htmlFor="cat-segmento">Segmento del SKU</Label>
            <Input
              id="cat-segmento"
              value={segmento}
              onChange={(e) => setSegmento(e.target.value)}
              placeholder={esMacro ? "Ej: IR" : "Ej: 1 o ADS"}
              required
            />
            <p className="text-xs text-muted-foreground">
              Código resultante: <span className="font-mono text-foreground">{preview}</span>
            </p>
          </div>

          <div className="flex flex-col gap-2">
            <Label htmlFor="cat-desc">Breve descripción</Label>
            <Textarea
              id="cat-desc"
              value={descripcion}
              onChange={(e) => setDescripcion(e.target.value)}
              placeholder="Qué incluye esta categoría"
              rows={3}
            />
          </div>

          <div className="flex flex-col gap-2">
            <Label>Imagen</Label>
            <ImageUpload value={imagenUrl} onChange={setImagenUrl} />
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)} disabled={pending}>
              Cancelar
            </Button>
            <Button type="submit" disabled={pending}>
              {pending && <Loader2 className="size-4 animate-spin" />}
              {mode === "create" ? "Crear" : "Guardar"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
