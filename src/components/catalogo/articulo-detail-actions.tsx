"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Pencil, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ArticuloFormDialog } from "@/components/catalogo/articulo-form-dialog";
import { ConfirmDialog } from "@/components/catalogo/confirm-dialog";
import { eliminarProducto } from "@/app/catalogo/actions";

type Props = {
  producto: {
    id: string;
    categoriaId: string;
    nombre: string;
    descripcion: string | null;
    estado: "ACTIVO" | "INACTIVO";
    cantidadStock: number;
    unidadStock: string;
    lugar: string | null;
    imagenUrl: string | null;
  };
  categoriaSku: string;
};

export function ArticuloDetailActions({ producto, categoriaSku }: Props) {
  const router = useRouter();
  const [editOpen, setEditOpen] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);

  return (
    <>
      <div className="flex gap-2">
        <Button variant="outline" onClick={() => setEditOpen(true)}>
          <Pencil className="size-4" /> Editar
        </Button>
        <Button variant="outline" onClick={() => setDeleteOpen(true)}>
          <Trash2 className="size-4" /> Eliminar
        </Button>
      </div>

      <ArticuloFormDialog
        open={editOpen}
        onOpenChange={setEditOpen}
        mode="edit"
        categoriaId={producto.categoriaId}
        categoriaSku={categoriaSku}
        producto={producto}
      />
      <ConfirmDialog
        open={deleteOpen}
        onOpenChange={setDeleteOpen}
        title={`Eliminar "${producto.nombre}"`}
        description="Esta acción no se puede deshacer."
        action={() => eliminarProducto(producto.id)}
        onDone={() => router.push(`/catalogo/${producto.categoriaId}`)}
      />
    </>
  );
}
