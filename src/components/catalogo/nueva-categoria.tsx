"use client";

import { useState } from "react";
import { Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { CategoriaFormDialog } from "@/components/catalogo/categoria-form-dialog";

type Props = {
  parentId?: string | null;
  parentSku?: string | null;
  esMacro?: boolean;
  /** Si es true, se muestra como tile punteado dentro del grid. */
  tile?: boolean;
};

export function NuevaCategoria({ parentId = null, parentSku = null, esMacro = false, tile }: Props) {
  const [open, setOpen] = useState(false);
  const label = esMacro ? "Nueva categoría" : "Nueva subcategoría";

  return (
    <>
      {tile ? (
        <button
          type="button"
          onClick={() => setOpen(true)}
          className="flex min-h-40 flex-col items-center justify-center gap-2 rounded-xl border border-dashed text-muted-foreground transition-colors hover:border-foreground/30 hover:text-foreground"
        >
          <Plus className="size-5" />
          <span className="text-sm">{label}</span>
        </button>
      ) : (
        <Button onClick={() => setOpen(true)}>
          <Plus className="size-4" /> {label}
        </Button>
      )}

      <CategoriaFormDialog
        open={open}
        onOpenChange={setOpen}
        mode="create"
        parentId={parentId}
        parentSku={parentSku}
        esMacro={esMacro}
      />
    </>
  );
}
