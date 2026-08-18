"use client";

import { useState } from "react";
import Link from "next/link";
import { ArrowRightLeft, BadgeAlert, FileText, Package, Pencil, Sparkles, Trash2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ArticuloFormDialog } from "@/components/catalogo/articulo-form-dialog";
import { ConfirmDialog } from "@/components/catalogo/confirm-dialog";
import { MoverArticulosDialog } from "@/components/catalogo/mover-articulos-dialog";
import { eliminarProducto } from "@/app/catalogo/actions";

export type ArticuloCardData = {
  id: string;
  categoriaId: string;
  categoriaSku: string;
  nombre: string;
  descripcion: string | null;
  codigoSku: string;
  estado: "ACTIVO" | "INACTIVO";
  cantidadStock: number;
  unidadStock: string;
  lugar: string | null;
  imagenUrl: string | null;
  esNuevo?: boolean;
  /** Se asignó a la categoría después de la última verificación de ésta. */
  postVerificacion?: boolean;
};

export function ArticuloCard({ producto }: { producto: ArticuloCardData }) {
  const [editOpen, setEditOpen] = useState(false);
  const [moverOpen, setMoverOpen] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const sinStock = producto.cantidadStock <= 0;

  return (
    <>
      <div
        className={cn(
          "group relative flex flex-col overflow-hidden rounded-xl border bg-card transition-colors hover:border-foreground/20",
          sinStock && "opacity-60 grayscale hover:opacity-100 hover:grayscale-0",
        )}
      >
        <Link href={`/catalogo/articulo/${producto.id}`} className="flex flex-1 flex-col">
          <div className="flex aspect-[16/7] items-center justify-center bg-muted">
            {producto.imagenUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={producto.imagenUrl} alt={producto.nombre} className="size-full object-cover" />
            ) : (
              <Package className="size-7 text-muted-foreground/40" />
            )}
            {producto.esNuevo && (
              <Badge className="absolute top-2 left-2 gap-1">
                <Sparkles className="size-3" /> Nuevo
              </Badge>
            )}
            {producto.postVerificacion && (
              <Badge
                variant="outline"
                className="absolute bottom-2 left-2 gap-1 border-amber-500/50 bg-background/90 text-amber-700 dark:text-amber-400"
                title="Asignado a esta categoría después de la última verificación"
              >
                <BadgeAlert className="size-3" /> Nuevo desde verificación
              </Badge>
            )}
          </div>
          <div className="flex flex-1 flex-col gap-2 p-4">
            <div className="flex items-start gap-2">
              <FileText className="mt-0.5 size-4 shrink-0 text-muted-foreground" />
              <h3 className="font-medium leading-tight">{producto.nombre}</h3>
            </div>
            <div className="mt-auto flex flex-wrap items-center gap-2 pt-2">
              <Badge variant="secondary" className="font-mono">
                {producto.codigoSku}
              </Badge>
              {sinStock ? (
                <Badge variant="outline">Sin stock</Badge>
              ) : (
                <Badge variant={producto.estado === "ACTIVO" ? "default" : "outline"}>
                  {producto.estado === "ACTIVO" ? "Activo" : "Inactivo"}
                </Badge>
              )}
              <span className="text-xs text-muted-foreground">
                {producto.cantidadStock} {producto.unidadStock}
              </span>
            </div>
          </div>
        </Link>

        <div className="absolute top-2 right-2 flex gap-1 opacity-0 transition-opacity group-hover:opacity-100">
          <Button
            size="icon-sm"
            variant="secondary"
            onClick={() => setMoverOpen(true)}
            aria-label="Mover de categoría"
            title="Mover de categoría"
          >
            <ArrowRightLeft className="size-3.5" />
          </Button>
          <Button
            size="icon-sm"
            variant="secondary"
            onClick={() => setEditOpen(true)}
            aria-label="Editar"
          >
            <Pencil className="size-3.5" />
          </Button>
          <Button
            size="icon-sm"
            variant="secondary"
            onClick={() => setDeleteOpen(true)}
            aria-label="Eliminar"
          >
            <Trash2 className="size-3.5" />
          </Button>
        </div>
      </div>

      <ArticuloFormDialog
        open={editOpen}
        onOpenChange={setEditOpen}
        mode="edit"
        categoriaId={producto.categoriaId}
        categoriaSku={producto.categoriaSku}
        producto={{
          id: producto.id,
          nombre: producto.nombre,
          descripcion: producto.descripcion,
          estado: producto.estado,
          cantidadStock: producto.cantidadStock,
          unidadStock: producto.unidadStock,
          lugar: producto.lugar,
          imagenUrl: producto.imagenUrl,
        }}
      />
      <MoverArticulosDialog
        open={moverOpen}
        onOpenChange={setMoverOpen}
        ids={[producto.id]}
        actualesIds={[producto.categoriaId]}
        etiqueta={`«${producto.nombre}»`}
      />
      <ConfirmDialog
        open={deleteOpen}
        onOpenChange={setDeleteOpen}
        title={`Eliminar "${producto.nombre}"`}
        description="Esta acción no se puede deshacer."
        action={() => eliminarProducto(producto.id)}
      />
    </>
  );
}
