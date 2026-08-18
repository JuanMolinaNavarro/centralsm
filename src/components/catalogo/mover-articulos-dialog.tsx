"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { CategoriaPicker } from "@/components/catalogo/categoria-picker";
import { deshacerMovida, moverProductos, type MoverResult } from "@/app/catalogo/actions";
import type { CategoriaPlana } from "@/lib/catalogo-tipos";

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Ids de los artículos a mover. */
  ids: string[];
  /** Categorías actuales de esos artículos (se marcan en el selector). */
  actualesIds?: string[];
  /** Descripción para el título: nombre del artículo o "N artículos". */
  etiqueta?: string;
  categorias?: CategoriaPlana[];
  onMoved?: (res: Extract<MoverResult, { ok: true }>) => void;
};

/**
 * Elegir una categoría destino y mover ahí los artículos indicados.
 * Al terminar muestra un toast con la opción de deshacer.
 */
export function MoverArticulosDialog({
  open,
  onOpenChange,
  ids,
  actualesIds,
  etiqueta,
  categorias,
  onMoved,
}: Props) {
  const router = useRouter();
  const [pending, setPending] = useState(false);

  const cuantos = ids.length;
  const que = etiqueta ?? (cuantos === 1 ? "1 artículo" : `${cuantos} artículos`);

  async function handleSelect(cat: CategoriaPlana) {
    setPending(true);
    try {
      const res = await moverProductos(ids, cat.id);
      if (!res.ok) {
        toast.error(res.error);
        return;
      }
      onOpenChange(false);
      const destinoTexto = [...cat.ruta, cat.nombre].join(" › ");
      if (res.movidos === 0) {
        toast.info(`Ya estaba${cuantos === 1 ? "" : "n"} en ${destinoTexto}.`);
      } else {
        toast.success(
          `${res.movidos === 1 ? "1 artículo movido" : `${res.movidos} artículos movidos`} a ${destinoTexto}`,
          {
            duration: 8000,
            action: {
              label: "Deshacer",
              onClick: async () => {
                const undo = await deshacerMovida(res.anterior);
                if (undo.ok) toast.success("Movida deshecha");
                else toast.error(undo.error);
                router.refresh();
              },
            },
          },
        );
      }
      onMoved?.(res);
      router.refresh();
    } finally {
      setPending(false);
    }
  }

  return (
    <CategoriaPicker
      open={open}
      onOpenChange={onOpenChange}
      titulo={`Mover ${que} a…`}
      descripcion="Elegí la categoría destino. El SKU se regenera con el correlativo de la nueva categoría."
      categorias={categorias}
      actualesIds={actualesIds}
      onSelect={handleSelect}
      pending={pending}
    />
  );
}
