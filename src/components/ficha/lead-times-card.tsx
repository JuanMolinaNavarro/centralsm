"use client";

// Historial de lead times reales (días entre emisión de la orden y recepción).
// El promedio y el desvío se derivan de acá: nunca se tipean. En la versión
// final, cada recepción de orden de compra registrará el suyo automáticamente.

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Plus } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { agregarLeadTime, eliminarLeadTime } from "@/app/catalogo/articulo/[id]/ficha/actions";
import type { FichaData } from "@/lib/ficha-data";
import { nf } from "./constantes";

export function LeadTimesCard({ data }: { data: FichaData }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [dias, setDias] = useState("");
  const productoId = data.producto.id;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-sm uppercase tracking-wide text-primary">Lead time del proveedor</CardTitle>
        <CardDescription>
          Días entre emisión de la orden y recepción, una entrada por recepción real. El promedio y el
          desvío salen de este historial y alimentan el colchón de seguridad — sin desvío no hay colchón
          defendible.
        </CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-4">
        <div className="flex flex-wrap items-center gap-2">
          {data.leadTimes.map((l) => (
            <span key={l.id} className="inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 font-mono text-xs">
              {l.dias} d
              <button
                type="button"
                aria-label={`Eliminar registro de ${l.dias} días`}
                className="text-muted-foreground hover:text-destructive"
                onClick={() =>
                  startTransition(async () => {
                    const res = await eliminarLeadTime(productoId, l.id);
                    if (res.ok) router.refresh();
                    else toast.error(res.error);
                  })
                }
              >
                ✕
              </button>
            </span>
          ))}
          {data.leadTimes.length === 0 && (
            <span className="text-xs text-muted-foreground">Sin recepciones registradas.</span>
          )}
        </div>

        <div className="flex flex-wrap items-end gap-2">
          <div className="flex flex-col gap-1">
            <Label className="font-mono text-[11px] uppercase">Días de la recepción</Label>
            <Input type="number" min="1" className="w-36" value={dias} onChange={(e) => setDias(e.target.value)} />
          </div>
          <Button
            variant="outline"
            size="sm"
            disabled={pending || !dias}
            onClick={() =>
              startTransition(async () => {
                const res = await agregarLeadTime(productoId, Number(dias));
                if (res.ok) {
                  setDias("");
                  router.refresh();
                } else {
                  toast.error(res.error);
                }
              })
            }
          >
            <Plus className="size-3.5" /> Registrar
          </Button>
        </div>

        <div className="flex gap-6 rounded-lg border bg-muted/30 px-4 py-3 text-sm">
          <div>
            <div className="font-mono text-[11px] uppercase text-muted-foreground">Lead time medio</div>
            <div className="font-mono text-lg font-semibold">
              {data.ltMedio !== null ? `${nf(data.ltMedio)} días` : "—"}
            </div>
          </div>
          <div>
            <div className="font-mono text-[11px] uppercase text-muted-foreground">Desvío</div>
            <div className="font-mono text-lg font-semibold">
              {data.ltDesvio !== null ? `${nf(data.ltDesvio)} días` : "—"}
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
