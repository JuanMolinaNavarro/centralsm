"use client";

import { useState } from "react";
import { Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ArticuloFormDialog } from "@/components/catalogo/articulo-form-dialog";

type Props = {
  categoriaId: string;
  categoriaSku: string;
  tile?: boolean;
};

export function NuevoArticulo({ categoriaId, categoriaSku, tile }: Props) {
  const [open, setOpen] = useState(false);

  return (
    <>
      {tile ? (
        <button
          type="button"
          onClick={() => setOpen(true)}
          className="flex min-h-40 flex-col items-center justify-center gap-2 rounded-xl border border-dashed text-muted-foreground transition-colors hover:border-foreground/30 hover:text-foreground"
        >
          <Plus className="size-5" />
          <span className="text-sm">Nuevo artículo</span>
        </button>
      ) : (
        <Button variant="outline" onClick={() => setOpen(true)}>
          <Plus className="size-4" /> Nuevo artículo
        </Button>
      )}

      <ArticuloFormDialog
        open={open}
        onOpenChange={setOpen}
        mode="create"
        categoriaId={categoriaId}
        categoriaSku={categoriaSku}
      />
    </>
  );
}
