"use client";

import { AlertTriangle } from "lucide-react";
import { Button } from "@/components/ui/button";

// Error boundary global: cubre cualquier página que falle en el server
// (típicamente Postgres caído). Antes no existía y Next mostraba su pantalla
// genérica de error.
export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <main className="flex min-h-[60vh] flex-col items-center justify-center gap-4 p-8 text-center">
      <AlertTriangle className="size-10 text-amber-500" />
      <h1 className="text-xl font-semibold">Algo salió mal</h1>
      <p className="max-w-md text-sm text-muted-foreground">
        No se pudo cargar esta página. Si el problema persiste, revisá que la base
        de datos esté corriendo (<code className="font-mono">centralsm-db</code>).
      </p>
      {error.digest && (
        <p className="text-xs text-muted-foreground">Ref: {error.digest}</p>
      )}
      <Button onClick={reset} variant="outline">
        Reintentar
      </Button>
    </main>
  );
}
