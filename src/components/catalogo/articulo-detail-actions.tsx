"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowRightLeft, Pencil, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ArticuloFormDialog } from "@/components/catalogo/articulo-form-dialog";
import { ConfirmDialog } from "@/components/catalogo/confirm-dialog";
import { MoverArticulosDialog } from "@/components/catalogo/mover-articulos-dialog";
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
  const [moverOpen, setMoverOpen] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);

  return (
    <>
      {/* Sin contenedor propio: los botones se alinean con los del padre. */}
      <Button variant="outline" onClick={() => setMoverOpen(true)}>
        <ArrowRightLeft className="size-4" /> Mover de categoría
      </Button>
      <Button variant="outline" onClick={() => setEditOpen(true)}>
        <Pencil className="size-4" /> Editar
      </Button>
      <Button variant="outline" onClick={() => setDeleteOpen(true)}>
        <Trash2 className="size-4" /> Eliminar
      </Button>

      <ArticuloFormDialog
        open={editOpen}
        onOpenChange={setEditOpen}
        mode="edit"
        categoriaId={producto.categoriaId}
        categoriaSku={categoriaSku}
        producto={producto}
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
        onDone={() => router.push(`/catalogo/${producto.categoriaId}`)}
      />
    </>
  );
}
