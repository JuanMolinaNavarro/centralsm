import { AlertTriangle } from "lucide-react";
import { listarProductos } from "@/lib/teamplace";
import { TeamplaceExplorer } from "@/components/teamplace/teamplace-explorer";
import type { ProductoResumen } from "@/components/teamplace/productos-table";

export const dynamic = "force-dynamic";

export default async function TeamplacePage() {
  let productos: ProductoResumen[] = [];
  let error: string | null = null;
  try {
    productos = await listarProductos();
  } catch (e) {
    error = e instanceof Error ? e.message : "No se pudo conectar con Teamplace.";
  }

  return (
    <main className="mx-auto w-full max-w-6xl flex-1 px-6 py-10">
      <div className="mb-6">
        <h1 className="text-2xl font-semibold tracking-tight">Teamplace</h1>
        <p className="text-sm text-muted-foreground">
          Explorá productos y stock directamente desde la API de Finnegans.
        </p>
      </div>

      {error ? (
        <div className="flex items-start gap-3 rounded-lg border border-destructive/30 bg-destructive/5 p-4 text-sm">
          <AlertTriangle className="mt-0.5 size-5 shrink-0 text-destructive" />
          <div>
            <p className="font-medium text-destructive">No se pudo conectar con Teamplace</p>
            <p className="text-muted-foreground">{error}</p>
            <p className="mt-1 text-muted-foreground">
              Verificá <code>TEAMPLACE_CLIENT_ID</code> / <code>TEAMPLACE_CLIENT_SECRET</code> en el
              entorno. Si estás en Docker, recreá el contenedor para tomar las variables.
            </p>
          </div>
        </div>
      ) : (
        <TeamplaceExplorer productos={productos} />
      )}
    </main>
  );
}
