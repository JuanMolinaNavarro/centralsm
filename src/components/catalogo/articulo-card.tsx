"use client";

import { useState } from "react";
import Link from "next/link";
import { FileText, Package, Pencil, Sparkles, Trash2 } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ArticuloFormDialog } from "@/components/catalogo/articulo-form-dialog";
import { ConfirmDialog } from "@/components/catalogo/confirm-dialog";
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
};

export function ArticuloCard({ producto }: { producto: ArticuloCardData }) {
  const [editOpen, setEditOpen] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);

  return (
    <>
      <div className="group relative flex flex-col overflow-hidden rounded-xl border bg-card transition-colors hover:border-foreground/20">
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
              <Badge variant={producto.estado === "ACTIVO" ? "default" : "outline"}>
                {producto.estado === "ACTIVO" ? "Activo" : "Inactivo"}
              </Badge>
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
