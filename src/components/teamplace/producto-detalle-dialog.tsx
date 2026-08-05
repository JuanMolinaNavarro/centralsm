"use client";

import { useEffect, useState } from "react";
import { Loader2 } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

type Props = {
  codigo: string | null;
  onOpenChange: (open: boolean) => void;
};

function renderValor(valor: unknown) {
  if (valor === null || valor === undefined || valor === "") {
    return <span className="text-muted-foreground">—</span>;
  }
  if (typeof valor === "boolean") {
    return valor ? "Sí" : "No";
  }
  if (typeof valor === "object") {
    return (
      <pre className="max-h-48 overflow-auto rounded-md bg-muted p-2 text-xs">
        {JSON.stringify(valor, null, 2)}
      </pre>
    );
  }
  return String(valor);
}

export function ProductoDetalleDialog({ codigo, onOpenChange }: Props) {
  const [data, setData] = useState<Record<string, unknown> | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!codigo) return;
    setData(null);
    setError(null);
    setLoading(true);
    fetch(`/api/teamplace/producto/${encodeURIComponent(codigo)}`)
      .then(async (res) => {
        const json = await res.json();
        if (!res.ok) throw new Error(json.error ?? "Error al consultar Teamplace.");
        return json;
      })
      .then((json) => setData(json))
      .catch((e) => setError(e instanceof Error ? e.message : "Error"))
      .finally(() => setLoading(false));
  }, [codigo]);

  const campos = data ? Object.entries(data) : [];

  return (
    <Dialog open={codigo !== null} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[85vh] overflow-y-auto sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle className="font-mono">{codigo}</DialogTitle>
          <DialogDescription>
            Todos los campos del producto en Teamplace (ProductoVO).
          </DialogDescription>
        </DialogHeader>

        {loading && (
          <div className="flex items-center gap-2 py-8 text-sm text-muted-foreground">
            <Loader2 className="size-4 animate-spin" /> Cargando…
          </div>
        )}
        {error && <p className="py-4 text-sm text-destructive">{error}</p>}

        {data && (
          <dl className="divide-y text-sm">
            {campos.map(([clave, valor]) => (
              <div key={clave} className="grid grid-cols-1 gap-1 py-2 sm:grid-cols-[220px_1fr] sm:gap-4">
                <dt className="font-medium text-muted-foreground">{clave}</dt>
                <dd className="break-words">{renderValor(valor)}</dd>
              </div>
            ))}
          </dl>
        )}
      </DialogContent>
    </Dialog>
  );
}
