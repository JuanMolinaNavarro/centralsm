"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { Loader2, RotateCw } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { reintentarPush } from "@/app/productos/actions";

/** Relanza el bot de Playwright para un producto que quedó en ERROR. */
export function ReintentarPush({ productoId }: { productoId: string }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  function handleClick() {
    startTransition(async () => {
      const res = await reintentarPush(productoId);
      if (res.ok) {
        toast.success("Reintentando la carga en Finnegans Go…");
        router.refresh();
      } else {
        toast.error(res.error);
      }
    });
  }

  return (
    <Button size="sm" variant="outline" onClick={handleClick} disabled={pending}>
      {pending ? <Loader2 className="size-3.5 animate-spin" /> : <RotateCw className="size-3.5" />}
      Reintentar
    </Button>
  );
}
