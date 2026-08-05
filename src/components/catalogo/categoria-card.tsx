"use client";

import { useState } from "react";
import Link from "next/link";
import { FileText, FolderTree, Package, Pencil, Trash2 } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { CategoriaFormDialog } from "@/components/catalogo/categoria-form-dialog";
import { ConfirmDialog } from "@/components/catalogo/confirm-dialog";
import { eliminarCategoria } from "@/app/catalogo/actions";

export type CategoriaCardData = {
  id: string;
  nombre: string;
  descripcion: string | null;
  segmento: string;
  codigoSku: string;
  imagenUrl: string | null;
  childrenCount: number;
  productosCount: number;
  parentSku: string | null;
};

export function CategoriaCard({ categoria }: { categoria: CategoriaCardData }) {
  const [editOpen, setEditOpen] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);

  return (
    <>
      <div className="group relative flex flex-col overflow-hidden rounded-xl border bg-card transition-colors hover:border-foreground/20">
        <Link href={`/catalogo/${categoria.id}`} className="flex flex-1 flex-col">
          <div className="flex aspect-[16/7] items-center justify-center bg-muted">
            {categoria.imagenUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={categoria.imagenUrl} alt={categoria.nombre} className="size-full object-cover" />
            ) : (
              <FolderTree className="size-7 text-muted-foreground/40" />
            )}
          </div>
          <div className="flex flex-1 flex-col gap-2 p-4">
            <div className="flex items-start gap-2">
              <FileText className="mt-0.5 size-4 shrink-0 text-muted-foreground" />
              <h3 className="font-medium leading-tight">{categoria.nombre}</h3>
            </div>
            {categoria.descripcion && (
              <p className="line-clamp-3 text-sm text-muted-foreground">{categoria.descripcion}</p>
            )}
            <div className="mt-auto flex items-center gap-3 pt-2">
              <Badge variant="secondary" className="font-mono">
                {categoria.codigoSku}
              </Badge>
              {categoria.childrenCount > 0 && (
                <span className="flex items-center gap-1 text-xs text-muted-foreground">
                  <FolderTree className="size-3.5" /> {categoria.childrenCount}
                </span>
              )}
              {categoria.productosCount > 0 && (
                <span className="flex items-center gap-1 text-xs text-muted-foreground">
                  <Package className="size-3.5" /> {categoria.productosCount}
                </span>
              )}
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

      <CategoriaFormDialog
        open={editOpen}
        onOpenChange={setEditOpen}
        mode="edit"
        parentSku={categoria.parentSku}
        categoria={{
          id: categoria.id,
          nombre: categoria.nombre,
          descripcion: categoria.descripcion,
          segmento: categoria.segmento,
          imagenUrl: categoria.imagenUrl,
        }}
      />
      <ConfirmDialog
        open={deleteOpen}
        onOpenChange={setDeleteOpen}
        title={`Eliminar "${categoria.nombre}"`}
        description="Se eliminarán también sus subcategorías y artículos. Esta acción no se puede deshacer."
        action={() => eliminarCategoria(categoria.id)}
      />
    </>
  );
}
